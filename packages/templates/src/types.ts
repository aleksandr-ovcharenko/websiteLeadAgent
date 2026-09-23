export interface NavItem {
  id: string;
  label: string;
  href: string;
  target?: string;
  targetType?: 'HOME' | 'HOME_SECTION' | 'COLLECTION' | 'PAGE' | 'CONTENT_DETAIL' | 'EXTERNAL_URL' | 'CUSTOM_URL' | string;
  children?: NavItem[];
  showInHeader?: boolean;
  showInFooter?: boolean;
  showOnHomepage?: boolean;
  external?: boolean;
  sortOrder?: number;
}

export interface HomepageSection {
  id?: string;
  type?: string;
  target?: string;
  targetType?: 'HOME_SECTION' | 'COLLECTION' | 'PAGE' | 'CUSTOM' | string;
  sectionType?: string;
  enabled?: boolean;
  sortOrder?: number;
  title?: string;
  /** Resolved display heading (edited block `heading` preferred over `title`). */
  heading?: string;
  eyebrow?: string;
  subtitle?: string;
  limit?: number;
  displayVariant?: string;
  selectedItemIds?: string[];
  /** Original Page.blocks payload when the section was resolved from canonical blocks. */
  block?: Record<string, any>;
  /** False when the active template cannot render this section type. */
  supported?: boolean;
}

export type RenderNode = any;

export interface TemplateManifest {
  id: string;
  name: string;
  fallbackPrimaryColor?: string;
  supportedSectionTypes: string[];
  sectionRendererMap: Record<string, string>;
  collectionRendererMap: Record<string, string>;
  pageRenderer?: string;
}

export interface RenderContext {
  site: any;
  settings: any;
  theme: any;
  hero: any;
  about: any;
  cta: any;
  logo: any;
  favicon: any;
  homepageSections: HomepageSection[];
  pages: any[];
  services: any[];
  projects: any[];
  products?: any[];
  news: any[];
  vacancies: any[];
  menu: NavItem[];
  mediaMap: Map<string, any>;
  route: string;
  subRoute?: string;
  /** The token the page was requested with (variant token takes precedence over site token). */
  previewToken?: string;
  manifest?: TemplateManifest;
  stylePreset?: string;
  /** 1-based collection page number from ?page=N (V3.7.2 pagination). */
  page?: number;
}

export interface Template {
  id: string;
  name: string;
  render(ctx: RenderContext): string;
}
