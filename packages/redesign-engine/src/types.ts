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
  /** URL the crawl was pointed at (before redirects). */
  requestedUrl?: string;
  /** Final URL after redirects (page.url() / response url). */
  finalUrl?: string;
  title: string;
  metaDescription: string;
  h1: string;
  canonicalUrl?: string;
  text: string;
  html: string;
  links: { text: string; href: string; source?: 'header' | 'footer' | 'body' }[];
  images: CrawledImage[];
  logo?: string;
  logoHref?: string;
  favicon?: string;
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
  /** Bounded, separately configurable timeout for root/homepage discovery. */
  rootTimeoutMs?: number;
  /** Bounded retries for root/homepage discovery variants. */
  rootRetries?: number;
}

export type HomepageStatus =
  | 'FOUND'
  | 'UNREACHABLE'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'REDIRECT_FAILED'
  | 'UNKNOWN';

export interface RootResolution {
  requestedUrl: string;
  /** Every URL visited in the redirect chain, in order. */
  redirectChain: string[];
  finalUrl?: string;
  canonicalUrl?: string;
  /** HTTP status of the final response. */
  status?: number;
  durationMs: number;
  homepageStatus: HomepageStatus;
  failureReason?: string;
}

export type CrawlCandidateSource =
  | 'root'
  | 'nav'
  | 'sitemap'
  | 'collection'
  | 'body'
  | 'footer';

export type CrawlCandidateResult =
  | 'CRAWLED'
  | 'REDIRECTED_TO_CANONICAL'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'BLOCKED'
  | 'BUDGET_EXHAUSTED'
  | 'NOT_ATTEMPTED'
  | 'FAILED';

export interface CrawlPlanEntry {
  url: string;
  source: CrawlCandidateSource;
  depth: number;
  priority: number;
  attempted: boolean;
  result?: CrawlCandidateResult;
  status?: number;
  finalUrl?: string;
  failureReason?: string;
  /** SourceDocument/ crawled-page URL this candidate resolved to. */
  documentUrl?: string;
}

export interface HomepageCandidate {
  url: string;
  confidence: number;
  reason: string;
  pageIndex: number;
  /** Explicit resolution status — UNKNOWN is better than a wrong homepage. */
  status?: HomepageStatus;
}

export interface CrawlResult {
  pages: CrawledPage[];
  navigation: NavigationNode[];
  homepage: HomepageCandidate;
  rootResolution?: RootResolution;
  /** Observable plan: why every candidate was or was not fetched. */
  crawlPlan?: CrawlPlanEntry[];
  warnings: string[];
  skipped: { url: string; reason: string }[];
}

export type RedesignStage =
  | 'NOT_SELECTED'
  | 'SELECTED_FOR_REDESIGN'
  | 'CRAWL_READY'
  | 'CRAWL_FAILED'
  | 'CONTENT_EXTRACTED'
  | 'CONTENT_TRANSFORMED'
  | 'CMS_IMPORTED'
  | 'SITE_RENDERED'
  | 'AUDIT_DONE'
  | 'DEMO_GENERATED';

export interface SourceDocumentImage {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  domPath?: string;
  region: 'header' | 'footer' | 'nav' | 'main' | 'aside' | 'chrome' | 'unknown';
  provenance: {
    sourcePageUrl: string;
    sourceSectionId?: string;
    sourceSelector?: string;
    isLogo?: boolean;
    isHero?: boolean;
    isBackground?: boolean;
  };
  href?: string;
}

export interface SourceDocumentLink {
  text: string;
  href: string;
  source?: 'header' | 'footer' | 'nav' | 'body';
  domPath?: string;
}

export interface SourceDocumentCollection {
  id: string;
  selector: string;
  heading?: string;
  sectionId?: string;
  typeCandidate?: 'services' | 'projects' | 'news' | 'vacancies' | 'team' | 'testimonials' | 'unknown';
  items: {
    title?: string;
    description?: string;
    url?: string;
    image?: SourceDocumentImage;
    meta?: Record<string, string>;
    /** Group/category heading this item belongs to, e.g. "Residential" or "In progress". */
    group?: string;
    /** True when this item is itself a group/collection heading, not a concrete entity. */
    isGroup?: boolean;
  }[];
  /** Viewport-scoped container evidence (Tilda screen records, mobile menus)
   *  — used to collapse responsive collection copies. */
  responsiveScope?: { kind: 'min' | 'max' | 'menu' | 'clone'; px?: number; recId?: string };
}

export interface SourceDocumentFaq {
  question: string;
  answer: string;
  domPath?: string;
}

export interface SourceDocumentSection {
  id: string;
  level: number;
  heading?: string;
  region: 'main' | 'aside' | 'article' | 'chrome' | 'unknown';
  paragraphs: string[];
  lists: string[][];
  tables: { headers?: string[]; rows: string[][] }[];
  images: SourceDocumentImage[];
  links: SourceDocumentLink[];
  collections: SourceDocumentCollection[];
  /** Question/answer pairs recovered from accordion, details/summary and
   * toggle markup — typed evidence, never flattened into paragraphs. */
  faqs: SourceDocumentFaq[];
  domPath?: string;
  order: number;
  /** Responsive container scope the section was extracted from (Tilda
   *  `t-screenmin-Npx`/`t-screenmax-Npx` records, mobile-menu containers, or
   *  slider clones). Used to prove that an identical copy is a responsive
   *  representation rather than deliberate repeated content. */
  responsiveScope?: { kind: 'min' | 'max' | 'menu' | 'clone'; px?: number; recId?: string };
}

export interface SourceDocumentDiagnostics {
  /** Paragraphs removed by the deterministic adjacent-duplicate normalizer. */
  dedupedParagraphs: { sectionId: string; kind: 'heading-paragraph' | 'adjacent'; text: string }[];
  /** Whole sections removed as responsive representations of a retained
   *  section (Tilda screen-scoped record copies, menu containers, slider
   *  clones). Every removal records both ids and the fingerprint. */
  responsiveDuplicates?: {
    removedSectionId: string;
    retainedSectionId: string;
    fingerprint: string;
    reason: string;
    confidence: number;
    removedScope?: string;
    retainedScope?: string;
  }[];
  /** Identical-signature sections kept deliberately (no responsive evidence —
   *  legitimate contextual repetition). */
  repeatedContent?: { fingerprint: string; sectionIds: string[]; note: string }[];
  /** Tilda breakpoint artboards skipped inside a .t396 block (non-first). */
  droppedArtboards?: number;
  /** Slider/clone containers skipped outright. */
  droppedClones?: number;
  /** Zero-content sections (layout shells/spacers) dropped before dedupe. */
  droppedEmptySections?: number;
  /** Tracking pixels / lazy placeholders / data: blobs excluded from media. */
  droppedMedia?: number;
  /** Technical payloads (form-config JSON, widget state, code fragments)
   *  excluded from visible content — every drop records rule + evidence. */
  technicalPayloads?: {
    rule: string;
    confidence: number;
    sample: string;
    domPath?: string;
    context?: string;
  }[];
  /** UI-chrome / accessibility text rejected during the walk (nav toggles,
   *  carousel controls, screen-reader helpers, cookie/widget labels).
   *  Contextual, not a global blacklist — each entry carries its selector. */
  rejectedTexts?: {
    text: string;
    sourceUrl: string;
    selector: string;
    rejectionReason: string;
    extractionStage: string;
  }[];
}

export interface SourceDocumentChrome {
  header?: { html?: string; text?: string; links: SourceDocumentLink[]; images: SourceDocumentImage[] };
  footer?: { html?: string; text?: string; links: SourceDocumentLink[]; images: SourceDocumentImage[] };
  nav?: {
    primary?: NavigationNode[];
    secondary?: NavigationNode[];
    breadcrumbs?: { label: string; url?: string }[];
  };
  contacts?: {
    phones?: string[];
    emails?: string[];
    addresses?: string[];
    socialLinks?: { platform: string; url: string }[];
    workingHours?: string;
  };
  logo?: { src?: string; href?: string; alt?: string };
  favicon?: string;
  themeColors?: CrawledThemeColors;
}

export interface SourceDocumentEvidence {
  dates: { text: string; type: 'jsonld' | 'time' | 'meta' | 'visible'; context?: string }[];
  companyNameCandidates: { text: string; source: string }[];
  addressCandidates: string[];
}

export interface SourceDocument {
  id: string;
  url: string;
  path: string;
  title: string;
  metaDescription: string;
  h1?: string;
  canonicalUrl?: string;
  language?: string;
  isHomepage: boolean;
  depth: number;
  priority?: number;
  chrome: SourceDocumentChrome;
  sections: SourceDocumentSection[];
  collections: SourceDocumentCollection[];
  structuredData: any[];
  openGraph: Record<string, string>;
  evidence: SourceDocumentEvidence;
  images: SourceDocumentImage[];
  mainText: string;
  rawText: string;
  html: string;
  diagnostics?: SourceDocumentDiagnostics;
}
