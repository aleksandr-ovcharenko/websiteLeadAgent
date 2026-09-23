import { z } from 'zod';

const pointSchema = z.object({
  lat: z.number().optional(),
  lon: z.number().optional()
});

const contactSchema = z.object({
  type: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  text: z.string().optional()
});

// Actual 2GIS response shape: item.contact_groups[].contacts[].
// contact_groups requires a paid permission on the API key — without it the
// field is silently absent from every item (HTTP stays 200).
const contactGroupSchema = z.object({
  name: z.string().optional(),
  contacts: z.array(contactSchema).optional()
});

const itemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  address_name: z.string().optional(),
  rubrics: z.array(z.object({ name: z.string().optional() })).optional(),
  point: pointSchema.optional(),
  url: z.string().optional(),
  // Legacy flat shape kept for backward compatibility with cached fixtures.
  contacts: z.array(contactSchema).optional(),
  contact_groups: z.array(contactGroupSchema).optional()
});

const responseSchema = z.object({
  result: z
    .object({
      items: z.array(itemSchema).optional()
    })
    .optional()
});

export type DgisItem = z.infer<typeof itemSchema>;

const REQUESTED_FIELDS = 'items.rubrics,items.point,items.contact_groups';

/** True when the RAW item object carries the requested contact_groups key. */
export function itemHasContactGroups(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && 'contact_groups' in (raw as Record<string, unknown>);
}

export function parseDgisItemsResponse(json: any): { items: DgisItem[]; contactGroupsPresent: boolean; rawItems: any[] } {
  const parsed = responseSchema.parse(json);
  const items = parsed.result?.items ?? [];
  const rawItems: any[] = Array.isArray(json?.result?.items) ? json.result.items : [];
  const contactGroupsPresent = rawItems.some(itemHasContactGroups);
  return { items, contactGroupsPresent, rawItems };
}

export interface Fetch2gisResult {
  items: DgisItem[];
  /** true when at least one returned item carried contact_groups. */
  contactGroupsPresent: boolean;
  /** Raw JSON items — evidence for diagnostics/replay (never sent onward). */
  rawItems: any[];
}

export async function fetch2gisItems(input: {
  apiKey: string;
  city: string;
  query: string;
  page: number;
  pageSize: number;
  fetchImpl?: typeof fetch;
}): Promise<Fetch2gisResult> {
  const { apiKey, city, query, page, pageSize } = input;
  const fetchImpl = input.fetchImpl ?? fetch;

  const url = new URL('https://catalog.api.2gis.com/3.0/items');
  url.searchParams.set('q', `${query} ${city}`);
  url.searchParams.set('type', 'branch');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  url.searchParams.set('fields', REQUESTED_FIELDS);
  url.searchParams.set('key', apiKey);

  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`2GIS HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  return parseDgisItemsResponse(json);
}

/** Strip nothing secret-bearing but keep the sample small — 2GIS items carry
 *  no credentials; redaction trims bulky arrays for evidence storage. */
export function redactDgisItem(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const { contact_groups, ...rest } = raw;
  return {
    ...rest,
    ...(contact_groups !== undefined
      ? { contact_groups: contact_groups.map((g: any) => ({ contacts: (g?.contacts ?? []).map((c: any) => ({ type: c?.type, value: c?.value, url: c?.url, text: c?.text })) })) }
      : {}),
  };
}

/**
 * Definitive permission probe: request contact_groups for a known firm id via
 * items/byid. When the key lacks the permission the field is absent even on
 * single-item detail — a real "no contacts" org still returns the key.
 */
export async function probeContactGroupsAccess(input: {
  apiKey: string;
  itemId: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL('https://catalog.api.2gis.com/3.0/items/byid');
  url.searchParams.set('id', input.itemId);
  url.searchParams.set('fields', 'items.contact_groups');
  url.searchParams.set('key', input.apiKey);
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return false;
    const json = await res.json();
    const items: any[] = Array.isArray(json?.result?.items) ? json.result.items : [];
    return items.some(itemHasContactGroups);
  } catch {
    return false;
  }
}
