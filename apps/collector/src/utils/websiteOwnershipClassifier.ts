import { canonicalizeWebsite } from './canonicalizeWebsite.js';

// WebsiteOwnershipClassifier — layered, deterministic, auditable.
//
// Layer 1: explicit known-domain policy (verified aggregator/directory
//          platforms observed in the lead corpus — added only with evidence).
// Layer 2: deterministic structural signals extracted from page content
//          (only when HTML/text is available — e.g. post-fetch or test input).
// Layer 3: URL-shape signals (company-listing path patterns).
//
// Uncertain cases stay UNCERTAIN for human review — never auto-rejected.
// No external calls; pure functions.

export type OwnershipDecision =
  | 'DIRECT_COMPANY_SITE'
  | 'AGGREGATOR'
  | 'DIRECTORY'
  | 'MARKETPLACE'
  | 'MAP_PROVIDER'
  | 'SEARCH_ENGINE'
  | 'SOCIAL_NETWORK'
  | 'GOVERNMENT'
  | 'MEDIA_PORTAL'
  | 'UNCERTAIN';

export const CLASSIFIER_VERSION = 'ownership-v1.0';

export interface OwnershipClassification {
  decision: OwnershipDecision;
  reason: string;
  confidence: number;
  matchedSignals: string[];
  evidenceUrls: string[];
  classifierVersion: string;
}

export interface OwnershipInput {
  url: string;
  companyName?: string;
  html?: string;
  text?: string;
  /** Internal hrefs observed on the fetched page (for listing-pattern signals). */
  links?: string[];
}

// ---------------------------------------------------------------------------
// Layer 1 — explicit policy. Verified entries only; each carries evidence.
// ---------------------------------------------------------------------------

interface PolicyEntry {
  domain: string;
  decision: OwnershipDecision;
  reason: string;
  evidence: string;
}

export const KNOWN_NON_COMPANY_DOMAINS: PolicyEntry[] = [
  { domain: 'gmc.by', decision: 'AGGREGATOR', reason: 'GMC is a company directory/aggregator: numbered company listings (e.g. /16851-flaydero.html), add-company/add-product flows, unrelated sellers on one domain', evidence: 'https://gmc.by/16851-flaydero.html' },
  { domain: 'deal.by', decision: 'MARKETPLACE', reason: 'deal.by is a marketplace: seller storefronts under /cs/<id>/, catalog of goods from many unrelated sellers', evidence: 'https://deal.by/cs/252480/contacts' },
  { domain: 'rubrikator.by', decision: 'DIRECTORY', reason: 'rubrikator.by is an organization directory (same operator family as rubrikator.org): /place/<slug> listings', evidence: 'https://rubrikator.by/place/…' },
  { domain: 'minsk-city.by', decision: 'DIRECTORY', reason: 'minsk-city.by is a city directory: /companies/<slug> listings of unrelated businesses', evidence: 'https://minsk-city.by/companies/azhur' },
];

// ---------------------------------------------------------------------------
// Layer 3 — URL shape. Strong listing patterns only; a company's own
// /catalog/, /products/, /projects/ pages are NOT evidence of aggregation.
// ---------------------------------------------------------------------------

const LISTING_PATH_RES = [
  { re: /\/(companies|company|firms?|org|orgs|organizations|place|places|catalog-companies|spravochnik|katalog-kompanij)\/[\w-]+/i, signal: 'url:company-listing-pattern' },
  { re: /\/\d{3,}-[\w-]+\.(html?|php)$/i, signal: 'url:numbered-company-page' }, // gmc-style /16851-flaydero.html
  { re: /\/cs\/\d+\//i, signal: 'url:seller-storefront' }, // deal.by storefront
  { re: /\/(tag|tags|rubric|rubrics|category-directory|razdel)\/[\w-]+/i, signal: 'url:tag-directory' },
];

// ---------------------------------------------------------------------------
// Layer 2 — structural signals from page content.
// ---------------------------------------------------------------------------

const STRUCTURAL_SIGNALS: { re: RegExp; signal: string; weight: number }[] = [
  { re: /добавить\s+(компанию|организацию|фирму|предприятие)/i, signal: 'text:add-company-flow', weight: 3 },
  { re: /добавить\s+(товар|услугу|объявление|продукцию)/i, signal: 'text:add-product-service-flow', weight: 2 },
  { re: /каталог\s+(компаний|организаций|предприятий|фирм)/i, signal: 'text:company-catalog', weight: 3 },
  { re: /справочник\s+(организаций|предприятий|компаний)/i, signal: 'text:org-directory', weight: 3 },
  { re: /(разместить|зарегистрировать)\s+(компанию|организацию|свою фирму)/i, signal: 'text:business-registration-flow', weight: 3 },
  { re: /(все|поиск)\s+(компании|организации|поставщики|продавцы)\s+(в|по)\s+(рубрик|категор|город)/i, signal: 'text:directory-search', weight: 2 },
  { re: /бесплатн\w*\s+(размещени|добавлени)\w*/i, signal: 'text:free-listing-offer', weight: 2 },
  { re: /organizations?\s+catalog|business\s+directory|add\s+(your\s+)?(company|business|listing)/i, signal: 'text:en-directory', weight: 3 },
];

const SELLER_ATTR_RE = /(поставщик|продавец|компания|организация|смотреть все (товары|услуги) (компании|продавца))\s*[::]/i;

interface SignalHit { signal: string; weight: number; }

function structuralSignals(input: OwnershipInput): SignalHit[] {
  const hits: SignalHit[] = [];
  const text = `${input.text || ''}\n${input.html || ''}`;
  if (!text.trim()) return hits;
  for (const s of STRUCTURAL_SIGNALS) {
    if (s.re.test(text)) hits.push({ signal: s.signal, weight: s.weight });
  }
  if (SELLER_ATTR_RE.test(text)) hits.push({ signal: 'text:seller-attribution', weight: 2 });
  // Many unrelated organization names → schema/listed-company signal. We only
  // count explicit multi-org markers to avoid flagging a company's own catalog.
  const orgMentions = text.match(/оао|ооо|зао|ип\s|чтуп|уп\s|llc|ltd/gi) || [];
  if (new Set(orgMentions.map((m) => m.toLowerCase())).size >= 4) {
    hits.push({ signal: 'text:many-distinct-org-forms', weight: 1 });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export function classifyWebsiteOwnership(input: OwnershipInput): OwnershipClassification {
  const cw = canonicalizeWebsite(input.url);
  const host = cw.registrableDomain || cw.canonicalHost;
  const matchedSignals: string[] = [];
  const evidenceUrls: string[] = [];

  // Layer 1 — explicit policy wins outright.
  if (host) {
    const rule = KNOWN_NON_COMPANY_DOMAINS.find((r) => host === r.domain || host.endsWith(`.${r.domain}`));
    if (rule) {
      return {
        decision: rule.decision,
        reason: rule.reason,
        confidence: 0.98,
        matchedSignals: [`policy:${rule.domain}`],
        evidenceUrls: [input.url],
        classifierVersion: CLASSIFIER_VERSION,
      };
    }
  }

  // Layer 3 — URL shape.
  const path = (() => { try { return new URL(cw.canonicalUrl || input.url).pathname; } catch { return ''; } })();
  for (const { re, signal } of LISTING_PATH_RES) {
    if (re.test(path)) matchedSignals.push(signal);
  }

  // Layer 2 — structural signals when content is available.
  const structural = structuralSignals(input);
  matchedSignals.push(...structural.map((s) => s.signal));
  const weight = structural.reduce((s, h) => s + h.weight, 0) + matchedSignals.filter((s) => s.startsWith('url:')).length * 1;

  if (weight >= 4) {
    // Multiple strong aggregator signals → confident DIRECTORY/AGGREGATOR.
    const decision: OwnershipDecision = structural.some((s) => s.signal.includes('seller') || s.signal.includes('storefront')) || matchedSignals.includes('url:seller-storefront')
      ? 'MARKETPLACE' : 'DIRECTORY';
    return {
      decision,
      reason: `Structural aggregator signals (weight ${weight}): ${matchedSignals.join(', ')}`,
      confidence: Math.min(0.9, 0.5 + weight * 0.08),
      matchedSignals,
      evidenceUrls: [input.url],
      classifierVersion: CLASSIFIER_VERSION,
    };
  }
  if (weight >= 2) {
    // Some aggregator signals but not conclusive — human review.
    return {
      decision: 'UNCERTAIN',
      reason: `Weak aggregator signals (weight ${weight}): ${matchedSignals.join(', ')}`,
      confidence: 0.4,
      matchedSignals,
      evidenceUrls: [input.url],
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  // A deep path on an otherwise clean domain can still be a listing — one
  // strong URL signal alone stays UNCERTAIN (e.g. news site company profile).
  if (matchedSignals.some((s) => s.startsWith('url:'))) {
    return {
      decision: 'UNCERTAIN',
      reason: `URL matches a listing pattern but no structural confirmation: ${matchedSignals.join(', ')}`,
      confidence: 0.35,
      matchedSignals,
      evidenceUrls: [input.url],
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  return {
    decision: 'DIRECT_COMPANY_SITE',
    reason: 'No aggregator/directory signals — direct company website',
    confidence: host ? 0.8 : 0.5,
    matchedSignals,
    evidenceUrls: [input.url],
    classifierVersion: CLASSIFIER_VERSION,
  };
}
