import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPrisma } from './testDb.js';
import { seedRbac, migrateExistingUsers } from '../apps/dashboard/src/security/rbacSeed.js';

let prisma: Awaited<ReturnType<typeof getTestPrisma>>;

let superUser: string;
let siteUser: string;
let siteA: string;
let membership: any;

beforeAll(async () => {
  prisma = await getTestPrisma();
  await seedRbac(prisma);
  superUser = (await prisma.user.create({
    data: { email: 'mig-super@example.com', passwordHash: 'x', globalRole: 'SUPER_ADMIN' },
  })).id;
  siteUser = (await prisma.user.create({
    data: { email: 'mig-editor@example.com', passwordHash: 'x', globalRole: 'USER' },
  })).id;
  siteA = (await prisma.site.create({
    data: { name: 'Mig A', slug: 'mig-a', previewToken: 'a', templateId: 'tpl', templateVersion: '1' },
  })).id;
  membership = await prisma.siteUser.create({
    data: { siteId: siteA, userId: siteUser, role: 'EDITOR' },
  });
  await migrateExistingUsers(prisma);
});

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId: { in: [superUser, siteUser] } } });
  await prisma.siteUser.deleteMany({ where: { id: membership?.id } });
  await prisma.user.deleteMany({ where: { id: { in: [superUser, siteUser] } } });
  await prisma.site.deleteMany({ where: { id: siteA } });
  await prisma.$disconnect();
});

describe('RBAC migration', () => {
  it('preserves existing SUPER_ADMIN access', async () => {
    const roles = await prisma.userRole.findMany({ where: { userId: superUser }, include: { role: true } });
    const roleNames = roles.map((r) => r.role.name);
    expect(roleNames).toContain('SUPER_ADMIN');
  });

  it('maps legacy SiteUser.EDITOR to SITE_EDITOR for that site', async () => {
    const roles = await prisma.userRole.findMany({ where: { userId: siteUser, siteId: siteA }, include: { role: true } });
    expect(roles.length).toBe(1);
    expect(roles[0].role.name).toBe('SITE_EDITOR');
  });

  it('does not accidentally grant cross-site permissions', async () => {
    const otherSite = await prisma.site.create({
      data: { name: 'Mig Other', slug: 'mig-other', previewToken: 'b', templateId: 'tpl', templateVersion: '1' },
    });
    const crossSite = await prisma.userRole.findMany({ where: { userId: siteUser, siteId: otherSite.id } });
    expect(crossSite.length).toBe(0);
    await prisma.site.delete({ where: { id: otherSite.id } });
  });
});
