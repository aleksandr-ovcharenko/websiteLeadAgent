import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { hasPermission, hasSitePermission, hasAnyPermission } from '../apps/dashboard/src/security/authz.js';
import { seedRbac } from '../apps/dashboard/src/security/rbacSeed.js';

const prisma = new PrismaClient({ log: ['error'] });

async function createUser(email: string): Promise<string> {
  const u = await prisma.user.create({
    data: { email, passwordHash: 'x', globalRole: 'USER' },
  });
  return u.id;
}

async function assignRole(userId: string, roleName: string, siteId?: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`role not found: ${roleName}`);
  await prisma.userRole.create({
    data: { userId, roleId: role.id, siteId },
  });
}

let siteA: string;
let siteB: string;
let superAdmin: string;
let siteAdminA: string;
let siteEditorA: string;
let leadManager: string;
let showcaseManager: string;
let securityAdmin: string;
let noRole: string;

beforeAll(async () => {
  await seedRbac(prisma);

  siteA = (await prisma.site.create({
    data: { name: 'Site A', slug: 'site-a-rbac', previewToken: 'a', templateId: 'tpl', templateVersion: '1' },
  })).id;

  siteB = (await prisma.site.create({
    data: { name: 'Site B', slug: 'site-b-rbac', previewToken: 'b', templateId: 'tpl', templateVersion: '1' },
  })).id;

  superAdmin = await createUser('rbac-super@example.com');
  await assignRole(superAdmin, 'SUPER_ADMIN');

  siteAdminA = await createUser('rbac-admin-a@example.com');
  await assignRole(siteAdminA, 'SITE_ADMIN', siteA);

  siteEditorA = await createUser('rbac-editor-a@example.com');
  await assignRole(siteEditorA, 'SITE_EDITOR', siteA);

  leadManager = await createUser('rbac-lead@example.com');
  await assignRole(leadManager, 'LEAD_MANAGER');

  showcaseManager = await createUser('rbac-showcase@example.com');
  await assignRole(showcaseManager, 'SHOWCASE_MANAGER');

  securityAdmin = await createUser('rbac-security@example.com');
  await assignRole(securityAdmin, 'SECURITY_ADMIN');

  noRole = await createUser('rbac-norole@example.com');
});

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId: { in: [superAdmin, siteAdminA, siteEditorA, leadManager, showcaseManager, securityAdmin, noRole] } } });
  await prisma.user.deleteMany({ where: { id: { in: [superAdmin, siteAdminA, siteEditorA, leadManager, showcaseManager, securityAdmin, noRole] } } });
  await prisma.site.deleteMany({ where: { id: { in: [siteA, siteB] } } });
  await prisma.$disconnect();
});

describe('RBAC scoped permissions', () => {
  it('SITE_ADMIN Site A -> Site A CMS = ALLOW', async () => {
    expect(await hasSitePermission(prisma, siteAdminA, 'cms.edit', siteA)).toBe(true);
    expect(await hasSitePermission(prisma, siteAdminA, 'cms.read', siteA)).toBe(true);
    expect(await hasSitePermission(prisma, siteAdminA, 'cms.users.manage', siteA)).toBe(true);
  });

  it('SITE_ADMIN Site A -> Site B CMS = DENY', async () => {
    expect(await hasSitePermission(prisma, siteAdminA, 'cms.edit', siteB)).toBe(false);
    expect(await hasSitePermission(prisma, siteAdminA, 'cms.read', siteB)).toBe(false);
  });

  it('SITE_EDITOR -> edit content = ALLOW, manage users = DENY', async () => {
    expect(await hasSitePermission(prisma, siteEditorA, 'cms.edit', siteA)).toBe(true);
    expect(await hasSitePermission(prisma, siteEditorA, 'cms.users.manage', siteA)).toBe(false);
  });

  it('LEAD_MANAGER -> Radar = ALLOW, Security Center = DENY', async () => {
    expect(await hasPermission(prisma, leadManager, 'radar.read')).toBe(true);
    expect(await hasPermission(prisma, leadManager, 'radar.manage')).toBe(true);
    expect(await hasPermission(prisma, leadManager, 'security.read')).toBe(false);
    expect(await hasPermission(prisma, leadManager, 'cms.edit')).toBe(false);
  });

  it('SHOWCASE_MANAGER -> Showcase/Studio = ALLOW, Radar config = DENY', async () => {
    expect(await hasPermission(prisma, showcaseManager, 'showcase.configure')).toBe(true);
    expect(await hasPermission(prisma, showcaseManager, 'studio.edit')).toBe(true);
    expect(await hasPermission(prisma, showcaseManager, 'radar.manage')).toBe(false);
    expect(await hasPermission(prisma, showcaseManager, 'security.read')).toBe(false);
  });

  it('SECURITY_ADMIN -> Security APIs = ALLOW, CMS mutation = DENY unless separately granted', async () => {
    expect(await hasPermission(prisma, securityAdmin, 'security.read')).toBe(true);
    expect(await hasPermission(prisma, securityAdmin, 'security.manage')).toBe(true);
    expect(await hasSitePermission(prisma, securityAdmin, 'cms.edit', siteA)).toBe(false);
  });

  it('SUPER_ADMIN -> all = ALLOW', async () => {
    expect(await hasPermission(prisma, superAdmin, 'security.read')).toBe(true);
    expect(await hasPermission(prisma, superAdmin, 'radar.manage')).toBe(true);
    expect(await hasSitePermission(prisma, superAdmin, 'cms.edit', siteA)).toBe(true);
    expect(await hasSitePermission(prisma, superAdmin, 'cms.edit', siteB)).toBe(true);
    expect(await hasAnyPermission(prisma, superAdmin, ['roles.manage', 'settings.manage'])).toBe(true);
  });

  it('user with no roles has no permissions', async () => {
    expect(await hasPermission(prisma, noRole, 'radar.read')).toBe(false);
    expect(await hasSitePermission(prisma, noRole, 'cms.read', siteA)).toBe(false);
    expect(await hasAnyPermission(prisma, noRole, ['security.read', 'cms.edit'])).toBe(false);
  });
});
