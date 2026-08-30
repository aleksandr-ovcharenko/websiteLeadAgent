import { evaluateWebsiteEligibility } from '../../../collector/src/utils/evaluateWebsiteEligibility.js';

export function isBlacklistedWebsiteDomain(domain: string): boolean {
  const result = evaluateWebsiteEligibility(domain);
  return !result.eligible;
}
