import { canonicalKey } from './rootResolution.js';
// Priority tiers — value-ordered, domain-agnostic.
export const FRONTIER_PRIORITY = {
    ROOT: -1000,
    NAV: -100, // primary navigation links
    SITEMAP: -50, // sitemap-discovered URLs
    INDEX: -75, // hub/ancestor pages of multiple discovered URLs — between nav and sitemap
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
        // Path pagination beyond page 1 (/page/2/, /stranica/3/) is low value.
        if (/\/(page|stranica|str|p)\/\d{2,}\/?$/i.test(u.pathname))
            return true;
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
    itemByKey = new Map();
    seenKeys = new Set();
    order = 0;
    ancestorDescendants = new Map();
    plan = new Map();
    constructor(maxDepth) {
        this.maxDepth = maxDepth;
    }
    effectivePriority(url, depth, source, extra = 0) {
        let priority = SOURCE_PRIORITY[source] + depth * 10 + extra;
        if (isLowValueUrl(url))
            priority += FRONTIER_PRIORITY.LOW_VALUE;
        return priority;
    }
    /** Returns true when the URL was newly enqueued. */
    add(url, depth, source, extraPriority = 0) {
        const key = canonicalKey(url);
        const priority = this.effectivePriority(url, depth, source, extraPriority);
        if (this.seenKeys.has(key)) {
            // Stronger evidence wins: a nav/body link discovered later must upgrade
            // a cheaply-seeded sitemap entry rather than be silently deduped.
            const existing = this.itemByKey.get(key);
            if (existing && priority < existing.priority) {
                existing.priority = priority;
                existing.source = source;
                existing.depth = Math.min(existing.depth, depth);
                const e = this.plan.get(key);
                if (e) {
                    e.priority = priority;
                    e.source = source;
                    e.depth = existing.depth;
                }
            }
            return false;
        }
        this.seenKeys.add(key);
        let finalPriority = priority;
        // If this URL is itself a known hub ancestor (children already discovered),
        // give it index-tier priority immediately.
        try {
            const selfPrefix = new URL(url).pathname.replace(/\/+$/, '') + '/';
            if ((this.ancestorDescendants.get(selfPrefix) || 0) >= 2) {
                finalPriority = Math.min(priority, FRONTIER_PRIORITY.INDEX + depth);
            }
        }
        catch { }
        const item = { url, source, depth, priority: finalPriority, order: this.order++ };
        this.items.push(item);
        this.itemByKey.set(key, item);
        this.plan.set(key, { url, source, depth, priority: finalPriority, attempted: false });
        this.applyHubBoost(url);
        return true;
    }
    /**
     * Hub boost: a path that is the ancestor of ≥2 discovered URLs is likely a
     * content index (e.g. /category/novosti parent of crawled children) — raise
     * its priority so indexes aren't starved by leaf pages. Structural, not
     * semantic: no language- or domain-specific names.
     */
    applyHubBoost(url) {
        let pathname;
        try {
            pathname = new URL(url).pathname;
        }
        catch {
            return;
        }
        const segs = pathname.split('/').filter(Boolean);
        for (let i = 1; i < segs.length; i++) {
            const prefix = '/' + segs.slice(0, i).join('/') + '/';
            const count = (this.ancestorDescendants.get(prefix) || 0) + 1;
            this.ancestorDescendants.set(prefix, count);
            if (count >= 2) {
                // Any queued item sitting on this hub path — including ones cheaply
                // claimed by sitemap seeding — gets index-tier priority.
                for (const item of this.items) {
                    try {
                        const p = new URL(item.url).pathname.replace(/\/+$/, '') + '/';
                        if (p === prefix && item.priority > FRONTIER_PRIORITY.INDEX) {
                            item.priority = FRONTIER_PRIORITY.INDEX + item.depth;
                            const e = this.plan.get(canonicalKey(item.url));
                            if (e)
                                e.priority = item.priority;
                        }
                    }
                    catch { }
                }
            }
        }
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
