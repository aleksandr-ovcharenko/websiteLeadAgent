import { PrismaClient } from '@prisma/client';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';

export const prisma = new PrismaClient();

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-me';

export const sessionMiddleware = cookieSession({
  name: 'pla.sid',
  keys: [SESSION_SECRET],
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24
});

export interface PlatformUser {
  id: string;
  email: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
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
  getSessionUser(req).then((user) => {
    if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
    if (user.globalRole !== 'SUPER_ADMIN') { res.status(403).json({ error: 'forbidden' }); return; }
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

export const authRouter = express.Router();
authRouter.use(express.json());

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) { res.status(400).json({ error: 'missing_credentials' }); return; }
  const user = await (prisma as any).user.findUnique({ where: { email } });
  if (!user) { res.status(401).json({ error: 'invalid_credentials' }); return; }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: 'invalid_credentials' }); return; }
  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email, globalRole: user.globalRole } });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  (req as any).session = null;
  res.json({ ok: true });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
  res.json({ user });
});
