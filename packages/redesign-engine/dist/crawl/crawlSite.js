import { chromium } from 'playwright';
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
        u.pathname = u.pathname.replace(/\/$/, '') || '/';
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
const DEFAULT_SKIP = [
    'login', 'admin', 'wp-admin', 'cart', 'checkout', 'privacy',
    'cookie', 'terms', 'search', 'wp-login', '/wp-content/',
    'authe', 'logout', 'account', '/pdf', '.pdf', '.jpg', '.png', '.zip',
    'print', '?replytocom', '/comment-', 'feed=', 'action=', 'share=',
    'utm_', 'fbclid', 'gclid', 'mailto:', 'tel:', 'javascript:'
];
const ALLOWED_EXTENSIONS = new Set(['.html', '.htm', '']);
function shouldCrawlUrl(nu) {
    const lower = nu.toLowerCase();
    const path = new URL(nu).pathname.toLowerCase();
    if (DEFAULT_SKIP.some((s) => lower.includes(s.toLowerCase())))
        return false;
    const dot = path.lastIndexOf('.');
    const slash = path.lastIndexOf('/');
    const ext = dot > slash && dot > 0 ? path.slice(dot) : '';
    if (ext && !ALLOWED_EXTENSIONS.has(ext))
        return false;
    return true;
}
const skipSet = DEFAULT_SKIP;
function cleanLabel(text) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 60);
}
async function handleCookieConsent(page) {
    const labels = ['accept', 'agree', 'ok', 'allow', 'принять', 'согласен', 'continue'];
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
        args: ['--ignore-certificate-errors', '--ignore-certificate-errors-spki-list', '--no-sandbox', '--disable-gpu']
    });
    const seen = new Set();
    const queue = [{ url: baseUrl, depth: 0, priority: 0 }];
    const pages = [];
    const allHeaderLinks = [];
    const allFooterLinks = [];
    function enqueue(nu, depth, priority, source) {
        if (seen.has(nu) || !shouldCrawlUrl(nu) || depth > maxDepth)
            return;
        queue.push({ url: nu, depth, priority });
        // Sort so navigation/sitemap links are crawled first, then by depth.
        queue.sort((a, b) => a.priority - b.priority || a.depth - b.depth);
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
        while (queue.length > 0 && pages.length < maxPages) {
            const { url, depth } = queue.shift();
            if (seen.has(url))
                continue;
            seen.add(url);
            const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
            const page = await context.newPage();
            try {
                const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => null);
                if (resp && (resp.status() >= 400)) {
                    console.warn('crawl non-2xx', url, resp.status());
                    continue;
                }
                await page.addInitScript({ content: 'window.__name = function __name(x){ return x; };' });
                await handleCookieConsent(page);
                await page.waitForTimeout(200);
                const data = await page.evaluate((baseHref) => {
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
                            u.pathname = u.pathname.replace(/\/$/, '') || '/';
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
                    function extractLogo() {
                        const header = document.querySelector('header');
                        const nav = document.querySelector('nav, [role="navigation"]');
                        const area = header || nav;
                        if (area) {
                            const logoImg = area.querySelector('img[alt*="logo" i], img[class*="logo" i], a[href="/"] img, a[href="./"] img');
                            if (logoImg?.src)
                                return new URL(logoImg.getAttribute('src') || logoImg.src, baseHref).toString();
                        }
                        const linkIcon = document.querySelector('link[rel*="icon" i]');
                        if (linkIcon?.href)
                            return new URL(linkIcon.href, baseHref).toString();
                        return null;
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
                            const ctx = document.createElement('canvas').getContext('2d');
                            if (!ctx)
                                return c;
                            ctx.fillStyle = c;
                            return ctx.fillStyle;
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
                    function extractImages() {
                        const header = document.querySelector('header');
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
                            const likelyLogo = inHeader && (alt.toLowerCase().includes('logo') || (el.closest('a[href="/"], a[href="./"], a[href*="home"]') !== null) || (w > 0 && w < 220 && h > 0 && h < 120));
                            const likelyHero = !inHeader && !inFooter && area > 200000 && rect.top < (window.innerHeight || 800);
                            out.push({ src, alt, width: w, height: h, area, context, likelyLogo, likelyHero });
                        }
                        return out;
                    }
                    const title = document.title || '';
                    const meta = document.querySelector('meta[name="description"]')?.content ?? '';
                    const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
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
                    const heroImage = extractHeroImage();
                    const images = extractImages();
                    const themeColors = extractThemeColors();
                    return {
                        title,
                        meta,
                        h1,
                        text: body.slice(0, 12000),
                        html,
                        logo,
                        heroImage,
                        themeColors,
                        links: allLinks,
                        images,
                        headerNav,
                        footerNav
                    };
                }, baseUrl);
                pages.push({
                    url,
                    title: data.title,
                    metaDescription: data.meta,
                    h1: data.h1,
                    text: data.text,
                    html: data.html,
                    links: data.links,
                    images: data.images,
                    logo: data.logo || undefined,
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
    return { pages, navigation };
}
