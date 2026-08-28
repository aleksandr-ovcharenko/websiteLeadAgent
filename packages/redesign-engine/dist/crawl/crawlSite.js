import { chromium } from 'playwright';
function normalizeUrl(base, href) {
    try {
        const u = new URL(href, base);
        const b = new URL(base);
        if (u.hostname !== b.hostname)
            return null;
        u.hash = '';
        u.search = '';
        u.pathname = u.pathname.replace(/\/$/, '') || '/';
        return u.toString();
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
    'authe', 'logout', 'account', '/pdf', '.pdf', '.jpg', '.png', '.zip'
];
const DEFAULT_KEYWORDS = [
    'services', 'услуги', 'about', 'о компании', 'o kompanii', 'projects',
    'объекты', 'portfolio', 'работы', 'gallery', 'галерея', 'news', 'новости',
    'reviews', 'отзывы', 'contacts', 'контакты', 'prices', 'цены', 'index', ''
];
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
export async function crawlSite(options) {
    const maxPages = options.maxPages ?? 15;
    const skipPaths = options.skipPaths ?? DEFAULT_SKIP;
    const timeoutMs = options.timeoutMs ?? 30000;
    const browser = await chromium.launch({
        headless: true,
        args: ['--ignore-certificate-errors', '--ignore-certificate-errors-spki-list', '--no-sandbox', '--disable-gpu']
    });
    const seen = new Set();
    const queue = [{ url: options.baseUrl, depth: 0 }];
    const pages = [];
    try {
        while (queue.length > 0 && pages.length < maxPages) {
            const { url, depth } = queue.shift();
            if (seen.has(url))
                continue;
            seen.add(url);
            const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
            const page = await context.newPage();
            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => { });
                await page.addInitScript({ content: 'window.__name = function __name(x){ return x; };' });
                await handleCookieConsent(page);
                await page.waitForTimeout(200);
                const data = await page.evaluate(() => {
                    const __name = window.__name || ((x) => x);
                    const title = document.title || '';
                    const meta = document.querySelector('meta[name="description"]')?.content ?? '';
                    const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
                    const body = document.body?.innerText ?? '';
                    const html = document.documentElement?.outerHTML ?? '';
                    const links = Array.from(document.querySelectorAll('a[href]'))
                        .map((a) => ({
                        text: (a.textContent ?? '').trim().slice(0, 120),
                        href: a.getAttribute('href') ?? ''
                    }))
                        .filter((l) => l.href);
                    const images = Array.from(document.querySelectorAll('img[src]'))
                        .map((img) => ({
                        src: img.getAttribute('src') ?? '',
                        alt: img.getAttribute('alt') ?? ''
                    }))
                        .filter((i) => i.src);
                    return { title, meta, h1, text: body.slice(0, 10000), html, links, images };
                });
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
                    depth
                });
                if (depth < 2) {
                    for (const link of data.links) {
                        const nu = normalizeUrl(options.baseUrl, link.href);
                        if (!nu || seen.has(nu))
                            continue;
                        const lower = nu.toLowerCase();
                        if (skipPaths.some((s) => lower.includes(s.toLowerCase())))
                            continue;
                        queue.push({ url: nu, depth: depth + 1 });
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
    return pages;
}
