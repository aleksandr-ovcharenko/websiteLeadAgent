import type { DgisItem } from './fetch2gisItems.js';
import type { Prisma } from '@prisma/client';
import { evaluateWebsiteEligibility } from '../../utils/evaluateWebsiteEligibility.js';

type DgisContact = { type?: string; value?: string; url?: string; text?: string };

function allContacts(item: DgisItem): DgisContact[] {
  const out: DgisContact[] = [];
  for (const group of item.contact_groups ?? []) {
    out.push(...(group.contacts ?? []));
  }
  out.push(...(item.contacts ?? []));
  return out;
}

function contactKind(c: DgisContact): string {
  return (c.type ?? '').toLowerCase();
}

/** contact.text often carries a bare domain ("acme.by") — normalize to a URL. */
function normalizeWebsiteText(text?: string): string | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  if (/^[\w.-]+\.[a-zа-я]{2,}(\/\S*)?$/iu.test(t)) return `https://${t}`;
  return null;
}

function websiteCandidates(c: DgisContact): string[] {
  return [c.url, c.value, normalizeWebsiteText(c.text)]
    .filter((x): x is string => Boolean(x && x.trim()));
}

export function map2gisItemToLeadUpsert(input: {
  city: string;
  query: string;
  item: DgisItem;
}): {
  sourceId: string;
  create: Prisma.LeadCreateInput;
  update: Prisma.LeadUpdateInput;
} {
  const { city, item } = input;

  const categories = (item.rubrics ?? [])
    .map((r: { name?: string }) => r.name)
    .filter((x: string | undefined): x is string => Boolean(x));

  const contacts = allContacts(item);
  const phoneContact = contacts.find((c) => contactKind(c) === 'phone');
  const phone = phoneContact?.value ?? phoneContact?.text ?? null;

  // Website contacts in priority order: url → value → normalized text, then
  // first candidate that passes direct-site eligibility (aggregators, maps,
  // 2gis profile links and social networks never become the lead website).
  let website: string | null = null;
  let websiteDomain: string | null = null;
  let lastReason: string | null = null;
  for (const c of contacts.filter((x) => contactKind(x) === 'website' || contactKind(x) === 'url')) {
    for (const cand of websiteCandidates(c)) {
      const e = evaluateWebsiteEligibility(cand);
      if (e.eligible) {
        website = e.canonicalUrl;
        websiteDomain = e.canonicalDomain;
        lastReason = null;
        break;
      }
      lastReason = e.reason;
    }
    if (website) break;
  }
  const websiteStatus = website ? 'FOUND' : 'UNKNOWN';
  const websiteIneligibilityReason = website ? null : (lastReason ?? 'NO_WEBSITE');

  const create: Prisma.LeadCreateInput = {
    source: 'dgis',
    sourceId: item.id,
    companyName: item.name ?? item.id,
    city,
    address: item.address_name ?? null,
    categories,
    latitude: item.point?.lat ?? null,
    longitude: item.point?.lon ?? null,
    website,
    websiteDomain,
    websiteStatus,
    websiteIneligibilityReason,
    phone,
    sourceUrl: item.url ?? null
  };

  const update: Prisma.LeadUpdateInput = {
    companyName: item.name ?? item.id,
    address: item.address_name ?? null,
    categories,
    latitude: item.point?.lat ?? null,
    longitude: item.point?.lon ?? null,
    website,
    websiteDomain,
    websiteStatus,
    websiteIneligibilityReason,
    phone,
    sourceUrl: item.url ?? null
  };

  return { sourceId: item.id, create, update };
}
