// V3.7.8 — canonical view dispatch for template frontends.
//
// The server already resolved the route (payload.ROUTE.type + ENTITY). The
// frontend must consume that decision — never re-derive a conflicting view
// from raw route/subRoute + PAGES. When ROUTE.type is absent (bundles
// rendered before this contract), a legacy derivation keeps old previews
// working.

export type RouteView =
  | { view: 'home'; activeSection?: string }
  | { view: 'entity-detail'; entityKind: 'service' | 'project' | 'news' | 'vacancy' | 'product'; entityId?: string; slug?: string }
  | { view: 'collection'; collection: string }
  | { view: 'page'; slug: string }
  | { view: 'not-found' };

const DETAIL_KIND: Record<string, 'service' | 'project' | 'news' | 'vacancy' | 'product'> = {
  SERVICE_DETAIL: 'service',
  PROJECT_DETAIL: 'project',
  NEWS_DETAIL: 'news',
  VACANCY_DETAIL: 'vacancy',
  PRODUCT_DETAIL: 'product',
};

const LEGACY_COLLECTION_ROUTES = ['news', 'projects', 'services', 'vacancies', 'products'];
const LEGACY_DETAIL_KIND: Record<string, 'service' | 'project' | 'news' | 'vacancy' | 'product'> = {
  services: 'service', projects: 'project', news: 'news', vacancies: 'vacancy', products: 'product',
};

export function resolveRouteView(cms: any): RouteView {
  const routeType = cms?.ROUTE?.type;
  if (routeType) {
    if (routeType === 'HOME') return { view: 'home' };
    const kind = DETAIL_KIND[routeType];
    if (kind) {
      return { view: 'entity-detail', entityKind: kind, entityId: cms?.ENTITY?.id, slug: cms?.ROUTE?.slug };
    }
    if (routeType === 'COLLECTION') {
      return { view: 'collection', collection: cms?.ROUTE?.collection || cms?.ROUTE?.slug || '' };
    }
    if (routeType === 'PAGE') {
      return { view: 'page', slug: cms?.PAGE?.slug || cms?.ROUTE?.slug || '' };
    }
    if (routeType === 'NOT_FOUND') {
      // A bare section-type path (e.g. /about with no Page) still scrolls the
      // homepage when that section is enabled — nav anchors are client-side.
      const sec = (cms?.HOME_SECTIONS || []).find(
        (s: any) => s?.enabled !== false && String(s?.type || '') === (cms?.ROUTE?.slug || cms?.ROUTE?.path || ''),
      );
      if (sec) return { view: 'home', activeSection: sec.type };
      return { view: 'not-found' };
    }
    return { view: 'not-found' };
  }

  // ── legacy fallback: pre-contract payloads ──────────────────────────────
  const route = cms?.route || '';
  const sub = cms?.subRoute || '';
  const pages: any[] = cms?.PAGES || [];
  if (!route) return { view: 'home' };
  if (LEGACY_COLLECTION_ROUTES.includes(route)) {
    if (sub) return { view: 'entity-detail', entityKind: LEGACY_DETAIL_KIND[route], entityId: undefined, slug: sub };
    return { view: 'collection', collection: route };
  }
  if (pages.some((p: any) => p.slug === route)) return { view: 'page', slug: route };
  const sec = (cms?.HOME_SECTIONS || []).find((s: any) => s?.enabled !== false && String(s?.type || '') === route && !sub);
  if (sec) return { view: 'home', activeSection: route };
  return { view: 'page', slug: route };
}
