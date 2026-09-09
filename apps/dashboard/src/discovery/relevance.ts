import type { DiscoveryCandidateInput } from './gate.js';

export type DiscoveryRelevanceDecision = 'ACCEPT' | 'REJECT' | 'UNCERTAIN';

export interface DiscoveryRelevanceResult {
  decision: DiscoveryRelevanceDecision;
  reason: string;
  matchedConcepts: string[];
  confidence: number;
}

export interface IntentProfile {
  positive: string[];
  negative: string[];
}

const INTENT_PROFILES: Record<string, IntentProfile> = {
  construction: {
    positive: ['строитель', 'строи', 'подряд', 'генподряд', 'ремонт', 'мост', 'дорог', 'фасад'],
    negative: ['клуб', 'спорт', 'хокке', 'футбол', 'баскетбол', 'теннис', 'плаван', 'ресторан', 'кафе', 'бар', 'школ', 'универ', 'государствен', 'администрац', 'портал', 'справочник', 'каталог', 'афиша', 'новост', 'газет'],
  },
  sports: {
    positive: ['клуб', 'спорт', 'хокке', 'футбол', 'баскетбол', 'теннис', 'плаван'],
    negative: ['строитель', 'подряд', 'генподряд', 'ремонт', 'ресторан', 'кафе', 'бар'],
  },
  default: {
    positive: [],
    negative: ['портал', 'справочник', 'каталог', 'афиша', 'новост'],
  },
};

function normalizeText(input: string | string[] | undefined | null): string {
  const arr = Array.isArray(input) ? input : [input];
  return arr
    .filter((x): x is string => typeof x === 'string')
    .join(' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectBusinessType(intent: string | undefined, query: string): string {
  const corpus = normalizeText([intent, query]);
  if (corpus.includes('спорт') || corpus.includes('клуб')) return 'sports';
  if (corpus.includes('подряд') || corpus.includes('строит')) return 'construction';
  if (corpus.includes('сварка') || corpus.includes('сантех')) return 'construction';
  return 'default';
}

export function classifyRelevance(
  candidate: DiscoveryCandidateInput,
  intent: string | undefined,
  query: string
): DiscoveryRelevanceResult {
  const businessType = detectBusinessType(intent, query);
  const profile = INTENT_PROFILES[businessType] ?? INTENT_PROFILES.default;
  const text = normalizeText([candidate.companyName, ...(candidate.categories || [])]);

  const matchedNegative: string[] = [];
  for (const kw of profile.negative) {
    if (text.includes(kw)) matchedNegative.push(kw);
  }

  if (matchedNegative.length > 0) {
    return {
      decision: 'REJECT',
      reason: 'IRRELEVANT_BUSINESS_CATEGORY',
      matchedConcepts: matchedNegative,
      confidence: 0.9,
    };
  }

  const matchedPositive: string[] = [];
  for (const kw of profile.positive) {
    if (text.includes(kw)) matchedPositive.push(kw);
  }

  if (matchedPositive.length > 0) {
    return {
      decision: 'ACCEPT',
      reason: 'RELEVANT_TO_QUERY',
      matchedConcepts: matchedPositive,
      confidence: 0.8,
    };
  }

  return {
    decision: 'UNCERTAIN',
    reason: 'UNCERTAIN_RELEVANCE',
    matchedConcepts: [],
    confidence: 0.5,
  };
}
