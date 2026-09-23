import type pino from 'pino';
import { OSMEnrichmentProvider } from './providers/osm/osmEnrichmentProvider.js';
import { SerpApiEnrichmentProvider } from './providers/serpapi/serpApiEnrichmentProvider.js';
import { DDGEnrichmentProvider } from './providers/ddg/ddgEnrichmentProvider.js';
import { evaluateWebsiteEligibility } from '../utils/evaluateWebsiteEligibility.js';
import type { EnrichmentSubject, LeadEnrichmentProvider, LeadEnrichmentResult } from './types.js';

export interface EnrichmentAttempt {
  provider: string;
  /** deterministic query/input the provider was given */
  input: string;
  /** raw website the provider returned (before eligibility) */
  candidateUrl: string | null;
  decision: 'FOUND' | 'INELIGIBLE' | 'NONE' | 'ERROR';
  reason: string | null;
}

export interface CandidateEnrichmentResult {
  website: string | null;
  phone: string | null;
  source?: string;
  attempts: EnrichmentAttempt[];
}

/** The configured provider chain — deterministic order, no AI involved. */
export function defaultEnrichmentProviders(env: Record<string, string | undefined>): LeadEnrichmentProvider[] {
  const providers: LeadEnrichmentProvider[] = [new OSMEnrichmentProvider()];
  if (env.SERPAPI_API_KEY) {
    providers.push(new SerpApiEnrichmentProvider(env.SERPAPI_API_KEY));
  }
  providers.push(new DDGEnrichmentProvider());
  return providers;
}

function providerName(p: LeadEnrichmentProvider): string {
  const n = p.constructor?.name ?? 'unknown';
  return n.replace(/EnrichmentProvider$/, '').toLowerCase() || 'unknown';
}

function subjectInput(subject: EnrichmentSubject): string {
  return `${subject.companyName} ${subject.city ?? ''} ${subject.address ?? ''}`.replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a direct-company website for a pre-lead subject. Runs every
 * configured provider until one returns an eligible site; every attempt is
 * recorded with its input, candidate URL and reason.
 */
export async function enrichCandidateWebsite(input: {
  subject: EnrichmentSubject;
  providers?: LeadEnrichmentProvider[];
  env?: Record<string, string | undefined>;
  logger?: pino.Logger;
}): Promise<CandidateEnrichmentResult> {
  const { subject } = input;
  const providers = input.providers ?? defaultEnrichmentProviders(input.env ?? process.env as any);
  const attempts: EnrichmentAttempt[] = [];
  const query = subjectInput(subject);

  for (const provider of providers) {
    const name = providerName(provider);
    let result: LeadEnrichmentResult;
    try {
      result = await provider.enrich({ lead: subject });
    } catch (err: any) {
      attempts.push({ provider: name, input: query, candidateUrl: null, decision: 'ERROR', reason: err?.message || 'provider error' });
      input.logger?.warn({ err: err?.message, provider: name }, 'enrichment.provider.error');
      continue;
    }

    if (!result.website) {
      attempts.push({ provider: name, input: query, candidateUrl: null, decision: 'NONE', reason: 'no result' });
      continue;
    }

    const eligibility = evaluateWebsiteEligibility(result.website);
    if (eligibility.eligible) {
      attempts.push({ provider: name, input: query, candidateUrl: result.website, decision: 'FOUND', reason: null });
      return { website: eligibility.canonicalUrl, phone: result.phone ?? null, source: result.source ?? name, attempts };
    }
    attempts.push({ provider: name, input: query, candidateUrl: result.website, decision: 'INELIGIBLE', reason: eligibility.reason });
  }

  return { website: null, phone: null, attempts };
}
