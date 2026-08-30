import type { DgisItem } from './fetch2gisItems.js';
import type { Prisma } from '@prisma/client';
import { evaluateWebsiteEligibility } from '../../utils/evaluateWebsiteEligibility.js';

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

  const phone = (item.contacts ?? []).find((c: { type?: string; value?: string }) => c.type === 'phone')?.value;
  const rawWebsite = (item.contacts ?? []).find((c: { type?: string; value?: string }) => c.type === 'website')?.value;

  const eligibility = rawWebsite
    ? evaluateWebsiteEligibility(rawWebsite)
    : { eligible: false, canonicalUrl: null, canonicalDomain: null, reason: 'NO_WEBSITE' as const, matchedRule: null };

  const website = eligibility.eligible ? eligibility.canonicalUrl : null;
  const websiteDomain = eligibility.eligible ? eligibility.canonicalDomain : null;
  const websiteStatus = eligibility.eligible ? 'FOUND' : 'UNKNOWN';
  const websiteIneligibilityReason = eligibility.eligible ? null : eligibility.reason;

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
    phone: phone ?? null,
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
    phone: phone ?? null,
    sourceUrl: item.url ?? null
  };

  return { sourceId: item.id, create, update };
}
