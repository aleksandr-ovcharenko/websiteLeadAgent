import { chromium } from 'playwright';
import { discoverHomepage } from './homepageDiscovery.js';
function normalizeUrl(base, href) {
    try {
        const u = new URL(href, base);
        const b = new URL(base);
        if (u.hostname !== b.hostname)
            return null;
        u.hash = '';
        // Drop common tracking/query params but keep useful paths.
        const keep = new Set(['page', 'p', 'category', 'tag']);
        for (const [k] of u.searchParams) {
            if (!keep.has(k.toLowerCase()))
                u.searchParams.delete(k);
        }
        if (!u.search)
            u.search = '';
        const hrefHadTrailingSlash = href.endsWith('/') || (href === '' ? false : false);
        const pathnameHadTrailingSlash = u.pathname.endsWith('/');
        // Canonicalize /index.html and /index.htm to the directory root, preserving trailing slash when present.
        u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
        if (hrefHadTrailingSlash && pathnameHadTrailingSlash && u.pathname !== '/')
            u.pathname += '/';
        return u.toString().replace(/\?$/, '');
    }
    catch {
        return null;
    }
}
function slugFromUrl(url) {
    try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/$/, '').replace(/^\//, '');
        return path || 'index';
    }
    catch {
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
export function shouldCrawlUrl(nu) {
    try {
        const u = new URL(nu);
        if (u.protocol !== 'http:' && u.protocol !== 'https:')
            return false;
        for (const key of u.searchParams.keys()) {
            const kl = key.toLowerCase();
            if (kl.startsWith('utm_') || BLOCKED_QUERY_KEYS.includes(kl))
                return false;
        }
        const pathLower = u.pathname.toLowerCase();
        const segments = pathLower.split('/').filter(Boolean);
        if (segments.some((seg) => BLOCKED_PATH_SEGMENTS.has(seg)))
            return false;
        const extMatch = pathLower.match(/\.([a-z0-9]+)(?:\?.*)?$/);
        if (extMatch) {
            const ext = `.${extMatch[1]}`;
            if (BLOCKED_FILE_EXTENSIONS.has(ext))
                return false;
        }
        if (/\/(print|feed|comments|trackback)(?:\/|$)/i.test(pathLower))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function cleanLabel(text) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 60);
}
async function handleCookieConsent(page) {
    const labels = ['accept', 'agree', 'ok', 'allow', 'continue', 'yes'];
    for (const label of labels) {
        try {
            const el = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
            if (await el.isVisible().catch(() => false)) {
                await el.click({ force: true }).catch(() => { });
                await page.waitForTimeout(200);
                return;
            }
        }
        catch { }
    }
    try {
        const banners = page.locator('[class*="cookie"], [class*="consent"], [id*="cookie"], [id*="consent"]').first();
        if (await banners.isVisible().catch(() => false)) {
            await banners.evaluate((node) => { node.style.display = 'none'; });
        }
    }
    catch { }
}
function extractLinksFromContainer(container, source) {
    if (!container)
        return [];
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
function buildNavTree(links, baseUrl, depth = 0) {
    const roots = [];
    const map = new Map();
    const seenRoots = new Set();
    for (const link of links) {
        const nu = normalizeUrl(baseUrl, link.href);
        if (!nu)
            continue;
        const existing = map.get(nu);
        if (existing) {
            if (link.source === 'header')
                existing.source = 'header';
            continue;
        }
        const node = { label: link.text, url: nu, source: link.source, children: [] };
        map.set(nu, node);
        if (depth === 0) {
            roots.push(node);
            seenRoots.add(nu);
        }
    }
    // If a header link was later expanded on a deeper page, children will be added by the caller.
    return roots;
}
function mergeHeaderAndFooter(header, footer) {
    // Preserve header order; add footer items that are not in header.
    const all = [...header];
    const headerUrls = new Set(header.map((n) => n.url));
    for (const f of footer) {
        if (f.url && !headerUrls.has(f.url))
            all.push(f);
    }
    return all;
}
async function fetchSitemap(baseUrl) {
    const candidates = ['/sitemap.xml', '/sitemap_index.xml'];
    const nodes = [];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, baseUrl).toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok)
                continue;
            const text = await res.text();
            const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]).filter(Boolean);
            for (const u of urls) {
                const nu = normalizeUrl(baseUrl, u);
                if (nu)
                    nodes.push({ label: 'Sitemap', url: nu, source: 'sitemap', children: [] });
            }
            break;
        }
        catch { }
    }
    return nodes;
}
export async function crawlSite(options) {
    const maxPages = options.maxPages ?? 30;
    const maxDepth = options.maxDepth ?? 4;
    const timeoutMs = options.timeoutMs ?? 30000;
    const baseUrl = normalizeUrl(options.baseUrl, options.baseUrl) ?? options.baseUrl;
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        args: ['--ignore-certificate-errors', '--ignore-certificate-errors-spki-list', '--no-sandbox', '--disable-gpu']
    });
    const seen = new Set();
    const buckets = Array.from({ length: maxDepth + 1 }, () => []);
    const pages = [];
    const allHeaderLinks = [];
    const allFooterLinks = [];
    const warnings = [];
    const skipped = [];
    function enqueue(nu, depth, priority, _source) {
        if (seen.has(nu))
            return;
        if (depth > maxDepth) {
            skipped.push({ url: nu, reason: `depth ${depth} > maxDepth ${maxDepth}` });
            return;
        }
        if (!shouldCrawlUrl(nu)) {
            skipped.push({ url: nu, reason: 'blocked_by_rules' });
            return;
        }
        seen.add(nu);
        buckets[depth].push({ url: nu, depth, priority });
    }
    // Seed base URL at depth 0 and origin root with the highest priority for homepage discovery.
    enqueue(baseUrl, 0, 0, 'body');
    try {
        const origin = new URL(baseUrl).origin + '/';
        const originRoot = normalizeUrl(baseUrl, origin);
        if (originRoot && originRoot !== baseUrl) {
            enqueue(originRoot, 0, -100, 'body');
        }
    }
    catch {
        warnings.push('Could not derive origin root from baseUrl');
    }
    // Seed from sitemap up front.
    let sitemap = [];
    try {
        sitemap = await fetchSitemap(baseUrl);
        for (const n of sitemap) {
            if (n.url)
                enqueue(n.url, 0, -10, 'header');
        }
    }
    catch { }
    try {
        while (pages.length < maxPages) {
            let next;
            for (let d = 0; d <= maxDepth; d++) {
                const bucket = buckets[d];
                if (!bucket.length)
                    continue;
                bucket.sort((a, b) => a.priority - b.priority);
                next = bucket.shift();
                break;
            }
            if (!next)
                break;
            const { url, depth } = next;
            const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
            const page = await context.newPage();
            try {
                await page.addInitScript({ content: 'window.__name = function __name(x){ return x; }; globalThis.__name = window.__name;' });
                const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => null);
                if (resp && (resp.status() >= 400)) {
                    console.warn('crawl non-2xx', url, resp.status());
                    continue;
                }
                await handleCookieConsent(page);
                await page.waitForTimeout(200);
                const baseOrigin = new URL(baseUrl).origin;
                const data = await page.evaluate(({ baseHref, baseOrigin: baseOriginStr }) => {
                    function cleanLabel(text) {
                        return text.replace(/\s+/g, ' ').trim().slice(0, 60);
                    }
                    function normalizeUrl(base, href) {
                        try {
                            const u = new URL(href, base);
                            const b = new URL(base);
                            if (u.hostname !== b.hostname)
                                return null;
                            u.hash = '';
                            const keep = new Set(['page', 'p', 'category', 'tag']);
                            for (const [k] of u.searchParams) {
                                if (!keep.has(k.toLowerCase()))
                                    u.searchParams.delete(k);
                            }
                            if (!u.search)
                                u.search = '';
                            u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
                            return u.toString().replace(/\?$/, '');
                        }
                        catch {
                            return null;
                        }
                    }
                    function validHref(href) {
                        return !!href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:');
                    }
                    function isInternal(base, href) {
                        try {
                            return new URL(href, base).hostname === new URL(base).hostname;
                        }
                        catch {
                            return false;
                        }
                    }
                    function linkFromAnchor(a, source) {
                        const href = a.getAttribute('href') ?? '';
                        if (!validHref(href) || !isInternal(baseHref, href))
                            return null;
                        const text = cleanLabel(a.textContent ?? '');
                        if (!text)
                            return null;
                        return { text, href, source };
                    }
                    function flattenNav(nodes) {
                        const out = [];
                        for (const n of nodes) {
                            if (n.url && n.label)
                                out.push({ text: n.label, href: n.url, source: n.source });
                            if (n.children?.length)
                                out.push(...flattenNav(n.children));
                        }
                        return out;
                    }
                    function parseList(ul, source) {
                        if (!ul)
                            return [];
                        const nodes = [];
                        for (const li of Array.from(ul.children)) {
                            if (li.tagName !== 'LI')
                                continue;
                            const a = li.querySelector(':scope > a[href], :scope > div > a[href], :scope > span > a[href]');
                            const childUl = li.querySelector(':scope > ul');
                            if (!a && childUl) {
                                nodes.push(...parseList(childUl, source));
                                continue;
                            }
                            if (!a)
                                continue;
                            const l = linkFromAnchor(a, source);
                            if (!l) {
                                if (childUl)
                                    nodes.push(...parseList(childUl, source));
                                continue;
                            }
                            const nu = normalizeUrl(baseHref, l.href);
                            if (!nu) {
                                if (childUl)
                                    nodes.push(...parseList(childUl, source));
                                continue;
                            }
                            const children = childUl ? parseList(childUl, source) : [];
                            nodes.push({ label: l.text, url: nu, source, children });
                        }
                        return nodes;
                    }
                    function extractNavTree(container, source) {
                        if (!container)
                            return [];
                        const topUl = container.querySelector('ul');
                        if (topUl)
                            return parseList(topUl, source);
                        // fallback: flat anchors
                        return Array.from(container.querySelectorAll('a[href]'))
                            .map((a) => linkFromAnchor(a, source))
                            .filter(Boolean)
                            .map((l) => ({ label: l.text, url: normalizeUrl(baseHref, l.href), source, children: [] }))
                            .filter((n) => n.url);
                    }
                    function extractBodyLinks() {
                        const body = document.body;
                        if (!body)
                            return [];
                        const seen = new Set();
                        return Array.from(body.querySelectorAll('a[href]'))
                            .map((a) => linkFromAnchor(a, 'body'))
                            .filter(Boolean)
                            .filter((l) => {
                            const nu = normalizeUrl(baseHref, l.href);
                            if (!nu || seen.has(nu))
                                return false;
                            seen.add(nu);
                            return true;
                        });
                    }
                    function isHomeLink(href) {
                        if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:'))
                            return false;
                        const nu = normalizeUrl(baseHref, href);
                        if (!nu)
                            return false;
                        try {
                            const u = new URL(nu);
                            const base = new URL(baseHref);
                            return u.pathname === '/' || nu === baseOriginStr + '/' || u.href === base.href || u.href === baseOriginStr + '/';
                        }
                        catch {
                            return false;
                        }
                    }
                    function isUtilityImage(src, alt, cls, id, href) {
                        const hay = `${src} ${alt} ${cls} ${id} ${href}`.toLowerCase();
                        return /\b(flag|flags|translate|gtranslate|weglot|wpml|lang|language|currency|search|cart|basket|user|account|profile|social|icon|icons|share|menu|hamburger|close|expand|dropdown)\b/.test(hay) ||
                            /cdn\.gtranslate\.net|translate\.google|weglot|wpml\.org/.test(src);
                    }
                    function logoScore(img, baseHref) {
                        const src = resolveSrc(img.getAttribute('src') || '');
                        const alt = (img.getAttribute('alt') || '').toLowerCase();
                        const cls = (img.getAttribute('class') || '').toLowerCase();
                        const id = (img.getAttribute('id') || '').toLowerCase();
                        const link = img.closest('a[href]');
                        const href = link ? normalizeUrl(baseHref, link.getAttribute('href') || '') || '' : '';
                        if (isUtilityImage(src, alt, cls, id, href))
                            return -1000;
                        let score = 0;
                        if (cls.includes('logo') || alt.includes('logo') || src.includes('logo') || id.includes('logo'))
                            score += 50;
                        if (link && isHomeLink(link.getAttribute('href') || ''))
                            score += 20;
                        if (src.endsWith('.svg'))
                            score += 10;
                        const w = img.naturalWidth || img.width || 0;
                        const h = img.naturalHeight || img.height || 0;
                        if (w > 0 && w < 260 && h > 0 && h < 140)
                            score += 5;
                        if (w > 0 && h > 0 && w / h > 1.2 && w / h < 5)
                            score += 3;
                        try {
                            if (new URL(src, baseHref).hostname !== new URL(baseHref).hostname)
                                score -= 15;
                        }
                        catch { }
                        return score;
                    }
                    function extractLogo() {
                        const header = document.querySelector('header, [role="banner"]');
                        const nav = document.querySelector('nav, [role="navigation"]');
                        const area = header || nav;
                        const images = area ? Array.from(area.querySelectorAll('img')) : Array.from(document.querySelectorAll('header img, nav img'));
                        let best = null;
                        for (const img of images) {
                            const score = logoScore(img, baseHref);
                            if (score < 0)
                                continue;
                            if (!best || score > best.score)
                                best = { img, score };
                        }
                        let src = null;
                        let href = null;
                        if (best) {
                            src = resolveSrc(best.img.getAttribute('src') || best.img.src);
                            const link = best.img.closest('a[href]');
                            if (link)
                                href = normalizeUrl(baseHref, link.getAttribute('href') || '') || normalizeUrl(baseHref, link.href);
                        }
                        else if (area) {
                            // Last resort: first image in header/nav that links internally and is not a utility icon.
                            const firstLinked = Array.from(area.querySelectorAll('a[href] img')).find((img) => {
                                const a = img.closest('a[href]');
                                return a && normalizeUrl(baseHref, a.getAttribute('href') || '') && logoScore(img, baseHref) >= -5;
                            });
                            if (firstLinked) {
                                src = resolveSrc(firstLinked.getAttribute('src') || firstLinked.src);
                                const link = firstLinked.closest('a[href]');
                                if (link)
                                    href = normalizeUrl(baseHref, link.getAttribute('href') || '') || normalizeUrl(baseHref, link.href);
                            }
                        }
                        if (!href) {
                            // Find any anchor pointing to the homepage.
                            for (const a of Array.from(document.querySelectorAll('header a[href], nav a[href], [role="banner"] a[href]'))) {
                                const raw = a.getAttribute('href') || '';
                                if (isHomeLink(raw)) {
                                    href = normalizeUrl(baseHref, raw);
                                    break;
                                }
                            }
                        }
                        return { src, href };
                    }
                    function parseIconSize(sizes) {
                        if (!sizes)
                            return 0;
                        const match = sizes.match(/(\d+)\s*x\s*(\d+)/);
                        return match ? parseInt(match[1], 10) : 0;
                    }
                    function extractFavicon() {
                        const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
                        const candidates = [];
                        for (const rel of rels) {
                            const links = document.querySelectorAll(`link[rel="${rel}" i], link[rel*="${rel}" i]`);
                            for (const el of Array.from(links)) {
                                const link = el;
                                if (link.href) {
                                    const size = parseIconSize(link.getAttribute('sizes') || undefined);
                                    candidates.push({ href: new URL(link.href, baseHref).toString(), size });
                                }
                            }
                        }
                        candidates.sort((a, b) => b.size - a.size);
                        return candidates[0]?.href || null;
                    }
                    function resolveSrc(src) {
                        try {
                            return new URL(src, baseHref).toString();
                        }
                        catch {
                            return src;
                        }
                    }
                    function imageContext(img) {
                        const section = img.closest('section, article, header, footer, main, [class*="hero" i], [class*="about" i], [class*="service" i], [class*="project" i], [class*="news" i]');
                        if (section) {
                            const cls = section.getAttribute('class') || '';
                            const id = section.getAttribute('id') || '';
                            return `${section.tagName.toLowerCase()} ${cls} ${id}`.trim().slice(0, 120);
                        }
                        return (img.parentElement?.getAttribute('class') || '').slice(0, 80);
                    }
                    function extractHeroImage() {
                        const selectors = ['[class*="hero" i] img', '[class*="banner" i] img', 'header img', 'main > section:first-of-type img', 'section:first-of-type img'];
                        const candidates = [];
                        const viewport = window.innerHeight || 800;
                        for (const sel of selectors) {
                            for (const img of Array.from(document.querySelectorAll(sel))) {
                                const el = img;
                                const src = resolveSrc(el.getAttribute('src') || '');
                                if (!src || src.startsWith('data:'))
                                    continue;
                                const rect = el.getBoundingClientRect();
                                const w = el.naturalWidth || rect.width || 0;
                                const h = el.naturalHeight || rect.height || 0;
                                if (w < 300 || h < 150)
                                    continue;
                                candidates.push({ src, area: w * h, top: rect.top });
                            }
                        }
                        // Also consider body images not in header/footer
                        const header = document.querySelector('header');
                        const footer = document.querySelector('footer');
                        for (const img of Array.from(document.querySelectorAll('img[src]'))) {
                            const el = img;
                            if (header?.contains(el) || footer?.contains(el))
                                continue;
                            const src = resolveSrc(el.getAttribute('src') || '');
                            if (!src || src.startsWith('data:'))
                                continue;
                            const rect = el.getBoundingClientRect();
                            const w = el.naturalWidth || rect.width || 0;
                            const h = el.naturalHeight || rect.height || 0;
                            if (w < 600 || h < 300 || rect.top > viewport)
                                continue;
                            candidates.push({ src, area: w * h, top: rect.top });
                        }
                        candidates.sort((a, b) => (a.top < 0 ? 1 : 0) - (b.top < 0 ? 1 : 0) || a.top - b.top || b.area - a.area);
                        return candidates[0]?.src || null;
                    }
                    function extractThemeColors() {
                        const header = document.querySelector('header');
                        const nav = document.querySelector('nav, [role="navigation"]');
                        const headerEl = header || nav;
                        const firstLink = document.querySelector('a');
                        const firstButton = document.querySelector('button, .btn, [class*="button" i]');
                        const toHex = (c) => {
                            try {
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                if (!ctx)
                                    return c;
                                ctx.fillStyle = c;
                                return ctx.fillStyle || c;
                            }
                            catch {
                                return c;
                            }
                        };
                        const get = (el, prop) => {
                            if (!el)
                                return undefined;
                            const v = window.getComputedStyle(el)[prop];
                            if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent')
                                return undefined;
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
                    function extractImages(logoSrc) {
                        const header = document.querySelector('header, [role="banner"]');
                        const footer = document.querySelector('footer');
                        const seen = new Set();
                        const out = [];
                        for (const img of Array.from(document.querySelectorAll('img[src]'))) {
                            const el = img;
                            const raw = el.getAttribute('src') || '';
                            if (!raw || raw.startsWith('data:'))
                                continue;
                            const src = resolveSrc(raw);
                            if (seen.has(src))
                                continue;
                            seen.add(src);
                            const rect = el.getBoundingClientRect();
                            const w = el.naturalWidth || rect.width || 0;
                            const h = el.naturalHeight || rect.height || 0;
                            const area = w * h;
                            const alt = el.getAttribute('alt') || '';
                            const context = imageContext(el);
                            const inHeader = !!header?.contains(el);
                            const inFooter = !!footer?.contains(el);
                            const link = el.closest('a[href]');
                            const isHomeLinkValue = link ? isHomeLink(link.getAttribute('href') || '') : false;
                            const logoScoreValue = inHeader ? logoScore(el, baseHref) : -Infinity;
                            const likelyLogo = src === logoSrc || logoScoreValue >= 15 || inHeader && (alt.toLowerCase().includes('logo') || (el.getAttribute('class') || '').toLowerCase().includes('logo') || isHomeLinkValue);
                            const likelyHero = !inHeader && !inFooter && area > 200000 && rect.top < (window.innerHeight || 800);
                            out.push({ src, alt, width: w, height: h, area, context, likelyLogo, likelyHero });
                        }
                        return out;
                    }
                    const title = document.title || '';
                    const meta = document.querySelector('meta[name="description"]')?.content ?? '';
                    const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
                    const canonicalLink = document.querySelector('link[rel="canonical"]');
                    const canonicalUrl = canonicalLink?.href ? normalizeUrl(baseHref, canonicalLink.href) : null;
                    const body = document.body?.innerText ?? '';
                    const html = document.documentElement?.outerHTML ?? '';
                    const headerEl = document.querySelector('header');
                    const navEl = document.querySelector('nav, [role="navigation"]');
                    const headerContainer = headerEl || navEl;
                    const footerEl = document.querySelector('footer');
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
                }, { baseHref: baseUrl, baseOrigin });
                pages.push({
                    url,
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
                    path: slugFromUrl(url),
                    depth,
                    priority: depth,
                    navItem: false
                });
                const isNavItem = (href) => {
                    const nu = normalizeUrl(baseUrl, href);
                    if (!nu)
                        return false;
                    return [...allHeaderLinks, ...allFooterLinks].some((l) => normalizeUrl(baseUrl, l.href) === nu);
                };
                if (depth < maxDepth) {
                    for (const link of data.links) {
                        const nu = normalizeUrl(baseUrl, link.href);
                        if (!nu)
                            continue;
                        let priority = depth * 10;
                        if (link.source === 'header') {
                            priority -= 20;
                            allHeaderLinks.push({ ...link });
                        }
                        else if (link.source === 'footer') {
                            priority -= 15;
                            allFooterLinks.push({ ...link });
                        }
                        if (isNavItem(link.href))
                            priority -= 30;
                        enqueue(nu, depth + 1, priority, link.source);
                    }
                }
            }
            catch (err) {
                console.warn('crawl page failed', url, err);
                skipped.push({ url, reason: err?.message || 'page_crawl_failed' });
            }
            finally {
                await page.close().catch(() => { });
                await context.close().catch(() => { });
            }
        }
    }
    finally {
        await browser.close().catch(() => { });
    }
    // Build canonical navigation tree from the first page's header/footer DOM trees.
    let firstPageHeaderNav = [];
    let firstPageFooterNav = [];
    if (pages[0]?.headerNav) {
        firstPageHeaderNav = pages[0].headerNav;
        firstPageFooterNav = pages[0].footerNav || [];
    }
    else {
        firstPageHeaderNav = buildNavTree(allHeaderLinks, baseUrl);
        firstPageFooterNav = buildNavTree(allFooterLinks, baseUrl);
    }
    const navigation = mergeHeaderAndFooter(firstPageHeaderNav, firstPageFooterNav);
    const originRoot = (() => {
        try {
            return new URL(baseUrl).origin + '/';
        }
        catch {
            return baseUrl;
        }
    })();
    const homepage = discoverHomepage(pages, baseUrl, navigation, originRoot, warnings);
    return { pages, navigation, homepage, warnings, skipped };
}
