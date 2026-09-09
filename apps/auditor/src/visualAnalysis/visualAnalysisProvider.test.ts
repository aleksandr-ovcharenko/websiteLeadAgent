import { describe, it, expect } from 'vitest';
import { VisualAnalysisError, isRetryableVisualError } from './visualAnalysisProvider.js';

describe('VisualAnalysisProvider errors', () => {
  it('marks 429 errors as retryable', () => {
    const err = new VisualAnalysisError('Gemini quota temporarily unavailable: 429', { retryable: true, code: 'GEMINI_QUOTA' });
    expect(err.retryable).toBe(true);
    expect(err.code).toBe('GEMINI_QUOTA');
    expect(isRetryableVisualError(err)).toBe(true);
  });

  it('does not mark validation failures as retryable', () => {
    const err = new Error('AI response validation failed');
    expect(isRetryableVisualError(err)).toBe(false);
  });

  it('detects retryable messages', () => {
    expect(isRetryableVisualError(new Error('429 rate limit'))).toBe(true);
    expect(isRetryableVisualError(new Error('socket hang up'))).toBe(true);
    expect(isRetryableVisualError(new Error('bad request'))).toBe(false);
  });
});
