import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';

export interface EffectivePermission {
  name: string;
  scope: 'GLOBAL' | 'PRODUCT' | 'SITE';
  product?: string | null;
  siteId?: string | null;
}

export async function getEffectivePermissions(prisma: PrismaClient, userId: string): Promise<EffectivePermission[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      site: true,
    },
  });

  const perms: EffectivePermission[] = [];
  for (const ur of rows) {
    for (const rp of ur.role.permissions) {
      const scope = rp.scope;
      const siteId = scope === 'SITE' ? ur.siteId : undefined;
      perms.push({
        name: rp.permission.name,
        scope,
        product: rp.scopeProduct,
        siteId,
      });
    }
  }
  return perms;
}

export async function hasPermission(prisma: PrismaClient, userId: string, permissionName: string): Promise<boolean> {
  const perms = await getEffectivePermissions(prisma, userId);
  return perms.some((p) => p.name === permissionName && p.scope === 'GLOBAL');
}

export async function hasSitePermission(prisma: PrismaClient, userId: string, permissionName: string, siteId: string): Promise<boolean> {
  const perms = await getEffectivePermissions(prisma, userId);
  return perms.some((p) => {
    if (p.name !== permissionName) return false;
    if (p.scope === 'GLOBAL') return true;
    if (p.scope === 'SITE' && p.siteId === siteId) return true;
    return false;
  });
}

export async function hasAnyPermission(prisma: PrismaClient, userId: string, permissionNames: string[]): Promise<boolean> {
  const perms = await getEffectivePermissions(prisma, userId);
  return perms.some((p) => permissionNames.includes(p.name) && p.scope === 'GLOBAL');
}

export async function hasAnySitePermission(prisma: PrismaClient, userId: string, siteId: string): Promise<boolean> {
  const perms = await getEffectivePermissions(prisma, userId);
  return perms.some((p) => p.siteId === siteId || p.scope === 'GLOBAL');
}

export function requirePermission(prisma: PrismaClient, permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const ok = await hasPermission(prisma, user.id, permissionName);
    if (!ok) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

export function requireSitePermission(prisma: PrismaClient, permissionName: string, siteIdParam: string = 'siteId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const siteId = req.params[siteIdParam];
    if (!siteId) { res.status(400).json({ error: 'missing_site' }); return; }
    const ok = await hasSitePermission(prisma, user.id, permissionName, siteId);
    if (!ok) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

export function requireAnyPermission(prisma: PrismaClient, ...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const ok = await hasAnyPermission(prisma, user.id, permissionNames);
    if (!ok) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

export function requireSiteAccess(prisma: PrismaClient, siteIdParam: string = 'siteId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const siteId = req.params[siteIdParam];
    if (!siteId) { res.status(400).json({ error: 'missing_site' }); return; }
    const ok = await hasAnySitePermission(prisma, user.id, siteId);
    if (!ok) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

export function requireAuth(getSessionUser: (req: Request) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getSessionUser(req);
    if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as any).user = user;
    next();
  };
}
