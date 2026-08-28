function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export type LeadScoreV2Config = {
  weights: {
    visualOpportunity: number;
    technicalOpportunity: number;
    redesignPotential: number;
  };
};

export const defaultLeadScoreV2Config: LeadScoreV2Config = {
  weights: {
    visualOpportunity: 0.65,
    technicalOpportunity: 0.2,
    redesignPotential: 0.15
  }
};

export type LeadScoreV2Inputs = {
  technicalQualityScore: number; // 0..100 (100=excellent)
  visualQualityScore: number; // 0..100 (100=excellent)
  businessConfidenceScore: number; // 0..100
  redesignPotentialNormalized: number; // 0..100
};

export function computeLeadScoreV2(input: { config?: LeadScoreV2Config; scores: LeadScoreV2Inputs }) {
  const config = input.config ?? defaultLeadScoreV2Config;
  const s = input.scores;

  const technicalOpportunity = clampInt(100 - s.technicalQualityScore, 0, 100);
  const visualOpportunity = clampInt(100 - s.visualQualityScore, 0, 100);

  const redesignOpportunity =
    visualOpportunity * config.weights.visualOpportunity +
    technicalOpportunity * config.weights.technicalOpportunity +
    s.redesignPotentialNormalized * config.weights.redesignPotential;

  const redesignOpportunityClamped = clampInt(redesignOpportunity, 0, 100);

  const leadScoreV2 = clampInt((redesignOpportunityClamped * s.businessConfidenceScore) / 100, 0, 100);

  const reasons: string[] = [];
  if (s.businessConfidenceScore >= 60) reasons.push('active-looking business');
  if (visualOpportunity >= 60) reasons.push('visually outdated or weak design');
  if (technicalOpportunity >= 60) reasons.push('technical issues / low lighthouse');
  if (s.redesignPotentialNormalized >= 70) reasons.push('high redesign potential');

  return {
    leadScoreV2,
    parts: {
      technicalOpportunity,
      visualOpportunity,
      redesignPotentialNormalized: s.redesignPotentialNormalized,
      redesignOpportunity: redesignOpportunityClamped,
      businessConfidenceScore: s.businessConfidenceScore
    },
    reasons
  };
}
