// Canonical route resolution for showcase rendering.
//
// Every showcase URL resolves to exactly one route view:
//   HOME            → homepage composition
//   PAGE            → a CMS Page and its blocks
//   SERVICE_DETAIL  → a CMS Service (+ its backing page blocks)
//   PROJECT_DETAIL  → a CMS Project (+ its backing page blocks)
//   COLLECTION      → a typed entity collection (services/projects/news/…)
//   NOT_FOUND       → honest 404 — never silently the homepage
//
// Matching is evidence-based: entities are linked to routes through their
// provenance sourceUrl path and through the Page records imported for the
// same source document. No slug guessing.

import type { RenderContext } from './types.js';

export type RouteKind =
  | 'HOME'
  | 'PAGE'
  | 'SERVICE_DETAIL'
  | 'PROJECT_DETAIL'
  | 'NEWS_DETAIL'
  | 'VACANCY_DETAIL'
  | 'PRODUCT_DETAIL'
  | 'COLLECTION'
  | 'NOT_FOUND';

export type CollectionKind = 'services' | 'projects' | 'news' | 'vacancies' | 'products';

export interface ResolvedRoute {
  kind: RouteKind;
  /** The full requested path after the showcase token ('' for home). */
  path: string;
  slug: string;
  subRoute?: string;
  page?: any;
  entity?: any;
  collectionKind?: CollectionKind;
  /** Suggested <title> — page/entity title, falling back to site name. */
  title?: string;
}

export function pathOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url, 'http://x').pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  } catch {
    return url.replace(/^\/+|\/+$/g, '').toLowerCase();
  }
}

function lastSeg(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/** Default cards per collection page; per-kind overrides allowed, range 1–24. */
export const DEFAULT_PAGE_SIZE = 6;
export const PAGE_SIZE_MIN = 1;
export const PAGE_SIZE_MAX = 24;

export function clampPageSize(v: unknown, fallback = DEFAULT_PAGE_SIZE): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.max(Math.floor(n), PAGE_SIZE_MIN), PAGE_SIZE_MAX);
}

export interface PagerLink {
  page: number;
  href: string;
  current: boolean;
}

export interface PageSlice<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Numbered page links; undefined when a single page suffices. */
  pager?: PagerLink[];
}

/**
 * Slice a collection into a stable page. An out-of-range page yields an empty
 * slice (never a silent duplicate of page 1) while the pager still renders.
 */
export function paginate<T>(items: T[], page: number, pageSize: number, hrefFor: (page: number) => string): PageSlice<T> {
  const size = clampPageSize(pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const p = Math.max(1, Math.floor(page) || 1);
  const slice = items.slice((p - 1) * size, p * size);
  const pager = pageCount > 1
    ? Array.from({ length: pageCount }, (_, i) => ({ page: i + 1, href: hrefFor(i + 1), current: i + 1 === p }))
    : undefined;
  return { items: slice, page: p, pageCount, total, pageSize: size, pager };
}

export const COLLECTION_SLUG_HINTS: Record<string, CollectionKind> = {
  services: 'services',
  servisy: 'services',
  uslugi: 'services',
  portfolio: 'projects',
  projects: 'projects',
  works: 'projects',
  proektyi: 'projects',
  proekty: 'projects',
  news: 'news',
  novosti: 'news',
  articles: 'news',
  blog: 'news',
  vacancies: 'vacancies',
  vakansii: 'vacancies',
  products: 'products',
  katalog: 'products',
  catalog: 'products',
};

/** The URL path prefix under which an entity's detail pages live. */
export function entitySourceDir(sourceUrl?: string): string {
  const p = pathOf(sourceUrl);
  // '#item-*' provenance marks an entity that lives ON the page at that path
  // (popup-store cards with no detail URL) — its own path is the parent.
  if (sourceUrl?.includes('#')) return p;
  const idx = p.lastIndexOf('/');
  return idx > 0 ? p.slice(0, idx) : '';
}

/**
 * Detect whether a page is a collection index by evidence:
 * entities whose sourceUrl sits directly under the page's sourceUrl path
 * (e.g. /services/monolit under /services). Falls back to known slug hints.
 */
export function collectionKindOf(page: any, ctx: RenderContext): CollectionKind | undefined {
  const pagePath = pathOf(page?.sourceUrl || `/${page?.slug || ''}`);
  if (!pagePath || pagePath === 'index') return undefined;
  const sets: [CollectionKind, any[]][] = [
    ['services', ctx.services || []],
    ['projects', ctx.projects || []],
    ['news', ctx.news || []],
    ['vacancies', ctx.vacancies || []],
    ['products', ctx.products || []],
  ];
  for (const [kind, items] of sets) {
    if (items.some((e) => entitySourceDir(e?.sourceUrl) === pagePath)) return kind;
  }
  return COLLECTION_SLUG_HINTS[page.slug || ''];
}

/**
 * Canonical internal route for an entity — the imported Page that carries its
 * source document when one exists, else the entity's own slug. One builder for
 * homepage sections, collection views and navigation so a routable entity can
 * never disagree about its own URL. Returns undefined for unroutable input.
 */
export function entityRoute(entity: any, pages: any[]): string | undefined {
  if (!entity) return undefined;
  const backing = (pages || []).find((p: any) => p.sourceUrl && p.sourceUrl === entity.sourceUrl);
  const slug = backing?.slug || entity.slug;
  return slug ? `/${slug}` : undefined;
}

/**
 * Shared preview-path resolver (V3.7.4 Phase 5) — the ONE contract used by
 * CMS Preview buttons, the CMS API and route-integrity QA. Wraps entityRoute
 * with the publication gate: a Preview link exists only for a PUBLISHED
 * entity with a resolvable detail route. Returns undefined when no detail
 * route exists — callers must render "unavailable", never substitute the
 * collection path.
 */
export function entityPreviewPath(entity: any, pages: any[]): string | undefined {
  if (!entity || entity.status !== 'PUBLISHED') return undefined;
  return entityRoute(entity, pages);
}

/**
 * Canonical collection route for a kind — the real CMS Page that resolves to
 * this collection when one exists, else the first slug hint (hinted routes
 * resolve to COLLECTION even without a page record).
 */
export function collectionRoute(kind: CollectionKind, ctx: RenderContext): string | undefined {
  const pages = ctx.pages || [];
  const page = pages.find((p: any) => !p.isHomepage && collectionKindOf(p, ctx) === kind);
  if (page?.slug) return `/${page.slug}`;
  const hinted = Object.keys(COLLECTION_SLUG_HINTS).find((k) => COLLECTION_SLUG_HINTS[k] === kind);
  return hinted ? `/${hinted}` : undefined;
}

function findBySlugOrSource(items: any[], fullPath: string, last: string): any | undefined {
  return (items || []).find((e) => {
    const src = pathOf(e?.sourceUrl);
    // Anchored '#item-*' provenance is not a routable detail path — many items
    // share the index pathname. Only the entity slug identifies its route.
    const anchored = typeof e?.sourceUrl === 'string' && e.sourceUrl.includes('#');
    return (!anchored && (src === fullPath || lastSeg(src) === last)) || e?.slug === last || e?.slug === fullPath;
  });
}

export function resolveRoute(ctx: RenderContext): ResolvedRoute {
  const route = (ctx.route || '').replace(/^\/+|\/+$/g, '');
  const subRoute = (ctx.subRoute || '').replace(/^\/+|\/+$/g, '');
  const fullPath = subRoute ? `${route}/${subRoute}` : route;
  const last = lastSeg(fullPath);
  const pages: any[] = ctx.pages || [];

  if (!fullPath || fullPath === 'index' || fullPath === 'home') {
    return { kind: 'HOME', path: '', slug: 'index' };
  }

  // 1. Entity detail — matched by provenance sourceUrl (or slug as fallback).
  const service = findBySlugOrSource(ctx.services, fullPath, last);
  if (service) {
    const page = pages.find((p) => p.sourceUrl && pathOf(p.sourceUrl) === pathOf(service.sourceUrl))
      || pages.find((p) => p.slug === last || p.slug === fullPath);
    return { kind: 'SERVICE_DETAIL', path: fullPath, slug: last, subRoute, entity: service, page, title: service.title };
  }
  const project = findBySlugOrSource(ctx.projects, fullPath, last);
  if (project) {
    const page = pages.find((p) => p.sourceUrl && pathOf(p.sourceUrl) === pathOf(project.sourceUrl))
      || pages.find((p) => p.slug === last || p.slug === fullPath);
    return { kind: 'PROJECT_DETAIL', path: fullPath, slug: last, subRoute, entity: project, page, title: project.title };
  }
  const newsItem = findBySlugOrSource(ctx.news, fullPath, last);
  if (newsItem) return { kind: 'NEWS_DETAIL', path: fullPath, slug: last, subRoute, entity: newsItem, title: newsItem.title };
  const vacancy = findBySlugOrSource(ctx.vacancies, fullPath, last);
  if (vacancy) return { kind: 'VACANCY_DETAIL', path: fullPath, slug: last, subRoute, entity: vacancy, title: vacancy.title };
  const product = findBySlugOrSource(ctx.products || [], fullPath, last);
  if (product) return { kind: 'PRODUCT_DETAIL', path: fullPath, slug: last, subRoute, entity: product, title: product.title };

  // 2. CMS page — by full path slug, then by last segment (importer flattens
  //    nested source paths to the leaf slug).
  const page = pages.find((p) => p.slug === fullPath) || pages.find((p) => p.slug === last);
  if (page) {
    if (page.isHomepage) return { kind: 'HOME', path: fullPath, slug: page.slug, page };
    const collectionKind = collectionKindOf(page, ctx);
    if (collectionKind && !subRoute) {
      return { kind: 'COLLECTION', path: fullPath, slug: page.slug, collectionKind, page, title: page.title };
    }
    return { kind: 'PAGE', path: fullPath, slug: page.slug, subRoute, page, title: page.title };
  }

  // 3. Collection keyword without a page record (e.g. /services when only
  //    entities exist).
  const hinted = COLLECTION_SLUG_HINTS[route];
  if (hinted && !subRoute) {
    return { kind: 'COLLECTION', path: fullPath, slug: route, collectionKind: hinted };
  }

  return { kind: 'NOT_FOUND', path: fullPath, slug: last };
}
