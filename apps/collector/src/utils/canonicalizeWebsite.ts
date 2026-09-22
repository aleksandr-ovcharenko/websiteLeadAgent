import { getDomain, parse } from 'tldts';

// Canonical website identity for discovery dedup and ownership checks.
//
// canonicalUrl:    scheme-normalized origin + cleaned path (stable identity of
//                  the resource the candidate pointed at)
// canonicalHost:   lowercase hostname, www stripped, IDN→punycode
// registrableDomain: public-suffix-aware registrable domain (tldts) — the
//                  strong duplicate key for "one Lead per company website"

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|yclid$|dclid$|mc_cid$|mc_eid$|igshid$|_ga$|_gl$|spm$|ref$|ref_|source$|campaign|medium$|sourceid$|from$|openstat|roistat|ymclid|erid$)/i;

function cleanPathname(pathname: string): string {
  let p = pathname || '/';
  // collapse duplicate slashes, drop trailing slash (but keep root "/")
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

export interface CanonicalWebsite {
  canonicalUrl: string | null;
  canonicalHost: string | null;
  registrableDomain: string | null;
  /** Strong dedup key: registrable domain — ignores scheme/www/path/query. */
  domainKey: string | null;
  /** Deeper key for same-domain different-site cases (path-aware). */
  urlKey: string | null;
}

export function canonicalizeWebsite(input: string | null | undefined): CanonicalWebsite {
  const none: CanonicalWebsite = { canonicalUrl: null, canonicalHost: null, registrableDomain: null, domainKey: null, urlKey: null };
  const raw = (input || '').trim();
  if (!raw) return none;

  let url: URL;
  try {
    url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
  } catch {
    return none;
  }

  // IDN → punycode happens inside URL; lowercase host; strip leading www.
  let host = url.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host || host === 'localhost' || !host.includes('.')) return none;

  // Fragment never identifies a distinct website; tracking params must not
  // create distinct identities either.
  url.hash = '';
  const params = new URLSearchParams(url.search);
  for (const k of [...params.keys()]) {
    if (TRACKING_PARAMS.test(k)) params.delete(k);
  }
  params.sort();

  const registrable = getDomain(host) || host;
  const path = cleanPathname(url.pathname);
  const query = params.toString();
  const canonicalUrl = `https://${host}${path}${query ? `?${query}` : ''}`;

  return {
    canonicalUrl,
    canonicalHost: host,
    registrableDomain: registrable,
    domainKey: registrable,
    urlKey: `${registrable}${path}`,
  };
}

/** True when `host` is a public suffix itself (e.g. com.by) — never a valid
 *  company identity on its own. */
export function isPublicSuffixHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  if (!h.includes('.')) return false;
  // Whole host is a listed public suffix → registrable domain is null.
  return parse(h).isIcann === true && getDomain(h) === null;
}
