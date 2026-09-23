import type { NavItem } from './types.js';

/**
 * Canonical navigation: CMS MenuItem records are the single source of truth
 * for both Studio NavEditor and the public renderer. This helper projects a
 * flat/tree MenuItem list into render-ready NavItems.
 *
 * `anchorForSection` maps HOME_SECTION/COLLECTION targets to in-page anchors
 * so single-page templates can resolve menu targets to section ids.
 */
export interface ResolvedNavItem {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  showOnHomepage: boolean;
  children?: ResolvedNavItem[];
}

const SECTION_ANCHOR: Record<string, string> = {
  ABOUT: 'about',
  SERVICES: 'services',
  PROJECTS: 'projects',
  NEWS: 'news',
  VACANCIES: 'vacancies',
  PRODUCTS: 'products',
  CONTACTS: 'contact',
  CONTACT: 'contact',
  HERO: 'hero',
  HOME: 'hero',
};

function pathnameOf(url: string): string {
  try {
    return new URL(url, 'http://x').pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    return url.replace(/^\/+|\/+$/g, '');
  }
}

function inferTargetFromPath(path: string): { targetType: string; target: string } {
  const key = path.toLowerCase();
  if (!key || key === 'index' || key === 'home') return { targetType: 'HOME', target: '' };
  const seg = key.split('/')[0];
  const section = Object.keys(SECTION_ANCHOR).find((k) => seg === k.toLowerCase());
  if (section) return { targetType: 'HOME_SECTION', target: section };
  return { targetType: 'PAGE', target: key };
}

export function resolveMenuHref(item: any, base: string): { href: string; external: boolean } {
  const targetType = item.targetType || '';
  const target = (item.target || '').toUpperCase();
  const showOnHomepage = item.showOnHomepage !== false;

  if (targetType === 'HOME') return { href: `${base}/`, external: false };
  if (targetType === 'HOME_SECTION' || targetType === 'COLLECTION') {
    const anchor = SECTION_ANCHOR[target] || target.toLowerCase();
    return { href: showOnHomepage ? `${base}/#${anchor}` : `${base}/${anchor}`, external: false };
  }
  if (targetType === 'PAGE') {
    const slug = item.page?.slug || (item.target || '').toLowerCase();
    if (slug === 'index' || slug === 'home') return { href: `${base}/`, external: false };
    if (SECTION_ANCHOR[slug.toUpperCase()] && showOnHomepage) {
      return { href: `${base}/#${SECTION_ANCHOR[slug.toUpperCase()]}`, external: false };
    }
    return { href: slug ? `${base}/${slug}` : `${base}/`, external: false };
  }
  if (targetType === 'CONTENT_DETAIL') {
    const [type, slug] = (item.target || '').split(':');
    return { href: type && slug ? `${base}/${type.toLowerCase()}/${slug}` : `${base}/`, external: false };
  }
  if (targetType === 'EXTERNAL_URL' || targetType === 'CUSTOM_URL') {
    const u = item.url || item.target || '';
    if (/^https?:\/\//.test(u)) return { href: u, external: true };
    return { href: u.startsWith('/') ? u : `${base}/${u}`, external: false };
  }

  // Untyped rows (crawler imports): infer from url/page.
  const u = item.url || '';
  if (u.startsWith('#')) return { href: `${base}/${u}`, external: false };
  if (/^https?:\/\//.test(u)) {
    const inferred = inferTargetFromPath(pathnameOf(u));
    if (inferred.targetType === 'HOME') return { href: `${base}/`, external: false };
    if (inferred.targetType === 'HOME_SECTION') {
      const anchor = SECTION_ANCHOR[inferred.target] || inferred.target.toLowerCase();
      return { href: `${base}/#${anchor}`, external: false };
    }
    const pageSlug = item.page?.slug;
    if (pageSlug) return { href: `${base}/${pageSlug}`, external: false };
    return { href: u, external: true };
  }
  if (u) {
    const inferred = inferTargetFromPath(pathnameOf(u));
    if (inferred.targetType === 'HOME') return { href: `${base}/`, external: false };
    if (inferred.targetType === 'HOME_SECTION') {
      const anchor = SECTION_ANCHOR[inferred.target] || inferred.target.toLowerCase();
      return { href: `${base}/#${anchor}`, external: false };
    }
    return { href: u.startsWith('/') ? u : `${base}/${u}`, external: false };
  }
  const pageSlug = item.page?.slug;
  if (pageSlug) return { href: `${base}/${pageSlug}`, external: false };
  return { href: `${base}/`, external: false };
}

/**
 * Project MenuItem rows (Prisma shape, with optional `children` and `page.slug`)
 * into ordered NavItems. Only `visible !== false` items are returned.
 */
export function buildNavItems(menu: any[] | undefined, base: string): ResolvedNavItem[] {
  if (!Array.isArray(menu) || menu.length === 0) return [];
  const sorted = [...menu].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return sorted
    .filter((item) => item.visible !== false && item.isVisible !== false)
    .map((item, i) => {
      const { href, external } = resolveMenuHref(item, base);
      const children = buildNavItems(item.children || [], base);
      return {
        id: item.id || `nav-${i}`,
        label: item.label || item.title || 'Item',
        href,
        external,
        sortOrder: item.sortOrder ?? i,
        showInHeader: item.showInHeader !== false,
        showInFooter: item.showInFooter !== false,
        showOnHomepage: item.showOnHomepage !== false,
        ...(children.length ? { children } : {}),
      };
    });
}

export function navForArea(items: ResolvedNavItem[], area: 'header' | 'footer'): ResolvedNavItem[] {
  const flag = area === 'header' ? 'showInHeader' : 'showInFooter';
  return items
    .filter((i) => i[flag])
    .map((i) => ({ ...i, children: i.children ? i.children.filter((c) => c[flag]) : undefined }));
}

/**
 * Header nav tree: hierarchical (never flattened), pruned of unroutable
 * targets. An item with an empty/'#' href and no routable children is dropped;
 * one with routable children survives as a toggle-only group (href '').
 */
export function headerNavTree<T extends { href?: string; showInHeader?: boolean; children?: T[]; sortOrder?: number }>(
  items: T[] | undefined,
): T[] {
  const routable = (href?: string) => !!href && href !== '#';
  const walk = (list: T[]): T[] =>
    (list || [])
      .filter((i) => i && i.showInHeader !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((i): T | null => {
        const children = i.children?.length ? walk(i.children) : undefined;
        if (!routable(i.href) && (!children || children.length === 0)) return null;
        return { ...i, href: routable(i.href) ? i.href : '', children: children?.length ? children : undefined } as T;
      })
      .filter((i): i is T => !!i);
  return walk(items || []);
}

/**
 * Flat leaf-first projection for footers/simple lists — order is parent then
 * its children, recursively. The header never uses this (hierarchy matters).
 */
export function flattenNavLeaves<T extends { children?: T[] }>(items: T[] | undefined): T[] {
  const out: T[] = [];
  for (const i of items || []) {
    out.push(i);
    if (i.children?.length) out.push(...flattenNavLeaves(i.children));
  }
  return out;
}
