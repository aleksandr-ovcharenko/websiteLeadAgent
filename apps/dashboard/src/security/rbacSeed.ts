import type { PrismaClient } from '@prisma/client';

export const PERMISSIONS: { name: string; description: string; product?: string }[] = [
  { name: 'radar.read', description: 'View Radar leads and analytics', product: 'radar' },
  { name: 'radar.manage', description: 'Manage Radar configuration and filters', product: 'radar' },

  { name: 'discovery.read', description: 'View discovery results', product: 'discovery' },
  { name: 'discovery.run', description: 'Run discovery jobs', product: 'discovery' },
  { name: 'discovery.configure', description: 'Configure discovery providers and presets', product: 'discovery' },

  { name: 'factory.read', description: 'View Factory runs and output', product: 'factory' },
  { name: 'factory.run', description: 'Trigger Factory generation jobs', product: 'factory' },

  { name: 'forge.read', description: 'View Forge plans and approvals', product: 'forge' },
  { name: 'forge.run', description: 'Approve and run Forge plans', product: 'forge' },

  { name: 'studio.read', description: 'View Studio content and previews', product: 'studio' },
  { name: 'studio.edit', description: 'Edit Studio content', product: 'studio' },

  { name: 'cms.read', description: 'Read CMS content for a site', product: 'cms' },
  { name: 'cms.edit', description: 'Edit CMS content for a site', product: 'cms' },
  { name: 'cms.users.manage', description: 'Manage CMS users for a site', product: 'cms' },

  { name: 'showcase.read', description: 'View Showcases', product: 'showcase' },
  { name: 'showcase.configure', description: 'Configure Showcase variants', product: 'showcase' },
  { name: 'showcase.publish', description: 'Publish Showcases', product: 'showcase' },

  { name: 'security.read', description: 'Read Security Center data', product: 'security' },
  { name: 'security.manage', description: 'Run security scans and update findings', product: 'security' },
  { name: 'security.acceptRisk', description: 'Accept or false-positive security findings', product: 'security' },

  { name: 'users.read', description: 'View users', product: 'users' },
  { name: 'users.manage', description: 'Create, edit, delete users', product: 'users' },
  { name: 'roles.manage', description: 'Manage roles and permissions', product: 'users' },

  { name: 'settings.read', description: 'Read global settings', product: 'settings' },
  { name: 'settings.manage', description: 'Manage global settings', product: 'settings' },
];

type Scope = 'GLOBAL' | 'PRODUCT' | 'SITE';

type RoleDef = {
  name: string;
  description: string;
  isGlobal: boolean;
  isSite: boolean;
  permissions: { name: string; scope: Scope }[];
};

const ROLES: RoleDef[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full platform access including role management and security',
    isGlobal: true,
    isSite: false,
    permissions: PERMISSIONS.map((p) => ({ name: p.name, scope: 'GLOBAL' })),
  },
  {
    name: 'PLATFORM_ADMIN',
    description: 'Most platform administration except super-sensitive actions',
    isGlobal: true,
    isSite: false,
    permissions: PERMISSIONS.filter((p) => !['security.manage', 'security.acceptRisk', 'roles.manage'].includes(p.name)).map((p) => ({ name: p.name, scope: 'GLOBAL' })),
  },
  {
    name: 'LEAD_MANAGER',
    description: 'Radar, Discovery and lead qualification',
    isGlobal: true,
    isSite: false,
    permissions: [
      { name: 'radar.read', scope: 'GLOBAL' },
      { name: 'radar.manage', scope: 'GLOBAL' },
      { name: 'discovery.read', scope: 'GLOBAL' },
      { name: 'discovery.run', scope: 'GLOBAL' },
      { name: 'discovery.configure', scope: 'GLOBAL' },
      { name: 'factory.read', scope: 'GLOBAL' },
      { name: 'forge.read', scope: 'GLOBAL' },
      { name: 'users.read', scope: 'GLOBAL' },
      { name: 'showcase.read', scope: 'GLOBAL' },
    ],
  },
  {
    name: 'SHOWCASE_MANAGER',
    description: 'Studio, Showcase, and related Factory/Forge operations',
    isGlobal: true,
    isSite: false,
    permissions: [
      { name: 'studio.read', scope: 'GLOBAL' },
      { name: 'studio.edit', scope: 'GLOBAL' },
      { name: 'showcase.read', scope: 'GLOBAL' },
      { name: 'showcase.configure', scope: 'GLOBAL' },
      { name: 'showcase.publish', scope: 'GLOBAL' },
      { name: 'factory.read', scope: 'GLOBAL' },
      { name: 'factory.run', scope: 'GLOBAL' },
      { name: 'forge.read', scope: 'GLOBAL' },
      { name: 'forge.run', scope: 'GLOBAL' },
      { name: 'cms.read', scope: 'GLOBAL' },
      { name: 'users.read', scope: 'GLOBAL' },
    ],
  },
  {
    name: 'SECURITY_ADMIN',
    description: 'Security Center access',
    isGlobal: true,
    isSite: false,
    permissions: [
      { name: 'security.read', scope: 'GLOBAL' },
      { name: 'security.manage', scope: 'GLOBAL' },
      { name: 'security.acceptRisk', scope: 'GLOBAL' },
      { name: 'users.read', scope: 'GLOBAL' },
      { name: 'settings.read', scope: 'GLOBAL' },
    ],
  },
  {
    name: 'SITE_ADMIN',
    description: 'Full admin for a single customer site',
    isGlobal: false,
    isSite: true,
    permissions: [
      { name: 'cms.read', scope: 'SITE' },
      { name: 'cms.edit', scope: 'SITE' },
      { name: 'cms.users.manage', scope: 'SITE' },
      { name: 'studio.read', scope: 'SITE' },
      { name: 'studio.edit', scope: 'SITE' },
      { name: 'showcase.read', scope: 'SITE' },
      { name: 'showcase.configure', scope: 'SITE' },
      { name: 'showcase.publish', scope: 'SITE' },
      { name: 'users.read', scope: 'SITE' },
      { name: 'settings.read', scope: 'SITE' },
    ],
  },
  {
    name: 'SITE_EDITOR',
    description: 'Edit content for a single customer site',
    isGlobal: false,
    isSite: true,
    permissions: [
      { name: 'cms.read', scope: 'SITE' },
      { name: 'cms.edit', scope: 'SITE' },
      { name: 'studio.read', scope: 'SITE' },
      { name: 'studio.edit', scope: 'SITE' },
    ],
  },
  {
    name: 'SITE_VIEWER',
    description: 'View-only access for a single customer site',
    isGlobal: false,
    isSite: true,
    permissions: [
      { name: 'cms.read', scope: 'SITE' },
      { name: 'studio.read', scope: 'SITE' },
      { name: 'showcase.read', scope: 'SITE' },
    ],
  },
];

export async function seedRbac(prisma: PrismaClient): Promise<void> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }

  for (const role of ROLES) {
    const existing = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        name: role.name,
        description: role.description,
        isGlobal: role.isGlobal,
        isSite: role.isSite,
      },
    });

    for (const perm of role.permissions) {
      const permission = await prisma.permission.findUnique({ where: { name: perm.name } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId_scope: {
            roleId: existing.id,
            permissionId: permission.id,
            scope: perm.scope as any,
          },
        },
        update: {},
        create: {
          roleId: existing.id,
          permissionId: permission.id,
          scope: perm.scope as any,
        },
      });
    }
  }
}

export async function migrateExistingUsers(prisma: PrismaClient): Promise<void> {
  // Migrate global roles
  const users = await prisma.user.findMany({
    select: { id: true, email: true, globalRole: true },
  });
  for (const u of users) {
    if (u.globalRole === 'SUPER_ADMIN') {
      const superAdmin = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
      if (superAdmin) {
        const existing = await prisma.userRole.findFirst({
          where: { userId: u.id, roleId: superAdmin.id, siteId: null },
        });
        if (!existing) {
          await prisma.userRole.create({ data: { userId: u.id, roleId: superAdmin.id, siteId: null } });
        }
      }
    }
    // USER global role carries no permissions by itself; site roles are migrated below.
  }

  // Migrate site roles
  const siteUsers = await prisma.siteUser.findMany({
    include: { user: true },
  });
  for (const su of siteUsers) {
    const roleName = su.role === 'ADMIN' ? 'SITE_ADMIN' : 'SITE_EDITOR';
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    await prisma.userRole.upsert({
      where: { userId_roleId_siteId: { userId: su.userId, roleId: role.id, siteId: su.siteId } },
      update: {},
      create: { userId: su.userId, roleId: role.id, siteId: su.siteId },
    });
  }
}
