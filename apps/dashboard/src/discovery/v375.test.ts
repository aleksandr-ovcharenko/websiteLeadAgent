import { describe, it, expect, vi, beforeEach } from 'vitest';
import { map2gisItemToLeadUpsert } from '../../../collector/src/providers/2gis/map2gisItemToLeadUpsert.js';
import { parseDgisItemsResponse, itemHasContactGroups } from '../../../collector/src/providers/2gis/fetch2gisItems.js';
import { DiscoveryGatingService } from './gate.js';
import { createTwogisProvider } from './providers/twogis.js';

// ---------------------------------------------------------------------------
// Part B — 2GIS contact_groups extraction
// ---------------------------------------------------------------------------

const NESTED_ITEM = {
  id: '70000001053432836',
  name: 'Дана Астра, строительная компания',
  address_name: 'Петра Мстиславца, 9',
  rubrics: [{ name: 'Застройщики' }],
  point: { lat: 53.93, lon: 27.64 },
  contact_groups: [
    {
      name: 'Офис',
      contacts: [
        { type: 'phone', value: '+375 17 200-00-00', text: '+375 17 200-00-00' },
        { type: 'website', url: 'https://dana-astra.by', text: 'dana-astra.by' },
      ],
    },
  ],
};

describe('2GIS contact_groups extraction', () => {
  it('1. extracts website from nested contact_groups', () => {
    const mapped = map2gisItemToLeadUpsert({ city: 'Минск', query: 'стройка', item: NESTED_ITEM as any });
    expect(mapped.create.website).toBe('https://dana-astra.by');
    expect(mapped.create.websiteDomain).toBe('dana-astra.by');
    expect(mapped.create.websiteStatus).toBe('FOUND');
  });

  it('2. finds website and phone across multiple contact groups', () => {
    const item = {
      ...NESTED_ITEM,
      contact_groups: [
        { contacts: [{ type: 'phone', value: '+375 29 111-22-33' }] },
        { contacts: [{ type: 'website', text: 'second-site.by' }, { type: 'phone', value: '+375 44 000-00-00' }] },
      ],
    };
    const mapped = map2gisItemToLeadUpsert({ city: 'Минск', query: 'q', item: item as any });
    expect(mapped.create.website).toBe('https://second-site.by');
    expect(mapped.create.phone).toBe('+375 29 111-22-33');
  });

  it('2b. website priority: contact.url > contact.value > normalized contact.text', () => {
    const item = {
      ...NESTED_ITEM,
      contact_groups: [{ contacts: [{ type: 'website', url: 'https://u.by', value: 'v.by', text: 't.by' }] }],
    };
    expect(map2gisItemToLeadUpsert({ city: '', query: '', item: item as any }).create.website).toBe('https://u.by');
    const noUrl = { ...NESTED_ITEM, contact_groups: [{ contacts: [{ type: 'website', value: 'v.by', text: 't.by' }] }] };
    expect(map2gisItemToLeadUpsert({ city: '', query: '', item: noUrl as any }).create.website).toBe('https://v.by');
    const onlyText = { ...NESTED_ITEM, contact_groups: [{ contacts: [{ type: 'website', text: 't-site.by' }] }] };
    expect(map2gisItemToLeadUpsert({ city: '', query: '', item: onlyText as any }).create.website).toBe('https://t-site.by');
  });

  it('5. still supports legacy flat contacts[]', () => {
    const item = { id: 'x', name: 'X', contacts: [{ type: 'website', value: 'legacy.by' }, { type: 'phone', value: '+1' }] };
    const mapped = map2gisItemToLeadUpsert({ city: '', query: '', item: item as any });
    expect(mapped.create.website).toBe('https://legacy.by');
    expect(mapped.create.phone).toBe('+1');
  });

  it('2gis profile links never become the lead website', () => {
    const item = {
      ...NESTED_ITEM,
      contact_groups: [{ contacts: [{ type: 'website', url: 'https://2gis.by/minsk/firm/70000001053432836' }] }],
    };
    const mapped = map2gisItemToLeadUpsert({ city: '', query: '', item: item as any });
    expect(mapped.create.website).toBeNull();
    expect(mapped.create.websiteDomain).toBeNull();
  });
});

describe('2GIS contact_groups availability detection', () => {
  it('parses items with contact_groups when the key has permission', () => {
    const raw = { result: { items: [NESTED_ITEM] } };
    const parsed = parseDgisItemsResponse(raw);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.contactGroupsPresent).toBe(true);
    expect(itemHasContactGroups(raw.result.items[0])).toBe(true);
  });

  it('detects missing contact_groups (key without permission)', () => {
    const raw = { result: { items: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] } };
    const parsed = parseDgisItemsResponse(raw);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.contactGroupsPresent).toBe(false);
  });
});

describe('2GIS provider warning', () => {
  const ctx = { prisma: {} as any, logger: { warn: () => {}, info: () => {} } as any, env: { DGIS_API_KEY: 'k' } };

  it('3. key without contact permission → DGIS_CONTACT_GROUPS_UNAVAILABLE warning, not silent NO_WEBSITE mass', async () => {
    const itemsNoContacts = [{ id: 'a1', name: 'A' }, { id: 'b2', name: 'B' }];
    const provider = createTwogisProvider({
      fetchItems: async () => ({ items: itemsNoContacts, contactGroupsPresent: false, rawItems: itemsNoContacts }),
      probeContactAccess: async () => false,
    });
    const progress: any[] = [];
    const result = await provider.search(
      { provider: 'dgis', query: 'стройка', location: 'Минск', limit: 10, maxPages: 1 },
      { ...ctx, onProgress: (m, meta) => progress.push({ m, meta }) },
    );
    expect(result.warning).toBe('DGIS_CONTACT_GROUPS_UNAVAILABLE');
    expect(progress.some((p) => p.meta?.reason === 'DGIS_CONTACT_PERMISSION_MISSING')).toBe(true);
  });

  it('3b. key with permission → no warning, candidates carry websites', async () => {
    const provider = createTwogisProvider({
      fetchItems: async () => ({ items: [NESTED_ITEM], contactGroupsPresent: true, rawItems: [NESTED_ITEM] }),
      probeContactAccess: async () => true,
    });
    const result = await provider.search(
      { provider: 'dgis', query: 'стройка', location: 'Минск', limit: 10, maxPages: 1 },
      ctx,
    );
    expect(result.warning).toBeUndefined();
    expect((result.candidates[0].data as any).websiteDomain).toBe('dana-astra.by');
  });
});

// ---------------------------------------------------------------------------
// Part C — discovery gate order: pending enrichment before NO_WEBSITE reject
// ---------------------------------------------------------------------------

function makeGatePrisma(existing: any[] = []) {
  const leads = [...existing];
  const candidates: any[] = [];
  return {
    prisma: {
      lead: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where?.websiteDomain) return leads.find((l) => l.websiteDomain === where.websiteDomain && l.mergeStatus === 'NONE') ?? null;
          return null;
        }),
        create: vi.fn(async ({ data }: any) => { const l = { id: `new-${leads.length}`, mergeStatus: 'NONE', ...data }; leads.push(l); return l; }),
      },
      discoveryCandidate: { create: vi.fn(async ({ data }: any) => { candidates.push(data); return data; }) },
      discoveryRun: { update: vi.fn(async () => ({})) },
      leadQuery: { upsert: vi.fn(async () => ({})) },
    } as any,
    leads,
    candidates,
  };
}

const logger: any = { info: () => {}, warn: () => {} };
const RUN = { id: 'run1', query: 'строительные компании', intent: 'строительные компании' };

function baseCandidate(over: any = {}) {
  return {
    source: 'dgis',
    sourceId: `s${Math.random().toString(36).slice(2, 8)}`,
    companyName: 'Строительная компания ООО',
    city: 'Минск',
    address: 'ул. Строителей, 1',
    categories: ['Строительные компании', 'Генподрядчик'],
    phone: null,
    website: null,
    ...over,
  };
}

describe('discovery gate website resolution order', () => {
  it('4. candidate without provider website → enrichment is attempted before reject', async () => {
    const enrich = vi.fn(async () => ({ website: null, phone: null, attempts: [{ provider: 'osm', input: 'q', candidateUrl: null, decision: 'NONE' as const, reason: 'no result' }] }));
    const { prisma, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: enrich });
    const res = await gate.process(RUN, [baseCandidate()]);
    expect(enrich).toHaveBeenCalledOnce();
    expect(candidates[0].enrichmentAttempts).toHaveLength(1);
    expect(res.created).toBe(0);
  });

  it('5. enrichment finds direct site → ACCEPT with WEBSITE_FROM_ENRICHMENT', async () => {
    const enrich = vi.fn(async () => ({
      website: 'https://acme-build.by', phone: '+375 29 000-00-00',
      attempts: [{ provider: 'osm', input: 'q', candidateUrl: 'https://acme-build.by', decision: 'FOUND' as const, reason: null }],
    }));
    const { prisma, leads, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: enrich });
    const res = await gate.process(RUN, [baseCandidate()]);
    expect(res.created).toBe(1);
    expect(leads[0].website).toBe('https://acme-build.by/');
    expect(candidates[0].decision).toBe('ACCEPT');
    expect(candidates[0].reason).toBe('WEBSITE_FROM_ENRICHMENT');
    expect(candidates[0].websiteSource).toBe('enrichment');
  });

  it('6. enrichment finds aggregator → REJECT SITE_KIND_AGGREGATOR, no lead', async () => {
    const enrich = vi.fn(async () => ({
      website: 'https://gmc.by/16851-flaydero.html', phone: null,
      attempts: [{ provider: 'ddg', input: 'q', candidateUrl: 'https://gmc.by/16851-flaydero.html', decision: 'FOUND' as const, reason: null }],
    }));
    const { prisma, leads, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: enrich });
    const res = await gate.process(RUN, [baseCandidate()]);
    expect(res.created).toBe(0);
    expect(leads).toHaveLength(0);
    expect(candidates[0].decision).toBe('REJECT');
    expect(candidates[0].reason).toBe('SITE_KIND_AGGREGATOR');
  });

  it('7. all enrichment attempts exhausted → NO_WEBSITE_AFTER_ENRICHMENT with evidence', async () => {
    const enrich = vi.fn(async () => ({
      website: null, phone: null,
      attempts: [
        { provider: 'osm', input: 'Строительная компания ООО, Минск', candidateUrl: null, decision: 'NONE' as const, reason: 'no osm object' },
        { provider: 'ddg', input: 'Строительная компания ООО Минск', candidateUrl: 'https://2gis.by/firm/1', decision: 'INELIGIBLE' as const, reason: 'MAP_PROVIDER' },
      ],
    }));
    const { prisma, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: enrich });
    await gate.process(RUN, [baseCandidate()]);
    expect(candidates[0].decision).toBe('REJECT');
    expect(candidates[0].reason).toBe('NO_WEBSITE_AFTER_ENRICHMENT');
    expect(candidates[0].enrichmentAttempts).toHaveLength(2);
    expect(candidates[0].enrichmentAttempts[1].reason).toBe('MAP_PROVIDER');
  });

  it('provider website path → ACCEPT with WEBSITE_FROM_PROVIDER, no enrichment call', async () => {
    const enrich = vi.fn();
    const { prisma, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: enrich });
    await gate.process(RUN, [baseCandidate({ website: 'https://direct.by' })]);
    expect(enrich).not.toHaveBeenCalled();
    expect(candidates[0].decision).toBe('ACCEPT');
    expect(candidates[0].reason).toBe('WEBSITE_FROM_PROVIDER');
    expect(candidates[0].websiteSource).toBe('provider');
  });

  it('aggregator from provider → REJECT SITE_KIND_*, no lead', async () => {
    const { prisma, candidates, leads } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: vi.fn() });
    await gate.process(RUN, [baseCandidate({ website: 'https://deal.by/cs/123/contacts' })]);
    expect(candidates[0].reason).toBe('SITE_KIND_MARKETPLACE');
    expect(leads).toHaveLength(0);
  });

  it('run reasonBreakdown aggregates candidate reasons', async () => {
    const enrich = vi.fn(async () => ({ website: null, phone: null, attempts: [] }));
    const { prisma } = makeGatePrisma();
    const update = prisma.discoveryRun.update;
    const gate = new DiscoveryGatingService({ prisma, logger, env: {}, enricher: enrich });
    await gate.process(RUN, [
      baseCandidate({ website: 'https://ok1.by' }),
      baseCandidate({ website: 'https://ok2.by' }),
      baseCandidate({ website: 'https://gmc.by/x/1' }),
      baseCandidate({}),
    ]);
    const last = update.mock.calls.at(-1)?.[0];
    expect(last.data.reasonBreakdown.WEBSITE_FROM_PROVIDER).toBe(2);
    expect(last.data.reasonBreakdown.SITE_KIND_AGGREGATOR).toBe(1);
    expect(last.data.reasonBreakdown.NO_WEBSITE_AFTER_ENRICHMENT).toBe(1);
    expect(last.data.reasonBreakdown.ACCEPTED).toBe(2);
  });
});
