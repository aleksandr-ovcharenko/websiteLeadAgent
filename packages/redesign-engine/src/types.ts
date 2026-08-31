export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  text: string;
  html: string;
  links: { text: string; href: string }[];
  images: { src: string; alt: string }[];
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
