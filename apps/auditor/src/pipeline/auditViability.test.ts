import { describe, it, expect } from 'vitest';
import { classifyNavigationError } from './auditLeadWebsite';

describe('classifyNavigationError — website viability gate', () => {
  it('marks DNS/protocol/TLS/refused failures as HARD (dead website)', () => {
    for (const msg of [
      'page.goto: net::ERR_NAME_NOT_RESOLVED',
      'page.goto: net::ERR_CONNECTION_REFUSED',
      'page.goto: net::ERR_HTTP2_PROTOCOL_ERROR at https://svisloch.by/kontaktyi-svisloch',
      'page.goto: net::ERR_SSL_PROTOCOL_ERROR',
      'Audit failed after ignoring certificate errors: net::ERR_CERT_AUTHORITY_INVALID',
      'page.goto: net::ERR_TOO_MANY_REDIRECTS',
    ]) {
      expect(classifyNavigationError(msg), msg).toBe('HARD');
    }
  });

  it('marks timeouts, 429/5xx and WAF-style blocks as RETRYABLE', () => {
    for (const msg of [
      'page.goto: net::ERR_TIMED_OUT',
      'Website returned HTTP 429 for https://x.by',
      'Website returned HTTP 503 for https://x.by',
      'net::ERR_BLOCKED_BY_CLIENT',
      'some unexpected renderer hiccup',
    ]) {
      expect(classifyNavigationError(msg), msg).toBe('RETRYABLE');
    }
  });
});
