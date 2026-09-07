// Deterministic link-semantics tests: a link is correct only when it leads to
// the content its semantic target promises. HTTP-200 is not a pass.
import { describe, it, expect } from 'vitest';
import { resolveShowcaseTarget } from '../packages/templates/src/construction-modern-v1/linkResolver';
import { previewImageUrl } from '../packages/screenshot/src/index';

const BASE = '/showcase/tok123';

describe('semantic link resolver', () => {
  it('COLLECTION(PROJECTS) resolves to the collection route, not an anchor', () => {
    expect(resolveShowcaseTarget(BASE, 'COLLECTION:PROJECTS')).toBe(`${BASE}/projects`);
  });
  it('COLLECTION(PRODUCTS) resolves to /products', () => {
    expect(resolveShowcaseTarget(BASE, 'COLLECTION:PRODUCTS')).toBe(`${BASE}/products`);
  });
  it('CONTENT_DETAIL resolves to the entity route', () => {
    expect(resolveShowcaseTarget(BASE, 'CONTENT_DETAIL:products/gamvik')).toBe(`${BASE}/products/gamvik`);
  });
  it('HOME_SECTION(CONTACTS) resolves to the homepage anchor', () => {
    expect(resolveShowcaseTarget(BASE, 'HOME_SECTION:CONTACTS')).toBe(`${BASE}/#contacts`);
  });
  it('external URLs pass through untouched', () => {
    expect(resolveShowcaseTarget(BASE, 'EXTERNAL_URL:https://puzzlehouse.by/konstruktor/')).toBe('https://puzzlehouse.by/konstruktor/');
  });
  it('unresolvable/empty targets return empty — never silently /contacts', () => {
    expect(resolveShowcaseTarget(BASE, undefined)).toBe('');
    expect(resolveShowcaseTarget(BASE, '')).toBe('');
    // 'PROJECTS' as a bare collection label on a site without that section must
    // never resolve to /contacts or any unrelated valid route
    expect(resolveShowcaseTarget(BASE, 'HOME_SECTION:')).toBe('');
  });
});

describe('hub screenshot versioning', () => {
  it('a new preferred variant/run always produces a different preview URL', () => {
    const shot = { url: '/site-screenshots/s1/preview.png', siteUpdatedAt: new Date('2025-01-01') };
    const a = previewImageUrl(shot, 'variant-A');
    const b = previewImageUrl(shot, 'variant-B');
    expect(a).not.toBe(b);
    const c = previewImageUrl({ ...shot, siteUpdatedAt: new Date('2025-01-02') }, 'variant-B');
    expect(b).not.toBe(c); // same variant, newer capture → new URL
  });
});
