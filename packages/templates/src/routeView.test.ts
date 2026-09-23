// V3.7.8 — canonical route dispatch contract.
//
// The server-side resolveRoute() result (payload.ROUTE.type + ENTITY) is the
// single routing decision. The template must never re-derive a conflicting
// view from raw route/subRoute + PAGES — a duplicate Page must not shadow a
// PROJECT_DETAIL render.
import { describe, it, expect } from 'vitest';
import { resolveRouteView } from './routeView.js';

const payload = (over: any = {}) => ({
  route: 'dizajn-interera',
  subRoute: '',
  ROUTE: { type: 'PROJECT_DETAIL', path: 'dizajn-interera', slug: 'dizajn-interera', title: 'P title' },
  ENTITY: { id: 'prj-1', kind: 'project', title: 'P title' },
  PAGES: [{ id: 'pg-9', slug: 'dizajn-interera', title: 'Duplicate page title' }],
  ...over,
});

describe('resolveRouteView — canonical ROUTE.type wins', () => {
  it('PROJECT_DETAIL resolves to the project detail view bound to ENTITY.id — a same-slug Page cannot shadow it', () => {
    const v = resolveRouteView(payload());
    expect(v).toEqual({ view: 'entity-detail', entityKind: 'project', entityId: 'prj-1', slug: 'dizajn-interera' });
  });

  it.each([
    ['SERVICE_DETAIL', 'service'],
    ['NEWS_DETAIL', 'news'],
    ['VACANCY_DETAIL', 'vacancy'],
    ['PRODUCT_DETAIL', 'product'],
  ] as const)('%s → entity-detail %s', (type, kind) => {
    const v = resolveRouteView(payload({ ROUTE: { type, path: 'x', slug: 'x', title: '' }, ENTITY: { id: 'e1', kind, title: '' } }));
    expect(v.view).toBe('entity-detail');
    expect((v as any).entityKind).toBe(kind);
  });

  it('COLLECTION resolves to the collection view with its kind', () => {
    const v = resolveRouteView(payload({ ROUTE: { type: 'COLLECTION', path: 'projects', slug: 'projects', title: '', collection: 'projects' }, ENTITY: undefined }));
    expect(v).toEqual({ view: 'collection', collection: 'projects' });
  });

  it('PAGE resolves to the page view of the resolved page', () => {
    const v = resolveRouteView(payload({
      ROUTE: { type: 'PAGE', path: 'about', slug: 'about', title: '' },
      ENTITY: undefined,
      PAGE: { id: 'pg-1', slug: 'about' },
    }));
    expect(v).toEqual({ view: 'page', slug: 'about' });
  });

  it('HOME resolves to the homepage view', () => {
    expect(resolveRouteView(payload({ route: '', ROUTE: { type: 'HOME', path: '', slug: 'index', title: '' }, ENTITY: undefined })).view).toBe('home');
  });

  it('NOT_FOUND resolves honestly — never silently the homepage', () => {
    expect(resolveRouteView(payload({ ROUTE: { type: 'NOT_FOUND', path: 'zzz', slug: 'zzz', title: '' }, ENTITY: undefined })).view).toBe('not-found');
  });

  it('a home-section route on NOT_FOUND still scrolls the homepage when the section exists', () => {
    const v = resolveRouteView(payload({
      ROUTE: { type: 'NOT_FOUND', path: 'about', slug: 'about', title: '' },
      ENTITY: undefined,
      HOME_SECTIONS: [{ type: 'about', enabled: true }],
    }));
    expect(v).toEqual({ view: 'home', activeSection: 'about' });
  });
});

describe('resolveRouteView — legacy payload fallback (no ROUTE.type)', () => {
  it('falls back to route/subRoute derivation for bundles rendered before the contract', () => {
    const v = resolveRouteView({ route: 'projects', subRoute: 'zhiloj', PAGES: [] });
    expect(v).toEqual({ view: 'entity-detail', entityKind: 'project', entityId: undefined, slug: 'zhiloj' });
  });
  it('empty route → home; bare collection slug → collection', () => {
    expect(resolveRouteView({ route: '', PAGES: [] }).view).toBe('home');
    expect(resolveRouteView({ route: 'news', PAGES: [] })).toEqual({ view: 'collection', collection: 'news' });
  });
  it('matched page slug → page view', () => {
    expect(resolveRouteView({ route: 'about', PAGES: [{ slug: 'about' }] })).toEqual({ view: 'page', slug: 'about' });
  });
});
