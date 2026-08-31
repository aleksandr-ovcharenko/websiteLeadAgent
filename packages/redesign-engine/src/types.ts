export interface CrawledImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  area?: number;
  context?: string;
  likelyLogo?: boolean;
  likelyHero?: boolean;
}

export interface CrawledThemeColors {
  headerBg?: string;
  headerText?: string;
  linkColor?: string;
  buttonBg?: string;
  buttonText?: string;
  accent?: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  text: string;
  html: string;
  links: { text: string; href: string; source?: 'header' | 'footer' | 'body' }[];
  images: CrawledImage[];
  logo?: string;
  heroImage?: string;
  themeColors?: CrawledThemeColors;
  headerNav?: NavigationNode[];
  footerNav?: NavigationNode[];
  path: string;
  depth: number;
  priority?: number;
  navItem?: boolean;
}

export interface NavigationNode {
  label: string;
  url?: string;
  children?: NavigationNode[];
  source?: 'header' | 'footer' | 'sitemap' | 'body';
}

export interface CrawlOptions {
  baseUrl: string;
  maxPages?: number;
  skipPaths?: string[];
  allowedKeywords?: string[];
  timeoutMs?: number;
  maxDepth?: number;
}

export interface CrawlResult {
  pages: CrawledPage[];
  navigation: NavigationNode[];
}

export type RedesignStage =
  | 'NOT_SELECTED'
  | 'SELECTED_FOR_REDESIGN'
  | 'CONTENT_EXTRACTED'
  | 'CONTENT_TRANSFORMED'
  | 'CMS_IMPORTED'
  | 'SITE_RENDERED'
  | 'AUDIT_DONE'
  | 'DEMO_GENERATED';
