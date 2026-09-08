import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPrisma } from './testDb.js';
import { ensureDependencySnapshot, linkSiteBuildSnapshot } from '../packages/redesign-engine/src/security/snapshot.js';

let prisma: Awaited<ReturnType<typeof getTestPrisma>>;
const templateId = 'test-template';

let siteA: string;
let siteB: string;
let buildA: string;
let buildB: string;
let snapshotId: string;

beforeAll(async () => {
  prisma = await getTestPrisma();
  siteA = (await prisma.site.create({
    data: { name: 'Snap A', slug: 'snap-a', previewToken: 'a', templateId, templateVersion: '1' },
  })).id;
  siteB = (await prisma.site.create({
    data: { name: 'Snap B', slug: 'snap-b', previewToken: 'b', templateId, templateVersion: '1' },
  })).id;
  buildA = (await prisma.siteBuild.create({
    data: { siteId: siteA, templateId, status: 'SUCCESS', outputPath: '/tmp/a' },
  })).id;
  buildB = (await prisma.siteBuild.create({
    data: { siteId: siteB, templateId, status: 'SUCCESS', outputPath: '/tmp/b' },
  })).id;
  snapshotId = await ensureDependencySnapshot(prisma, templateId, process.cwd());
  await linkSiteBuildSnapshot(prisma, buildA, snapshotId);
  await linkSiteBuildSnapshot(prisma, buildB, snapshotId);
});

afterAll(async () => {
  await prisma.dependencyInSnapshot.deleteMany({ where: { snapshotId } });
  await prisma.siteBuild.deleteMany({ where: { id: { in: [buildA, buildB] } } });
  await prisma.site.deleteMany({ where: { id: { in: [siteA, siteB] } } });
  if (snapshotId) await prisma.securityDependencySnapshot.delete({ where: { id: snapshotId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Dependency snapshots for Showcase provenance', () => {
  it('creates a snapshot and links SiteBuilds', async () => {
    const snapshot = await prisma.securityDependencySnapshot.findUnique({
      where: { id: snapshotId },
      include: { siteBuilds: true, dependencies: { take: 1 } },
    });
    expect(snapshot).toBeTruthy();
    expect(snapshot?.siteBuilds.length).toBe(2);
    expect(snapshot?.dependencies.length).toBeGreaterThan(0);
  });

  it('reuses an identical snapshot', async () => {
    const id = await ensureDependencySnapshot(prisma, templateId, process.cwd());
    expect(id).toBe(snapshotId);
  });

  it('maps a dependency through the snapshot to all linked Showcases', async () => {
    const affectedBuilds = await prisma.securityDependencySnapshot.findMany({
      where: { id: snapshotId },
      include: { siteBuilds: true },
    });
    const buildIds = affectedBuilds.flatMap((s) => s.siteBuilds.map((b) => b.id));
    expect(buildIds).toContain(buildA);
    expect(buildIds).toContain(buildB);
  });
});
