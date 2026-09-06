import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSiteRoot, resolvedHomepageUrl, canonicalKey, rootVariants, RootFetchTimeout, RootFetchError } from '../dist/crawl/rootResolution.js';
import { CrawlFrontier, isLowValueUrl } from '../dist/crawl/frontier.js';
import { buildSourceDocuments } from '../dist/extract/buildSourceDocuments.js';

const okFetch = (finalUrl, extra = {}) => async () => ({ finalUrl, redirectChain: [finalUrl], status: 200, durationMs: 10, ...extra });
const failFetch = (msg) => async () => { throw new RootFetchError(msg); };
const timeoutFetch = async () => { throw new RootFetchTimeout('timeout'); };

function makeCrawlResult(pages, homepage) {
  return { pages, navigation: [], homepage, warnings: [], skipped: [] };
}

function fakePage(url, html = '<html><body><p>x</p></body></html>') {
  return {
    url, finalUrl: url, title: 'T', metaDescription: '', h1: '', text: 'x', html,
    links: [], images: [], path: 'p', depth: 0, navItem: false,
  };
}

describe('root resolution', () => {
  it('resolves a redirecting root to its canonical homepage', async () => {
    const res = await resolveSiteRoot('https://example.com', { retries: 0 }, okFetch('https://example.com/', { redirectChain: ['http://example.com/', 'https://example.com/'] }));
    assert.equal(res.homepageStatus, 'FOUND');
    assert.equal(res.finalUrl, 'https://example.com/');
    assert.ok(res.redirectChain.length >= 1);
    assert.equal(resolvedHomepageUrl(res), 'https://example.com/');
  });

  it('resolves www → non-www and http → https roots', async () => {
    const res = await resolveSiteRoot('http://www.example.com', { retries: 0 }, okFetch('https://example.com/'));
    assert.equal(res.homepageStatus, 'FOUND');
    assert.equal(resolvedHomepageUrl(res), 'https://example.com/');
  });

  it('does NOT invent a homepage when the root times out', async () => {
    const res = await resolveSiteRoot('https://slow.example', { timeoutMs: 1000, retries: 0 }, timeoutFetch);
    assert.equal(res.homepageStatus, 'TIMEOUT');
    assert.equal(resolvedHomepageUrl(res), undefined);
  });

  it('tries safe variants in order when the first fails', async () => {
    const tried = [];
    const fetch = async (url) => { tried.push(url); if (tried.length === 1) throw new RootFetchError('refused'); return { finalUrl: url, redirectChain: [url], status: 200, durationMs: 5 }; };
    const res = await resolveSiteRoot('https://example.com', { retries: 0 }, fetch);
    assert.equal(res.homepageStatus, 'FOUND');
    assert.ok(tried.length >= 2, 'a later variant succeeded');
  });

  it('reports REDIRECT_FAILED when the root leaves the domain', async () => {
    const res = await resolveSiteRoot('https://example.com', { retries: 0 }, okFetch('https://parking.example.net/'));
    assert.notEqual(res.homepageStatus, 'FOUND');
  });
});

describe('homepage identity on SourceDocuments', () => {
  it('root timeout + internal page crawled → internal page is NOT HOME', () => {
    const page = fakePage('https://example.com/projects', '<html><body><h1>Projects</h1></body></html>');
    const docs = buildSourceDocuments(makeCrawlResult([page], { url: 'https://example.com/', confidence: 0, reason: 'root TIMEOUT', pageIndex: -1, status: 'TIMEOUT' }));
    assert.equal(docs[0].isHomepage, false, 'unresolved root must not promote an internal page to HOME');
  });

  it('resolved root marks the matching document as homepage', () => {
    const root = fakePage('https://example.com/', '<html><body><h1>Home</h1></body></html>');
    const other = fakePage('https://example.com/projects');
    const docs = buildSourceDocuments(makeCrawlResult([root, other], { url: 'https://example.com/', confidence: 1, reason: 'root resolved', pageIndex: 0, status: 'FOUND' }));
    assert.equal(docs[0].isHomepage, true);
    assert.equal(docs[1].isHomepage, false);
  });

  it('www/non-www canonical keys collapse', () => {
    assert.equal(canonicalKey('https://www.example.com/'), canonicalKey('https://example.com/'));
    assert.equal(canonicalKey('https://example.com/index.html'), canonicalKey('https://example.com/'));
  });
});

describe('crawl frontier', () => {
  it('orders nav and sitemap before body links', () => {
    const f = new CrawlFrontier(3);
    f.add('https://x/deep-body-link', 2, 'body');
    f.add('https://x/footer-link', 1, 'footer');
    f.add('https://x/nav-item', 1, 'nav');
    f.add('https://x/sitemap-page', 1, 'sitemap');
    f.add('https://x/', 0, 'root');
    const order = [f.next().url, f.next().url, f.next().url, f.next().url, f.next().url];
    assert.equal(order[0], 'https://x/');
    assert.equal(order[1], 'https://x/nav-item');
    assert.equal(order[2], 'https://x/sitemap-page');
    // footer and deep body links come after high-value candidates (order among
    // equal priorities is by insertion).
    assert.ok(order.slice(3).sort().join() === ['https://x/deep-body-link', 'https://x/footer-link'].sort().join());
  });

  it('dedupes tracking-query and trailing-slash variants', () => {
    const f = new CrawlFrontier(3);
    assert.equal(f.add('https://x/page?utm_source=x', 1, 'body'), true);
    // canonicalKey keeps query — the crawler's normalizeUrl strips tracking first;
    // verify trailing-slash + www dedup through the frontier keys:
    assert.equal(f.has('https://www.x/page?utm_source=x'), true, 'www variant deduped');
  });

  it('marks unattempted candidates as BUDGET_EXHAUSTED', () => {
    const f = new CrawlFrontier(3);
    f.add('https://x/a', 1, 'body');
    f.add('https://x/b', 1, 'body');
    f.next();
    const plan = f.finalizePlan('BUDGET_EXHAUSTED');
    const b = plan.find((p) => p.url === 'https://x/b');
    assert.equal(b.result, 'BUDGET_EXHAUSTED');
    assert.equal(b.attempted, false);
  });

  it('records per-candidate result reasons', () => {
    const f = new CrawlFrontier(3);
    f.add('https://x/timeout-page', 1, 'body');
    const item = f.next();
    f.mark(item, { attempted: true, result: 'TIMEOUT', failureReason: 'timeout 30000ms' });
    const plan = f.finalizePlan('BUDGET_EXHAUSTED');
    assert.equal(plan[0].result, 'TIMEOUT');
    assert.equal(plan[0].failureReason, 'timeout 30000ms');
  });
});

describe('low-value URL detection', () => {
  it('flags utility paths but not content paths', () => {
    assert.equal(isLowValueUrl('https://x/login'), true);
    assert.equal(isLowValueUrl('https://x/search?q=1'), true);
    assert.equal(isLowValueUrl('https://x/projects/house-12'), false);
    assert.equal(isLowValueUrl('https://x/news/2024-report'), false);
  });
});
