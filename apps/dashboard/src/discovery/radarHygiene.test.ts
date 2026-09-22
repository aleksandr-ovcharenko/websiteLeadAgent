import { describe, it, expect, vi } from 'vitest';
import { canonicalizeWebsite } from '../../../collector/src/utils/canonicalizeWebsite.js';
import { classifyWebsiteOwnership } from '../../../collector/src/utils/websiteOwnershipClassifier.js';
import { evaluateWebsiteEligibility } from '../../../collector/src/utils/evaluateWebsiteEligibility.js';
import { groupDuplicates, planMerge, applyMerge, type LeadLite } from './dedupe.js';
import { leadMatchesFilters } from '../../../platform/src/radar/leadMerge.js';
import { DiscoveryGatingService } from './gate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let seq = 0;
function lead(over: Partial<LeadLite>): LeadLite {
  seq += 1;
  return {
    id: `L${seq}`,
    companyName: 'Company',
    website: null,
    websiteDomain: null,
    phone: null,
    address: null,
    source: 'test',
    sourceId: `s${seq}`,
    categories: [],
    redesignStage: 'NOT_SELECTED',
    manualReviewStatus: 'UNREVIEWED',
    mergeStatus: 'NONE',
    createdAt: new Date(2026, 0, seq),
    hasSite: false,
    ...over,
  };
}

const filters: any = { q: '' };

// ---------------------------------------------------------------------------
// Phase 15.1/15.3/15.4 — ownership classification
// ---------------------------------------------------------------------------

describe('WebsiteOwnershipClassifier', () => {
  it('rejects gmc.by as a directory/aggregator', () => {
    const c = classifyWebsiteOwnership({ url: 'https://gmc.by/16851-flaydero.html', companyName: 'Флайдеро' });
    expect(['AGGREGATOR', 'DIRECTORY']).toContain(c.decision);
    expect(c.matchedSignals).toContain('policy:gmc.by');
  });

  it('rejects known directory/marketplace domains via policy', () => {
    for (const [url, kinds] of [
      ['https://deal.by/cs/252480/contacts', ['MARKETPLACE']],
      ['https://rubrikator.by/place/foo', ['DIRECTORY']],
      ['https://minsk-city.by/companies/azhur', ['DIRECTORY']],
    ] as const) {
      const c = classifyWebsiteOwnership({ url });
      expect(kinds).toContain(c.decision);
    }
  });

  it('accepts nexttrade.by as a direct company site', () => {
    const c = classifyWebsiteOwnership({ url: 'https://nexttrade.by/', companyName: 'НекстТрейд' });
    expect(c.decision).toBe('DIRECT_COMPANY_SITE');
  });

  it("does not classify a company's own product catalog as an aggregator", () => {
    const c = classifyWebsiteOwnership({
      url: 'https://nexttrade.by/catalog/torgovoe-oborudovanie',
      companyName: 'НекстТрейд',
      text: 'Собственный каталог торгового оборудования компании. Проекты, услуги, контакты.',
    });
    expect(['DIRECT_COMPANY_SITE', 'UNCERTAIN']).toContain(c.decision);
    expect(c.decision).not.toBe('AGGREGATOR');
    expect(c.decision).not.toBe('MARKETPLACE');
  });

  it('flags structural aggregator signals from page text', () => {
    const c = classifyWebsiteOwnership({
      url: 'https://example-dir.by/',
      text: 'Каталог компаний Минска. Добавить компанию. Добавить организацию. Разместить компанию бесплатно. Справочник организаций.',
    });
    expect(['AGGREGATOR', 'DIRECTORY']).toContain(c.decision);
    expect(c.matchedSignals.length).toBeGreaterThan(0);
  });
});

describe('eligibility policy', () => {
  it('rejects directory suffixes', () => {
    for (const url of ['https://gmc.by/x', 'https://sub.gmc.by/x', 'https://spr.by/firm/1', 'https://deal.by/p/1']) {
      expect(evaluateWebsiteEligibility(url).eligible).toBe(false);
    }
  });
  it('accepts a normal company domain', () => {
    const e = evaluateWebsiteEligibility('https://nexttrade.by/');
    expect(e.eligible).toBe(true);
    expect(e.canonicalDomain).toBe('nexttrade.by');
  });
});

// ---------------------------------------------------------------------------
// Phase 15.5/15.6 — canonicalization
// ---------------------------------------------------------------------------

describe('canonicalizeWebsite', () => {
  it('collapses www/http/path/tracking variants to one domain key', () => {
    const variants = [
      'https://nexttrade.by/',
      'http://nexttrade.by/',
      'https://www.nexttrade.by/',
      'https://nexttrade.by/?utm_source=2gis&fbclid=abc',
      'https://nexttrade.by/#contacts',
      'nexttrade.by',
    ];
    const keys = new Set(variants.map((v) => canonicalizeWebsite(v).domainKey));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe('nexttrade.by');
  });

  it('keeps distinct paths under one domain key but separate url keys', () => {
    const a = canonicalizeWebsite('https://x.by/uslugi/a');
    const b = canonicalizeWebsite('https://x.by/uslugi/b');
    expect(a.domainKey).toBe(b.domainKey);
    expect(a.urlKey).not.toBe(b.urlKey);
  });

  it('strips tracking params and sorts the rest', () => {
    const c = canonicalizeWebsite('https://x.by/?b=2&utm_medium=cpc&a=1');
    expect(c.canonicalUrl).toBe('https://x.by/?a=1&b=2');
  });
});

// ---------------------------------------------------------------------------
// Phase 15.7/15.8/15.12 — grouping + merge planning
// ---------------------------------------------------------------------------

describe('groupDuplicates + planMerge', () => {
  it('groups same-domain variants and picks the reviewed survivor', () => {
    const a = lead({ website: 'https://sdke.by/kontakty.html', companyName: 'Студия дизайна интерьера Елены Кожеуровой', manualReviewStatus: 'BAD' });
    const b = lead({ website: 'https://www.sdke.by/?utm_source=x', companyName: 'Студия дизайна Елены Кожеуровой', manualReviewStatus: 'GOOD' });
    const groups = groupDuplicates([a, b]).map((g) => planMerge(g, [a, b]));
    expect(groups).toHaveLength(1);
    expect(groups[0].blocked).toBe(false);
    expect(groups[0].survivorId).toBe(b.id);
    expect(groups[0].mergeIds).toEqual([a.id]);
  });

  it('merges strong phone+name duplicates across different domains', () => {
    const a = lead({ companyName: 'ООО Строймонтаж', phone: '+375 29 123-45-67', website: 'https://a.by' });
    const b = lead({ companyName: 'Строймонтаж', phone: '8 029 123 45 67', website: 'https://b.by' });
    const groups = groupDuplicates([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('PHONE_NAME');
  });

  it('does NOT merge weak same-name-only records', () => {
    const a = lead({ companyName: 'ООО Альфа', website: 'https://alpha-one.by' });
    const b = lead({ companyName: 'Альфа', website: 'https://alpha-two.by' });
    expect(groupDuplicates([a, b])).toHaveLength(0);
  });

  it('blocks groups with conflicting generated sites', () => {
    const a = lead({ website: 'https://mapid.by', companyName: 'ОАО МАПИД', hasSite: true });
    const b = lead({ website: 'https://mapid.by/', companyName: 'МАПИД', hasSite: true });
    const g = planMerge(groupDuplicates([a, b])[0], [a, b]);
    expect(g.blocked).toBe(true);
    expect(g.blockReason).toBe('CONFLICTING_GENERATED_SITES');
  });

  it('blocks different organisations sharing one domain', () => {
    const a = lead({ website: 'https://fcminsk.by/uslugi/stadion', companyName: 'Минск, футбольный клуб' });
    const b = lead({ website: 'https://fcminsk.by/uslugi/trassa', companyName: 'Минск, лыжероллерная трасса' });
    const g = planMerge(groupDuplicates([a, b])[0], [a, b]);
    expect(g.blocked).toBe(true);
    expect(g.blockReason).toBe('DIFFERENT_ORGANISATIONS_SAME_DOMAIN');
    expect(g.survivorId).toBeNull();
    expect(g.mergeIds.sort()).toEqual([a.id, b.id].sort());
  });
});

// ---------------------------------------------------------------------------
// Phase 15.10/15.11 — merge application + evidence preservation
// ---------------------------------------------------------------------------

describe('applyMerge', () => {
  function makeTx(leads: LeadLite[]) {
    const queries: any[] = [
      { id: 'q1', leadId: leads[0].id, query: 'строители минск' },
      { id: 'q2', leadId: leads[1].id, query: 'строители минск' },   // collides
      { id: 'q3', leadId: leads[1].id, query: 'генподряд' },
    ];
    const candidates: any[] = [{ id: 'c1', leadId: leads[1].id }];
    const calls = { leadUpdate: [] as any[], lqDelete: [] as any[], lqUpdate: [] as any[], dcUpdate: [] as any[] };
    const tx = {
      lead: {
        findUnique: vi.fn(async ({ where }: any) => leads.find((l) => l.id === where.id)),
        update: vi.fn(async (args: any) => { calls.leadUpdate.push(args); return args; }),
      },
      leadQuery: {
        findMany: vi.fn(async ({ where }: any) => queries.filter((q) => q.leadId === where.leadId)),
        deleteMany: vi.fn(async (args: any) => { calls.lqDelete.push(args); }),
        updateMany: vi.fn(async (args: any) => { calls.lqUpdate.push(args); }),
      },
      discoveryCandidate: {
        updateMany: vi.fn(async (args: any) => { calls.dcUpdate.push(args); }),
      },
    };
    return { tx, calls };
  }

  it('repoints provenance, merges compatible fields, marks merged recoverably', async () => {
    const survivor = lead({ website: 'https://sdke.by', companyName: 'Студия', phone: '+375291112233', address: 'Минск', categories: ['дизайн'], manualReviewStatus: 'GOOD' });
    const dup = lead({ website: 'https://sdke.by/kontakty.html', companyName: 'Студия', categories: ['ремонт'] });
    const { tx, calls } = makeTx([survivor, dup]);
    const g = planMerge(groupDuplicates([survivor, dup])[0], [survivor, dup]);
    const res = await applyMerge(tx, g);

    expect(res.survivor).toBe(survivor.id);
    expect(res.merged).toEqual([dup.id]);
    // Colliding LeadQuery dropped, the rest repointed — evidence preserved.
    expect(calls.lqDelete[0].where.id.in).toEqual(['q2']);
    expect(calls.lqUpdate[0].data.leadId).toBe(survivor.id);
    expect(calls.dcUpdate[0].data.leadId).toBe(survivor.id);
    // Survivor keeps its own phone, gains the merged categories; dup is marked
    // MERGED with a pointer back.
    const survivorUpdate = calls.leadUpdate.find((u) => u.where.id === survivor.id);
    expect(survivorUpdate.data.phone).toBe('+375291112233');
    expect(survivorUpdate.data.categories).toEqual(['дизайн', 'ремонт']);
    const dupUpdate = calls.leadUpdate.find((u) => u.where.id === dup.id);
    expect(dupUpdate.data.mergeStatus).toBe('MERGED');
    expect(dupUpdate.data.mergedIntoLeadId).toBe(survivor.id);
    expect(dupUpdate.data.archivedAt).toBeInstanceOf(Date);
  });

  it('marks every member blocked when there is no survivor', async () => {
    const a = lead({ website: 'https://fcminsk.by/a', companyName: 'ФК' });
    const b = lead({ website: 'https://fcminsk.by/b', companyName: 'Трасса' });
    const { tx, calls } = makeTx([a, b]);
    const g = planMerge(groupDuplicates([a, b])[0], [a, b]);
    await applyMerge(tx, g, { blocked: true });
    const marked = calls.leadUpdate.filter((u) => u.data.mergeStatus === 'BLOCKED_FOR_MANUAL_MERGE').map((u) => u.where.id);
    expect(marked.sort()).toEqual([a.id, b.id].sort());
    expect(calls.dcUpdate).toHaveLength(0); // no repointing without a survivor
  });
});

// ---------------------------------------------------------------------------
// Phase 15.10 — merged leads disappear from actionable views
// ---------------------------------------------------------------------------

describe('leadMatchesFilters (client mirror)', () => {
  it('excludes merged, blocked and archived leads', () => {
    expect(leadMatchesFilters({ mergeStatus: 'MERGED' }, filters, 'ALL' as any)).toBe(false);
    expect(leadMatchesFilters({ mergeStatus: 'BLOCKED_FOR_MANUAL_MERGE' }, filters, 'ALL' as any)).toBe(false);
    expect(leadMatchesFilters({ mergeStatus: 'NONE', archivedAt: '2026-09-21' }, filters, 'ALL' as any)).toBe(false);
    expect(leadMatchesFilters({ mergeStatus: 'NONE', archivedAt: null }, filters, 'ALL' as any)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 15.1/15.13/15.14 — gate integration (mocked prisma)
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

const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('DiscoveryGatingService', () => {
  const run = { id: 'run1', query: 'строительные компании минск', intent: 'construction' };

  it('rejects gmc.by before lead creation and keeps the candidate record', async () => {
    const { prisma, leads, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {} });
    await gate.process(run, [{ source: 't', companyName: 'Флайдеро', website: 'https://gmc.by/16851-flaydero.html' }]);
    expect(leads).toHaveLength(0);
    expect(candidates[0].decision).toBe('REJECT');
    expect(String(candidates[0].reason)).toMatch(/SITE_KIND|DIRECTORY|AGGREGATOR/);
  });

  it('rejects a relevance-mismatched sports club without creating a lead', async () => {
    const { prisma, leads, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {} });
    await gate.process(run, [{ source: 't', companyName: 'Минск, клуб по хоккею на траве', website: 'https://xkminsk.by/' }]);
    expect(leads).toHaveLength(0);
    expect(candidates[0].decision).toBe('REJECT');
  });

  it('accepts a relevant direct company site once, collapsing domain variants', async () => {
    const { prisma, leads, candidates } = makeGatePrisma();
    const gate = new DiscoveryGatingService({ prisma, logger, env: {} });
    await gate.process(run, [
      { source: 't', companyName: 'Строительная компания НекстТрейд', website: 'https://nexttrade.by/' },
      { source: 't2', companyName: 'Строительная компания НекстТрейд', website: 'http://www.nexttrade.by/?utm_source=x' },
    ]);
    expect(leads).toHaveLength(1);
    expect(leads[0].websiteDomain).toBe('nexttrade.by');
    expect(candidates.map((c) => c.decision)).toEqual(['ACCEPT', 'REJECT']);
    expect(candidates[1].reason).toBe('DUPLICATE_CANONICAL_DOMAIN');
    expect(candidates[1].leadId).toBe(leads[0].id); // provenance attached
  });

  it('rejects a candidate whose domain already has an active lead', async () => {
    const { prisma, leads, candidates } = makeGatePrisma([
      { id: 'existing', websiteDomain: 'nexttrade.by', mergeStatus: 'NONE' },
    ]);
    const gate = new DiscoveryGatingService({ prisma, logger, env: {} });
    await gate.process(run, [{ source: 't', companyName: 'Строительная компания', website: 'https://nexttrade.by/about' }]);
    expect(leads).toHaveLength(1); // only the pre-existing lead
    expect(candidates[0].decision).toBe('REJECT');
    expect(candidates[0].reason).toBe('DUPLICATE_CANONICAL_DOMAIN');
    expect(candidates[0].leadId).toBe('existing');
  });

  it('ignores merged leads when checking for existing domain owners', async () => {
    const merged = { id: 'old', websiteDomain: 'sdke.by', mergeStatus: 'MERGED' };
    const { prisma, leads, candidates } = makeGatePrisma([merged]);
    const gate = new DiscoveryGatingService({ prisma, logger, env: {} });
    await gate.process(run, [{ source: 't', companyName: 'Строительная студия', website: 'https://sdke.by/' }]);
    expect(leads.filter((l) => l.id !== 'old')).toHaveLength(1);
    expect(candidates[0].decision).toBe('ACCEPT');
  });
});
