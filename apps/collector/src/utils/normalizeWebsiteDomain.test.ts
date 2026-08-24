import { describe, expect, it } from 'vitest';
import { normalizeWebsiteDomain } from './normalizeWebsiteDomain.js';

describe('normalizeWebsiteDomain', () => {
  it('normalizes http/https and strips www', () => {
    expect(normalizeWebsiteDomain('https://www.Example.COM/path')).toBe('example.com');
    expect(normalizeWebsiteDomain('http://example.com')).toBe('example.com');
  });

  it('accepts bare domain', () => {
    expect(normalizeWebsiteDomain('example.com')).toBe('example.com');
  });

  it('returns null for invalid input', () => {
    expect(normalizeWebsiteDomain('')).toBeNull();
    expect(normalizeWebsiteDomain('not a url::::')).toBeNull();
  });
});
