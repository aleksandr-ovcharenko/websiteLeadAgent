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
  eyebrow?: string;
  subtitle?: string;
  limit?: number;
  displayVariant?: string;
  selectedItemIds?: string[];
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
  news: any[];
  vacancies: any[];
  menu: NavItem[];
  mediaMap: Map<string, any>;
  route: string;
  subRoute?: string;
  manifest?: TemplateManifest;
}

export interface Template {
  id: string;
  name: string;
  render(ctx: RenderContext): string;
}
