// V3.7.8 — independent per-section collection limits.
//
// Contract: each homepageSections[] entry owns its own `limit`. No global
// limit, no shared value between sections, no hardcoded .slice(0, N) inside
// templates. Defaults come from the template manifest, not code.
import { describe, it, expect } from 'vitest';
import { resolveSectionLimit, applySectionLimit } from './sectionLimits.js';
import { PAGE_SIZE_MAX } from './routes.js';
import type { TemplateManifest } from './types.js';

const manifest: TemplateManifest = {
  id: 'test-template',
  name: 'Test',
  supportedSectionTypes: ['projects', 'news', 'services', 'products', 'vacancies'],
  sectionRendererMap: {},
  collectionRendererMap: {},
  collectionSections: {
    projects: { defaultLimit: 6, supportsLimit: true },
    news: { defaultLimit: 3, supportsLimit: true },
    services: { defaultLimit: 8, supportsLimit: true },
    products: { defaultLimit: 4, supportsLimit: true },
  },
};

const items = (n: number, prefix = 'i') =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, status: 'PUBLISHED', title: `${prefix}${i}` }));

describe('resolveSectionLimit', () => {
  it('reads the section instance limit', () => {
    expect(resolveSectionLimit({ type: 'projects', limit: 2 }, manifest)).toBe(2);
  });

  it('falls back to the manifest default for this section type — not a global value', () => {
    expect(resolveSectionLimit({ type: 'news' }, manifest)).toBe(3);
    expect(resolveSectionLimit({ type: 'services' }, manifest)).toBe(8);
    expect(resolveSectionLimit({ type: 'projects' }, manifest)).toBe(6);
  });

  it('normalizes invalid values to the declared default', () => {
    expect(resolveSectionLimit({ type: 'news', limit: 0 }, manifest)).toBe(3);
    expect(resolveSectionLimit({ type: 'news', limit: -5 }, manifest)).toBe(3);
    expect(resolveSectionLimit({ type: 'news', limit: NaN }, manifest)).toBe(3);
    expect(resolveSectionLimit({ type: 'news', limit: 'abc' as any }, manifest)).toBe(3);
  });

  it('floors fractional values and clamps to the shared page-size range', () => {
    expect(resolveSectionLimit({ type: 'news', limit: 2.9 }, manifest)).toBe(2);
    expect(resolveSectionLimit({ type: 'news', limit: 9999 }, manifest)).toBe(PAGE_SIZE_MAX);
    expect(resolveSectionLimit({ type: 'news', limit: 1 }, manifest)).toBe(1);
  });

  it('returns undefined for types the manifest does not declare as collections', () => {
    expect(resolveSectionLimit({ type: 'text', limit: 5 }, manifest)).toBeUndefined();
    expect(resolveSectionLimit({ type: 'vacancies' }, manifest)).toBeUndefined(); // not declared here
  });

  it('two sections of the same type keep independent limits', () => {
    const a = { id: 'home-projects', type: 'projects', limit: 2 };
    const b = { id: 'sidebar-projects', type: 'projects', limit: 5 };
    expect(resolveSectionLimit(a, manifest)).toBe(2);
    expect(resolveSectionLimit(b, manifest)).toBe(5);
  });
});

describe('applySectionLimit', () => {
  it('slices preview items to the section limit', () => {
    const out = applySectionLimit(items(10, 'p'), { type: 'projects', limit: 2 }, manifest);
    expect(out).toHaveLength(2);
    expect(out.map((x) => x.id)).toEqual(['p0', 'p1']);
  });

  it('uses the manifest default when limit is absent', () => {
    expect(applySectionLimit(items(10, 'n'), { type: 'news' }, manifest)).toHaveLength(3);
  });

  it('does not mutate the CMS section payload', () => {
    const sec = { type: 'projects', limit: 2 };
    applySectionLimit(items(5), sec, manifest);
    expect(sec.limit).toBe(2);
  });

  it('non-collection sections are not capped', () => {
    const out = applySectionLimit(items(10), { type: 'text' }, manifest);
    expect(out).toHaveLength(10);
  });

  it('only published items are returned and selectedItemIds still apply', () => {
    const mixed = [...items(4, 'a'), { id: 'draft1', status: 'DRAFT' }];
    const out = applySectionLimit(mixed, { type: 'projects', limit: 10 }, manifest);
    expect(out.every((x) => x.status === 'PUBLISHED')).toBe(true);
    const picked = applySectionLimit(mixed, { type: 'projects', limit: 10, selectedItemIds: ['a2', 'a0'] }, manifest);
    expect(picked.map((x) => x.id)).toEqual(['a2', 'a0']);
  });
});
