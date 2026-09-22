import { load } from 'cheerio';
import type { CrawlResult, CrawledImage, CrawledPage, NavigationNode, SourceDocument, SourceDocumentChrome, SourceDocumentCollection, SourceDocumentDiagnostics, SourceDocumentEvidence, SourceDocumentImage, SourceDocumentLink, SourceDocumentSection } from '../types.js';
import { detectTechnicalPayload, dropIfTechnical, type TechnicalPayloadDrop } from './technicalPayload.js';

const COLLECTION_SELECTORS = [
  '.services', '.service-list', '[class*="service"]',
  '.projects', '.project-list', '.portfolio', '.portfolio-block', '[class*="portfolio"]', '[class*="project"]',
  '.news', '.news-list', '[class*="news"]',
  '.vacancies', '.vacancy-list', '.careers', '[class*="vacanc"]',
  '.cards', '.card-list', '.items', '.list-group', '.image-grid', '.isotope', '.team', '.reviews'
];

const CARD_SELECTORS = [
  '.card', '.service', '.project', '.portfolio-item', '.element', '.grid-item', '.work', '.works',
  '.news-item', '.vacancy', '.team-member', '.review',
  'li', 'article', '.item', '[class*="item"]', '[class*="element"]'
];

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '').replace(/^\//, '');
    return path || 'index';
  } catch {
    return 'index';
  }
}

function normalizeUrl(base: string, href: string): string | null {
  try {
    const u = new URL(href, base);
    const b = new URL(base);
    if (u.hostname !== b.hostname) return null;
    u.hash = '';
    if (!u.search) u.search = '';
    const hrefHadTrailingSlash = typeof href === 'string' && href.endsWith('/');
    const pathnameHadTrailingSlash = u.pathname.endsWith('/');
    u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
    if (hrefHadTrailingSlash && pathnameHadTrailingSlash && u.pathname !== '/') u.pathname += '/';
    return u.toString().replace(/\?$/, '');
  } catch {
    return null;
  }
}

function isInternal(base: string, href: string): boolean {
  try { return new URL(href, base).hostname === new URL(base).hostname; } catch { return false; }
}

function nodePath(el: any): string {
  const parts: string[] = [];
  let cur = el;
  while (cur && cur.type === 'tag' && cur.tagName) {
    const cls = cur.attribs?.class ? '.' + cur.attribs.class.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    const id = cur.attribs?.id ? `#${cur.attribs.id}` : '';
    parts.unshift(`${cur.tagName}${id}${cls}`);
    cur = cur.parent;
  }
  return parts.slice(-8).join(' > ');
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractPhones(text: string): string[] {
  const re = /[\(\+]?\d(?:[\s\(\)\-]?\d){6,30}/g;
  const matches = (text.match(re) || [])
    .map((m) => m.replace(/\s+/g, ' ').trim())
    .filter((m) => m.replace(/[^\d]/g, '').length >= 7)
    .map((m) => m.replace(/\s+/g, ' ').trim());
  return [...new Set(matches)];
}

function extractEmails(text: string): string[] {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(re) || [])];
}

function extractSocialLinks(text: string, links: { href: string }[]): { platform: string; url: string }[] {
  const domains = [
    { platform: 'VK', rx: /vk\.com|vkontakte\.ru/ },
    { platform: 'Instagram', rx: /instagram\.com|instagr\.am/ },
    { platform: 'Facebook', rx: /facebook\.com|fb\.com/ },
    { platform: 'Telegram', rx: /t\.me|telegram\.me/ },
    { platform: 'YouTube', rx: /youtube\.com|youtu\.be/ },
    { platform: 'LinkedIn', rx: /linkedin\.com/ },
    { platform: 'OK', rx: /ok\.ru/ },
  ];
  const out: { platform: string; url: string }[] = [];
  const seen = new Set<string>();
  const all = [...new Set([text, ...links.map((l) => l.href)])];
  for (const raw of all) {
    for (const d of domains) {
      if (d.rx.test(raw)) {
        const match = raw.match(/https?:\/\/[^\s\"<>]+/);
        if (match) {
          const u = match[0].replace(/[\"'<>]/g, '');
          if (!seen.has(u)) {
            seen.add(u);
            out.push({ platform: d.platform, url: u });
          }
        }
        break;
      }
    }
  }
  return out;
}

function workingHours(text: string): string | undefined {
  // Generic time-range pattern (HH:MM - HH:MM) without language-specific day names.
  const m = text.match(/(?:\b(?:mon|tue|wed|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su)[-.,/]?\s*)?\d{1,2}[\:\.]\d{2}\s*[-–—]\s*\d{1,2}[\:\.]\d{2}/i);
  return m ? m[0].trim() : undefined;
}

function addressCandidates(text: string): string[] {
  // Generic address-like snippets: at least 20 chars, contains a digit and a comma or street-like token.
  const re = /.{20,80}?\d+.{0,60}/g;
  const matches = (text.match(re) || [])
    .map(cleanText)
    .filter((s) => s.length >= 20 && s.length <= 100);
  return [...new Set(matches)].slice(0, 5);
}

function findHeadingLevel(tagName: string): number {
  const m = tagName.match(/^h([1-6])$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function buildDomPath(el: any): string {
  return nodePath(el);
}

/** Canonicalize CDN derivative URLs to the original asset. Tilda serves
 *  thumbs/resizes through thb./optim. hosts with `/-/transform/` path
 *  segments; the original always lives at static.tildacdn.biz/HASH/FILE.
 *  Collapsing derivatives onto the original makes thumb↔original pairs
 *  dedupe naturally via imageMap keys. */
function normalizeMediaUrl(url: string): string {
  if (url.startsWith('//')) url = `https:${url}`;
  try {
    const u = new URL(url);
    if (/(^|\.)(thb|optim|static|static-files)\.tildacdn\.\w+$/i.test(u.host) && u.pathname.includes('/-/')) {
      const hash = u.pathname.split('/-/')[0];
      let file = u.pathname.split('/-/').pop()!.split('/').pop() || '';
      file = file.replace(/\.webp$/i, '');
      if (!file) return url;
      return `https://static.tildacdn.biz${hash}/${file}`;
    }
    return url;
  } catch {
    return url;
  }
}

const TRACKING_HOST_RE = /(^|\.)(mc\.yandex\.|mc\.webvisor\.|google-analytics\.com|googletagmanager\.com|stats\.g\.doubleclick\.net|doubleclick\.net|googleadservices\.com|connect\.facebook\.net|facebook\.com|counter\.|metrika)/i;
const PLACEHOLDER_FILE_RE = /^(spacer|blank|pixel|1x1|transparent)\.(gif|png)$/i;

/** Tracking pixels, 1x1 beacons, inline data: blobs and lazy-load
 *  placeholders that must never enter the media inventory. */
function isDroppableMedia(src: string, width?: number, height?: number): boolean {
  if (!src || src.startsWith('data:')) return true;
  try {
    const u = new URL(src);
    if (TRACKING_HOST_RE.test(u.host)) return true;
    const file = u.pathname.split('/').pop() || '';
    if (PLACEHOLDER_FILE_RE.test(file)) return true;
  } catch { /* non-URL srcs still get the size check */ }
  if ((width ?? 0) > 0 && (height ?? 0) > 0 && (width ?? 0) <= 1 && (height ?? 0) <= 1) return true;
  return false;
}

function extractImageAttributes($: any, img: any, baseUrl: string, pageUrl: string, crawledImage?: CrawledImage): SourceDocumentImage | null {
  const $img = $(img);
  // data-original (Tilda lazy) carries the real asset; src is often a thumb.
  const src = $img.attr('data-original') || $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('data-img-zoom-url') || $img.attr('src') || '';
  const resolved = src ? normalizeUrl(baseUrl, src) || src : '';
  const absoluteSrc = resolved ? normalizeMediaUrl(resolved) : '';
  let width = parseInt($img.attr('width') || '', 10) || undefined;
  let height = parseInt($img.attr('height') || '', 10) || undefined;
  if (crawledImage) {
    width = width ?? crawledImage.width;
    height = height ?? crawledImage.height;
  }
  const $link = $img.closest('a');
  const href = $link.length ? $link.attr('href') : undefined;
  const $figure = $img.closest('figure');
  const caption = ($figure.find('figcaption').first().text() || $img.attr('title') || '').trim();
  const alt = ($img.attr('alt') || '').trim();
  const domPath = buildDomPath(img);
  if (isDroppableMedia(absoluteSrc, width, height)) return null;
  return {
    src: absoluteSrc,
    alt,
    caption,
    width,
    height,
    domPath,
    region: 'unknown',
    provenance: { sourcePageUrl: pageUrl, sourceSelector: domPath },
    href: href ? normalizeUrl(baseUrl, href) || href : undefined
  };
}

function elementRegion($el: any, chrome: { header?: any[]; footer?: any[]; nav?: any[] }): SourceDocumentImage['region'] {
  const ancestors: any[] = [];
  let cur = $el.get(0);
  while (cur && cur.type === 'tag') {
    ancestors.push(cur);
    cur = cur.parent;
  }
  for (const h of chrome.header || []) {
    if (ancestors.includes(h)) return 'header';
  }
  for (const f of chrome.footer || []) {
    if (ancestors.includes(f)) return 'footer';
  }
  for (const n of chrome.nav || []) {
    if (ancestors.includes(n)) return 'nav';
  }
  const tagName = $el.get(0)?.tagName?.toLowerCase();
  if (tagName === 'main' || $el.closest('main').length) return 'main';
  if (tagName === 'article' || $el.closest('article').length) return 'aside';
  if (tagName === 'aside' || $el.closest('aside').length) return 'aside';
  return 'unknown';
}

function identifyChrome($: any) {
  // Builder template parts (Elementor/ekit, theme header/footer parts) are chrome
  // even though they are plain divs. Their class names carry -header/-footer tokens.
  const header = $('header, [role="banner"], .site-header, .page-header, #header, .header, [class*="ekit-template-content-header"], [class*="elementor-location-header"], [class*="template-header"]').get();
  const footer = $('footer, .site-footer, .page-footer, #footer, .footer, [class*="ekit-template-content-footer"], [class*="elementor-location-footer"], [class*="template-footer"]').get();
  const nav = $('nav, .nav, .navigation, .menu, .main-menu, .site-menu, #nav, .navbar').get();
  return { header, footer, nav };
}

function removeNoise($: any) {
  $('script:not([type="application/ld+json"]), style, noscript, svg, canvas, template, iframe, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], .modal, [role="dialog"]').remove();
}

function extractMeta($: any, name: string): string {
  return $(`meta[name="${name}"]`).attr('content') || $(`meta[property="${name}"]`).attr('content') || '';
}

function extractOpenGraph($: any): Record<string, string> {
  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_: number, el: any) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) og[prop] = content;
  });
  return og;
}

function extractStructuredData($: any): any[] {
  const data: any[] = [];
  $('script[type="application/ld+json"]').each((_: number, el: any) => {
    const text = $(el).html() || '';
    try { data.push(JSON.parse(text)); } catch {}
  });
  return data;
}

function extractBreadcrumbs($: any, baseUrl: string, jsonld: any[]): { label: string; url?: string }[] {
  for (const sd of jsonld) {
    if (sd['@type'] === 'BreadcrumbList' || (Array.isArray(sd['@graph']) && sd['@graph'].some((x: any) => x['@type'] === 'BreadcrumbList'))) {
      const list = sd.itemListElement || sd['@graph']?.find((x: any) => x['@type'] === 'BreadcrumbList')?.itemListElement || [];
      return list.map((it: any) => {
        const label = typeof it.item === 'string' ? it.name || it.item : it.name || (it.item?.name) || '';
        const url = typeof it.item === 'string' ? it.item : it.item?.['@id'] || it.item?.url || undefined;
        return { label, url: url ? normalizeUrl(baseUrl, url) || url : undefined };
      }).filter((b: any) => b.label);
    }
  }
  const bc: { label: string; url?: string }[] = [];
  $('[class*="breadcrumb"], nav[aria-label="breadcrumb"]').first().find('a').each((_: number, el: any) => {
    const label = cleanText($(el).text());
    const href = $(el).attr('href');
    if (label) bc.push({ label, url: href ? normalizeUrl(baseUrl, href) || href : undefined });
  });
  return bc;
}

function navTreeFromLinks(links: { text: string; href: string }[]): NavigationNode[] {
  const roots: NavigationNode[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    if (!l.href || seen.has(l.href)) continue;
    seen.add(l.href);
    roots.push({ label: l.text, url: l.href, source: 'header', children: [] });
  }
  return roots;
}

function extractNavTree($: any, container: any, baseUrl: string, source: 'header' | 'footer'): NavigationNode[] {
  const seen = new Set<string>();
  function anchorNode(a: any): NavigationNode | null {
    const text = cleanText($(a).text());
    const href = $(a).attr('href') || '';
    if (!text || !href) return null;
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
    if (!isInternal(baseUrl, href)) return null;
    const nu = normalizeUrl(baseUrl, href);
    if (!nu || seen.has(nu)) return null;
    seen.add(nu);
    return { label: text, url: nu, source, children: [] };
  }
  function walkList(ul: any): NavigationNode[] {
    const nodes: NavigationNode[] = [];
    $(ul).children('li').each((_: number, li: any) => {
      const $li = $(li);
      const link = $li.children('a[href]').first().get(0) || $li.find('a[href]').first().get(0);
      const node = link ? anchorNode(link) : null;
      if (!node) {
        // List item may be a heading label with a nested submenu.
        const label = cleanText($li.contents().not($li.children('ul, ol')).text());
        if (label && $li.children('ul, ol').length) {
          const children = walkList($li.children('ul, ol').first());
          if (children.length) {
            nodes.push({ label, url: children[0].url, source, children });
          }
          return;
        }
      }
      if (!node) return;
      const nested = $li.children('ul, ol');
      if (nested.length) {
        node.children = walkList(nested.first());
      } else {
        const anyNested = $li.find('ul, ol');
        if (anyNested.length) node.children = walkList(anyNested.first());
      }
      nodes.push(node);
    });
    return nodes;
  }
  const $container = $(container);
  if ($container.is('ul, ol')) return walkList(container);
  if ($container.children('a[href]').length) {
    return $container.children('a[href]').map((_: number, a: any) => anchorNode(a)).get().filter(Boolean);
  }
  const nestedUl = $container.find('ul, ol').first();
  if (nestedUl.length) return walkList(nestedUl.get(0));
  return $container.find('a[href]').map((_: number, a: any) => anchorNode(a)).get().filter(Boolean);
}

function detectCollectionType($el: any, items: any[], baseUrl: string): SourceDocumentCollection['typeCandidate'] {
  const html = $el.toString().toLowerCase();
  const text = cleanText($el.text()).toLowerCase();
  const url = items.map((it: any) => it.url).filter(Boolean).join(' ').toLowerCase();
  const signal = html + ' ' + text + ' ' + url;
  if (/\bservice|\bservices|\bsolutions/.test(signal)) return 'services';
  if (/\bproject|\bprojects|\bportfolio|\bwork/.test(signal)) return 'projects';
  if (/\bnews|\bblog|\barticle|\bpress/.test(signal)) return 'news';
  if (/\bvacan|\bcareer|\bjob|\bjobs/.test(signal)) return 'vacancies';
  if (/\bteam|\bpeople|\bstaff/.test(signal)) return 'team';
  if (/\breview|\btestimonial|\btestimonials/.test(signal)) return 'testimonials';
  return 'unknown';
}

function cardContainerScore($: any, $root: any): { cards: number; children: number; score: number } {
  const rootEl = $root.get(0);
  const children = $root.children().get();
  if (!rootEl || rootEl.tagName === 'body' || rootEl.tagName === 'html' || children.length < 2) {
    return { cards: 0, children: children.length, score: 0 };
  }
  let cards = 0;
  for (const child of children) {
    const $child = $(child);
    const tag = child.tagName?.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'section') continue;
    const hasLink = $child.find('a[href]').length > 0 || tag === 'a';
    const hasHeading = /^h[2-6]$/i.test(tag) || $child.find('h2,h3,h4,h5,h6').length > 0;
    const hasImage = $child.find('img').length > 0;
    const hasText = $child.text().trim().length > 0;
    const hasDescription = $child.find('p').text().trim().length > 20;
    // A card must have a link, image, or a heading with a meaningful description.
    const isCard = (hasLink || hasImage || (hasHeading && hasDescription)) && hasText;
    if (isCard) cards++;
  }
  const score = children.length ? cards / Math.max(children.length, 3) : 0;
  return { cards, children: children.length, score };
}

function isCardContainer($: any, $root: any): boolean {
  if ($root.closest('header, footer, nav, [role="banner"]').length) return false;
  const rootEl = $root.get(0);
  if (!rootEl || rootEl.tagName === 'body' || rootEl.tagName === 'html') return false;
  // Page-wide wrappers that contain the global chrome are not card containers
  const chromeInside = $root.find('header, footer, nav, [role="banner"], .site-header, .site-footer, .main-navigation, .main-nav, .navbar, .nav, .menu, .header, .footer, #header, #footer, #nav, #menu').length > 0;
  if (chromeInside) return false;
  // Modal / popup / overlay containers are not content collections
  const cls = ($root.attr('class') || '');
  if (/\b(modal|popup|dialog|overlay|drawer|offcanvas|lightbox|backdrop|v-modal)\b/i.test(cls)) return false;

  const { cards, children } = cardContainerScore($, $root);
  if (children < 2 || cards < 2) return false;

  // A container whose children are mostly structural sections/articles is a page wrapper, not a card list
  const structuralTags = new Set(['section', 'article', 'aside']);
  const structuralChildren = $root.children().get().filter((c: any) => structuralTags.has(c.tagName?.toLowerCase())).length;
  if (children > 12 && structuralChildren / children >= 0.5) return false;

  // If a child is itself a card container, this root is a wrapper around smaller grids
  const childContainers = $root.children().filter((_i: number, c: any) => {
    const $c = $(c);
    const { cards: cc, children: cl } = cardContainerScore($, $c);
    return cl >= 2 && cc >= 2 && cc / cl >= 0.5;
  }).length;
  if (childContainers > 0) return false;

  return cards / children >= 0.45;
}

function detectCollections($: any, baseUrl: string, pageUrl: string, imageMap: Map<string, SourceDocumentImage>): SourceDocumentCollection[] {
  const collections: SourceDocumentCollection[] = [];
  const roots = new Set<any>();
  const candidates: { el: any; depth: number; score: number }[] = [];

  function scoreRoot(el: any): number {
    const $el = $(el);
    const { cards, children } = cardContainerScore($, $el);
    if (children < 2 || cards < 2) return 0;
    return cards + (children > 6 ? 1 : 0);
  }

  function addRoot(el: any) {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'body' || tag === 'html') return;
    if ($(el).find('header, footer, nav, [role="banner"], .site-header, .site-footer, .main-navigation, .main-nav, .navbar, .nav, .menu, .header, .footer, #header, #footer, #nav, #menu').length > 0) return;
    for (const r of roots) {
      if ($.contains(r, el) || $.contains(el, r)) return;
    }
    const col = parseCollection($, el, baseUrl, pageUrl, imageMap);
    if (col.items.length >= 2) {
      collections.push(col);
      roots.add(el);
    }
  }

  // Gather semantic candidates
  $(COLLECTION_SELECTORS.join(',')).each((_: number, el: any) => {
    if ($(el).closest('header, footer, nav, [role="banner"]').length) return;
    const depth = $(el).parents().length;
    const s = scoreRoot(el);
    if (s > 0) candidates.push({ el, depth, score: s });
  });

  // Gather structural candidates
  $('section, div, article, ul, ol').each((_: number, el: any) => {
    if ($(el).closest('header, footer, nav, [role="banner"]').length) return;
    if (isCardContainer($, $(el))) {
      const depth = $(el).parents().length;
      const s = scoreRoot(el);
      if (s > 0) candidates.push({ el, depth, score: s });
    }
  });

  // Prefer the deepest, most card-like containers. This keeps inner grids (e.g. .portfolio_block)
  // and rejects outer page wrappers (e.g. div#fw_c or div#content when it contains a real grid).
  candidates.sort((a, b) => b.depth - a.depth || b.score - a.score);

  for (const c of candidates) {
    addRoot(c.el);
  }

  return collections;
}

function collectionHeading($: any, collectionRoot: any): string {
  const $root = $(collectionRoot);
  // A collection heading must not be a card title nested inside the collection.
  const isCardHeading = (el: any) => $(el).closest('a, article, li, .card, .element, .item, .project, .service, .work, [class*="portfolio"], [class*="project"], [class*="card"]').length > 0;
  const findHeading = (query: any) => query.filter((_: number, el: any) => !isCardHeading(el)).first().text() || '';
  const heading =
    findHeading($root.closest('section, article, main, [class*="section"], [class*="area"]').find('h2,h3,h4,h5,h6')) ||
    findHeading($root.prevAll('h2,h3,h4,h5,h6')) ||
    findHeading($root.prevAll().find('h2,h3,h4,h5,h6')) ||
    findHeading($root.siblings('h2,h3,h4,h5,h6')) ||
    findHeading($root.parent().prevAll('h2,h3,h4,h5,h6'));
  return cleanText(heading);
}

function parseCollection($: any, collectionRoot: any, baseUrl: string, pageUrl: string, imageMap: Map<string, SourceDocumentImage>): SourceDocumentCollection {
  const $root = $(collectionRoot);
  const selector = buildDomPath(collectionRoot);
  const heading = collectionHeading($, collectionRoot);
  const items: SourceDocumentCollection['items'] = [];
  let cardEls: any[] = [];
  $root.children().each((_: number, child: any) => {
    const $child = $(child);
    const tag = child.tagName?.toLowerCase();
    if (/^h[2-6]$/i.test(tag)) {
      cardEls.push(child);
      return;
    }
    if ($child.is(CARD_SELECTORS.join(','))) {
      cardEls.push(child);
      return;
    }
    const inner = $child.find(CARD_SELECTORS.join(',')).first();
    if (inner.length) {
      cardEls.push(inner.get(0));
    }
  });
  if (cardEls.length < 2) {
    // DOM-generic fallback: use descendants that have links or headings.
    cardEls = $root.find(CARD_SELECTORS.join(',')).get();
  }
  if (cardEls.length < 2 && $root.get(0).tagName === 'li') {
    cardEls.push($root.get(0));
  }
  let currentGroup: string | undefined;
  for (const card of cardEls.slice(0, 50)) {
    const $card = $(card);
    const isGroup = /^h[2-6]$/i.test(card.tagName);
    const $titleEl = isGroup ? $card : $card.find('h1,h2,h3,h4,h5,h6,.title,.heading,[class*="title"]').first();
    const title = cleanText($titleEl.text()) || (isGroup ? '' : cleanText($card.find('a').first().text()));
    const $link = $card.is('a[href]') ? $card : $card.find('a[href]').first();
    const href = $link.attr('href');
    // '#popup'/'#prodpopup' anchors are JS triggers, not navigable resources.
    const url = href && !href.startsWith('#') ? normalizeUrl(baseUrl, href) || href : undefined;
    const description = cleanText(
      $card.find('p, [class*="descr"], [class*="subtitle"]').not($titleEl.find('*')).slice(0, 2).text());
    const $img = $card.find('img').first();
    let imgSrc = $img.attr('data-original') || $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('src') || '';
    if (!imgSrc) {
      // Tilda cards use div.t-bgimg data-original + inline background, no <img>.
      const $bg = $card.find('[data-original], [data-bg], [data-back], [data-background]').first();
      imgSrc = $bg.attr('data-original') || $bg.attr('data-bg') || $bg.attr('data-back') || $bg.attr('data-background') || '';
      if (!imgSrc) {
        const style = ($bg.length ? $bg : $card.find('[style*="background"]').first()).attr('style') || '';
        imgSrc = style.match(/url\(['"]?([^)'"]+)['"]?\)/)?.[1] || '';
      }
    }
    const image = imgSrc ? imageMap.get(normalizeMediaUrl(normalizeUrl(baseUrl, imgSrc) || imgSrc)) : undefined;
    const meta: Record<string, string> = {};
    $card.find('[class*="date"], [class*="price"], [class*="location"], [class*="category"]').each((_: number, el: any) => {
      const text = cleanText($(el).text());
      if (text) {
        const key = ($(el).attr('class') || '').split(/\s+/).find((c: string) => /date|price|location|category/.test(c)) || 'meta';
        meta[key] = text;
      }
    });
    if (isGroup && title) {
      currentGroup = title;
    }
    if (title || url || image || Object.keys(meta).length) {
      items.push({ title, description, url, image, meta, group: isGroup ? undefined : currentGroup, isGroup });
    }
  }
  const typeCandidate = detectCollectionType($root, items, baseUrl);
  return { id: `col-${Math.random().toString(36).slice(2, 9)}`, selector, heading, typeCandidate, items, responsiveScope: responsiveScopeOf($, collectionRoot) };
}

// Containers whose inner title/content pairing is a Q&A structure, not prose.
const FAQ_CONTAINER_SEL = [
  '[class*="accordion"]', '[class*="accrodion"]', '[class*="faq"]',
  '[data-accordion]', '[data-ekit-toggle]', '[class*="toggle"]',
  '.elementor-accordion', '.elementskit-accordion',
].join(',');
const FAQ_TITLE_SEL = 'summary, button, a, [role="button"], h3, h4, h5, [class*="title"], [class*="header"], [class*="question"], dt';
const FAQ_BODY_SEL = '[class*="content"], [class*="body"], [class*="answer"], dd, .collapse, .panel, [class*="panel"]';

interface FaqPair { qNode: any; aNode?: any; question: string; answer: string; }

/** Deterministic Q&A recovery from accordion/disclosure markup.
 *  Recognizes details/summary, aria-controls/aria-expanded triggers,
 *  data-target/data-toggle, Elementor/ElementsKit accordions and generic
 *  title+content item pairs inside accordion/faq/toggle containers. */
function extractFaqPairs($: any, root: any): { pairs: FaqPair[]; consumed: Set<any> } {
  const pairs: FaqPair[] = [];
  const consumed = new Set<any>();
  const seenQ = new Set<string>();
  const norm = (t: string) => cleanText(t).toLowerCase();
  const markSubtree = (el: any) => {
    if (!el) return;
    consumed.add(el);
    $(el).contents().each((_: number, n: any) => { consumed.add(n); markSubtree(n); });
  };
  const push = (qNode: any, aNode: any, question: string, answer: string) => {
    question = cleanText(question);
    answer = cleanText(answer);
    if (!question || !answer || question === answer) return;
    const key = norm(question);
    if (seenQ.has(key)) return;
    seenQ.add(key);
    pairs.push({ qNode, aNode, question, answer });
    markSubtree(qNode);
    if (aNode) markSubtree(aNode);
  };

  $(root).find('details').add($(root).filter('details')).each((_: number, el: any) => {
    const $d = $(el);
    const q = cleanText($d.children('summary').first().text());
    const a = cleanText($d.clone().children('summary').remove().end().text());
    push(el, el, q, a);
  });

  // Trigger → target resolution (aria-controls / data-target / href=#id).
  $(root).find('[aria-controls], [data-target], [data-ekit-toggle], [data-toggle]').each((_: number, el: any) => {
    const $t = $(el);
    const sel = $t.attr('aria-controls') || $t.attr('data-target') || $t.attr('data-ekit-toggle') || $t.attr('data-toggle') || '';
    const id = sel.replace(/^#/, '').trim();
    if (!id) return;
    const target = $(root).find(`#${id.replace(/([^a-zA-Z0-9_-])/g, '\\$1')}`).get(0);
    if (!target) return;
    const q = cleanText($t.find('[class*="title"], [class*="question"], span').first().text()) || cleanText($t.text());
    // Question must look like a question/title OR live in a Q&A container —
    // this excludes nav/menu toggles that also use aria-controls.
    const inFaq = $t.closest(FAQ_CONTAINER_SEL).length > 0;
    if (!inFaq && !/\?\s*$/.test(q)) return;
    const a = cleanText($(target).text());
    push(el, target, q, a);
  });

  // Elementor/ElementsKit + generic accordion items: title node → sibling content.
  $(root).find(FAQ_CONTAINER_SEL).each((_: number, container: any) => {
    const itemSel = '.elementor-accordion-item, .elementskit-card, .accordion-item, [class*="accordion-item"], [class*="faq-item"], [class*="toggle-item"], li, .item';
    $(container).find(itemSel).each((__: number, item: any) => {
      const $item = $(item);
      const titleEl = $item.children(FAQ_TITLE_SEL).get(0) || $item.find(FAQ_TITLE_SEL).get(0);
      if (!titleEl || consumed.has(titleEl)) return;
      const q = cleanText($(titleEl).find('[class*="title"], [class*="question"]').first().text()) || cleanText($(titleEl).text());
      if (!q || q.length > 200) return;
      const bodyEl =
        $item.children(FAQ_BODY_SEL).get(0) ||
        $(titleEl).nextAll(FAQ_BODY_SEL).get(0) ||
        $item.find(FAQ_BODY_SEL).get(0);
      if (!bodyEl || bodyEl === titleEl || consumed.has(bodyEl)) return;
      const a = cleanText($(bodyEl).clone().children(FAQ_TITLE_SEL).remove().end().text());
      if (!a || a === q) return;
      push(titleEl, bodyEl, q, a);
    });
  });

  return { pairs, consumed };
}

/** Elements whose subtree is machine state, not prose: forms and their field
 *  widgets, hidden-input/config wrappers, nosnippet/hidden/aria-hidden nodes.
 *  Tilda stores form field definitions in hidden <textarea> config elements
 *  (tn-atom__inputs-*) — walking them emits JSON arrays as paragraphs.
 *  Deliberately NOT included: display:none containers (popups/tabs hold real
 *  content), script/style/noscript (removed earlier by removeNoise). */
function isTechnicalContainer($: any, node: any): boolean {
  const tag = (node.tagName || '').toLowerCase();
  if (['form', 'textarea', 'input', 'select', 'datalist', 'option', 'output', 'fieldset', 'keygen'].includes(tag)) return true;
  const $n = $(node);
  if ($n.attr('hidden') !== undefined || $n.attr('data-nosnippet') !== undefined || $n.attr('data-hidden') !== undefined) return true;
  if (($n.attr('aria-hidden') || '').toLowerCase() === 'true') return true;
  const cls = $n.attr('class') || '';
  if (/(__inputs-wrapp|__inputs-data|__inputs-textarea|js-form-spec|form-spec-comments|errorbox|successbox)\b/i.test(cls)) return true;
  return false;
}

const normalizeDupText = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();

// --- UI-chrome / accessibility text rejection --------------------------------
// Builder chrome leaks interface strings into walked text: Bootstrap nav
// toggles (".sr-only" spans), slick/owl/swiper carousel buttons, skip links,
// cookie bars. Two tiers, never a blind global blacklist:
//   STRONG — vocabulary that is never customer prose in any context
//   WEAK   — short control labels rejected only with structural chrome
//            evidence (control class/tag/role/aria on self or an ancestor).
// Ordinary prose ("следующий этап", "назад к истокам") never matches: both
// tiers are exact-match on the whole normalized string.
const STRONG_UI_CHROME_RE = /^(toggle navigation|navigation toggle|skip to (main )?(content|navigation)|open (the )?menu|close (the )?menu|previous slide|next slide|play slideshow|pause slideshow|slide \d+|открыть меню|закрыть меню|меню навигации|предыдущий слайд|следующий слайд|пропустить к (содержимому|контенту)|навигация слайдера)$/i;
const WEAK_UI_CHROME_RE = /^(previous|next|prev|more info|назад|впер[её]д|далее|след\.?|пред\.?|закрыть|открыть|play|pause|stop|\d+\s*[/|]\s*\d+|‹|›|«|»|<|>)$/i;
/** Class/id tokens marking a node (or subtree) as interface chrome. */
const CHROME_CONTROL_RE = /\b(sr[-_]?only|screen[-_]?reader|visually[-_]?hidden|visuallyhidden|a11y[-_]?(text|only|skip)|slick[-_]?(arrow|prev|next|dots?)|carousel[-_]?(control|indicators)|owl[-_]?(prev|next|dots|nav|controls)|swiper[-_]?(button|pagination|scrollbar)|t[-_]?slds__(arrow|bullet|controls)|navbar[-_]?toggle|nav[-_]?toggle|menu[-_]?toggle|hamburger|burger|skip[-_]?link|scroll[-_]?top|back[-_]?to[-_]?top|scrolltop|totop|pswp|lightbox|mfp[-_]|fancybox|magnific|select2|chosen|g[-_]?recaptcha|recaptcha|bx[-_]?(pager|controls|prev|next)|flex[-_]?(prev|next|control|direction)|popup[-_]?close|modal[-_]?close|js[-_]?close|close[-_]?btn|tn[-_]?atom__s[-_]?close|pageup|pagedown)/i;
/** Third-party widget roots (chat/callback/analytics/share vendors). Their
 *  entire subtree is vendor UI, never customer copy — dropped wholesale. */
const VENDOR_WIDGET_RE = /\b(leadia|jivosite|jivo[-_]|chatra|tawk[-_]?to|intercom|drift[-_]|zendesk|smartsupp|livechat|envybox|callbackhunter|callback[-_]?killer|talk[-_]?me|whatsapp[-_]?widget|telegram[-_]?widget|onicon|livetex|webim|siteheart|perezvon|usermind|cackle|disqus|remarketa|pluso|uptolike|share42|ya-share|yandex-share|push[-_]?world|sendpulse|onesignal|recaptcha[-_]?badge|grecaptcha[-_]?badge)/i;
const CONTROL_TAGS = new Set(['button', 'select', 'option']);

/** True when the node or a near ancestor is marked as interface chrome by
 *  class, role, or control tag. Drives weak-vocabulary rejection. */
function hasChromeContext($: any, node: any): boolean {
  let cur: any = node;
  for (let depth = 0; depth < 8 && cur && cur.type === 'tag'; depth++) {
    const tag = (cur.tagName || '').toLowerCase();
    if (CONTROL_TAGS.has(tag)) return true;
    const cls = cur.attribs?.class || '';
    const id = cur.attribs?.id || '';
    const role = (cur.attribs?.role || '').toLowerCase();
    const ariaLabel = cur.attribs?.['aria-label'] || '';
    if (CHROME_CONTROL_RE.test(cls) || CHROME_CONTROL_RE.test(id)) return true;
    if (['button', 'navigation', 'tab', 'tablist', 'toolbar', 'scrollbar'].includes(role)) return true;
    if (ariaLabel && (STRONG_UI_CHROME_RE.test(ariaLabel.trim()) || WEAK_UI_CHROME_RE.test(ariaLabel.trim()))) return true;
    if (tag === 'a' && /^#/.test(cur.attribs?.href || '')) return true;
    cur = cur.parent;
  }
  return false;
}

// --- Responsive-duplicate detection -----------------------------------------
// Tilda emits the same semantic block multiple times: Zero Block renders one
// `.t396__artboard` per breakpoint inside a single `.t396`, and authors
// duplicate whole `#rec*` records gated by `t-screenmin-Npx`/`t-screenmax-Npx`
// classes. Both must collapse to one semantic section — but only with
// responsive evidence; identical content in different flow contexts stays.

type ResponsiveScope = NonNullable<SourceDocumentSection['responsiveScope']>;

function responsiveScopeOf($: any, node: any): ResponsiveScope | undefined {
  let cur = $(node);
  for (let depth = 0; depth < 10 && cur.length; depth++) {
    const cls = cur.attr('class') || '';
    const id = cur.attr('id') || '';
    const recId = id.match(/^rec(\d+)/)?.[0];
    const m = cls.match(/\bt-screen(min|max)-(\d+)px\b/);
    if (m) return { kind: m[1] as 'min' | 'max', px: Number(m[2]), recId };
    if (/\btmenu-mobile\b|\btmenu\b|\bt450\b|tmenu-mobile__menucontent/.test(cls)) {
      return { kind: 'menu', recId };
    }
    if (/\bslick-cloned\b|\bdata-slide-clone\b|\bt-slds__clone\b/.test(cls) || cur.attr('data-slide-clone') !== undefined) {
      return { kind: 'clone', recId };
    }
    cur = cur.parent();
  }
  return undefined;
}

/** Non-first `.t396__artboard` inside the same `.t396` block — breakpoint
 *  copies of identical atoms. */
function isDuplicateArtboard($: any, node: any): boolean {
  const $n = $(node);
  if (!$n.hasClass('t396__artboard')) return false;
  // Artboards may nest inside intermediate wrappers — compare against the
  // first artboard under the owning .t396 block, not the direct parent.
  const t396 = $n.closest('.t396');
  if (!t396.length) return false;
  return t396.find('.t396__artboard').get(0) !== node;
}

/** Whole-container clone/hidden markers that must never produce content. */
function isCloneContainer($: any, node: any): boolean {
  const $n = $(node);
  const cls = $n.attr('class') || '';
  if (/\bslick-cloned\b|\bt-slds__clone\b|\btmenu-mobile__menucontent_hidden\b/.test(cls)) return true;
  if ($n.attr('data-slide-clone') !== undefined) return true;
  return false;
}

function sectionFingerprint(sec: SourceDocumentSection): string {
  const imgKey = (src: string) => { try { return new URL(src).pathname.split('/').pop() || src; } catch { return src; } };
  return [
    normalizeDupText(sec.heading || ''),
    sec.paragraphs.map(normalizeDupText).join('¶'),
    sec.lists.map((l) => l.map(normalizeDupText).join('·')).join('¶'),
    sec.faqs.map((f) => normalizeDupText(f.question)).join('¶'),
    sec.links.map((l) => l.href).sort().join('¶'),
    sec.images.map((i) => imgKey(i.src)).sort().join('¶'),
  ].join('⁂');
}

/** Collapse near-duplicate sections when a copy carries responsive evidence
 *  (screen-scoped rec, menu container, slider clone) and the two copies sit
 *  in DIFFERENT scopes — same-scope or unscoped identical sections are
 *  legitimate contextual repetition and stay. Similarity is paragraph-set
 *  Jaccard ≥ 0.7 of the smaller set: breakpoint copies differ slightly in
 *  atom counts, so exact fingerprints are too strict. */
function dedupeResponsiveSections(sections: SourceDocumentSection[], diagnostics: SourceDocumentDiagnostics): SourceDocumentSection[] {
  // Layout shells: zero-content records (spacers, empty breakpoint wrappers)
  // carry no evidence — drop them before similarity work.
  const hasContent = (s: SourceDocumentSection) =>
    !!(s.heading || s.paragraphs.length || s.lists.length || s.faqs.length || s.links.length || s.images.length || s.tables.length);
  const emptyCount = sections.filter((s) => !hasContent(s)).length;
  if (emptyCount) diagnostics.droppedEmptySections = (diagnostics.droppedEmptySections ?? 0) + emptyCount;
  sections = sections.filter(hasContent);
  const scopeRank = (s?: ResponsiveScope) => !s ? 0 : s.kind === 'min' ? 1 : s.kind === 'max' ? 2 : s.kind === 'menu' ? 3 : 4;
  const scopeLabel = (s?: ResponsiveScope) => s ? `${s.kind}${s.px ?? ''}` : 'unscoped';
  const paraSet = (s: SourceDocumentSection) =>
    new Set([...(s.heading ? [s.heading] : []), ...s.paragraphs, ...s.faqs.map((f) => f.question)].map(normalizeDupText).filter(Boolean));

  const similarity = (a: SourceDocumentSection, b: SourceDocumentSection) => {
    const A = paraSet(a);
    const B = paraSet(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return inter / Math.min(A.size, B.size);
  };
  const differentScopes = (a: SourceDocumentSection, b: SourceDocumentSection) =>
    !!(a.responsiveScope || b.responsiveScope) &&
    scopeLabel(a.responsiveScope) !== scopeLabel(b.responsiveScope);

  // Union-find over similar, differently-scoped pairs (3+ breakpoint copies
  // collapse transitively).
  const parent = new Map<string, string>();
  const find = (x: string): string => { const p = parent.get(x); return p === undefined || p === x ? x : (parent.set(x, find(p)), parent.get(x)!); };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  const sig = new Map<string, SourceDocumentSection[]>();
  for (const s of sections) {
    const fp = sectionFingerprint(s);
    if (fp.replace(/[¶⁂]/g, '')) (sig.get(fp) || sig.set(fp, []).get(fp)!).push(s);
  }
  const identicalGroups = [...sig.values()].filter((g) => g.length > 1);

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i], b = sections[j];
      if (!differentScopes(a, b)) continue;
      const fpA = sectionFingerprint(a);
      const exact = fpA === sectionFingerprint(b) && fpA.replace(/[¶⁂]/g, '').length > 0;
      const sim = exact ? 1 : similarity(a, b);
      if (process.env.WLA_DEBUG_DEDUPE) console.error(`[dedupe] ${a.id}(${scopeLabel(a.responsiveScope)}) vs ${b.id}(${scopeLabel(b.responsiveScope)}) sim=${sim.toFixed(2)}`);
      if (sim >= 0.7) union(a.id, b.id);
    }
  }

  const components = new Map<string, SourceDocumentSection[]>();
  for (const s of sections) {
    const root = find(s.id);
    (components.get(root) ?? components.set(root, []).get(root)!).push(s);
  }

  const dropped = new Set<string>();
  for (const group of components.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) =>
      scopeRank(a.responsiveScope) - scopeRank(b.responsiveScope)
      || (b.responsiveScope?.px ?? 0) - (a.responsiveScope?.px ?? 0)
      || a.order - b.order);
    const retained = ranked[0];
    for (const dup of ranked.slice(1)) {
      dropped.add(dup.id);
      diagnostics.responsiveDuplicates ??= [];
      diagnostics.responsiveDuplicates.push({
        removedSectionId: dup.id,
        retainedSectionId: retained.id,
        fingerprint: sectionFingerprint(dup).slice(0, 120),
        reason: 'responsive-representation',
        confidence: 0.9,
        removedScope: scopeLabel(dup.responsiveScope),
        retainedScope: scopeLabel(retained.responsiveScope),
      });
    }
  }

  // Identical signatures that survived — no differing responsive scope —
  // are reported as preserved repetition, never silently removed.
  for (const g of identicalGroups) {
    const alive = g.filter((s) => !dropped.has(s.id));
    if (alive.length > 1) {
      diagnostics.repeatedContent ??= [];
      diagnostics.repeatedContent.push({
        fingerprint: sectionFingerprint(alive[0]).slice(0, 120),
        sectionIds: alive.map((s) => s.id),
        note: 'identical signature without differing responsive scope — preserved',
      });
    }
  }
  return sections.filter((s) => !dropped.has(s.id));
}

/** Same rule for card collections: collapse overlapping item signatures only
 *  when copies sit in different responsive scopes. */
function dedupeResponsiveCollections(collections: SourceDocumentCollection[], diagnostics: SourceDocumentDiagnostics): SourceDocumentCollection[] {
  const scopeRank = (s?: ResponsiveScope) => !s ? 0 : s.kind === 'min' ? 1 : s.kind === 'max' ? 2 : s.kind === 'menu' ? 3 : 4;
  const scopeLabel = (s?: ResponsiveScope) => s ? `${s.kind}${s.px ?? ''}` : 'unscoped';
  const itemSet = (c: SourceDocumentCollection) =>
    new Set(c.items.map((i) => [normalizeDupText(i.title || ''), i.url || '', i.image?.src || ''].join('~')).filter((x) => x !== '~~'));
  const overlap = (a: SourceDocumentCollection, b: SourceDocumentCollection) => {
    const A = itemSet(a), B = itemSet(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return inter / Math.min(A.size, B.size);
  };
  const dropped = new Set<string>();
  for (let i = 0; i < collections.length; i++) {
    for (let j = i + 1; j < collections.length; j++) {
      const a = collections[i], b = collections[j];
      if (dropped.has(b.id)) continue;
      if (!(a.responsiveScope || b.responsiveScope)) continue;
      if (scopeLabel(a.responsiveScope) === scopeLabel(b.responsiveScope)) continue;
      if (overlap(a, b) < 0.7) continue;
      const [retained, dup] = scopeRank(a.responsiveScope) <= scopeRank(b.responsiveScope) ? [a, b] : [b, a];
      dropped.add(dup.id);
      diagnostics.responsiveDuplicates ??= [];
      diagnostics.responsiveDuplicates.push({
        removedSectionId: dup.id,
        retainedSectionId: retained.id,
        fingerprint: normalizeDupText(retained.heading || '').slice(0, 120),
        reason: 'responsive-collection-representation',
        confidence: 0.9,
        removedScope: scopeLabel(dup.responsiveScope),
        retainedScope: scopeLabel(retained.responsiveScope),
      });
    }
  }
  // Degenerate companion rule (same scope allowed): a titleless collection
  // whose item images are subsumed by a titled collection is a structural
  // echo (e.g. Tilda mobile-grid image strips), not independent content.
  const titled = (c: SourceDocumentCollection) => c.items.filter((i) => normalizeDupText(i.title || '')).length;
  const imgSet = (c: SourceDocumentCollection) => new Set(c.items.map((i) => i.image?.src).filter(Boolean));
  for (let i = 0; i < collections.length; i++) {
    const c = collections[i];
    if (dropped.has(c.id) || titled(c) > 0) continue;
    const imgs = imgSet(c);
    if (!imgs.size) continue;
    const donor = collections.find((o, j) => j !== i && !dropped.has(o.id) && titled(o) > 0 &&
      [...imgs].filter((s) => imgSet(o).has(s)).length / imgs.size >= 0.6);
    if (!donor) continue;
    dropped.add(c.id);
    diagnostics.responsiveDuplicates ??= [];
    diagnostics.responsiveDuplicates.push({
      removedSectionId: c.id,
      retainedSectionId: donor.id,
      fingerprint: normalizeDupText(donor.heading || '').slice(0, 120),
      reason: 'degenerate-image-only-collection',
      confidence: 0.85,
      removedScope: scopeLabel(c.responsiveScope),
      retainedScope: scopeLabel(donor.responsiveScope),
    });
  }
  return collections.filter((c) => !dropped.has(c.id));
}

/** Deterministic duplicate normalizer: drops a first paragraph that merely
 * repeats the section heading, and collapses immediately-adjacent normalized
 * duplicates. Non-adjacent repetition is preserved by design; facts are never
 * deduplicated globally. Returns removal diagnostics. */
export function dedupeSectionParagraphs(sec: SourceDocumentSection): { sectionId: string; kind: 'heading-paragraph' | 'adjacent'; text: string }[] {
  const removed: { sectionId: string; kind: 'heading-paragraph' | 'adjacent'; text: string }[] = [];
  const out: string[] = [];
  for (const p of sec.paragraphs) {
    const n = normalizeDupText(p);
    if (!n) continue;
    if (out.length === 0 && sec.heading && n === normalizeDupText(sec.heading)) {
      removed.push({ sectionId: sec.id, kind: 'heading-paragraph', text: p.slice(0, 160) });
      continue;
    }
    if (out.length && n === normalizeDupText(out[out.length - 1])) {
      removed.push({ sectionId: sec.id, kind: 'adjacent', text: p.slice(0, 160) });
      continue;
    }
    out.push(p);
  }
  sec.paragraphs = out;
  return removed;
}

function collectSections($: any, root: any, baseUrl: string, pageUrl: string, imageMap: Map<string, SourceDocumentImage>, region: SourceDocumentSection['region'], diagnostics?: SourceDocumentDiagnostics): SourceDocumentSection[] {
  const sections: SourceDocumentSection[] = [];
  let current: SourceDocumentSection | null = null;
  let order = 0;
  const { pairs: faqPairs, consumed: faqConsumed } = extractFaqPairs($, root);
  const faqByTrigger = new Map<any, FaqPair>(faqPairs.map((p) => [p.qNode, p]));

  function flush() {
    if (current) sections.push(current);
    current = null;
  }

  function startSection(headingEl?: any, triggerNode?: any) {
    flush();
    const id = `sec-${order}-${Math.random().toString(36).slice(2, 7)}`;
    const level = headingEl ? findHeadingLevel(headingEl.tagName) : 0;
    const heading = headingEl ? cleanText($(headingEl).text()) : undefined;
    const scopeNode = headingEl ?? triggerNode;
    current = {
      id,
      level,
      heading,
      region,
      paragraphs: [],
      lists: [],
      tables: [],
      images: [],
      links: [],
      collections: [],
      faqs: [],
      domPath: headingEl ? buildDomPath(headingEl) : undefined,
      responsiveScope: scopeNode ? responsiveScopeOf($, scopeNode) : undefined,
      order: order++
    };
  }

  function ensureScope(node: any) {
    if (current && !current.responsiveScope) current.responsiveScope = responsiveScopeOf($, node);
  }

  const techDrops = diagnostics ? (diagnostics.technicalPayloads ??= []) : undefined;
  const rejectedTexts = diagnostics ? (diagnostics.rejectedTexts ??= []) : undefined;

  /** Record a rejected UI-chrome fragment with provenance. */
  const recordRejection = (text: string, node: any, reason: string, stage: string) =>
    rejectedTexts?.push({
      text: cleanText(text).slice(0, 160),
      sourceUrl: pageUrl,
      selector: node ? buildDomPath(node) : '',
      rejectionReason: reason,
      extractionStage: stage,
    });

  /** True when a text fragment is interface chrome: strong vocabulary always,
   *  weak control vocabulary only with structural chrome evidence. */
  const dropIfUiChrome = (text: string, node: any, stage: string): boolean => {
    const t = cleanText(text);
    if (!t) return false;
    if (STRONG_UI_CHROME_RE.test(t)) {
      recordRejection(t, node, 'ui-chrome-vocabulary', stage);
      return true;
    }
    if (WEAK_UI_CHROME_RE.test(t) && node && hasChromeContext($, node)) {
      recordRejection(t, node, 'ui-chrome-control-context', stage);
      return true;
    }
    return false;
  };

  /** True when the element itself is a UI control (nav toggle, carousel
   *  arrow/dot, close button, screen-reader helper) — its whole subtree is
   *  interface furniture, not customer copy. Control tags only qualify when
   *  their text is actually a control label, so real CTA buttons stay. */
  function isUiChromeElement(node: any): boolean {
    const tag = (node.tagName || '').toLowerCase();
    const cls = node.attribs?.class || '';
    const id = node.attribs?.id || '';
    const role = (node.attribs?.role || '').toLowerCase();
    const ariaLabel = (node.attribs?.['aria-label'] || '').trim();
    if (CHROME_CONTROL_RE.test(cls) || CHROME_CONTROL_RE.test(id) || VENDOR_WIDGET_RE.test(cls) || VENDOR_WIDGET_RE.test(id)) return true;
    if (ariaLabel && (STRONG_UI_CHROME_RE.test(ariaLabel) || WEAK_UI_CHROME_RE.test(ariaLabel))) return true;
    if (['navigation', 'toolbar', 'scrollbar', 'tablist'].includes(role)) return true;
    if (CONTROL_TAGS.has(tag) || role === 'button' || (tag === 'a' && /^#/.test(node.attribs?.href || ''))) {
      const text = cleanText($(node).text());
      return !text || STRONG_UI_CHROME_RE.test(text) || WEAK_UI_CHROME_RE.test(text);
    }
    return false;
  }

  function walkNode(node: any) {
    if (!node) return;
    if (node.type === 'tag') {
      // Responsive/clone containers are dropped before any content logic —
      // including FAQ triggers living inside them.
      if (isDuplicateArtboard($, node)) {
        if (diagnostics) diagnostics.droppedArtboards = (diagnostics.droppedArtboards ?? 0) + 1;
        return;
      }
      if (isCloneContainer($, node)) {
        if (diagnostics) diagnostics.droppedClones = (diagnostics.droppedClones ?? 0) + 1;
        return;
      }
      // Technical containers: forms and their field config, hidden-input
      // wrappers, nosnippet/hidden/aria-hidden payloads. Their text is widget
      // state (Tilda form-field JSON, masks, callbacks), never customer copy.
      // display:none is deliberately NOT a signal — Tilda popups/tabs hold
      // real content behind it.
      if (isTechnicalContainer($, node)) {
        techDrops?.push({
          rule: 'technical-container',
          confidence: 0.95,
          sample: cleanText($(node).text()).slice(0, 160),
          domPath: buildDomPath(node),
        });
        return;
      }
      // Interface chrome: nav toggles, carousel arrows/dots, screen-reader
      // helpers, close buttons. Their text is control labels, never content.
      if (isUiChromeElement(node)) {
        recordRejection($(node).text(), node, 'ui-chrome-element', 'walk');
        return;
      }
    }
    // Trigger nodes are marked consumed to shield their descendants — check
    // the trigger map BEFORE the consumed set or the pair never emits.
    const faq = faqByTrigger.get(node);
    if (faq) {
      if (!current) startSection(undefined, node);
      current!.faqs.push({ question: faq.question, answer: faq.answer, domPath: buildDomPath(node) });
      ensureScope(node);
      return;
    }
    if (faqConsumed.has(node)) return;
    if (node.type === 'text') {
      const text = cleanText(node.data || '');
      if (text && current && !dropIfTechnical(text, techDrops, { context: 'text-node' }) && !dropIfUiChrome(text, node.parent, 'text-node')) {
        current.paragraphs.push(text); ensureScope(node);
      }
      return;
    }
    if (node.type !== 'tag') return;
    const tagName = node.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'svg', 'canvas', 'template'].includes(tagName)) return;

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      // Heading text lives ONLY in section.heading — never duplicated into
      // paragraphs. Invariant: normalize(heading) !== normalize(paragraphs[0]).
      const hText = cleanText($(node).text());
      if (hText && (STRONG_UI_CHROME_RE.test(hText) || (WEAK_UI_CHROME_RE.test(hText) && hasChromeContext($, node)))) {
        recordRejection(hText, node, 'ui-chrome-heading', 'heading');
        return;
      }
      startSection(node);
      return;
    }

    if (!current) startSection(undefined, node);
    ensureScope(node);

    if (tagName === 'p') {
      const text = cleanText($(node).text());
      if (text && !dropIfTechnical(text, techDrops, { domPath: buildDomPath(node), context: 'paragraph' }) && !dropIfUiChrome(text, node, 'paragraph')) {
        current!.paragraphs.push(text);
      }
    } else if (tagName === 'a') {
      const text = cleanText($(node).text());
      const href = $(node).attr('href');
      if (href && text && isInternal(baseUrl, href) && !href.startsWith('#')) {
        const nu = normalizeUrl(baseUrl, href) || href;
        current!.links.push({ text, href: nu, source: 'body', domPath: buildDomPath(node) });
      }
      // Images inside links are still valid content evidence.
      $(node).find('img').each((_: number, imgNode: any) => {
        const img = extractImageAttributes($, imgNode, baseUrl, pageUrl);
        if (!img) return;
        img.region = region === 'main' ? 'main' : 'unknown';
        img.provenance.sourceSectionId = current!.id;
        imageMap.set(img.src, img);
        current!.images.push(img);
      });
    } else if (tagName === 'img') {
      const img = extractImageAttributes($, node, baseUrl, pageUrl);
      if (!img) return;
      img.region = region === 'main' ? 'main' : 'unknown';
      img.provenance.sourceSectionId = current!.id;
      imageMap.set(img.src, img);
      current!.images.push(img);
    } else if (tagName === 'ul' || tagName === 'ol') {
      const items: string[] = [];
      $(node).find('li').each((_: number, li: any) => {
        const itemText = cleanText($(li).text());
        if (itemText && !dropIfTechnical(itemText, techDrops, { domPath: buildDomPath(li), context: 'list-item' }) && !dropIfUiChrome(itemText, li, 'list-item')) items.push(itemText);
      });
      if (items.length) current!.lists.push(items);
    } else if (tagName === 'table') {
      const rows: string[][] = [];
      const headers: string[] = [];
      $(node).find('tr').each((rowIdx: number, tr: any) => {
        const cells: string[] = [];
        $(tr).find('th,td').each((_: number, td: any) => {
          const text = cleanText($(td).text());
          cells.push(text);
          if (rowIdx === 0 && td.tagName === 'th') headers.push(text);
        });
        if (cells.length) rows.push(cells);
      });
      if (rows.length) current!.tables.push({ headers: headers.length ? headers : undefined, rows });
    } else if (tagName === 'article' || tagName === 'section' ||
      (tagName === 'div' && /^rec\d+$/.test($(node).attr('id') || '') && /\bt-rec\b/.test($(node).attr('class') || ''))) {
      // Tilda design blocks: each #recN.t-rec IS one visual block — bound a
      // section to it so screen-scoped copies produce parallel fingerprints.
      const isTildaRec = tagName === 'div';
      if (isTildaRec) flush();
      $(node).children().each((_: number, child: any) => walkNode(child));
      if (isTildaRec) flush();
    } else if (['div', 'span', 'header', 'footer', 'main', 'aside'].includes(tagName)) {
      const text = cleanText($(node).clone().children().remove().end().text());
      if (text && !$(node).children().length) {
        if (!dropIfTechnical(text, techDrops, { domPath: buildDomPath(node), context: 'leaf' }) && !dropIfUiChrome(text, node, 'leaf')) {
          current!.paragraphs.push(text);
        }
      } else {
        $(node).contents().each((_: number, child: any) => walkNode(child));
      }
    } else {
      $(node).contents().each((_: number, child: any) => walkNode(child));
    }
  }

  $(root).contents().each((_: number, child: any) => walkNode(child));
  flush();
  for (const sec of sections) {
    diagnostics?.dedupedParagraphs.push(...dedupeSectionParagraphs(sec));
  }
  return diagnostics ? dedupeResponsiveSections(sections, diagnostics) : sections;
}

function extractEvidence($: any, jsonld: any[], pageTitle: string, baseUrl: string): SourceDocumentEvidence {
  const dates: SourceDocumentEvidence['dates'] = [];
  const companyNameCandidates: SourceDocumentEvidence['companyNameCandidates'] = [];
  const addresses: string[] = [];

  for (const sd of jsonld) {
    const extract = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      ['datePublished', 'dateModified', 'foundingDate', 'startDate', 'dateCreated'].forEach((key) => {
        if (obj[key]) dates.push({ text: String(obj[key]), type: 'jsonld', context: `${obj['@type'] || 'Object'}/${key}` });
      });
      if (obj.name) companyNameCandidates.push({ text: String(obj.name), source: `jsonld/${obj['@type'] || 'Object'}` });
      if (obj.legalName) companyNameCandidates.push({ text: String(obj.legalName), source: `jsonld/${obj['@type'] || 'Object'}` });
      if (obj.address) {
        const addr = typeof obj.address === 'string' ? obj.address : [obj.address.streetAddress, obj.address.addressLocality, obj.address.addressRegion].filter(Boolean).join(', ');
        if (addr) addresses.push(addr);
      }
      if (obj['@graph']) obj['@graph'].forEach(extract);
    };
    extract(sd);
  }

  $('time').each((_: number, el: any) => {
    const text = cleanText($(el).attr('datetime') || $(el).text());
    if (text) dates.push({ text, type: 'time', context: buildDomPath(el) });
  });

  $('meta[property="article:published_time"], meta[property="article:modified_time"]').each((_: number, el: any) => {
    const text = $(el).attr('content');
    if (text) dates.push({ text, type: 'meta', context: $(el).attr('property') || '' });
  });

  const footerText = $('footer').text() || '';
  const headerText = $('header').text() || '';
  addresses.push(...addressCandidates(footerText), ...addressCandidates(headerText));

  if (pageTitle) {
    const candidate = pageTitle.split(/[-—|]/)[0].trim();
    if (candidate && candidate.length > 2 && !/\b(?:home|about|contact|services|news|products)\b/i.test(candidate)) {
      companyNameCandidates.push({ text: candidate, source: 'title' });
    }
  }

  return { dates, companyNameCandidates, addressCandidates: [...new Set(addresses)] };
}

function homepageKeyOf(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
    return `${host}${path}`;
  } catch {
    return url.toLowerCase();
  }
}

function buildSourceDocument(crawledPage: CrawledPage, index: number, baseUrl: string, homepageResolved: boolean): SourceDocument {
  const $ = load(crawledPage.html || '<html></html>');
  removeNoise($);

  const chromeNodes = identifyChrome($);
  const pageUrl = crawledPage.url;
  const imageMap = new Map<string, SourceDocumentImage>();

  const title = cleanText($('title').text()) || crawledPage.title || '';
  const metaDescription = cleanText($('meta[name="description"]').attr('content') || '') || crawledPage.metaDescription || '';
  const h1 = cleanText($('h1').first().text()) || crawledPage.h1 || '';
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || crawledPage.canonicalUrl;
  const language = $('html').attr('lang') || undefined;
  // Homepage identity is structural: the page's final URL must canonically
  // equal the resolved site root. When root resolution failed no page is HOME.
  const isHomepage = homepageResolved && homepageKeyOf(crawledPage.finalUrl || pageUrl) === homepageKeyOf(baseUrl);
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') || crawledPage.favicon;

  const structuredData = extractStructuredData($);
  const openGraph = extractOpenGraph($);
  const evidence = extractEvidence($, structuredData, title, baseUrl);

  const headerImages: SourceDocumentImage[] = [];
  const footerImages: SourceDocumentImage[] = [];
  const navImages: SourceDocumentImage[] = [];

  $(chromeNodes.header).find('img').add($(chromeNodes.header).filter('img')).each((_: number, img: any) => {
    const si = extractImageAttributes($, img, baseUrl, pageUrl);
    if (!si) return;
    si.region = 'header';
    imageMap.set(si.src, si);
    headerImages.push(si);
  });
  $(chromeNodes.footer).find('img').add($(chromeNodes.footer).filter('img')).each((_: number, img: any) => {
    const si = extractImageAttributes($, img, baseUrl, pageUrl);
    if (!si) return;
    si.region = 'footer';
    imageMap.set(si.src, si);
    footerImages.push(si);
  });
  $(chromeNodes.nav).find('img').add($(chromeNodes.nav).filter('img')).each((_: number, img: any) => {
    const si = extractImageAttributes($, img, baseUrl, pageUrl);
    if (!si) return;
    si.region = 'nav';
    imageMap.set(si.src, si);
    navImages.push(si);
  });

  let logoSrc: string | undefined;
  let logoHref: string | undefined;
  let logoAlt: string | undefined;
  $(chromeNodes.header).find('a img, .logo img, [class*="logo"] img').each((_: number, img: any) => {
    if (!logoSrc) {
      logoSrc = normalizeUrl(baseUrl, $(img).attr('src') || '') || $(img).attr('src') || '';
      logoAlt = $(img).attr('alt') || '';
      const $a = $(img).closest('a');
      logoHref = $a.length ? normalizeUrl(baseUrl, $a.attr('href') || '') || $a.attr('href') || undefined : undefined;
    }
  });
  if (!logoSrc && crawledPage.logo) logoSrc = normalizeUrl(baseUrl, crawledPage.logo) || crawledPage.logo;

  const headerLinks: SourceDocumentLink[] = [];
  $(chromeNodes.header).find('a[href]').each((_: number, el: any) => {
    const text = cleanText($(el).text());
    const href = $(el).attr('href') || '';
    if (text && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && isInternal(baseUrl, href)) {
      headerLinks.push({ text, href: normalizeUrl(baseUrl, href) || href, source: 'header', domPath: buildDomPath(el) });
    }
  });

  const footerLinks: SourceDocumentLink[] = [];
  $(chromeNodes.footer).find('a[href]').each((_: number, el: any) => {
    const text = cleanText($(el).text());
    const href = $(el).attr('href') || '';
    if (text && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && isInternal(baseUrl, href)) {
      footerLinks.push({ text, href: normalizeUrl(baseUrl, href) || href, source: 'footer', domPath: buildDomPath(el) });
    }
  });

  const navLinks: SourceDocumentLink[] = [];
  $(chromeNodes.nav).find('a[href]').each((_: number, el: any) => {
    const text = cleanText($(el).text());
    const href = $(el).attr('href') || '';
    if (text && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && isInternal(baseUrl, href)) {
      navLinks.push({ text, href: normalizeUrl(baseUrl, href) || href, source: 'nav', domPath: buildDomPath(el) });
    }
  });

  // Pick the element that owns the page's main content. Semantic containers
  // (main/[role=main]/article) win; class-based candidates must not be chrome
  // themselves, must not contain page chrome, and are ranked by clean text so a
  // header/footer wrapper named "...-content" can never win over real content.
  const chromeAll = [...chromeNodes.header, ...chromeNodes.footer, ...chromeNodes.nav];
  const isChromeOrContainsChrome = (el: any): boolean => {
    if (!el) return false;
    if (chromeAll.includes(el)) return true;
    const cls = ($(el).attr('class') || '').toLowerCase();
    // Elements whose own class marks them as chrome/template parts are not content.
    if (/(^|[^a-z])(header|footer|navbar|topbar|offcanvas|drawer|modal|popup)([^a-z]|$)/.test(cls)) return true;
    for (const c of chromeAll) { if ($.contains(el, c)) return true; }
    return false;
  };
  const textLen = (el: any) => cleanText($(el).text()).length;

  let mainEl: any = undefined;
  let mainIsFallback = false;
  const semantic = $('main, [role="main"], article').get().filter((el: any) => !isChromeOrContainsChrome(el));
  if (semantic.length) {
    mainEl = semantic.sort((a: any, b: any) => textLen(b) - textLen(a))[0];
  } else {
    const classCandidates = $('.content, .main-content, .page-content, #content, #main, [class*="content"]')
      .get()
      .filter((el: any) => {
        const t = (el.tagName || '').toLowerCase();
        if (t === 'body' || t === 'html') return false;
        if (isChromeOrContainsChrome(el)) return false;
        return true;
      });
    if (classCandidates.length) {
      mainEl = classCandidates.sort((a: any, b: any) => textLen(b) - textLen(a))[0];
    }
  }
  {
    // Fallback candidate: body minus chrome. Always considered — a chrome
    // wrapper can win the class-candidate race purely by matching
    // `[class*="content"]` (e.g. `ekit-template-content-header`), so the
    // larger clean-text root wins regardless of the candidate's size.
    const bodyClone = $('body').clone();
    bodyClone.find('script, style, noscript, svg, canvas, template, header, footer, nav, [role="banner"], [class*="cookie"], [class*="ekit-template-content-header"], [class*="ekit-template-content-footer"], [class*="elementor-location-header"], [class*="elementor-location-footer"], [class*="template-header"], [class*="template-footer"]').remove();
    const fallback = bodyClone.get(0);
    if (fallback && textLen(fallback) > textLen(mainEl)) {
      mainEl = fallback;
      mainIsFallback = true;
    }
  }

  const diagnostics: SourceDocumentDiagnostics = { dedupedParagraphs: [] };
  const sections: SourceDocumentSection[] = [];
  if (mainEl) {
    sections.push(...collectSections($, mainEl, baseUrl, pageUrl, imageMap, 'main', diagnostics));
  }

  // Also extract aside/article side content.
  $('aside, article').each((_: number, el: any) => {
    if (mainEl && $.contains(mainEl as any, el as any)) return;
    sections.push(...collectSections($, el, baseUrl, pageUrl, imageMap, 'aside', diagnostics));
  });

  const allImages: SourceDocumentImage[] = [];
  const allImagesSeen = new Set<string>();
  const pushImage = (si: SourceDocumentImage) => {
    if (allImagesSeen.has(si.src)) return;
    allImagesSeen.add(si.src);
    allImages.push(si);
  };
  let droppedMedia = 0;
  $('img').each((_: number, img: any) => {
    const raw = $(img).attr('data-original') || $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('data-img-zoom-url') || $(img).attr('src') || '';
    const src = normalizeMediaUrl(normalizeUrl(baseUrl, raw) || raw);
    if (!src) return;
    if (imageMap.has(src)) {
      pushImage(imageMap.get(src)!);
      return;
    }
    const si = extractImageAttributes($, img, baseUrl, pageUrl);
    if (!si) { droppedMedia++; return; }
    const $el = $(img);
    const region = elementRegion($el, chromeNodes);
    si.region = region === 'unknown' && mainEl && (mainIsFallback ? !isChromeOrContainsChrome(img) : $.contains(mainEl as any, img as any)) ? 'main' : region;
    imageMap.set(src, si);
    pushImage(si);
  });

  // Non-<img> image surfaces: CSS background images and slider data-*
  // attributes (e.g. WPR/gallery sliders that lazy-render via JS). Without
  // these, gallery-heavy detail pages appear imageless.
  const BG_ATTRS = ['data-back', 'data-bg', 'data-background', 'data-bg-image', 'data-lazy-background', 'data-original'];
  $('[style*="background"], [data-back], [data-bg], [data-background], [data-bg-image], [data-lazy-background], [data-original]').each((_: number, el: any) => {
    const urls: string[] = [];
    const style = $(el).attr('style') || '';
    const bgMatch = style.match(/background(?:-image)?[^;]*url\(['"]?([^)'"]+)['"]?\)/);
    if (bgMatch) urls.push(bgMatch[1]);
    for (const attr of BG_ATTRS) {
      const v = $(el).attr(attr);
      if (v && /\.(jpe?g|png|webp|avif|gif|svg)(\?|$)/i.test(v)) urls.push(v);
    }
    for (const raw of urls) {
      const src = normalizeMediaUrl(normalizeUrl(baseUrl, raw) || raw);
      if (!src || imageMap.has(src)) continue;
      if (isDroppableMedia(src)) { droppedMedia++; continue; }
      const region = elementRegion($(el), chromeNodes);
      const si: SourceDocumentImage = {
        src,
        alt: $(el).attr('data-alt') || $(el).attr('aria-label') || undefined,
        domPath: buildDomPath(el),
        region: region === 'unknown' && mainEl && (mainIsFallback ? !isChromeOrContainsChrome(el) : $.contains(mainEl as any, el as any)) ? 'main' : region,
        provenance: { sourcePageUrl: pageUrl, isBackground: true, sourceSelector: buildDomPath(el) },
      };
      imageMap.set(src, si);
      pushImage(si);
    }
  });

  // imageMap is complete only now — collections resolve card media against it.
  const collections: SourceDocumentCollection[] = dedupeResponsiveCollections(
    detectCollections($, baseUrl, pageUrl, imageMap), diagnostics);

  // Enrich with CrawledPage image metadata (dimensions, likely logo/hero flags from browser).
  const LOGOISH_RE = /logo|лого|логотип|icon|favicon|sprite|removebg|cropped|placeholder|avatar/i;
  for (const ci of crawledPage.images || []) {
    const key = normalizeMediaUrl(normalizeUrl(baseUrl, ci.src) || ci.src);
    const si = imageMap.get(key);
    if (si) {
      si.width = si.width ?? ci.width;
      si.height = si.height ?? ci.height;
      si.provenance.isLogo = ci.likelyLogo;
      si.provenance.isHero = ci.likelyHero;
      si.alt = si.alt || ci.alt;
    }
  }
  // Heuristic logo/icon detection independent of the browser pass:
  // alt/filename markers, or a tiny square raster linked to the site root.
  for (const si of imageMap.values()) {
    const fname = (() => { try { return new URL(si.src).pathname.split('/').pop() || ''; } catch { return si.src; } })();
    const haystack = `${si.alt || ''} ${fname} ${si.domPath || ''}`;
    const tiny = (si.width || 0) > 0 && (si.height || 0) > 0 && (si.width || 0) <= 200 && (si.height || 0) <= 200;
    if (si.provenance.isLogo !== true && (LOGOISH_RE.test(haystack) || (tiny && si.region !== 'main'))) {
      si.provenance.isLogo = true;
    }
  }

  const headerText = $(chromeNodes.header).text();
  const footerText = $(chromeNodes.footer).text();
  const phones = [...new Set([...extractPhones(headerText), ...extractPhones(footerText), ...extractPhones(crawledPage.text || '')])].slice(0, 5);
  const emails = [...new Set([...extractEmails(headerText), ...extractEmails(footerText), ...extractEmails(crawledPage.text || '')])].slice(0, 5);
  const socialLinks = extractSocialLinks(headerText + ' ' + footerText, [...headerLinks, ...footerLinks, ...navLinks]);

  const chrome: SourceDocumentChrome = {
    header: { html: $(chromeNodes.header).first().html() || undefined, text: cleanText(headerText), links: headerLinks, images: headerImages },
    footer: { html: $(chromeNodes.footer).first().html() || undefined, text: cleanText(footerText), links: footerLinks, images: footerImages },
    nav: {
      primary: extractNavTree($, chromeNodes.nav[0] || chromeNodes.header[0], baseUrl, 'header') || navTreeFromLinks(headerLinks),
      secondary: extractNavTree($, chromeNodes.nav[1] || chromeNodes.footer[0], baseUrl, 'footer') || navTreeFromLinks(footerLinks),
      breadcrumbs: extractBreadcrumbs($, baseUrl, structuredData)
    },
    contacts: {
      phones,
      emails,
      addresses: evidence.addressCandidates.slice(0, 5),
      socialLinks,
      workingHours: workingHours(headerText) || workingHours(footerText)
    },
    logo: logoSrc ? { src: logoSrc, href: logoHref, alt: logoAlt } : undefined,
    favicon: favicon ? normalizeUrl(baseUrl, favicon) || favicon : undefined,
    themeColors: crawledPage.themeColors
  };

  if (droppedMedia) diagnostics.droppedMedia = (diagnostics.droppedMedia ?? 0) + droppedMedia;

  const mainText = sections
    .map((s) => [
      s.heading,
      ...s.paragraphs,
      ...s.faqs.map((f) => `В: ${f.question}\nО: ${f.answer}`),
    ].filter(Boolean).join('\n\n'))
    .join('\n\n');
  const rawText = cleanText($.text());

  return {
    id: `sd-${index}-${slugFromUrl(pageUrl)}`,
    url: pageUrl,
    path: crawledPage.path,
    title,
    metaDescription,
    h1,
    canonicalUrl,
    language,
    isHomepage,
    depth: crawledPage.depth,
    priority: crawledPage.priority,
    chrome,
    sections: sections.filter((s) => s.paragraphs.length || s.lists.length || s.tables.length || s.images.length || s.faqs.length || s.heading),
    collections,
    structuredData,
    openGraph,
    evidence,
    images: allImages,
    mainText,
    rawText,
    html: crawledPage.html,
    diagnostics
  };
}

export function buildSourceDocuments(crawlResult: CrawlResult): SourceDocument[] {
  const baseUrl = crawlResult.homepage?.url || crawlResult.pages[0]?.url || '';
  // Legacy callers without an explicit status are treated as resolved.
  const homepageResolved = !crawlResult.homepage?.status || crawlResult.homepage.status === 'FOUND';
  return crawlResult.pages.map((page, index) => buildSourceDocument(page, index, baseUrl, homepageResolved));
}

export function sourceDocumentToCrawledPage(doc: SourceDocument): CrawledPage {
  const headerImages = doc.images.filter((i) => i.region === 'header' || i.provenance.isHero);
  const heroImage = headerImages.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0]?.src;
  const images: CrawledImage[] = doc.images.map((img) => ({
    src: img.src,
    alt: img.alt || '',
    width: img.width,
    height: img.height,
    area: img.width && img.height ? img.width * img.height : undefined,
    context: img.provenance.sourceSelector,
    likelyLogo: img.provenance.isLogo,
    likelyHero: img.provenance.isHero
  }));

  return {
    url: doc.url,
    title: doc.title,
    metaDescription: doc.metaDescription,
    h1: doc.h1 || '',
    canonicalUrl: doc.canonicalUrl,
    text: doc.mainText,
    html: doc.html,
    links: [...(doc.chrome.header?.links || []), ...(doc.chrome.footer?.links || []), ...doc.sections.flatMap((s) => s.links)].map((l) => ({ text: l.text, href: l.href, source: (l.source === 'nav' ? 'header' : l.source) as 'header' | 'footer' | 'body' })),
    images,
    logo: doc.chrome.logo?.src,
    logoHref: doc.chrome.logo?.href,
    favicon: doc.chrome.favicon,
    heroImage: heroImage || doc.chrome.logo?.src,
    themeColors: doc.chrome.themeColors,
    headerNav: doc.chrome.nav?.primary,
    footerNav: doc.chrome.nav?.secondary,
    path: doc.path,
    depth: doc.depth,
    priority: doc.priority,
    navItem: false
  };
}
