// CMS payload adapter — the ONLY data source for this template.
// Reads window.__CMS__ injected by the server-side renderer (index.ts).
// No local truth-graph imports, no bundled fixture data, no site-specific constants.

export interface CmsCompany {
  name: string;
  legalName?: string;
  unp?: string;
  founded?: string;
  employees?: string;
  address?: string;
  workingHours?: string;
  phone?: string;
  phoneHref?: string;
  email?: string;
}

export interface CmsItem {
  id: string;
  slug?: string;
  title: string;
  summary?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  location?: string;
  date?: string;
  description?: string;
  image?: string;
  gallery?: string[];
  href?: string;
  sourceUrl?: string;
  // certificate item fields (when section.type === 'certificates')
  src?: string;
  mediaId?: string;
  docType?: string;
  issuedBy?: string;
  issuedAt?: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  blocks: CmsSection[];
  sourceUrl?: string;
}

export interface CmsEntity extends CmsItem {
  kind?: string;
  sections?: CmsSection[];
  /** Canonical route back to the owning collection (news detail → /blog). */
  backHref?: string;
  backLabel?: string;
}

export interface CmsCollection {
  kind: string;
  heading?: string;
  items: CmsItem[];
  blocks?: CmsSection[];
  /** V3.7.2 pagination */
  page?: number;
  pageCount?: number;
  pageSize?: number;
  totalItems?: number;
  pager?: { page: number; href: string; current: boolean }[];
}

export interface CmsRoute {
  type: 'HOME' | 'PAGE' | 'SERVICE_DETAIL' | 'PROJECT_DETAIL' | 'NEWS_DETAIL' | 'VACANCY_DETAIL' | 'PRODUCT_DETAIL' | 'COLLECTION' | 'NOT_FOUND' | string;
  path: string;
  slug: string;
  title?: string;
}

export interface CmsSection {
  id: string;
  type: string;
  heading?: string;
  displayVariant?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  description?: string;
  caption?: string;
  image?: string;
  imageUrls?: string[];
  buttonLabel?: string;
  buttonUrl?: string;
  items?: CmsItem[];
  /** Canonical route of the collection this section previews (homepage). */
  collectionHref?: string;
  /** Total published entities behind this preview (for "Все …" gating). */
  totalItems?: number;
  /** Block-level toggle for the "Все …" collection link. */
  showAllLink?: boolean;
  reviews?: { author?: string; text?: string; rating?: number }[];
}

export interface CmsNavItem {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  children?: CmsNavItem[];
}

export interface CmsNav {
  header: CmsNavItem[];
  footer: CmsNavItem[];
}

export interface CmsPayload {
  route: string;
  subRoute?: string;
  ROUTE?: CmsRoute;
  BASE?: string;
  PREVIEW_TOKEN?: string;
  SITE_ID?: string;
  COMPANY: CmsCompany;
  LOGO?: string;
  FAVICON?: string;
  NAV?: CmsNav;
  SECTIONS: CmsSection[];
  PAGE?: CmsPage;
  ENTITY?: CmsEntity;
  COLLECTION?: CmsCollection;
  /** V3.7.3 — CMS-owned template copy dictionary. The ONLY source of
   *  user-visible furniture text; there are no renderer-side fallbacks. */
  COPY?: Record<string, string>;
}

const raw: CmsPayload = (window as any).__CMS__ || {
  route: '',
  ROUTE: { type: 'HOME', path: '', slug: 'index' },
  COMPANY: { name: '' },
  NAV: { header: [], footer: [] },
  SECTIONS: [],
};

export const cms = raw;

// ── Template copy (V3.7.3 CMS text ownership) ─────────────────────────────
// t() reads a CMS-owned dictionary string. Missing keys return '' — the
// component then omits the optional element or the QA gate blocks the run.
// tf() interpolates {name} params. No literal fallback phrases are allowed.
const COPY: Record<string, string> = raw.COPY || {};

export function t(key: string): string {
  const v = COPY[key];
  return typeof v === 'string' ? v : '';
}

export function tf(key: string, params: Record<string, string | number>): string {
  let s = t(key);
  for (const [k, v] of Object.entries(params)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

export function sectionsOf(type: string): CmsSection[] {
  return (cms.SECTIONS || []).filter((s) => s.type === type);
}

export function firstOf(type: string): CmsSection | undefined {
  return sectionsOf(type)[0];
}
