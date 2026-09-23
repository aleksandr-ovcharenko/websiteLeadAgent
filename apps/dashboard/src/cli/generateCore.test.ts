import { describe, it, expect, vi } from 'vitest';
import {
  ensureQualified,
  findCanonicalLeadByDomain,
  LeadReviewRequiredError,
  parseArgs,
  resolveLead,
  resolveResume,
} from './generateCore.js';

function makePrisma(overrides: Partial<{ leads: any[]; runs: any[] }> = {}) {
  const leads = overrides.leads ?? [];
  const runs = overrides.runs ?? [];
  const findFirst = vi.fn(async ({ where }: any) => {
    let rows = leads.filter((l) => l.websiteDomain === where.websiteDomain);
    if (where.mergeStatus === 'NONE') rows = rows.filter((l) => l.mergeStatus === 'NONE');
    if (where.archivedAt === null) rows = rows.filter((l) => !l.archivedAt);
    if (where.mergedIntoLeadId?.not === null) rows = rows.filter((l) => l.mergedIntoLeadId);
    return rows[0] ?? null;
  });
  const upsert = vi.fn(async ({ where, create, update }: any) => {
    const key = `${where.source_sourceId.source}:${where.source_sourceId.sourceId}`;
    const existing = leads.find((l) => `${l.source}:${l.sourceId}` === key);
    if (existing) return { ...existing, ...update };
    const created = { id: `lead-${leads.length + 1}`, mergeStatus: 'NONE', archivedAt: null, manualReviewStatus: 'UNREVIEWED', ...create };
    leads.push(created);
    return created;
  });
  return {
    lead: {
      findUnique: vi.fn(async ({ where }: any) => leads.find((l) => l.id === where.id) ?? null),
      findFirst,
      upsert,
    },
    redesignRun: {
      findUnique: vi.fn(async ({ where }: any) => runs.find((r) => r.id === where.id) ?? null),
    },
  };
}

const DIRECT_URL = 'https://acme-build.example';

describe('generateCore — qualification contract', () => {
  it('a new --url lead is created UNREVIEWED, never GOOD', async () => {
    const prisma = makePrisma();
    const lead = await resolveLead({ url: DIRECT_URL }, { prisma });
    expect(prisma.lead.upsert).toHaveBeenCalledOnce();
    const create = prisma.lead.upsert.mock.calls[0][0].create;
    expect(create.manualReviewStatus).toBeUndefined();
    expect(lead.manualReviewStatus).toBe('UNREVIEWED');
    expect(lead.websiteDomain).toBe('acme-build.example');
  });

  it('an UNREVIEWED lead cannot generate — LEAD_REVIEW_REQUIRED carries the leadId', async () => {
    const qualification = { advance: vi.fn(async () => ({ ok: true, readyForReview: true })) };
    const lead = { id: 'lead-1', manualReviewStatus: 'UNREVIEWED' };
    await expect(ensureQualified(lead, { qualification })).rejects.toThrow(LeadReviewRequiredError);
    await expect(ensureQualified(lead, { qualification })).rejects.toMatchObject({ leadId: 'lead-1', qualification: 'ready_for_review' });
    expect(qualification.advance).toHaveBeenCalledWith('lead-1');
  });

  it('qualification is driven until the op chain goes idle', async () => {
    const calls: string[] = [];
    const qualification = {
      advance: vi.fn(async () => {
        calls.push('advance');
        return calls.length < 3 ? { ok: true, started: { operationId: 'AUDIT_WEBSITE' } } : { ok: true, readyForReview: true };
      }),
    };
    let activeCalls = 0;
    const prisma = {
      operationRun: {
        findFirst: vi.fn(async () => (++activeCalls <= 1 ? { id: 'op1', operationId: 'AUDIT_WEBSITE', status: 'RUNNING' } : null)),
      },
    };
    const lead = { id: 'lead-9', manualReviewStatus: 'UNREVIEWED' };
    await expect(ensureQualified(lead, { qualification, prisma, pollMs: 0, maxPolls: 20 })).rejects.toMatchObject({
      leadId: 'lead-9',
      qualification: 'ready_for_review',
    });
    expect(qualification.advance.mock.calls.length).toBe(3);
  });

  it('a blocked qualification reports the blocking stage', async () => {
    const qualification = { advance: vi.fn(async () => ({ ok: false, reason: 'audit_failed' })) };
    await expect(ensureQualified({ id: 'lead-2', manualReviewStatus: 'UNREVIEWED' }, { qualification })).rejects.toMatchObject({
      leadId: 'lead-2',
      qualification: 'blocked:audit_failed',
    });
  });

  it('a GOOD lead passes the gate without touching qualification', async () => {
    const qualification = { advance: vi.fn() };
    await expect(ensureQualified({ id: 'lead-1', manualReviewStatus: 'GOOD' }, { qualification })).resolves.toBeUndefined();
    expect(qualification.advance).not.toHaveBeenCalled();
  });

  it('merged/archived leads are never selected as canonical for a domain', async () => {
    const archived = { id: 'l-arch', websiteDomain: 'acme-build.example', mergeStatus: 'NONE', archivedAt: new Date() };
    const merged = { id: 'l-merged', websiteDomain: 'acme-build.example', mergeStatus: 'MERGED', mergedIntoLeadId: 'l-surv' };
    const survivor = { id: 'l-surv', websiteDomain: 'acme-build.example', mergeStatus: 'NONE', archivedAt: null };
    const prisma = makePrisma({ leads: [archived, merged, survivor] });
    const lead = await resolveLead({ url: DIRECT_URL }, { prisma });
    expect(lead.id).toBe('l-surv');
  });

  it('a domain with no actionable or surviving lead falls through to create', async () => {
    const archived = { id: 'l-arch', websiteDomain: 'acme-build.example', mergeStatus: 'NONE', archivedAt: new Date() };
    const prisma = makePrisma({ leads: [archived] });
    const lead = await resolveLead({ url: DIRECT_URL }, { prisma });
    expect(lead.id).not.toBe('l-arch');
    expect(lead.manualReviewStatus).toBe('UNREVIEWED');
  });

  it('repeated --url resolves the same lead — no duplicate', async () => {
    const prisma = makePrisma();
    const first = await resolveLead({ url: DIRECT_URL }, { prisma });
    const second = await resolveLead({ url: `${DIRECT_URL}/` }, { prisma });
    expect(second.id).toBe(first.id);
    expect(prisma.lead.upsert).toHaveBeenCalledOnce(); // second call hits findCanonicalLeadByDomain
  });

  it('concurrent --url calls converge on one deterministic key — never two leads', async () => {
    const prisma = makePrisma();
    // Simulate the race: both miss findCanonicalLeadByDomain, both upsert.
    prisma.lead.findFirst.mockResolvedValue(null);
    const [a, b] = await Promise.all([
      resolveLead({ url: DIRECT_URL }, { prisma }),
      resolveLead({ url: `https://www.${'acme-build.example'}` }, { prisma }),
    ]);
    const keys = prisma.lead.upsert.mock.calls.map((c) => c[0].where.source_sourceId.sourceId);
    expect(new Set(keys).size).toBe(1);
    expect(a.id).toBe(b.id);
  });

  it('a merged --lead-id resolves to its survivor', async () => {
    const merged = { id: 'l-m', mergeStatus: 'MERGED', mergedIntoLeadId: 'l-s' };
    const survivor = { id: 'l-s', mergeStatus: 'NONE', archivedAt: null };
    const prisma = makePrisma({ leads: [merged, survivor] });
    const lead = await resolveLead({ 'lead-id': 'l-m' }, { prisma });
    expect(lead.id).toBe('l-s');
  });
});

describe('generateCore — resume contract', () => {
  const stages = [
    { stage: 'CRAWLED', status: 'PASS' },
    { stage: 'EXTRACTED', status: 'PASS' },
    { stage: 'CONTENT_VALIDATED', status: 'FAIL' },
  ];
  const run = { id: 'run-1', leadId: 'lead-1', stage: 'QA_FAILED', stageResults: stages };

  it('--run-id reuses the same run row as crawl artifact source', async () => {
    const prisma = makePrisma({ runs: [run] });
    const r = await resolveResume({ 'run-id': 'run-1' }, { prisma });
    expect(r.crawlRunId).toBe('run-1');
    expect(r.leadId).toBe('lead-1');
    expect(r.force).toBe(true);
  });

  it('resume starts at the first unpassed stage', async () => {
    const prisma = makePrisma({ runs: [run] });
    const r = await resolveResume({ 'run-id': 'run-1' }, { prisma });
    expect(r.resumeFromStage).toBe('CONTENT_VALIDATED');
  });

  it('PASS_WITH_WARNINGS counts as passed when locating the resume point', async () => {
    const prisma = makePrisma({
      runs: [{ ...run, stageResults: [{ stage: 'CRAWLED', status: 'PASS' }, { stage: 'EXTRACTED', status: 'PASS_WITH_WARNINGS' }] }],
    });
    const r = await resolveResume({ 'run-id': 'run-1' }, { prisma });
    expect(r.resumeFromStage).toBe('CONTENT_VALIDATED');
  });

  it('all-passed history resumes at the final stage', async () => {
    const full = ['CRAWLED', 'EXTRACTED', 'CONTENT_VALIDATED', 'GRAPH_BUILT', 'CMS_IMPORT_READY', 'CMS_IMPORTED', 'RENDERED', 'RENDER_VALIDATED', 'VISUAL_VALIDATED', 'PREVIEW_PUBLISHED']
      .map((stage) => ({ stage, status: 'PASS' }));
    const prisma = makePrisma({ runs: [{ ...run, stageResults: full }] });
    const r = await resolveResume({ 'run-id': 'run-1' }, { prisma });
    expect(r.resumeFromStage).toBe('HUMAN_REVIEW_READY');
  });

  it('no --run-id means no resume fields', async () => {
    const prisma = makePrisma();
    await expect(resolveResume({}, { prisma })).resolves.toEqual({});
  });

  it('unknown run id throws', async () => {
    const prisma = makePrisma();
    await expect(resolveResume({ 'run-id': 'nope' }, { prisma })).rejects.toThrow('not found');
  });
});

describe('parseArgs', () => {
  it('parses --key=value and bare --flag', () => {
    const a = parseArgs(['node', 'x', '--url=https://a.b', '--force']);
    expect(a.url).toBe('https://a.b');
    expect(a.force).toBe('true');
  });
});
