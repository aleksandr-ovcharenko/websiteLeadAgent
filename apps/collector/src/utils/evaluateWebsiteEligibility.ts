import { normalizeWebsiteDomain } from './normalizeWebsiteDomain.js';

export type WebsiteEligibilityReason =
  | 'NO_WEBSITE'
  | 'INVALID_URL'
  | 'AGGREGATOR'
  | 'DIRECTORY'
  | 'GOVERNMENT'
  | 'SOCIAL_NETWORK'
  | 'MARKETPLACE'
  | 'MAP_PROVIDER'
  | 'SEARCH_ENGINE'
  | 'BLACKLISTED_DOMAIN'
  | 'OTHER_NON_COMPANY_SITE';

export interface WebsiteEligibilityResult {
  eligible: boolean;
  canonicalUrl: string | null;
  canonicalDomain: string | null;
  reason: WebsiteEligibilityReason | null;
  matchedRule: string | null;
}

interface Rule {
  type: 'exact' | 'suffix' | 'pattern';
  value: string;
  reason: WebsiteEligibilityReason;
  category?: string;
}

const POLICY: Rule[] = [
  // Aggregator / directory platforms
  { type: 'suffix', value: 'ibiz.by', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'jsprav.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'spr.by', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'spisok.by', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'rubrikator.org', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'by.spr.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'cataloxy-by.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'suffix', value: 'cataloxy.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'yell.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'yell.by', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'zoon.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },

  // Government
  { type: 'suffix', value: 'gov.by', reason: 'GOVERNMENT', category: 'GOVERNMENT' },

  // Map / search / social / marketplace
  { type: 'suffix', value: '2gis.ru', reason: 'MAP_PROVIDER', category: 'MAP_PROVIDER' },
  { type: 'suffix', value: '2gis.kz', reason: 'MAP_PROVIDER', category: 'MAP_PROVIDER' },
  { type: 'suffix', value: '2gis.com', reason: 'MAP_PROVIDER', category: 'MAP_PROVIDER' },
  { type: 'exact', value: 'yandex.ru', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'exact', value: 'yandex.by', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'exact', value: 'yandex.com', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'suffix', value: 'yandex.ru', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'suffix', value: 'yandex.by', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'suffix', value: 'yandex.com', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'exact', value: 'google.com', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'suffix', value: 'google.com', reason: 'SEARCH_ENGINE', category: 'SEARCH_ENGINE' },
  { type: 'exact', value: 'vk.com', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'facebook.com', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'instagram.com', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'linkedin.com', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'ok.ru', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'youtube.com', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'tiktok.com', reason: 'SOCIAL_NETWORK', category: 'SOCIAL_NETWORK' },
  { type: 'exact', value: 'wildberries.ru', reason: 'MARKETPLACE', category: 'MARKETPLACE' },
  { type: 'exact', value: 'ozon.ru', reason: 'MARKETPLACE', category: 'MARKETPLACE' },
  { type: 'exact', value: 'aliexpress.com', reason: 'MARKETPLACE', category: 'MARKETPLACE' },
  { type: 'exact', value: 'market.yandex.ru', reason: 'MARKETPLACE', category: 'MARKETPLACE' },

  // Legacy hard blacklist (exact subdomains captured above)
  { type: 'exact', value: 'minsk.jsprav.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'rubrikator.org', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'spisok.by', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'spr.by', reason: 'DIRECTORY', category: 'AGGREGATOR' },
  { type: 'exact', value: 'by.spr.ru', reason: 'DIRECTORY', category: 'AGGREGATOR' },
];

function toCanonicalUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      new URL(raw);
      return raw;
    }
    const withHttps = `https://${raw}`;
    new URL(withHttps);
    return withHttps;
  } catch {
    return null;
  }
}

export function evaluateWebsiteEligibility(input: string | null | undefined): WebsiteEligibilityResult {
  const raw = input?.trim() ?? '';
  if (!raw) {
    return { eligible: false, canonicalUrl: null, canonicalDomain: null, reason: 'NO_WEBSITE', matchedRule: null };
  }

  const canonicalUrl = toCanonicalUrl(raw);
  const canonicalDomain = normalizeWebsiteDomain(raw);

  if (!canonicalUrl || !canonicalDomain) {
    return { eligible: false, canonicalUrl, canonicalDomain, reason: 'INVALID_URL', matchedRule: null };
  }

  const domain = canonicalDomain.toLowerCase();

  for (const rule of POLICY) {
    let matches = false;
    if (rule.type === 'exact' && domain === rule.value) matches = true;
    if (rule.type === 'suffix' && (domain === rule.value || domain.endsWith(`.${rule.value}`))) matches = true;
    if (rule.type === 'pattern') {
      try {
        const re = new RegExp(rule.value, 'i');
        if (re.test(domain) || re.test(raw)) matches = true;
      } catch { /* ignore invalid regex */ }
    }

    if (matches) {
      return {
        eligible: false,
        canonicalUrl,
        canonicalDomain,
        reason: rule.reason,
        matchedRule: `${rule.type}:${rule.value}${rule.category ? ` (${rule.category})` : ''}`,
      };
    }
  }

  return { eligible: true, canonicalUrl, canonicalDomain, reason: null, matchedRule: null };
}
