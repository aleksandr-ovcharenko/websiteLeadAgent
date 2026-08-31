import { describe, it, expect } from 'vitest';
import { normalizeError } from './normalizeError.js';

describe('normalizeError', () => {
  it('recognizes Playwright missing Chromium', () => {
    const error = new Error('browserType.launch: Executable doesn\'t exist at /home/aleks/.cache/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell');
    const normalized = normalizeError(error);
    expect(normalized.code).toBe('PLAYWRIGHT_BROWSER_MISSING');
    expect(normalized.friendlyMessage).toBe('Chromium browser is not installed.');
    expect(normalized.action).toBe('Run: npm run setup:browsers');
  });

  it('recognizes source timeout', () => {
    const error = new Error('page.goto: Timeout 30000ms exceeded.');
    const normalized = normalizeError(error);
    expect(normalized.code).toBe('SOURCE_TIMEOUT');
  });

  it('recognizes source DNS failure', () => {
    const error = new Error('net::ERR_NAME_NOT_RESOLVED at https://example.com');
    const normalized = normalizeError(error);
    expect(normalized.code).toBe('SOURCE_DNS_FAILED');
  });

  it('recognizes AI rate limit', () => {
    const error = new Error('429 Too Many Requests');
    const normalized = normalizeError(error);
    expect(normalized.code).toBe('AI_RATE_LIMIT');
  });

  it('falls back to unknown for unrecognized errors', () => {
    const error = new Error('Something weird happened');
    const normalized = normalizeError(error);
    expect(normalized.code).toBe('UNKNOWN_ERROR');
    expect(normalized.friendlyMessage).toBe('Something weird happened');
  });
});
