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
  PREVIEW_TOKEN?: string;
  SITE_ID?: string;
  COMPANY: CmsCompany;
  LOGO?: string;
  FAVICON?: string;
  NAV?: CmsNav;
  SECTIONS: CmsSection[];
}

const raw: CmsPayload = (window as any).__CMS__ || {
  route: '',
  COMPANY: { name: '' },
  NAV: { header: [], footer: [] },
  SECTIONS: [],
};

export const cms = raw;

export function sectionsOf(type: string): CmsSection[] {
  return (cms.SECTIONS || []).filter((s) => s.type === type);
}

export function firstOf(type: string): CmsSection | undefined {
  return sectionsOf(type)[0];
}
