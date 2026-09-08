import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPrisma } from './testDb.js';
import { evaluateSecurityGate } from '../apps/dashboard/src/security/gate.js';

let prisma: Awaited<ReturnType<typeof getTestPrisma>>;

async function makeFinding(sev: string, env: string, reach: string, canonicalId?: string): Promise<void> {
  await prisma.securityFinding.create({
    data: {
      product: 'wla-platform',
      severity: sev as any,
      category: 'DEPENDENCY',
      environment: env as any,
      reachability: reach as any,
      scanner: 'test',
      source: 'test',
      fingerprint: `fp-${Date.now()}-${Math.random()}`,
      canonicalId: canonicalId || `canon-${Date.now()}-${Math.random()}`,
      title: 'Test',
      description: 'test',
      evidence: {},
      status: 'OPEN',
    },
  });
}

beforeAll(async () => {
  prisma = await getTestPrisma();
});

beforeEach(async () => {
  await prisma.securityFinding.deleteMany({ where: { scanner: 'test' } });
  await prisma.securityAudit.deleteMany({ where: { scanner: 'test' } });
  await prisma.securityGate.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Security gate reachability semantics', () => {
  it('CRITICAL runtime reachable = BLOCKED', async () => {
    await makeFinding('CRITICAL', 'RUNTIME', 'REACHABLE');
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.status).toBe('BLOCKED');
    expect(gate.productionCritical).toBe(1);
  });

  it('CRITICAL runtime unknown = BLOCKED (conservative)', async () => {
    await makeFinding('CRITICAL', 'RUNTIME', 'UNKNOWN');
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.status).toBe('BLOCKED');
    expect(gate.productionCritical).toBe(1);
  });

  it('CRITICAL dev-only not-reachable = not BLOCKED', async () => {
    await makeFinding('CRITICAL', 'DEV', 'NOT_REACHABLE');
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.status).toBe('HEALTHY');
    expect(gate.openCritical).toBe(1);
    expect(gate.productionCritical).toBe(0);
  });

  it('HIGH runtime reachable = HIGH_RISK', async () => {
    await makeFinding('HIGH', 'RUNTIME', 'REACHABLE');
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.status).toBe('HIGH_RISK');
    expect(gate.productionHigh).toBe(1);
  });

  it('MEDIUM runtime reachable = ATTENTION', async () => {
    await makeFinding('MEDIUM', 'RUNTIME', 'REACHABLE');
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.status).toBe('ATTENTION');
    expect(gate.productionMedium).toBe(1);
  });

  it('scanner failure prevents HEALTHY', async () => {
    await makeFinding('LOW', 'DEV', 'NOT_REACHABLE');
    await prisma.securityAudit.create({
      data: { scanner: 'test', category: 'dependency', status: 'FAILED' },
    });
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.status).toBe('ATTENTION');
    expect(gate.blockedReason).toMatch(/scanner failure/);
  });

  it('deduplicates by canonicalId', async () => {
    const canonical = 'npm|pkg|1.0.0|GHSA-xxx';
    await makeFinding('HIGH', 'RUNTIME', 'REACHABLE', canonical);
    await makeFinding('HIGH', 'RUNTIME', 'REACHABLE', canonical);
    const gate = await evaluateSecurityGate(prisma);
    expect(gate.openHigh).toBe(1);
    expect(gate.productionHigh).toBe(1);
  });
});
