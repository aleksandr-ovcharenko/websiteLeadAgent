import { chromium, type Browser, type Page } from 'playwright';
import type { CrawlOptions, CrawledPage, CrawlResult, NavigationNode, RootResolution } from '../types.js';
import { resolveSiteRoot, resolvedHomepageUrl, canonicalKey, type RootFetchResult } from './rootResolution.js';
import { CrawlFrontier, FRONTIER_PRIORITY } from './frontier.js';

function normalizeUrl(base: string, href: string): string | null {
  try {
    const u = new URL(href, base);
    const b = new URL(base);
    if (u.hostname !== b.hostname) return null;
    u.hash = '';
    // Drop common tracking/query params but keep useful paths.
    const keep = new Set(['page', 'p', 'category', 'tag']);
    for (const [k] of u.searchParams) {
      if (!keep.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    if (!u.search) u.search = '';
    const hrefHadTrailingSlash = href.endsWith('/') || (href === '' ? false : false);
    const pathnameHadTrailingSlash = u.pathname.endsWith('/');
    // Canonicalize /index.html and /index.htm to the directory root, preserving trailing slash when present.
    u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
    if (hrefHadTrailingSlash && pathnameHadTrailingSlash && u.pathname !== '/') u.pathname += '/';
    return u.toString().replace(/\?$/, '');
  } catch {
    return null;
  }
}

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '').replace(/^\//, '');
    return path || 'index';
  } catch {
    return 'index';
  }
}

const BLOCKED_PATH_SEGMENTS = new Set([
  'login', 'admin', 'wp-admin', 'cart', 'checkout', 'privacy',
  'cookie', 'cookies', 'terms', 'search', 'wp-login', 'logout',
  'account', 'register', 'auth', 'authentication', 'authorization',
  'wp-content', 'wp-includes', 'wp-json', 'xmlrpc', 'feed', 'comments', 'trackback'
]);

const BLOCKED_FILE_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
  '.zip', '.rar', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.avi', '.mov', '.css', '.js', '.xml', '.rss', '.json'
]);

const BLOCKED_QUERY_KEYS = ['fbclid', 'gclid', 'action', 'feed', 'share', 'replytocom'];

export function shouldCrawlUrl(nu: string): boolean {
  try {
    const u = new URL(nu);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    for (const key of u.searchParams.keys()) {
      const kl = key.toLowerCase();
      if (kl.startsWith('utm_') || BLOCKED_QUERY_KEYS.includes(kl)) return false;
    }

    const pathLower = u.pathname.toLowerCase();
    const segments = pathLower.split('/').filter(Boolean);
    if (segments.some((seg) => BLOCKED_PATH_SEGMENTS.has(seg))) return false;

    const extMatch = pathLower.match(/\.([a-z0-9]+)(?:\?.*)?$/);
    if (extMatch) {
      const ext = `.${extMatch[1]}`;
      if (BLOCKED_FILE_EXTENSIONS.has(ext)) return false;
    }

    if (/\/(print|feed|comments|trackback)(?:\/|$)/i.test(pathLower)) return false;

    return true;
  } catch {
    return false;
  }
}

function cleanLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 60);
}

async function handleCookieConsent(page: Page) {
  const labels = ['accept', 'agree', 'ok', 'allow', 'continue', 'yes'];
  for (const label of labels) {
    try {
      const el = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
        return;
      }
    } catch {}
  }
  try {
    const banners = page.locator('[class*="cookie"], [class*="consent"], [id*="cookie"], [id*="consent"]').first();
    if (await banners.isVisible().catch(() => false)) {
      await banners.evaluate((node) => { (node as HTMLElement).style.display = 'none'; });
    }
  } catch {}
}

type RawLink = { text: string; href: string; source: 'header' | 'footer' | 'body' };

type ExtractedImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  area?: number;
  context?: string;
  likelyLogo?: boolean;
  likelyHero?: boolean;
};

type PageThemeColors = {
  headerBg?: string;
  headerText?: string;
  linkColor?: string;
  buttonBg?: string;
  buttonText?: string;
  accent?: string;
};

type ExtractedNav = {
  title: string;
  meta: string;
  h1: string;
  canonicalUrl: string | null;
  text: string;
  html: string;
  logo: { src: string | null; href: string | null };
  favicon: string | null;
  heroImage: string | null;
  themeColors: PageThemeColors;
  links: RawLink[];
  images: ExtractedImage[];
  headerNav: NavigationNode[];
  footerNav: NavigationNode[];
};

function extractLinksFromContainer(container: HTMLElement | null, source: 'header' | 'footer' | 'body'): RawLink[] {
  if (!container) return [];
  const anchors = Array.from(container.querySelectorAll('a[href]'));
  return anchors
    .filter((a) => {
      const href = a.getAttribute('href') ?? '';
      return href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:');
    })
    .map((a) => ({
      text: cleanLabel(a.textContent ?? ''),
      href: a.getAttribute('href') ?? '',
      source
    }))
    .filter((l) => l.text && l.href);
}

function buildNavTree(links: RawLink[], baseUrl: string, depth = 0): NavigationNode[] {
  const roots: NavigationNode[] = [];
  const map = new Map<string, NavigationNode>();
  const seenRoots = new Set<string>();

  for (const link of links) {
    const nu = normalizeUrl(baseUrl, link.href);
    if (!nu) continue;
    const existing = map.get(nu);
    if (existing) {
      if (link.source === 'header') existing.source = 'header';
      continue;
    }
    const node: NavigationNode = { label: link.text, url: nu, source: link.source, children: [] };
    map.set(nu, node);
    if (depth === 0) {
      roots.push(node);
      seenRoots.add(nu);
    }
  }

  // If a header link was later expanded on a deeper page, children will be added by the caller.
  return roots;
}

function mergeHeaderAndFooter(header: NavigationNode[], footer: NavigationNode[]): NavigationNode[] {
  // Preserve header order; add footer items that are not in header.
  const all = [...header];
  const headerUrls = new Set(header.map((n) => n.url));
  for (const f of footer) {
    if (f.url && !headerUrls.has(f.url)) all.push(f);
  }
  return all;
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const res = await fetch(sitemapUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const text = await res.text();
    return [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchSitemap(baseUrl: string): Promise<NavigationNode[]> {
  const candidates = ['/sitemap.xml', '/sitemap_index.xml'];
  // robots.txt may reference additional sitemap locations.
  try {
    const res = await fetch(new URL('/robots.txt', baseUrl).toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const text = await res.text();
      for (const m of text.matchAll(/^sitemap:\s*(\S+)/gim)) candidates.push(m[1]);
    }
  } catch {}
  const nodes: NavigationNode[] = [];
  const baseHost = (() => { try { return new URL(baseUrl).hostname.replace(/^www\./i, ''); } catch { return ''; } })();
  for (const candidate of candidates) {
    let sitemapUrl: string;
    try { sitemapUrl = /^https?:/i.test(candidate) ? new URL(candidate).toString() : new URL(candidate, baseUrl).toString(); } catch { continue; }
    let urls = await fetchSitemapUrls(sitemapUrl);
    // One level of nested sitemap indexes (WP-style post-sitemap.xml etc.).
    const nested = urls.filter((u) => /\.xml$/i.test(u));
    if (nested.length) {
      for (const n of nested.slice(0, 8)) {
        urls.push(...(await fetchSitemapUrls(n)));
      }
    }
    for (const u of urls) {
      // Same-site check tolerates www/non-www relative to the sitemap host.
      try {
        if (new URL(u).hostname.replace(/^www\./i, '') !== baseHost) continue;
      } catch { continue; }
      if (/\.xml$/i.test(u)) continue; // never enqueue sitemap indexes as pages
      const nu = normalizeUrl(baseUrl, u) || u;
      nodes.push({ label: 'Sitemap', url: nu, source: 'sitemap', children: [] });
    }
    if (nodes.length) break;
  }
  return nodes;
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? 30;
  const maxDepth = options.maxDepth ?? 4;
  const timeoutMs = options.timeoutMs ?? 30000;
  const rootTimeoutMs = options.rootTimeoutMs ?? Math.max(timeoutMs * 2, 60000);
  const rootRetries = options.rootRetries ?? 1;
  const baseUrl = normalizeUrl(options.baseUrl, options.baseUrl) ?? options.baseUrl;

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ['--ignore-certificate-errors', '--ignore-certificate-errors-spki-list', '--no-sandbox', '--disable-gpu']
  });
  const pages: CrawledPage[] = [];
  const allHeaderLinks: RawLink[] = [];
  const allFooterLinks: RawLink[] = [];
  const warnings: string[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const frontier = new CrawlFrontier(maxDepth);
  const fetchedFinalKeys = new Set<string>();

  // ---------------------------------------------------------------------
  // 1. Explicit root resolution. The homepage is the resolved canonical root
  //    or nothing — never a heuristic pick from whatever pages happened to load.
  // ---------------------------------------------------------------------
  const rootFetch = async (url: string, t: number): Promise<RootFetchResult> => {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
    const page = await context.newPage();
    const started = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: t });
      if (!resp) throw new Error('no response');
      // Redirect chain from the Playwright request graph.
      const chain: string[] = [];
      let req: any = resp.request().redirectedFrom();
      while (req) { chain.unshift(req.url()); req = req.redirectedFrom(); }
      const canonical = await page
        .evaluate(() => (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href)
        .catch(() => undefined);
      return {
        finalUrl: page.url() || url,
        redirectChain: chain,
        status: resp.status(),
        durationMs: Date.now() - started,
        canonicalUrl: canonical || undefined,
      };
    } catch (err: any) {
      if (/timeout/i.test(String(err?.message))) {
        const { RootFetchTimeout } = await import('./rootResolution.js');
        throw new RootFetchTimeout(String(err.message));
      }
      throw err;
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  };

  const rootResolution: RootResolution = await resolveSiteRoot(
    options.baseUrl,
    { timeoutMs: rootTimeoutMs, retries: rootRetries },
    rootFetch,
  );
  if (rootResolution.homepageStatus !== 'FOUND') {
    warnings.push(`Homepage not resolved (${rootResolution.homepageStatus}): ${rootResolution.failureReason || ''}`.trim());
  }

  // Canonical origin for same-site rules: the resolved final origin when FOUND,
  // otherwise the requested origin. www/non-www collapse through canonicalKey.
  const canonicalBase = rootResolution.finalUrl || baseUrl;
  let canonicalOrigin: string;
  try { canonicalOrigin = new URL(canonicalBase).origin; } catch { canonicalOrigin = new URL(baseUrl).origin; }
  const canonicalHost = new URL(canonicalOrigin).hostname;

  // Same-site check that tolerates www/non-www against the canonical host.
  function sameSite(url: string): boolean {
    try {
      const h = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      return h === canonicalHost.toLowerCase().replace(/^www\./, '');
    } catch { return false; }
  }

  function enqueue(nu: string, depth: number, source: 'root' | 'nav' | 'sitemap' | 'collection' | 'body' | 'footer', extra = 0) {
    if (depth > maxDepth) {
      skipped.push({ url: nu, reason: `depth ${depth} > maxDepth ${maxDepth}` });
      return;
    }
    if (!sameSite(nu)) {
      skipped.push({ url: nu, reason: 'off_site' });
      return;
    }
    if (!shouldCrawlUrl(nu)) {
      skipped.push({ url: nu, reason: 'blocked_by_rules' });
      frontier.plan.set(canonicalKey(nu), { url: nu, source, depth, priority: 0, attempted: false, result: 'BLOCKED' });
      return;
    }
    frontier.add(nu, depth, source, extra);
  }

  // Seed the resolved canonical root (FOUND) or the requested URL (otherwise).
  const seedUrl = rootResolution.homepageStatus === 'FOUND' && rootResolution.finalUrl
    ? rootResolution.finalUrl
    : baseUrl;
  frontier.add(seedUrl, 0, 'root');
  // If the requested URL differs from the resolved root, keep it as a candidate too.
  if (canonicalKey(baseUrl) !== canonicalKey(seedUrl)) frontier.add(baseUrl, 0, 'root', 5);

  // Seed from sitemap up front.
  let sitemap: NavigationNode[] = [];
  try {
    sitemap = await fetchSitemap(canonicalOrigin + '/');
    for (const n of sitemap) {
      if (n.url) enqueue(n.url, 0, 'sitemap');
    }
  } catch {}

  try {
    while (pages.length < maxPages) {
      const next = frontier.next();
      if (!next) break;
      const { url, depth } = next;
      const planKey = canonicalKey(url);
      frontier.mark(url, { attempted: true });

      const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
      const page = await context.newPage();
      try {
        await page.addInitScript({ content: 'window.__name = function __name(x){ return x; }; globalThis.__name = window.__name;' });
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch((e) => {
          if (/timeout/i.test(String(e?.message))) return 'TIMEOUT' as const;
          return null;
        });
        if (resp === 'TIMEOUT' || resp === null) {
          const reason = resp === 'TIMEOUT' ? `timeout ${timeoutMs}ms` : 'navigation failed';
          skipped.push({ url, reason });
          frontier.mark(url, { result: 'TIMEOUT', failureReason: reason });
          continue;
        }
        if (resp.status() >= 400) {
          console.warn('crawl non-2xx', url, resp.status());
          skipped.push({ url, reason: `HTTP ${resp.status()}` });
          frontier.mark(url, { result: 'HTTP_ERROR', status: resp.status() });
          continue;
        }

        // Redirect dedup: if the final URL canonicalizes to an already-fetched
        // document, record the alias instead of storing a duplicate document.
        const finalKey = canonicalKey(page.url() || url);
        if (finalKey !== planKey && fetchedFinalKeys.has(finalKey)) {
          frontier.mark(url, { result: 'REDIRECTED_TO_CANONICAL', finalUrl: page.url(), documentUrl: page.url() });
          continue;
        }
        fetchedFinalKeys.add(finalKey);

        await handleCookieConsent(page);
        await page.waitForTimeout(200);

        const baseOrigin = canonicalOrigin;
        const data = await page.evaluate(({ baseHref, baseOrigin: baseOriginStr }: { baseHref: string; baseOrigin: string }): ExtractedNav => {

          function cleanLabel(text: string): string {
            return text.replace(/\s+/g, ' ').trim().slice(0, 60);
          }

          function sameSiteHost(a: string, b: string): boolean {
            return a.toLowerCase().replace(/^www\./, '') === b.toLowerCase().replace(/^www\./, '');
          }

          function normalizeUrl(base: string, href: string): string | null {
            try {
              const u = new URL(href, base);
              const b = new URL(base);
              if (!sameSiteHost(u.hostname, b.hostname)) return null;
              u.hash = '';
              const keep = new Set(['page', 'p', 'category', 'tag']);
              for (const [k] of u.searchParams) {
                if (!keep.has(k.toLowerCase())) u.searchParams.delete(k);
              }
              if (!u.search) u.search = '';
              u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
              return u.toString().replace(/\?$/, '');
            } catch {
              return null;
            }
          }

          function validHref(href: string): boolean {
            return !!href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:');
          }

          function isInternal(base: string, href: string): boolean {
            try { return sameSiteHost(new URL(href, base).hostname, new URL(base).hostname); } catch { return false; }
          }

          function linkFromAnchor(a: HTMLAnchorElement, source: 'header' | 'footer' | 'body'): RawLink | null {
            const href = a.getAttribute('href') ?? '';
            if (!validHref(href) || !isInternal(baseHref, href)) return null;
            const text = cleanLabel(a.textContent ?? '');
            if (!text) return null;
            return { text, href, source };
          }

          function flattenNav(nodes: any[]): RawLink[] {
            const out: RawLink[] = [];
            for (const n of nodes) {
              if (n.url && n.label) out.push({ text: n.label, href: n.url, source: n.source });
              if (n.children?.length) out.push(...flattenNav(n.children));
            }
            return out;
          }

          function parseList(ul: HTMLUListElement | null, source: 'header' | 'footer'): any[] {
            if (!ul) return [];
            const nodes: any[] = [];
            for (const li of Array.from(ul.children)) {
              if (li.tagName !== 'LI') continue;
              const a = li.querySelector(':scope > a[href], :scope > div > a[href], :scope > span > a[href]') as HTMLAnchorElement | null;
              const childUl = li.querySelector(':scope > ul') as HTMLUListElement | null;
              if (!a && childUl) {
                nodes.push(...parseList(childUl, source));
                continue;
              }
              if (!a) continue;
              const l = linkFromAnchor(a, source);
              if (!l) {
                if (childUl) nodes.push(...parseList(childUl, source));
                continue;
              }
              const nu = normalizeUrl(baseHref, l.href);
              if (!nu) {
                if (childUl) nodes.push(...parseList(childUl, source));
                continue;
              }
              const children: any[] = childUl ? parseList(childUl, source) : [];
              nodes.push({ label: l.text, url: nu, source, children });
            }
            return nodes;
          }

          function extractNavTree(container: HTMLElement | null, source: 'header' | 'footer'): any[] {
            if (!container) return [];
            const topUl = container.querySelector('ul') as HTMLUListElement | null;
            if (topUl) return parseList(topUl, source);
            // fallback: flat anchors
            return Array.from(container.querySelectorAll('a[href]'))
              .map((a) => linkFromAnchor(a as HTMLAnchorElement, source))
              .filter(Boolean)
              .map((l: any) => ({ label: l.text, url: normalizeUrl(baseHref, l.href), source, children: [] }))
              .filter((n: any) => n.url);
          }

          function extractBodyLinks(): RawLink[] {
            const body = document.body;
            if (!body) return [];
            const seen = new Set<string>();
            return Array.from(body.querySelectorAll('a[href]'))
              .map((a) => linkFromAnchor(a as HTMLAnchorElement, 'body'))
              .filter(Boolean)
              .filter((l: any) => {
                const nu = normalizeUrl(baseHref, l.href);
                if (!nu || seen.has(nu)) return false;
                seen.add(nu);
                return true;
              }) as RawLink[];
          }

          function isHomeLink(href: string): boolean {
            if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
            const nu = normalizeUrl(baseHref, href);
            if (!nu) return false;
            try {
              const u = new URL(nu);
              const base = new URL(baseHref);
              return u.pathname === '/' || nu === baseOriginStr + '/' || u.href === base.href || u.href === baseOriginStr + '/';
            } catch {
              return false;
            }
          }

          function isUtilityImage(src: string, alt: string, cls: string, id: string, href: string): boolean {
            const hay = `${src} ${alt} ${cls} ${id} ${href}`.toLowerCase();
            return /\b(flag|flags|translate|gtranslate|weglot|wpml|lang|language|currency|search|cart|basket|user|account|profile|social|icon|icons|share|menu|hamburger|close|expand|dropdown)\b/.test(hay) ||
                   /cdn\.gtranslate\.net|translate\.google|weglot|wpml\.org/.test(src);
          }

          function logoScore(img: HTMLImageElement, baseHref: string): number {
            const src = resolveSrc(img.getAttribute('src') || '');
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const cls = (img.getAttribute('class') || '').toLowerCase();
            const id = (img.getAttribute('id') || '').toLowerCase();
            const link = img.closest('a[href]') as HTMLAnchorElement | null;
            const href = link ? normalizeUrl(baseHref, link.getAttribute('href') || '') || '' : '';
            if (isUtilityImage(src, alt, cls, id, href)) return -1000;
            let score = 0;
            if (cls.includes('logo') || alt.includes('logo') || src.includes('logo') || id.includes('logo')) score += 50;
            if (link && isHomeLink(link.getAttribute('href') || '')) score += 20;
            if (src.endsWith('.svg')) score += 10;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 0 && w < 260 && h > 0 && h < 140) score += 5;
            if (w > 0 && h > 0 && w / h > 1.2 && w / h < 5) score += 3;
            try {
              if (new URL(src, baseHref).hostname !== new URL(baseHref).hostname) score -= 15;
            } catch {}
            return score;
          }

          function extractLogo(): { src: string | null; href: string | null } {
            const header = document.querySelector('header, [role="banner"]') as HTMLElement | null;
            const nav = document.querySelector('nav, [role="navigation"]') as HTMLElement | null;
            const area = header || nav;
            const images = area ? Array.from(area.querySelectorAll('img')) as HTMLImageElement[] : Array.from(document.querySelectorAll('header img, nav img')) as HTMLImageElement[];
            let best: { img: HTMLImageElement; score: number } | null = null;
            for (const img of images) {
              const score = logoScore(img, baseHref);
              if (score < 0) continue;
              if (!best || score > best.score) best = { img, score };
            }
            let src: string | null = null;
            let href: string | null = null;
            if (best) {
              src = resolveSrc(best.img.getAttribute('src') || best.img.src);
              const link = best.img.closest('a[href]') as HTMLAnchorElement | null;
              if (link) href = normalizeUrl(baseHref, link.getAttribute('href') || '') || normalizeUrl(baseHref, link.href);
            } else if (area) {
              // Last resort: first image in header/nav that links internally and is not a utility icon.
              const firstLinked = Array.from(area.querySelectorAll('a[href] img')).find((img) => {
                const a = img.closest('a[href]') as HTMLAnchorElement | null;
                return a && normalizeUrl(baseHref, a.getAttribute('href') || '') && logoScore(img as HTMLImageElement, baseHref) >= -5;
              }) as HTMLImageElement | undefined;
              if (firstLinked) {
                src = resolveSrc(firstLinked.getAttribute('src') || firstLinked.src);
                const link = firstLinked.closest('a[href]') as HTMLAnchorElement | null;
                if (link) href = normalizeUrl(baseHref, link.getAttribute('href') || '') || normalizeUrl(baseHref, link.href);
              }
            }
            if (!href) {
              // Find any anchor pointing to the homepage.
              for (const a of Array.from(document.querySelectorAll('header a[href], nav a[href], [role="banner"] a[href]'))) {
                const raw = (a as HTMLAnchorElement).getAttribute('href') || '';
                if (isHomeLink(raw)) {
                  href = normalizeUrl(baseHref, raw);
                  break;
                }
              }
            }
            return { src, href };
          }

          function parseIconSize(sizes?: string): number {
            if (!sizes) return 0;
            const match = sizes.match(/(\d+)\s*x\s*(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          }

          function extractFavicon(): string | null {
            const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
            const candidates: { href: string; size: number }[] = [];
            for (const rel of rels) {
              const links = document.querySelectorAll(`link[rel="${rel}" i], link[rel*="${rel}" i]`);
              for (const el of Array.from(links)) {
                const link = el as HTMLLinkElement;
                if (link.href) {
                  const size = parseIconSize(link.getAttribute('sizes') || undefined);
                  candidates.push({ href: new URL(link.href, baseHref).toString(), size });
                }
              }
            }
            candidates.sort((a, b) => b.size - a.size);
            return candidates[0]?.href || null;
          }

          function resolveSrc(src: string): string {
            try { return new URL(src, baseHref).toString(); } catch { return src; }
          }

          function imageContext(img: HTMLImageElement): string {
            const section = img.closest('section, article, header, footer, main, [class*="hero" i], [class*="about" i], [class*="service" i], [class*="project" i], [class*="news" i]') as HTMLElement | null;
            if (section) {
              const cls = section.getAttribute('class') || '';
              const id = section.getAttribute('id') || '';
              return `${section.tagName.toLowerCase()} ${cls} ${id}`.trim().slice(0, 120);
            }
            return (img.parentElement?.getAttribute('class') || '').slice(0, 80);
          }

          function extractHeroImage(): string | null {
            const selectors = ['[class*="hero" i] img', '[class*="banner" i] img', 'header img', 'main > section:first-of-type img', 'section:first-of-type img'];
            const candidates: { src: string; area: number; top: number }[] = [];
            const viewport = window.innerHeight || 800;
            for (const sel of selectors) {
              for (const img of Array.from(document.querySelectorAll(sel))) {
                const el = img as HTMLImageElement;
                const src = resolveSrc(el.getAttribute('src') || '');
                if (!src || src.startsWith('data:')) continue;
                const rect = el.getBoundingClientRect();
                const w = el.naturalWidth || rect.width || 0;
                const h = el.naturalHeight || rect.height || 0;
                if (w < 300 || h < 150) continue;
                candidates.push({ src, area: w * h, top: rect.top });
              }
            }
            // Also consider body images not in header/footer
            const header = document.querySelector('header');
            const footer = document.querySelector('footer');
            for (const img of Array.from(document.querySelectorAll('img[src]'))) {
              const el = img as HTMLImageElement;
              if (header?.contains(el) || footer?.contains(el)) continue;
              const src = resolveSrc(el.getAttribute('src') || '');
              if (!src || src.startsWith('data:')) continue;
              const rect = el.getBoundingClientRect();
              const w = el.naturalWidth || rect.width || 0;
              const h = el.naturalHeight || rect.height || 0;
              if (w < 600 || h < 300 || rect.top > viewport) continue;
              candidates.push({ src, area: w * h, top: rect.top });
            }
            candidates.sort((a, b) => (a.top < 0 ? 1 : 0) - (b.top < 0 ? 1 : 0) || a.top - b.top || b.area - a.area);
            return candidates[0]?.src || null;
          }

          function extractThemeColors(): PageThemeColors {
            const header = document.querySelector('header') as HTMLElement | null;
            const nav = document.querySelector('nav, [role="navigation"]') as HTMLElement | null;
            const headerEl = header || nav;
            const firstLink = document.querySelector('a') as HTMLAnchorElement | null;
            const firstButton = document.querySelector('button, .btn, [class*="button" i]') as HTMLElement | null;
            const toHex = (c: string) => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return c;
                ctx.fillStyle = c;
                return ctx.fillStyle || c;
              } catch {
                return c;
              }
            };
            const get = (el: Element | null, prop: keyof CSSStyleDeclaration) => {
              if (!el) return undefined;
              const v = window.getComputedStyle(el)[prop as any] as string;
              if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return undefined;
              return toHex(v);
            };
            const linkColor = firstLink ? toHex(window.getComputedStyle(firstLink).color) : undefined;
            const accent = linkColor;
            return {
              headerBg: get(headerEl, 'backgroundColor'),
              headerText: get(headerEl, 'color'),
              linkColor,
              buttonBg: get(firstButton, 'backgroundColor'),
              buttonText: get(firstButton, 'color'),
              accent
            };
          }

          function extractImages(logoSrc: string | null): ExtractedImage[] {
            const header = document.querySelector('header, [role="banner"]');
            const footer = document.querySelector('footer');
            const seen = new Set<string>();
            const out: ExtractedImage[] = [];
            for (const img of Array.from(document.querySelectorAll('img[src]'))) {
              const el = img as HTMLImageElement;
              const raw = el.getAttribute('src') || '';
              if (!raw || raw.startsWith('data:')) continue;
              const src = resolveSrc(raw);
              if (seen.has(src)) continue;
              seen.add(src);
              const rect = el.getBoundingClientRect();
              const w = el.naturalWidth || rect.width || 0;
              const h = el.naturalHeight || rect.height || 0;
              const area = w * h;
              const alt = el.getAttribute('alt') || '';
              const context = imageContext(el);
              const inHeader = !!header?.contains(el);
              const inFooter = !!footer?.contains(el);
              const link = el.closest('a[href]') as HTMLAnchorElement | null;
              const isHomeLinkValue = link ? isHomeLink(link.getAttribute('href') || '') : false;
              const logoScoreValue = inHeader ? logoScore(el as HTMLImageElement, baseHref) : -Infinity;
              const likelyLogo = src === logoSrc || logoScoreValue >= 15 || inHeader && (alt.toLowerCase().includes('logo') || (el.getAttribute('class') || '').toLowerCase().includes('logo') || isHomeLinkValue);
              const likelyHero = !inHeader && !inFooter && area > 200000 && rect.top < (window.innerHeight || 800);
              out.push({ src, alt, width: w, height: h, area, context, likelyLogo, likelyHero });
            }
            return out;
          }

          const title = document.title || '';
          const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content ?? '';
          const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
          const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
          const canonicalUrl = canonicalLink?.href ? normalizeUrl(baseHref, canonicalLink.href) : null;
          const body = document.body?.innerText ?? '';
          const html = document.documentElement?.outerHTML ?? '';

          const headerEl = document.querySelector('header') as HTMLElement | null;
          const navEl = document.querySelector('nav, [role="navigation"]') as HTMLElement | null;
          const headerContainer = headerEl || navEl;
          const footerEl = document.querySelector('footer') as HTMLElement | null;

          const headerNav = extractNavTree(headerContainer, 'header');
          const footerNav = extractNavTree(footerEl, 'footer');
          const bodyLinks = extractBodyLinks();

          const navFlat = [...flattenNav(headerNav), ...flattenNav(footerNav)];
          const allLinks = [...navFlat, ...bodyLinks];

          const logo = extractLogo();
          const favicon = extractFavicon();
          const heroImage = extractHeroImage();
          const images = extractImages(logo.src);
          const themeColors = extractThemeColors();

          return {
            title,
            meta,
            h1,
            canonicalUrl,
            text: body.slice(0, 12000),
            html,
            logo,
            favicon,
            heroImage,
            themeColors,
            links: allLinks,
            images,
            headerNav,
            footerNav
          };
        }, { baseHref: canonicalBase, baseOrigin });

        const pageFinalUrl = page.url() || url;
        pages.push({
          url: normalizeUrl(canonicalBase, pageFinalUrl) || pageFinalUrl,
          requestedUrl: url,
          finalUrl: pageFinalUrl,
          title: data.title,
          metaDescription: data.meta,
          h1: data.h1,
          canonicalUrl: data.canonicalUrl || undefined,
          text: data.text,
          html: data.html,
          links: data.links,
          images: data.images,
          logo: data.logo.src || undefined,
          logoHref: data.logo.href || undefined,
          favicon: data.favicon || undefined,
          heroImage: data.heroImage || undefined,
          themeColors: data.themeColors,
          headerNav: data.headerNav,
          footerNav: data.footerNav,
          path: slugFromUrl(pageFinalUrl),
          depth,
          priority: depth,
          navItem: false
        });
        frontier.mark(url, { result: 'CRAWLED', status: resp.status(), finalUrl: pageFinalUrl, documentUrl: pageFinalUrl });

        const isNavItem = (href: string) => {
          const nu = normalizeUrl(canonicalBase, href);
          if (!nu) return false;
          return [...allHeaderLinks, ...allFooterLinks].some((l) => normalizeUrl(canonicalBase, l.href) === nu);
        };

        if (depth < maxDepth) {
          for (const link of data.links) {
            const nu = normalizeUrl(canonicalBase, link.href);
            if (!nu) continue;
            if (link.source === 'header') {
              allHeaderLinks.push({ ...link });
              enqueue(nu, depth + 1, 'nav', isNavItem(link.href) ? -30 : 0);
            } else if (link.source === 'footer') {
              allFooterLinks.push({ ...link });
              enqueue(nu, depth + 1, 'footer', isNavItem(link.href) ? -30 : 0);
            } else {
              enqueue(nu, depth + 1, 'body');
            }
          }
        }
      } catch (err: any) {
        console.warn('crawl page failed', url, err);
        skipped.push({ url, reason: err?.message || 'page_crawl_failed' });
        frontier.mark(url, { result: 'FAILED', failureReason: err?.message || 'page_crawl_failed' });
      } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // Build canonical navigation tree from the first page's header/footer DOM trees.
  let firstPageHeaderNav: NavigationNode[] = [];
  let firstPageFooterNav: NavigationNode[] = [];
  if (pages[0]?.headerNav) {
    firstPageHeaderNav = pages[0].headerNav;
    firstPageFooterNav = pages[0].footerNav || [];
  } else {
    firstPageHeaderNav = buildNavTree(allHeaderLinks, baseUrl);
    firstPageFooterNav = buildNavTree(allFooterLinks, baseUrl);
  }
  const navigation = mergeHeaderAndFooter(firstPageHeaderNav, firstPageFooterNav);

  // Homepage identity comes ONLY from root resolution. When the root could
  // not be fetched the homepage stays UNKNOWN — an internal page must never
  // be promoted to HOME just because it was the first/best page crawled.
  const resolvedHome = resolvedHomepageUrl(rootResolution);
  let homepage: CrawlResult['homepage'];
  if (resolvedHome) {
    const homeKey = canonicalKey(resolvedHome);
    const pageIndex = pages.findIndex((p) => canonicalKey(p.finalUrl || p.url) === homeKey);
    homepage = {
      url: resolvedHome,
      confidence: pageIndex >= 0 ? 1 : 0.8,
      reason: pageIndex >= 0 ? 'root resolved and crawled' : 'root resolved; canonical root not in crawled set',
      pageIndex,
      status: 'FOUND',
    };
  } else {
    homepage = {
      url: canonicalOrigin + '/',
      confidence: 0,
      reason: `root not resolved: ${rootResolution.homepageStatus} ${rootResolution.failureReason || ''}`.trim(),
      pageIndex: -1,
      status: rootResolution.homepageStatus,
    };
  }

  // Every candidate that was never attempted is budget-exhausted.
  const crawlPlan = frontier.finalizePlan('BUDGET_EXHAUSTED');

  return { pages, navigation, homepage, rootResolution, crawlPlan, warnings, skipped };
}
