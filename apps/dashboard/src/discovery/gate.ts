import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { evaluateWebsiteEligibility } from '../../../collector/src/utils/evaluateWebsiteEligibility.js';
import { normalizeWebsiteDomain } from '../../../collector/src/utils/normalizeWebsiteDomain.js';
import { canonicalizeWebsite } from '../../../collector/src/utils/canonicalizeWebsite.js';
import { classifyWebsiteOwnership } from '../../../collector/src/utils/websiteOwnershipClassifier.js';
import { enrichCandidateWebsite, type CandidateEnrichmentResult, type EnrichmentAttempt } from '../../../collector/src/enrichment/enrichCandidate.js';
import type { EnrichmentSubject } from '../../../collector/src/enrichment/types.js';
import { classifyRelevance } from './relevance.js';
import { semanticRelevance } from './semantic.js';

export interface DiscoveryCandidateInput {
  source: string;
  sourceId?: string;
  companyName: string;
  city?: string;
  address?: string | null;
  categories?: string[];
  phone?: string | null;
  website?: string | null;
  sourceUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export type CandidateEnricher = (input: { subject: EnrichmentSubject }) => Promise<CandidateEnrichmentResult>;

interface ProcessedLead {
  id: string;
  isNew: boolean;
  canonicalDomain: string | null;
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Non-company website kinds share the SITE_KIND_* reason namespace; the
// run-level breakdown buckets them under the spec names.
const KIND_FOLD: Record<string, string> = { DIRECTORY: 'AGGREGATOR', SOCIAL_NETWORK: 'SOCIAL' };
function siteKindReason(kind: string): string {
  return `SITE_KIND_${KIND_FOLD[kind] ?? kind}`;
}

const AGGREGATOR_KINDS = new Set(['AGGREGATOR', 'MARKETPLACE', 'MAP_PROVIDER']);

export function bucketReason(reason: string | null | undefined, decision: string): string | null {
  if (!reason) return null;
  if (decision === 'ACCEPT') {
    if (reason === 'WEBSITE_FROM_PROVIDER' || reason === 'WEBSITE_FROM_ENRICHMENT') return reason;
    return 'ACCEPTED';
  }
  if (reason === 'NO_WEBSITE' || reason === 'NO_WEBSITE_AFTER_ENRICHMENT') return 'NO_WEBSITE_AFTER_ENRICHMENT';
  if (reason.startsWith('SITE_KIND_')) {
    const kind = reason.slice('SITE_KIND_'.length);
    if (AGGREGATOR_KINDS.has(kind)) return 'SITE_KIND_AGGREGATOR';
    if (kind === 'SOCIAL') return 'SITE_KIND_SOCIAL';
    return reason;
  }
  if (reason.startsWith('DUPLICATE')) return reason;
  if (reason === 'IRRELEVANT' || reason.startsWith('IRRELEVANT') || reason.startsWith('UNCERTAIN')) return 'IRRELEVANT';
  return reason;
}

export class DiscoveryGatingService {
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private env: Record<string, string | undefined>;
  private enricher: CandidateEnricher;

  constructor(input: { prisma: PrismaClient; logger: pino.Logger; env: Record<string, string | undefined>; enricher?: CandidateEnricher }) {
    this.prisma = input.prisma;
    this.logger = input.logger;
    this.env = input.env;
    this.enricher = input.enricher ?? (({ subject }) => enrichCandidateWebsite({ subject, env: this.env, logger: this.logger }));
  }

  async process(run: { id: string; query: string; intent?: string | null }, candidates: DiscoveryCandidateInput[]) {
    const acceptedLeads: ProcessedLead[] = [];
    const seenCanonicalDomains = new Map<string, string>();
    const seenOrgs = new Map<string, string>();
    const reasonBreakdown: Record<string, number> = {};

    let created = 0;
    let duplicates = 0;
    let rejected = 0;
    let uncertain = 0;

    const bump = (reason: string | null | undefined, decision: string) => {
      const b = bucketReason(reason, decision);
      if (b) reasonBreakdown[b] = (reasonBreakdown[b] ?? 0) + 1;
    };

    for (const candidate of candidates) {
      const result = await this.evaluateCandidate(candidate, run, seenCanonicalDomains, seenOrgs);
      bump(result.reason, result.decision);

      await this.prisma.discoveryCandidate.create({
        data: {
          runId: run.id,
          source: candidate.source,
          sourceId: candidate.sourceId,
          companyName: candidate.companyName,
          website: candidate.website,
          canonicalUrl: result.canonicalUrl,
          canonicalDomain: result.canonicalDomain,
          registrableDomain: result.canonicalDomain,
          websiteDomain: result.canonicalDomain,
          address: candidate.address,
          phone: candidate.phone,
          categories: candidate.categories ?? [],
          latitude: candidate.latitude ?? null,
          longitude: candidate.longitude ?? null,
          sourceUrl: candidate.sourceUrl,
          decision: result.decision,
          reason: result.reason,
          confidence: result.confidence,
          matchedConcepts: result.matchedConcepts,
          leadId: result.leadId ?? null,
          websiteSource: result.websiteSource ?? null,
          enrichmentAttempts: result.enrichmentAttempts as any,
        },
      });

      if (result.leadId && !result.leadExists) {
        acceptedLeads.push({ id: result.leadId, isNew: true, canonicalDomain: result.canonicalDomain });
        created++;
      } else if (result.leadId) {
        acceptedLeads.push({ id: result.leadId, isNew: false, canonicalDomain: result.canonicalDomain });
        duplicates++;
      } else if (result.decision === 'UNCERTAIN') {
        uncertain++;
      } else {
        rejected++;
      }
    }

    const leadIds = acceptedLeads.filter((l) => l.isNew).map((l) => l.id);
    const newLeadIds = [...leadIds];
    reasonBreakdown.ACCEPTED = created;

    await this.prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        collected: candidates.length,
        leadIds: newLeadIds,
        createdCount: created,
        duplicateCount: duplicates,
        rejectedCount: rejected,
        uncertainCount: uncertain,
        reasonBreakdown: reasonBreakdown as any,
      },
    });

    for (const lead of acceptedLeads.filter((l) => l.isNew)) {
      await this.prisma.leadQuery.upsert({
        where: { leadId_query: { leadId: lead.id, query: run.query } },
        create: { leadId: lead.id, query: run.query },
        update: {},
      });
    }

    this.logger.info({ runId: run.id, collected: candidates.length, created, duplicates, rejected, uncertain, reasonBreakdown }, 'discovery.gate.complete');
    return { leadIds: newLeadIds, created, duplicates, rejected, uncertain, reasonBreakdown };
  }

  /**
   * Order (V3.7.5): provider website → deterministic website enrichment when
   * absent → eligibility → ownership → relevance → dedup → create lead.
   * A missing provider website is PENDING_WEBSITE_ENRICHMENT, never a final
   * reject — NO_WEBSITE_AFTER_ENRICHMENT only after every provider is spent.
   * Leads are created only for confirmed direct-company websites.
   */
  private async evaluateCandidate(
    candidate: DiscoveryCandidateInput,
    run: { id: string; query: string; intent?: string | null },
    seenCanonicalDomains: Map<string, string>,
    seenOrgs: Map<string, string>
  ): Promise<{
    decision: 'ACCEPT' | 'REJECT' | 'UNCERTAIN';
    reason: string;
    matchedConcepts: string[];
    confidence: number;
    canonicalUrl: string | null;
    canonicalDomain: string | null;
    websiteSource?: 'provider' | 'enrichment';
    enrichmentAttempts?: EnrichmentAttempt[];
    leadId?: string;
    leadExists?: boolean;
  }> {
    let website = candidate.website?.trim() || null;
    let websiteSource: 'provider' | 'enrichment' | undefined = website ? 'provider' : undefined;
    let enrichmentAttempts: EnrichmentAttempt[] = [];

    // ---- website resolution -------------------------------------------------
    if (!website) {
      const enriched = await this.enricher({
        subject: {
          companyName: candidate.companyName,
          city: candidate.city ?? null,
          address: candidate.address ?? null,
          latitude: candidate.latitude ?? null,
          longitude: candidate.longitude ?? null,
        },
      });
      enrichmentAttempts = enriched.attempts;
      if (enriched.website) {
        website = enriched.website;
        websiteSource = 'enrichment';
        if (enriched.phone && !candidate.phone) candidate = { ...candidate, phone: enriched.phone };
      } else {
        return {
          decision: 'REJECT',
          reason: 'NO_WEBSITE_AFTER_ENRICHMENT',
          matchedConcepts: enrichmentAttempts.map((a) => `${a.provider}:${a.decision}`),
          confidence: 1,
          canonicalUrl: null,
          canonicalDomain: null,
          enrichmentAttempts,
        };
      }
    }

    // ---- eligibility (aggregators/maps/social never pass) -------------------
    const eligibility = evaluateWebsiteEligibility(website);
    if (!eligibility.eligible) {
      return {
        decision: 'REJECT',
        reason: siteKindReason(eligibility.reason || 'OTHER_NON_COMPANY_SITE'),
        matchedConcepts: eligibility.matchedRule ? [eligibility.matchedRule] : [],
        confidence: 1,
        canonicalUrl: eligibility.canonicalUrl,
        canonicalDomain: eligibility.canonicalDomain,
        websiteSource,
        enrichmentAttempts,
      };
    }

    const cw = canonicalizeWebsite(website);
    const canonicalDomain = cw.domainKey || eligibility.canonicalDomain;
    const canonicalUrl = cw.canonicalUrl || eligibility.canonicalUrl;

    // ---- ownership: only direct company sites become leads ------------------
    const ownership = classifyWebsiteOwnership({
      url: website,
      companyName: candidate.companyName,
    });
    if (ownership.decision !== 'DIRECT_COMPANY_SITE' && ownership.decision !== 'UNCERTAIN') {
      return {
        decision: 'REJECT',
        reason: siteKindReason(ownership.decision),
        matchedConcepts: ownership.matchedSignals,
        confidence: ownership.confidence,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
      };
    }

    // ---- relevance -----------------------------------------------------------
    const cheap = classifyRelevance(candidate, run.intent ?? undefined, run.query);
    let finalDecision: 'ACCEPT' | 'REJECT' | 'UNCERTAIN' = cheap.decision;
    let finalReason = cheap.reason;
    let finalMatched = cheap.matchedConcepts;
    let finalConfidence = cheap.confidence;

    if (cheap.decision === 'REJECT') {
      return {
        decision: 'REJECT',
        reason: cheap.reason,
        matchedConcepts: cheap.matchedConcepts,
        confidence: cheap.confidence,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
      };
    }

    if (cheap.decision === 'UNCERTAIN') {
      const semantic = await semanticRelevance(candidate, run.intent ?? undefined, run.query, this.env.GEMINI_API_KEY);
      if (semantic.decision === 'RELEVANT' && semantic.confidence >= 0.6) {
        finalDecision = 'ACCEPT';
        finalReason = semantic.reason;
        finalMatched = semantic.matchedConcepts;
        finalConfidence = semantic.confidence;
      } else if (semantic.decision === 'IRRELEVANT' && semantic.confidence >= 0.6) {
        return {
          decision: 'REJECT',
          reason: semantic.reason || 'IRRELEVANT_TO_QUERY',
          matchedConcepts: semantic.matchedConcepts,
          confidence: semantic.confidence,
          canonicalUrl,
          canonicalDomain,
          websiteSource,
          enrichmentAttempts,
        };
      } else {
        finalReason = semantic.reason || 'UNCERTAIN_RELEVANCE';
        finalMatched = semantic.matchedConcepts;
        finalConfidence = semantic.confidence;
      }
    }

    if (finalDecision !== 'ACCEPT') {
      return {
        decision: finalDecision,
        reason: finalReason,
        matchedConcepts: finalMatched,
        confidence: finalConfidence,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
      };
    }

    // ---- deduplication -------------------------------------------------------
    const seenLeadId = seenCanonicalDomains.get(canonicalDomain ?? '');
    if (canonicalDomain && seenLeadId) {
      return {
        decision: 'REJECT',
        reason: 'DUPLICATE_CANONICAL_DOMAIN',
        matchedConcepts: [canonicalDomain],
        confidence: 1,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
        leadId: seenLeadId,
        leadExists: true,
      };
    }

    const existingByDomain = canonicalDomain
      ? await this.prisma.lead.findFirst({ where: { websiteDomain: canonicalDomain, mergeStatus: 'NONE' }, select: { id: true } })
      : null;
    if (canonicalDomain && existingByDomain) {
      return {
        decision: 'REJECT',
        reason: 'DUPLICATE_CANONICAL_DOMAIN',
        matchedConcepts: [canonicalDomain],
        confidence: 1,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
        leadId: existingByDomain.id,
        leadExists: true,
      };
    }

    const normCompany = normalizeCompanyName(candidate.companyName);
    const orgKey = `${canonicalDomain ?? ''}:${candidate.phone ?? ''}:${candidate.address ?? ''}:${normCompany}`;
    const seenOrgLeadId = seenOrgs.get(orgKey);
    if (seenOrgLeadId) {
      return {
        decision: 'REJECT',
        reason: 'DUPLICATE_ORGANISATION',
        matchedConcepts: [candidate.companyName],
        confidence: 1,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
        leadId: seenOrgLeadId,
        leadExists: true,
      };
    }

    const strongMatch = await this.findStrongOrganisationMatch(candidate, canonicalDomain);
    if (strongMatch) {
      return {
        decision: 'REJECT',
        reason: 'DUPLICATE_ORGANISATION',
        matchedConcepts: [candidate.companyName],
        confidence: 0.95,
        canonicalUrl,
        canonicalDomain,
        websiteSource,
        enrichmentAttempts,
        leadId: strongMatch.id,
        leadExists: true,
      };
    }

    // ---- create the lead: only after a confirmed direct site -----------------
    const leadData: any = {
      source: candidate.source as any,
      sourceId: candidate.sourceId ?? `${candidate.source}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      companyName: candidate.companyName,
      city: candidate.city ?? '',
      address: candidate.address ?? null,
      categories: candidate.categories ?? [],
      phone: candidate.phone ?? null,
      website: canonicalUrl,
      websiteDomain: canonicalDomain,
      websiteStatus: 'FOUND' as any,
      websiteIneligibilityReason: null,
      sourceUrl: candidate.sourceUrl ?? null,
      latitude: candidate.latitude ?? null,
      longitude: candidate.longitude ?? null,
    };

    const lead = await this.prisma.lead.create({ data: leadData });

    if (canonicalDomain) seenCanonicalDomains.set(canonicalDomain, lead.id);
    seenOrgs.set(orgKey, lead.id);

    return {
      decision: 'ACCEPT',
      reason: websiteSource === 'enrichment' ? 'WEBSITE_FROM_ENRICHMENT' : 'WEBSITE_FROM_PROVIDER',
      matchedConcepts: finalMatched,
      confidence: finalConfidence,
      canonicalUrl,
      canonicalDomain,
      websiteSource,
      enrichmentAttempts,
      leadId: lead.id,
      leadExists: false,
    };
  }

  private async findStrongOrganisationMatch(candidate: DiscoveryCandidateInput, canonicalDomain: string | null) {
    if (!candidate.companyName) return null;
    const where: any = {
      websiteDomain: { not: canonicalDomain },
      mergeStatus: 'NONE',
      companyName: { equals: candidate.companyName, mode: 'insensitive' },
    };
    if (candidate.phone) {
      where.phone = candidate.phone;
    } else if (candidate.address) {
      where.address = { equals: candidate.address, mode: 'insensitive' };
    } else {
      return null;
    }
    return this.prisma.lead.findFirst({ where, select: { id: true } });
  }
}
