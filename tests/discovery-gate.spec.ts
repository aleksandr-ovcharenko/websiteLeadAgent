import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPrisma } from './testDb.js';
import { DiscoveryGatingService } from '../apps/dashboard/src/discovery/gate.js';
import pino from 'pino';

let prisma: Awaited<ReturnType<typeof getTestPrisma>>;
let service: DiscoveryGatingService;

beforeAll(async () => {
  prisma = await getTestPrisma();
  service = new DiscoveryGatingService({ prisma, logger: pino({ level: 'silent' }), env: {} });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function run(query: string, intent: string, candidates: any[]) {
  const runRecord = await prisma.discoveryRun.create({
    data: {
      provider: 'manual',
      query,
      intent,
      status: 'DISCOVERING',
      leadIds: [],
      collected: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      uncertainCount: 0,
    },
  });
  const result = await service.process(runRecord, candidates);
  const [accepted, rejected, uncertain, duplicates] = await Promise.all([
    prisma.discoveryCandidate.count({ where: { runId: runRecord.id, decision: 'ACCEPT' } }),
    prisma.discoveryCandidate.count({ where: { runId: runRecord.id, decision: 'REJECT' } }),
    prisma.discoveryCandidate.count({ where: { runId: runRecord.id, decision: 'UNCERTAIN' } }),
    prisma.discoveryCandidate.count({ where: { runId: runRecord.id, decision: 'REJECT', reason: { startsWith: 'DUPLICATE' } } }),
  ]);
  return { result, accepted, rejected, uncertain, duplicates, runId: runRecord.id };
}

describe('DiscoveryGatingService', () => {
  it('rejects xkminsk for construction intent', async () => {
    const r = await run('генподрядчик', 'General contractor', [
      { source: 'manual', sourceId: 'hockey-1', companyName: 'Минск, клуб по хоккею на траве', city: 'Минск', website: 'https://xkminsk.by/', address: 'Броневой переулок, 10' },
    ]);
    expect(r.accepted).toBe(0);
    expect(r.rejected).toBe(1);
    const candidate = await prisma.discoveryCandidate.findFirstOrThrow({ where: { runId: r.runId } });
    expect(candidate.reason).toBe('IRRELEVANT_BUSINESS_CATEGORY');
    expect(candidate.decision).toBe('REJECT');
  });

  it('accepts xkminsk for sports-club intent', async () => {
    const r = await run('спортивные клубы', 'Sports club', [
      { source: 'manual', sourceId: 'hockey-2', companyName: 'Минск, клуб по хоккею на траве', city: 'Минск', website: 'https://xkminsk.by/', address: 'Броневой переулок, 10' },
    ]);
    expect(r.accepted).toBe(1);
    expect(r.rejected).toBe(0);
    const candidate = await prisma.discoveryCandidate.findFirstOrThrow({ where: { runId: r.runId } });
    expect(candidate.decision).toBe('ACCEPT');
    expect(candidate.leadId).toBeTruthy();
  });

  it('merges exact canonical domain duplicates', async () => {
    const r = await run('генподрядчик', 'General contractor', [
      { source: 'manual', sourceId: 'obs-1', companyName: 'MinskDSK, строительная компания', city: 'Минск', website: 'https://minskdsk.by/', address: 'Минск' },
      { source: 'manual', sourceId: 'obs-2', companyName: 'MinskDSK, строительная компания', city: 'Минск', website: 'https://www.minskdsk.by/contact', address: 'Минск' },
      { source: 'manual', sourceId: 'obs-3', companyName: 'MinskDSK, строительная компания', city: 'Минск', website: 'http://minskdsk.by?utm_source=test', address: 'Минск' },
    ]);
    expect(r.result.created).toBe(1);
    expect(r.result.duplicates).toBe(2);
    const leads = await prisma.lead.count({ where: { websiteDomain: 'minskdsk.by' } });
    expect(leads).toBe(1);
  });

  it('merges strong cross-domain organisation duplicates', async () => {
    await prisma.lead.create({
      data: {
        source: 'manual',
        sourceId: 'existing-by',
        companyName: 'Minsk строительная компания',
        city: 'Минск',
        website: 'https://example.by/',
        websiteDomain: 'example.by',
        phone: '+375291111111',
      },
    });
    const r = await run('генподрядчик', 'General contractor', [
      { source: 'manual', sourceId: 'new-com', companyName: 'Minsk строительная компания', city: 'Минск', website: 'https://example.com/', phone: '+375291111111' },
    ]);
    expect(r.result.created).toBe(0);
    expect(r.result.duplicates).toBe(1);
    expect(r.result.leadIds.length).toBe(0);
  });

  it('does not merge weak same-name-only candidates', async () => {
    await prisma.lead.create({
      data: {
        source: 'manual',
        sourceId: 'existing-weak',
        companyName: 'Atlas',
        city: 'Минск',
        website: 'https://atlas.by/',
        websiteDomain: 'atlas.by',
        phone: '+375291111111',
      },
    });
    const r = await run('генподрядчик', 'General contractor', [
      { source: 'manual', sourceId: 'weak-com', companyName: 'Atlas строительная', city: 'Минск', website: 'https://atlas.com/', phone: '+375292222222' },
    ]);
    expect(r.result.created).toBe(1);
    expect(r.result.duplicates).toBe(0);
  });
});
