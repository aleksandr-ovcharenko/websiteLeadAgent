import type { VisualAnalysisInput, VisualAnalysisResult } from './visualAnalysisSchema.js';

export interface VisualAnalysisProvider {
  analyze(input: VisualAnalysisInput): Promise<{ result: VisualAnalysisResult; model: string; usage: unknown | null }>;
}

export class VisualAnalysisError extends Error {
  retryable: boolean;
  code: string;
  constructor(message: string, opts: { retryable?: boolean; code?: string } = {}) {
    super(message);
    this.name = 'VisualAnalysisError';
    this.retryable = opts.retryable ?? false;
    this.code = opts.code ?? 'VISUAL_ANALYSIS_FAILED';
  }
}

export function isRetryableVisualError(err: unknown): boolean {
  if (err instanceof VisualAnalysisError) return err.retryable;
  const text = String((err as any)?.message ?? err).toLowerCase();
  return (
    text.includes('429') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('temporarily unavailable') ||
    text.includes('server error') ||
    text.includes('gateway timeout') ||
    text.includes('econnreset') ||
    text.includes('socket hang up') ||
    text.includes('timeout')
  );
}
