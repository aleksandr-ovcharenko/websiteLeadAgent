/**
 * Provider-neutral cost aggregation.
 */

/**
 * @typedef {import('./generationRun.mjs').CostRecord} CostRecord
 */

/**
 * Aggregate an array of cost records by provider/operation.
 * @param {CostRecord[]} costs
 * @returns {CostRecord[]}
 */
export function aggregateCosts(costs) {
  const byKey = new Map();
  for (const c of costs) {
    const key = `${c.provider}:${c.operation}`;
    const existing = byKey.get(key) ?? {
      provider: c.provider,
      operation: c.operation,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      credits: 0,
      reportedCost: undefined,
      estimatedCost: undefined,
      currency: c.currency,
    };
    existing.requests = (existing.requests ?? 0) + (c.requests ?? 0);
    existing.inputTokens = (existing.inputTokens ?? 0) + (c.inputTokens ?? 0);
    existing.outputTokens = (existing.outputTokens ?? 0) + (c.outputTokens ?? 0);
    existing.credits = (existing.credits ?? 0) + (c.credits ?? 0);
    if (c.reportedCost != null) existing.reportedCost = (existing.reportedCost ?? 0) + c.reportedCost;
    if (c.estimatedCost != null) existing.estimatedCost = (existing.estimatedCost ?? 0) + c.estimatedCost;
    byKey.set(key, existing);
  }
  return Array.from(byKey.values());
}

/**
 * Summarize cost records for reporting.
 * @param {CostRecord[]} costs
 * @returns {{ totalEstimatedCostUsd: number | null, totalCredits: number, totalTokens: number, providers: string[] }}
 */
export function summarizeCosts(costs) {
  const providers = [...new Set(costs.map((c) => c.provider))];
  let totalEstimatedCostUsd = null;
  let totalCredits = 0;
  let totalTokens = 0;
  for (const c of costs) {
    if (c.estimatedCost != null) totalEstimatedCostUsd = (totalEstimatedCostUsd ?? 0) + c.estimatedCost;
    if (c.credits != null) totalCredits += c.credits;
    if (c.inputTokens != null) totalTokens += c.inputTokens;
    if (c.outputTokens != null) totalTokens += c.outputTokens;
  }
  return { totalEstimatedCostUsd, totalCredits, totalTokens, providers };
}

/**
 * Create an empty cost record representing an unmeasured operation.
 * @param {string} provider
 * @param {string} operation
 * @returns {CostRecord}
 */
export function unknownCost(provider, operation) {
  return {
    provider,
    operation,
    requests: undefined,
    inputTokens: undefined,
    outputTokens: undefined,
    credits: undefined,
    reportedCost: undefined,
    estimatedCost: undefined,
    currency: undefined,
  };
}
