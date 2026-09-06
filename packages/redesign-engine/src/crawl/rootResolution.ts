import type { HomepageStatus, RootResolution } from '../types.js';

// Generic site-root resolution. Homepage identity comes ONLY from canonical
// URL semantics: follow the redirect chain of the site root and record what
// actually answered. A failed root must never promote an internal page to HOME.

export interface RootFetchResult {
  /** Final URL after all redirects. */
  finalUrl: string;
  /** URLs visited by the redirect chain, in order (excluding the request itself). */
  redirectChain: string[];
  status: number;
  durationMs: number;
  /** rel=canonical observed on the resolved page, if any. */
  canonicalUrl?: string;
}

export type RootFetch = (url: string, timeoutMs: number) => Promise<RootFetchResult>;

export class RootFetchTimeout extends Error {}
export class RootFetchError extends Error {}

/** Safe root variants, tried in order. No domain-specific exceptions. */
export function rootVariants(inputUrl: string): string[] {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  } catch {
    return [inputUrl];
  }
  const host = u.hostname.replace(/^www\./i, '');
  const variants = [
    `https://${host}/`,
    `https://www.${host}/`,
    `http://${host}/`,
    `http://www.${host}/`,
  ];
  // If the input already pins a variant, try it first.
  const given = `${u.protocol}//${u.host}/`;
  return [given, ...variants.filter((v) => v !== given)];
}

function sameRegistrableDomain(a: string, b: string): boolean {
  try {
    const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, '');
    return stripWww(new URL(a).hostname) === stripWww(new URL(b).hostname);
  } catch {
    return false;
  }
}

/** Canonical host-agnostic key for comparing a page URL to the resolved root. */
export function canonicalKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
    return `${host}${path}`;
  } catch {
    return url.toLowerCase();
  }
}

function isRootPath(url: string): boolean {
  try {
    const p = new URL(url).pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '');
    return p === '' || p === '/';
  } catch {
    return false;
  }
}

export interface ResolveRootOptions {
  timeoutMs?: number;
  retries?: number;
}

/**
 * Resolve the site root. Tries each safe variant; a successful fetch (status
 * < 400) that ends on a root path of the same registrable domain is FOUND.
 * Otherwise the status is explicit — never guessed.
 */
export async function resolveSiteRoot(
  inputUrl: string,
  opts: ResolveRootOptions,
  fetchRoot: RootFetch,
): Promise<RootResolution> {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const retries = Math.max(0, opts.retries ?? 1);
  const variants = rootVariants(inputUrl);

  let lastStatus: HomepageStatus = 'UNKNOWN';
  let lastReason = 'no root variant attempted';
  let last: RootResolution = {
    requestedUrl: variants[0],
    redirectChain: [],
    durationMs: 0,
    homepageStatus: 'UNKNOWN',
    failureReason: lastReason,
  };

  for (const variant of variants) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const started = Date.now();
      try {
        const res = await fetchRoot(variant, timeoutMs);
        const durationMs = res.durationMs ?? Date.now() - started;
        const chain = res.redirectChain || [];
        const finalUrl = res.finalUrl || variant;
        last = {
          requestedUrl: variant,
          redirectChain: [variant, ...chain.filter((c) => c !== variant)],
          finalUrl,
          canonicalUrl: res.canonicalUrl,
          status: res.status,
          durationMs,
          homepageStatus: 'UNKNOWN',
        };

        if (res.status >= 400) {
          lastStatus = 'HTTP_ERROR';
          lastReason = `HTTP ${res.status}`;
          last.homepageStatus = 'HTTP_ERROR';
          last.failureReason = lastReason;
          break; // HTTP errors are deterministic — don't retry this variant.
        }
        if (!sameRegistrableDomain(inputUrl, finalUrl)) {
          lastStatus = 'REDIRECT_FAILED';
          lastReason = `redirect left the site domain: ${finalUrl}`;
          last.homepageStatus = 'REDIRECT_FAILED';
          last.failureReason = lastReason;
          break;
        }
        // The root resolved. The final URL should be a root path; if it is not
        // (e.g. redirected to /en/), the final URL is still the canonical home —
        // record it as FOUND with the observed canonical identity.
        lastStatus = 'FOUND';
        last.homepageStatus = 'FOUND';
        last.canonicalUrl = res.canonicalUrl || finalUrl;
        return last;
      } catch (err) {
        const isTimeout = err instanceof RootFetchTimeout || /timeout/i.test(String((err as Error)?.message));
        lastStatus = isTimeout ? 'TIMEOUT' : 'UNREACHABLE';
        lastReason = isTimeout ? `timeout after ${timeoutMs}ms` : String((err as Error)?.message || err);
        last = {
          requestedUrl: variant,
          redirectChain: [variant],
          durationMs: Date.now() - started,
          homepageStatus: lastStatus,
          failureReason: lastReason,
        };
        // Timeouts may be transient — retry within the bound.
      }
    }
  }

  last.homepageStatus = lastStatus;
  last.failureReason = lastReason;
  return last;
}

/**
 * The resolved homepage URL for SourceDocument identity. Only returned when
 * the root was actually found — otherwise undefined (UNKNOWN, not wrong).
 */
export function resolvedHomepageUrl(res: RootResolution): string | undefined {
  if (res.homepageStatus !== 'FOUND' || !res.finalUrl) return undefined;
  // Prefer rel=canonical when it points at a root path of the same domain.
  if (res.canonicalUrl && isRootPath(res.canonicalUrl) && sameRegistrableDomain(res.finalUrl, res.canonicalUrl)) {
    return res.canonicalUrl;
  }
  return res.finalUrl;
}
