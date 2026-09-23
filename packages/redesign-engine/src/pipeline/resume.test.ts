import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRunForResume, mergeStageResult, resolveActiveVariant, resolveCanonicalSite } from './resume.js';

function makePrisma(overrides: { runs?: any[]; sites?: any[]; variants?: any[] } = {}) {
  const runs = overrides.runs ?? [];
  const sites = overrides.sites ?? [];
  const variants = overrides.variants ?? [];
  return {
    redesignRun: {
      findUnique: vi.fn(async ({ where }: any) => runs.find((r) => r.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => Object.assign(runs.find((r) => r.id === where.id) ?? {}, data)),
    },
    site: {
      findFirst: vi.fn(async ({ where }: any) =>
        sites.find(
          (s) =>
            s.mergedIntoSiteId == null &&
            s.status !== 'ARCHIVED' &&
            (s.canonicalDomain === where.OR[0].canonicalDomain || s.domain === where.OR[1].domain),
        ) ?? null,
      ),
    },
    demoVariant: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const rows = variants.filter((v) => v.siteId === where.siteId && v.status === 'ACTIVE');
        rows.sort((a, b) => Number(b.isPreferred ?? false) - Number(a.isPreferred ?? false));
        return rows[0] ?? null;
      }),
    },
  };
}

describe('resume contract — loadRunForResume', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wla-resume-'));
  const crawlJsonPath = join(dir, 'crawl.json');
  writeFileSync(crawlJsonPath, JSON.stringify({ pages: [{ url: 'https://a.b/' }], homepage: { url: 'https://a.b/' }, navigation: [] }));
  const baseRun = () => ({ id: 'run-1', leadId: 'lead-1', stage: 'QA_FAILED', crawlJsonPath });

  it('returns the same run row and the unchanged crawlJsonPath — no recrawl', async () => {
    const prisma = makePrisma({ runs: [baseRun()] });
    const rr = await loadRunForResume(prisma, 'run-1', 'lead-1', true);
    expect(rr.run.id).toBe('run-1');
    expect(rr.crawlJsonPath).toBe(crawlJsonPath);
    expect(rr.crawlResult.pages).toHaveLength(1);
    // no crawl invocation exists in this path at all — the artifact file is read
  });

  it('rejects a run owned by a different lead', async () => {
    const prisma = makePrisma({ runs: [baseRun()] });
    await expect(loadRunForResume(prisma, 'run-1', 'lead-2', true)).rejects.toThrow('does not belong');
  });

  it('rejects a run without a crawl artifact', async () => {
    const prisma = makePrisma({ runs: [{ ...baseRun(), crawlJsonPath: null }] });
    await expect(loadRunForResume(prisma, 'run-1', 'lead-1', true)).rejects.toThrow('no crawl artifact');
  });

  it('without force, a non-resumable stage is rejected', async () => {
    const prisma = makePrisma({ runs: [baseRun()] });
    await expect(loadRunForResume(prisma, 'run-1', 'lead-1', false)).rejects.toThrow('Use force');
  });

  it('force resets the same row to CRAWL_READY — no new run is created', async () => {
    const prisma = makePrisma({ runs: [baseRun()] });
    await loadRunForResume(prisma, 'run-1', 'lead-1', true);
    expect(prisma.redesignRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { errorMessage: null, stage: 'CRAWL_READY' },
    });
  });
});

describe('resume contract — stage history merge', () => {
  const pass = (stage: string) => ({ stage, status: 'PASS', errors: [], warnings: [], metrics: {}, artifactPaths: [], durationMs: 1 }) as any;

  it('a re-run stage replaces its prior entry instead of duplicating', () => {
    const history = [pass('CRAWLED'), pass('EXTRACTED'), pass('CONTENT_VALIDATED')];
    const rerun = { ...pass('EXTRACTED'), status: 'PASS', durationMs: 999 };
    mergeStageResult(history, rerun);
    expect(history).toHaveLength(3);
    expect(history.filter((r) => r.stage === 'EXTRACTED')).toHaveLength(1);
    expect(history[1].durationMs).toBe(999);
  });

  it('previously passed history is retained alongside the new entry', () => {
    const history = [pass('CRAWLED'), pass('EXTRACTED')];
    mergeStageResult(history, pass('CONTENT_VALIDATED'));
    expect(history.map((r) => r.stage)).toEqual(['CRAWLED', 'EXTRACTED', 'CONTENT_VALIDATED']);
  });
});

describe('resume contract — canonical site resolution', () => {
  const lead = (site: any) => ({ id: 'l1', site, website: 'https://acme.example', websiteDomain: 'acme.example' });

  it('an ARCHIVED site is never the resume target — canonical active site wins', async () => {
    const archived = { id: 's-old', status: 'ARCHIVED' };
    const canonical = { id: 's-new', status: 'ACTIVE', canonicalDomain: 'acme.example', mergedIntoSiteId: null };
    const prisma = makePrisma({ sites: [archived, canonical] });
    const site = await resolveCanonicalSite(prisma, lead(archived));
    expect(site.id).toBe('s-new');
  });

  it('a merged site resolves to the canonical survivor by domain', async () => {
    const merged = { id: 's-m', status: 'ACTIVE', mergedIntoSiteId: 's-new' };
    const canonical = { id: 's-new', status: 'ACTIVE', canonicalDomain: 'acme.example', mergedIntoSiteId: null };
    const prisma = makePrisma({ sites: [merged, canonical] });
    const site = await resolveCanonicalSite(prisma, lead(merged));
    expect(site.id).toBe('s-new');
  });

  it('the linked site is used directly when it is live and unmerged', async () => {
    const live = { id: 's-live', status: 'ACTIVE', mergedIntoSiteId: null };
    const prisma = makePrisma({ sites: [live] });
    const site = await resolveCanonicalSite(prisma, lead(live));
    expect(site.id).toBe('s-live');
    expect(prisma.site.findFirst).not.toHaveBeenCalled();
  });
});

describe('resume contract — preferred variant resolution', () => {
  it('resolves the preferred ACTIVE variant from the DB', async () => {
    const variants = [
      { id: 'v-old', siteId: 's1', status: 'ACTIVE', isPreferred: false },
      { id: 'v-pref', siteId: 's1', status: 'ACTIVE', isPreferred: true },
      { id: 'v-arch', siteId: 's1', status: 'ARCHIVED', isPreferred: true },
    ];
    const prisma = makePrisma({ variants });
    const v = await resolveActiveVariant(prisma, 's1');
    expect(v.id).toBe('v-pref');
  });
});
