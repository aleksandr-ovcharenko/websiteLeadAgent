import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { evaluateWebsiteEligibility } from '../../../collector/src/utils/evaluateWebsiteEligibility.js';
import { normalizeWebsiteDomain } from '../../../collector/src/utils/normalizeWebsiteDomain.js';
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

export class DiscoveryGatingService {
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private env: Record<string, string | undefined>;

  constructor(input: { prisma: PrismaClient; logger: pino.Logger; env: Record<string, string | undefined> }) {
    this.prisma = input.prisma;
    this.logger = input.logger;
    this.env = input.env;
  }

  async process(run: { id: string; query: string; intent?: string | null }, candidates: DiscoveryCandidateInput[]) {
    const acceptedLeads: ProcessedLead[] = [];
    const seenCanonicalDomains = new Map<string, string>();
    const seenOrgs = new Map<string, string>();

    let created = 0;
    let duplicates = 0;
    let rejected = 0;
    let uncertain = 0;

    for (const candidate of candidates) {
      const result = await this.evaluateCandidate(candidate, run, seenCanonicalDomains, seenOrgs);

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

    await this.prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        collected: candidates.length,
        leadIds: newLeadIds,
        createdCount: created,
        duplicateCount: duplicates,
        rejectedCount: rejected,
        uncertainCount: uncertain,
      },
    });

    for (const lead of acceptedLeads.filter((l) => l.isNew)) {
      await this.prisma.leadQuery.upsert({
        where: { leadId_query: { leadId: lead.id, query: run.query } },
        create: { leadId: lead.id, query: run.query },
        update: {},
      });
    }

    this.logger.info({ runId: run.id, collected: candidates.length, created, duplicates, rejected, uncertain }, 'discovery.gate.complete');
    return { leadIds: newLeadIds, created, duplicates, rejected, uncertain };
  }

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
    leadId?: string;
    leadExists?: boolean;
  }> {
    const eligibility = candidate.website
      ? evaluateWebsiteEligibility(candidate.website)
      : { eligible: false, canonicalUrl: null, canonicalDomain: null, reason: 'NO_WEBSITE' as const, matchedRule: null };

    if (!eligibility.eligible) {
      return {
        decision: 'REJECT',
        reason: eligibility.reason || 'NO_WEBSITE',
        matchedConcepts: eligibility.matchedRule ? [eligibility.matchedRule] : [],
        confidence: 1,
        canonicalUrl: eligibility.canonicalUrl,
        canonicalDomain: eligibility.canonicalDomain,
      };
    }

    const canonicalDomain = eligibility.canonicalDomain;
    const canonicalUrl = eligibility.canonicalUrl;

    const seenLeadId = seenCanonicalDomains.get(canonicalDomain ?? '');
    if (canonicalDomain && seenLeadId) {
      return {
        decision: 'REJECT',
        reason: 'DUPLICATE_CANONICAL_DOMAIN',
        matchedConcepts: [canonicalDomain],
        confidence: 1,
        canonicalUrl,
        canonicalDomain,
        leadId: seenLeadId,
        leadExists: true,
      };
    }

    const existingByDomain = canonicalDomain
      ? await this.prisma.lead.findFirst({ where: { websiteDomain: canonicalDomain }, select: { id: true } })
      : null;
    if (canonicalDomain && existingByDomain) {
      return {
        decision: 'REJECT',
        reason: 'DUPLICATE_CANONICAL_DOMAIN',
        matchedConcepts: [canonicalDomain],
        confidence: 1,
        canonicalUrl,
        canonicalDomain,
        leadId: existingByDomain.id,
        leadExists: true,
      };
    }

    const cheap = classifyRelevance(candidate, run.intent, run.query);
    if (cheap.decision === 'REJECT') {
      return {
        decision: 'REJECT',
        reason: cheap.reason,
        matchedConcepts: cheap.matchedConcepts,
        confidence: cheap.confidence,
        canonicalUrl,
        canonicalDomain,
      };
    }

    let finalDecision: 'ACCEPT' | 'REJECT' | 'UNCERTAIN' = cheap.decision as 'ACCEPT' | 'REJECT' | 'UNCERTAIN';
    let finalReason = cheap.reason;
    let finalMatched = cheap.matchedConcepts;
    let finalConfidence = cheap.confidence;

    if (cheap.decision === 'UNCERTAIN') {
      const semantic = await semanticRelevance(candidate, run.intent ?? undefined, run.query, this.env.GEMINI_API_KEY);
      if (semantic.decision === 'RELEVANT' && semantic.confidence >= 0.6) {
        finalDecision = 'ACCEPT';
        finalReason = semantic.reason;
        finalMatched = semantic.matchedConcepts;
        finalConfidence = semantic.confidence;
      } else if (semantic.decision === 'IRRELEVANT' && semantic.confidence >= 0.6) {
        finalDecision = 'REJECT';
        finalReason = semantic.reason || 'IRRELEVANT_TO_QUERY';
        finalMatched = semantic.matchedConcepts;
        finalConfidence = semantic.confidence;
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
        leadId: strongMatch.id,
        leadExists: true,
      };
    }

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
      websiteStatus: 'UNKNOWN' as any,
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
      reason: finalReason,
      matchedConcepts: finalMatched,
      confidence: finalConfidence,
      canonicalUrl,
      canonicalDomain,
      leadId: lead.id,
      leadExists: false,
    };
  }

  private async findStrongOrganisationMatch(candidate: DiscoveryCandidateInput, canonicalDomain: string | null) {
    if (!candidate.companyName) return null;
    const where: any = {
      websiteDomain: { not: canonicalDomain },
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
