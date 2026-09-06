import { canonicalKey } from './rootResolution.js';
// Priority tiers — value-ordered, domain-agnostic.
export const FRONTIER_PRIORITY = {
    ROOT: -1000,
    NAV: -100, // primary navigation links
    SITEMAP: -50, // sitemap-discovered URLs
    INDEX: -25, // pages that look like content indexes (applied post-hoc on discovered links)
    BODY: 0,
    FOOTER: 10,
    LOW_VALUE: 50, // utility/filter/tag/archive-like
};
export const SOURCE_PRIORITY = {
    root: FRONTIER_PRIORITY.ROOT,
    nav: FRONTIER_PRIORITY.NAV,
    sitemap: FRONTIER_PRIORITY.SITEMAP,
    collection: -10,
    body: FRONTIER_PRIORITY.BODY,
    footer: FRONTIER_PRIORITY.FOOTER,
};
// Generic low-value URL signals — utility, session, filtering. Strong evidence
// only; semantic meaning is still decided later by the classifier.
const LOW_VALUE_RE = /(login|logout|signin|signup|register|auth|account|cart|basket|checkout|search|print|share|feed|trackback|xmlrpc|wp-|tag|tags|archive|filter|sort|compare|wishlist|subscribe|unsubscribe|sitemap|impressum|privacy|cookie|terms|policy|soglasie|politika|личный|кабинет|корзина|поиск)/i;
export function isLowValueUrl(url) {
    try {
        const u = new URL(url);
        if (LOW_VALUE_RE.test(u.pathname))
            return true;
        // Pagination deeper than page 2 and filter/sort query params are low value.
        if (u.searchParams.has('sort') || u.searchParams.has('order') || u.searchParams.has('filter'))
            return true;
        const page = u.searchParams.get('page') || u.searchParams.get('p');
        if (page && Number(page) > 2)
            return true;
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Value-ordered crawl frontier. Dedupes by canonical key (host-agnostic for
 * www/non-www, index.html/trailing-slash collapsed, tracking params removed
 * upstream by normalizeUrl). Lowest priority value is fetched first.
 */
export class CrawlFrontier {
    maxDepth;
    items = [];
    seenKeys = new Set();
    order = 0;
    plan = new Map();
    constructor(maxDepth) {
        this.maxDepth = maxDepth;
    }
    /** Returns true when the URL was newly enqueued. */
    add(url, depth, source, extraPriority = 0) {
        const key = canonicalKey(url);
        if (this.seenKeys.has(key))
            return false;
        this.seenKeys.add(key);
        let priority = SOURCE_PRIORITY[source] + depth * 10 + extraPriority;
        if (isLowValueUrl(url))
            priority += FRONTIER_PRIORITY.LOW_VALUE;
        this.items.push({ url, source, depth, priority, order: this.order++ });
        this.plan.set(key, { url, source, depth, priority, attempted: false });
        return true;
    }
    has(url) {
        return this.seenKeys.has(canonicalKey(url));
    }
    next() {
        if (!this.items.length)
            return undefined;
        let bestIdx = 0;
        for (let i = 1; i < this.items.length; i++) {
            const it = this.items[i];
            const best = this.items[bestIdx];
            if (it.priority < best.priority || (it.priority === best.priority && it.order < best.order))
                bestIdx = i;
        }
        return this.items.splice(bestIdx, 1)[0];
    }
    get size() {
        return this.items.length;
    }
    mark(entry, patch) {
        const key = typeof entry === 'string' ? canonicalKey(entry) : canonicalKey(entry.url);
        const p = this.plan.get(key);
        if (p)
            Object.assign(p, patch);
    }
    /** Mark every never-attempted candidate so misses are observable. */
    finalizePlan(result) {
        for (const p of this.plan.values()) {
            if (!p.attempted && !p.result)
                p.result = result;
        }
        return [...this.plan.values()];
    }
}
