import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPrisma } from './testDb.js';
import { hasPermission } from '../apps/dashboard/src/security/authz.js';
import { seedRbac } from '../apps/dashboard/src/security/rbacSeed.js';

let prisma: Awaited<ReturnType<typeof getTestPrisma>>;

let superUser: string;
let leadManager: string;
let plainUser: string;

beforeAll(async () => {
  prisma = await getTestPrisma();
  await seedRbac(prisma);
  superUser = (await prisma.user.create({ data: { email: 'rb-super@example.com', passwordHash: 'x', globalRole: 'SUPER_ADMIN' } })).id;
  leadManager = (await prisma.user.create({ data: { email: 'rb-lead@example.com', passwordHash: 'x', globalRole: 'USER' } })).id;
  plainUser = (await prisma.user.create({ data: { email: 'rb-plain@example.com', passwordHash: 'x', globalRole: 'USER' } })).id;
  const lmRole = await prisma.role.findUnique({ where: { name: 'LEAD_MANAGER' } });
  await prisma.userRole.create({ data: { userId: leadManager, roleId: lmRole!.id } });
});

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId: { in: [superUser, leadManager, plainUser] } } });
  await prisma.user.deleteMany({ where: { id: { in: [superUser, leadManager, plainUser] } } });
  await prisma.$disconnect();
});

describe('Radar bulk action authorization', () => {
  it('SUPER_ADMIN can manage Radar', async () => {
    expect(await hasPermission(prisma, superUser, 'radar.manage')).toBe(true);
  });

  it('LEAD_MANAGER can manage Radar', async () => {
    expect(await hasPermission(prisma, leadManager, 'radar.manage')).toBe(true);
  });

  it('plain user cannot manage Radar', async () => {
    expect(await hasPermission(prisma, plainUser, 'radar.manage')).toBe(false);
  });
});
