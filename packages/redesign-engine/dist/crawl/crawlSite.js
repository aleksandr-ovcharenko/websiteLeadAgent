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
                    function extractLinksFromContainer(container, source) {
                        if (!container)
                            return [];
                        return Array.from(container.querySelectorAll('a[href]'))
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
                    function buildNavTree(links) {
                        const roots = [];
                        const map = new Map();
                        for (const link of links) {
                            const nu = normalizeUrl(baseHref, link.href);
                            if (!nu)
                                continue;
                            if (map.has(nu))
                                continue;
                            const node = { label: link.text, url: nu, source: link.source, children: [] };
                            map.set(nu, node);
                            roots.push(node);
                        }
                        return roots;
                    }
                    const title = document.title || '';
                    const meta = document.querySelector('meta[name="description"]')?.content ?? '';
                    const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
                    const body = document.body?.innerText ?? '';
                    const html = document.documentElement?.outerHTML ?? '';
                    const header = document.querySelector('header, nav, [role="navigation"]');
                    const footer = document.querySelector('footer');
                    const headerLinks = extractLinksFromContainer(header, 'header');
                    const footerLinks = extractLinksFromContainer(footer, 'footer');
                    const bodyLinks = extractLinksFromContainer(document.body, 'body');
                    const headerNav = buildNavTree(headerLinks);
                    const footerNav = buildNavTree(footerLinks);
                    const all = [...headerLinks, ...footerLinks, ...bodyLinks];
                    const images = Array.from(document.querySelectorAll('img[src]'))
                        .map((img) => ({
                        src: img.getAttribute('src') ?? '',
                        alt: img.getAttribute('alt') ?? ''
                    }))
                        .filter((i) => i.src);
                    return {
                        title,
                        meta,
                        h1,
                        text: body.slice(0, 12000),
                        html,
                        links: all,
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
    // Build canonical navigation tree.
    const headerNav = buildNavTree(allHeaderLinks, baseUrl);
    const footerNav = buildNavTree(allFooterLinks, baseUrl);
    const navigation = mergeHeaderAndFooter(headerNav, footerNav);
    return { pages, navigation };
}
