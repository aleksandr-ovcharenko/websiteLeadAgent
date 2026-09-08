import { PrismaClient } from '@prisma/client';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';
import { getCookieSessionOptions } from '@minsk/security';
import { getClientIp, loginRateLimiter } from './security/rateLimit.js';
import { getEffectivePermissions, hasPermission, type EffectivePermission } from './security/authz.js';

export const prisma = new PrismaClient();

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

export const sessionMiddleware = cookieSession(getCookieSessionOptions());

export interface PlatformUser {
  id: string;
  email: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
  permissions?: EffectivePermission[];
}

export async function getSessionUser(req: Request): Promise<PlatformUser | null> {
  const userId = (req.session as any)?.userId;
  if (!userId) return null;
  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, globalRole: true }
  });
  return user ?? null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  getSessionUser(req).then((user) => {
    if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as any).user = user;
    next();
  }).catch((e) => next(e));
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  getSessionUser(req).then(async (user) => {
    if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
    const ok = await hasPermission(prisma, user.id, 'roles.manage');
    if (!ok) { res.status(403).json({ error: 'forbidden' }); return; }
    (req as any).user = user;
    next();
  }).catch((e) => next(e));
}

export async function canAccessSite(user: PlatformUser, siteId: string): Promise<boolean> {
  if (user.globalRole === 'SUPER_ADMIN') return true;
  const su = await (prisma as any).siteUser.findUnique({
    where: { siteId_userId: { siteId, userId: user.id } },
    select: { role: true }
  });
  return !!su;
}

export function requireSiteAccess(siteIdParam: string = 'siteId') {
  return (req: Request, res: Response, next: NextFunction) => {
    getSessionUser(req).then(async (user) => {
      if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
      const siteId = req.params[siteIdParam] || req.query.siteId || req.body?.siteId;
      if (!siteId) { res.status(400).json({ error: 'missing_site' }); return; }
      if (await canAccessSite(user, String(siteId))) {
        (req as any).user = user;
        next();
      } else {
        res.status(403).json({ error: 'forbidden' });
      }
    }).catch((e) => next(e));
  };
}

export function requireSiteRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const siteId = req.params.siteId || req.query.siteId || req.body?.siteId;
    if (!siteId) { res.status(400).json({ error: 'missing_site' }); return; }
    const role = await getSiteRole(user, String(siteId));
    if (!role || !roles.includes(role)) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

async function getSiteRole(user: any, siteId: string): Promise<string | null> {
  if (user?.globalRole === 'SUPER_ADMIN') return 'ADMIN';
  const su = await (prisma as any).siteUser.findUnique({
    where: { siteId_userId: { siteId, userId: user?.id } },
    select: { role: true }
  });
  return su?.role ?? null;
}

export const authRouter = express.Router();
authRouter.use(express.json());

authRouter.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) { res.status(400).json({ error: 'missing_credentials' }); return; }
  const user = await (prisma as any).user.findUnique({ where: { email } });
  const dummyHash = '$2b$10$zDQBsWUx.F78DBoMeu.1Q.mSSuydjq4IPclYyE2bqsFjmJa2QVpfe';
  const ok = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !ok) { res.status(401).json({ error: 'invalid_credentials' }); return; }

  // Regenerate session identifier on login to prevent session fixation.
  (req as any).session = null;
  (req as any).session = { userId: user.id };

  const permissions = await getEffectivePermissions(prisma, user.id);
  res.json({ ok: true, user: { id: user.id, email: user.email, globalRole: user.globalRole, permissions } });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  (req as any).session = null;
  res.json({ ok: true });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
  const permissions = await getEffectivePermissions(prisma, user.id);
  res.json({ user: { ...user, permissions } });
});

export { getClientIp };
