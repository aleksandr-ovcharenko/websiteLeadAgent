import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pino from 'pino';
import { getTestPrisma } from './testDb.js';
import { SecurityAuditService } from '../apps/dashboard/src/security/audit.js';
import type { SecurityScanner, SecurityFindingInput } from '../apps/dashboard/src/security/scanner.js';

let prisma: Awaited<ReturnType<typeof getTestPrisma>>;
const logger = pino({ level: 'silent' });
const repoRoot = process.cwd();

class FakeScanner implements SecurityScanner {
  constructor(
    readonly id: string,
    readonly category: string,
    public findings: SecurityFindingInput[] = [],
    public fail = false
  ) {}
  async run(): Promise<any> {
    if (this.fail) throw new Error('scanner failure');
    return { status: 'SUCCESS' as const, findings: this.findings };
  }
}

class TestableAuditService extends SecurityAuditService {
  scanner?: FakeScanner;
  constructor(opts: any) {
    super(opts);
  }
  get scanners(): SecurityScanner[] {
    return this.scanner ? [this.scanner] : super.scanners;
  }
  setScanner(s: FakeScanner) {
    this.scanner = s;
  }
}

async function makeFinding(input: Partial<any> = {}): Promise<string> {
  const f = await prisma.securityFinding.create({
    data: {
      product: 'wla-platform',
      severity: 'HIGH',
      category: input.category || 'INJECTION',
      environment: 'RUNTIME',
      reachability: 'REACHABLE',
      scanner: input.scanner || 'test-sast',
      source: 'test',
      fingerprint: `test-fp-${Date.now()}-${Math.random()}`,
      title: 'Test finding',
      description: 'test',
      evidence: {},
      status: input.status || 'OPEN',
      lastDetectedAt: input.lastDetectedAt || new Date(Date.now() - 1000 * 60 * 60),
      ...(input.dependencyId ? { dependencyId: input.dependencyId } : {}),
    },
  });
  return f.id;
}

const service = new TestableAuditService({ prisma, logger, repoRoot });

beforeAll(async () => {
  prisma = await getTestPrisma();
  // Re-instantiate service with correct prisma
  (service as any).prisma = prisma;
  await prisma.securityScannerConfig.upsert({
    where: { scanner: 'test-sast' },
    create: { scanner: 'test-sast', category: 'sast', enabled: true, schedule: 'manual' },
    update: { enabled: true },
  });
  await prisma.securityScannerConfig.upsert({
    where: { scanner: 'test-dep' },
    create: { scanner: 'test-dep', category: 'dependency', enabled: true, schedule: 'manual' },
    update: { enabled: true },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Security reconciliation', () => {
  it('same scanner disappears -> finding resolved', async () => {
    const fid = await makeFinding({ scanner: 'test-sast', status: 'OPEN' });
    service.setScanner(new FakeScanner('test-sast', 'sast', []));
    await service.runAll();
    const f = await prisma.securityFinding.findUnique({ where: { id: fid } });
    expect(f?.status).toBe('RESOLVED');
  });

  it('different scanner does not resolve finding from another scanner', async () => {
    const fid = await makeFinding({ scanner: 'other-scanner', status: 'OPEN' });
    service.setScanner(new FakeScanner('test-sast', 'sast', []));
    await service.runAll();
    const f = await prisma.securityFinding.findUnique({ where: { id: fid } });
    expect(f?.status).toBe('OPEN');
  });

  it('scanner failure keeps finding open and audit status is FAILED', async () => {
    const fid = await makeFinding({ scanner: 'test-sast', status: 'OPEN' });
    service.setScanner(new FakeScanner('test-sast', 'sast', [], true));
    await expect(service.runAll()).rejects.toThrow('scanner failure');
    const f = await prisma.securityFinding.findUnique({ where: { id: fid } });
    expect(f?.status).toBe('OPEN');
    const audit = await prisma.securityAudit.findFirst({ where: { scanner: 'test-sast' }, orderBy: { startedAt: 'desc' } });
    expect(audit?.status).toBe('FAILED');
  });

  it('disabled scanner does not run and does not resolve findings', async () => {
    const fid = await makeFinding({ scanner: 'disabled-scanner', status: 'OPEN' });
    await prisma.securityScannerConfig.upsert({
      where: { scanner: 'disabled-scanner' },
      create: { scanner: 'disabled-scanner', category: 'sast', enabled: false, schedule: 'manual' },
      update: { enabled: false },
    });
    service.setScanner(new FakeScanner('test-sast', 'sast', []));
    await service.runAll();
    const f = await prisma.securityFinding.findUnique({ where: { id: fid } });
    expect(f?.status).toBe('OPEN');
    await prisma.securityScannerConfig.deleteMany({ where: { scanner: 'disabled-scanner' } });
  });

  it('equivalent dependency evidence resolves cross-scanner finding when package is gone', async () => {
    const dep = await prisma.securityDependency.create({
      data: { ecosystem: 'npm', name: 'old-pkg', version: '1.0.0' },
    });
    const fid = await makeFinding({ scanner: 'osv-scanner', category: 'DEPENDENCY', dependencyId: dep.id, status: 'OPEN' });
    const findings: SecurityFindingInput[] = [
      {
        product: 'wla-platform',
        severity: 'HIGH',
        category: 'DEPENDENCY',
        scanner: 'test-dep',
        source: 'test',
        fingerprint: 'test-dep-other-pkg-1.0.0',
        title: 'Other pkg',
        description: 'other',
        evidence: {},
        dependencyEcosystem: 'npm',
        dependencyName: 'other-pkg',
        dependencyVersion: '1.0.0',
      },
    ];
    service.setScanner(new FakeScanner('test-dep', 'dependency', findings));
    await service.runAll();
    const f = await prisma.securityFinding.findUnique({ where: { id: fid } });
    expect(f?.status).toBe('RESOLVED');
    await prisma.securityDependency.delete({ where: { id: dep.id } }).catch(() => {});
  });
});
