import type { DiscoveryCandidateInput } from './gate.js';

export interface SemanticRelevanceResult {
  decision: 'RELEVANT' | 'IRRELEVANT' | 'UNCERTAIN';
  confidence: number;
  reason: string;
  matchedConcepts: string[];
}

const RELEVANCE_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['RELEVANT', 'IRRELEVANT', 'UNCERTAIN'] },
    confidence: { type: 'number' },
    reason: { type: 'string' },
    matchedConcepts: { type: 'array', items: { type: 'string' } },
  },
  required: ['decision', 'confidence', 'reason', 'matchedConcepts'],
};

function normalizeText(input: string | string[] | undefined | null): string {
  const arr = Array.isArray(input) ? input : [input];
  return arr
    .filter((x): x is string => typeof x === 'string')
    .join(' ')
    .trim();
}

export async function semanticRelevance(
  candidate: DiscoveryCandidateInput,
  intent: string | undefined,
  query: string,
  apiKey?: string
): Promise<SemanticRelevanceResult> {
  if (!apiKey) {
    return { decision: 'UNCERTAIN', confidence: 0, reason: 'AI classifier not configured', matchedConcepts: [] };
  }

  const system = `You classify whether a business is relevant to a discovery search intent. Reply with JSON only. Decision values: RELEVANT, IRRELEVANT, UNCERTAIN. Provide confidence 0..1, a short reason, and matched concepts. Be strict: only return RELEVANT if the business clearly matches the intent; IRRELEVANT if the category is clearly off-target; UNCERTAIN if evidence is insufficient. Do not guess.`;
  const user = `Intent: ${intent || query}\nQuery: ${query}\nCompany name: ${candidate.companyName}\nCategories: ${(candidate.categories || []).join(', ')}\nAddress: ${candidate.address || ''}\nWebsite: ${candidate.website || ''}`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: system + '\n\n' + user }] },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RELEVANCE_SCHEMA,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = await res.json() as any;
    const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('No response text from Gemini');
    }
    const parsed = JSON.parse(candidateText) as SemanticRelevanceResult;
    return {
      decision: parsed.decision,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
      reason: parsed.reason || 'No reason provided',
      matchedConcepts: parsed.matchedConcepts || [],
    };
  } catch (e: any) {
    // AI failure must never leak into persisted candidate reasons — the gate
    // stays deterministic: an unavailable classifier means UNCERTAIN, with a
    // stable machine-readable reason for the run breakdown.
    if (e?.message?.includes('429') || e?.message?.includes('quota') || e?.message?.includes('timeout')) {
      return { decision: 'UNCERTAIN', confidence: 0, reason: 'AI_TEMPORARILY_UNAVAILABLE', matchedConcepts: [] };
    }
    return { decision: 'UNCERTAIN', confidence: 0, reason: 'AI_CLASSIFIER_FAILED', matchedConcepts: [] };
  }
}
