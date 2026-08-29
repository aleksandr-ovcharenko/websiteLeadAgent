import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { sessionMiddleware, getSessionUser, requireSiteAccess, requireSuperAdmin } from '../../dashboard/src/auth.js';
import { LocalFilesystemMediaStorage } from '../../../packages/media-storage/dist/index.js';

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.CMS_PORT ?? 3335);

app.use(sessionMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAuth(req: Request, res: Response, next: NextFunction) {
  getSessionUser(req).then((user) => {
    if (!user) { res.status(401).send('Unauthorized'); return; }
    (req as any).user = user;
    next();
  }).catch((e: any) => next(e));
}

async function getSiteRole(user: any, siteId: string): Promise<string | null> {
  if (user.globalRole === 'SUPER_ADMIN') return 'ADMIN';
  const su = await (prisma as any).siteUser.findUnique({
    where: { siteId_userId: { siteId, userId: user.id } },
    select: { role: true }
  });
  return su?.role ?? null;
}

function requireSiteRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const siteId = req.params.siteId || req.query.siteId || req.body?.siteId;
    if (!siteId) { res.status(400).json({ error: 'missing_site' }); return; }
    const role = await getSiteRole(user, String(siteId));
    if (!role || !roles.includes(role)) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'cms', status: 'ok' });
});

// Legacy admin UI removed — Studio lives in platform web SPA under /studio/:siteId
app.get('/admin', requireAuth, (_req: Request, res: Response) => {
  res.redirect('/forge');
});

app.get('/api/cms/sites', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const where: any = {};
  if (user.globalRole !== 'SUPER_ADMIN') {
    const siteUsers = await (prisma as any).siteUser.findMany({ where: { userId: user.id }, select: { siteId: true } });
    where.id = { in: siteUsers.map((s: any) => s.siteId) };
  }
  const sites = await (prisma as any).site.findMany({
    where,
    include: { lead: { select: { companyName: true, website: true } }, siteSettings: true }
  });
  res.json({ sites });
});

app.get('/api/cms/sites/:siteId', requireSiteAccess('siteId'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const site = await (prisma as any).site.findUnique({ where: { id: siteId }, include: { siteSettings: true } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const [pages, services, projects, news, menu, media, vacancies, users] = await Promise.all([
    (prisma as any).page.findMany({ where: { siteId } }),
    (prisma as any).service.findMany({ where: { siteId } }),
    (prisma as any).project.findMany({ where: { siteId }, include: { projectMedia: { include: { media: true } } } }),
    (prisma as any).newsPost.findMany({ where: { siteId } }),
    (prisma as any).menuItem.findMany({ where: { siteId }, include: { page: { select: { slug: true, title: true } } }, orderBy: { sortOrder: 'asc' } }),
    (prisma as any).media.findMany({ where: { siteId } }),
    (prisma as any).vacancy.findMany({ where: { siteId } }),
    (prisma as any).siteUser.findMany({ where: { siteId }, include: { user: { select: { id: true, email: true, createdAt: true } } } })
  ]);
  res.json({ site, pages, services, projects, news, menu, media, vacancies, users });
});

app.post('/api/cms/sites/:siteId/settings', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const data = req.body;
  const settings = await (prisma as any).siteSettings.upsert({
    where: { siteId },
    create: { siteId, ...data },
    update: data
  });
  res.json({ ok: true, settings });
});

function createSlug(title: string) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё\-]/g, '').replace(/--+/g, '-').slice(0, 80);
}

// Pages
app.post('/api/cms/sites/:siteId/pages', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, blocks, status, isHomepage, seoTitle, seoDescription, showInNav } = req.body;
  const s = slug || createSlug(title);
  const page = await (prisma as any).page.create({
    data: { siteId, title, slug: s, blocks: blocks ?? [], status: status ?? 'DRAFT', isHomepage: !!isHomepage, seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  if (showInNav) {
    let menu = await (prisma as any).menu.findFirst({ where: { siteId, name: 'Main' } });
    if (!menu) menu = await (prisma as any).menu.create({ data: { siteId, name: 'Main', isMain: true } });
    await (prisma as any).menuItem.create({ data: { siteId, menuId: menu.id, label: title, pageId: page.id, url: `/${s}`, sortOrder: 0, visible: true } });
  }
  res.json({ ok: true, page });
});

app.put('/api/cms/sites/:siteId/pages/:pageId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, pageId } = req.params;
  const { title, slug, blocks, status, isHomepage, seoTitle, seoDescription } = req.body;
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (slug !== undefined) data.slug = slug;
  if (blocks !== undefined) data.blocks = blocks;
  if (status !== undefined) { data.status = status; if (status === 'PUBLISHED') data.publishedAt = new Date(); }
  if (isHomepage !== undefined) data.isHomepage = isHomepage;
  if (seoTitle !== undefined) data.seoTitle = seoTitle;
  if (seoDescription !== undefined) data.seoDescription = seoDescription;
  const page = await (prisma as any).page.update({ where: { id: pageId, siteId }, data });
  res.json({ ok: true, page });
});

app.delete('/api/cms/sites/:siteId/pages/:pageId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, pageId } = req.params;
  await (prisma as any).page.delete({ where: { id: pageId, siteId } });
  res.json({ ok: true });
});

// News
app.post('/api/cms/sites/:siteId/news', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, excerpt, blocks, status, coverImageId, seoTitle, seoDescription, publishedAt } = req.body;
  const s = slug || createSlug(title);
  const providedDate = publishedAt ? new Date(publishedAt) : null;
  const news = await (prisma as any).newsPost.create({
    data: { siteId, title, slug: s, excerpt, blocks: blocks ?? [], coverImageId: coverImageId || null, status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? (providedDate || new Date()) : providedDate }
  });
  res.json({ ok: true, news });
});

app.put('/api/cms/sites/:siteId/news/:newsId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, newsId } = req.params;
  const data: any = {};
  ['title', 'slug', 'excerpt', 'blocks', 'status', 'coverImageId', 'publishedAt', 'seoTitle', 'seoDescription'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.coverImageId === '') data.coverImageId = null;
  if (data.publishedAt !== undefined) data.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
  if (data.status === 'PUBLISHED' && !data.publishedAt) data.publishedAt = new Date();
  const news = await (prisma as any).newsPost.update({ where: { id: newsId, siteId }, data });
  res.json({ ok: true, news });
});

app.delete('/api/cms/sites/:siteId/news/:newsId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, newsId } = req.params;
  await (prisma as any).newsPost.delete({ where: { id: newsId, siteId } });
  res.json({ ok: true });
});

// Projects
app.post('/api/cms/sites/:siteId/projects', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, excerpt, category, location, completionDate, blocks, status, coverImageId, galleryImageIds, projectStatus, seoTitle, seoDescription } = req.body;
  const s = slug || createSlug(title);
  const gallery: string[] = Array.isArray(galleryImageIds) ? galleryImageIds.filter((id: any) => typeof id === 'string') : [];
  const project = await (prisma as any).project.create({
    data: {
      siteId, title, slug: s, excerpt, category, location, completionDate, blocks: blocks ?? [], coverImageId: coverImageId || null,
      projectStatus: projectStatus ?? 'completed', status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL',
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      projectMedia: { create: gallery.map((mediaId: string, i: number) => ({ mediaId, sortOrder: i })) }
    },
    include: { projectMedia: { include: { media: true } } }
  });
  res.json({ ok: true, project });
});

app.put('/api/cms/sites/:siteId/projects/:projectId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, projectId } = req.params;
  const data: any = {};
  ['title', 'slug', 'excerpt', 'category', 'location', 'completionDate', 'blocks', 'status', 'coverImageId', 'projectStatus', 'seoTitle', 'seoDescription'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.coverImageId === '') data.coverImageId = null;
  if (data.status === 'PUBLISHED' && data.publishedAt === undefined) data.publishedAt = new Date();
  if (data.status === 'DRAFT') data.publishedAt = null;
  if (Array.isArray(req.body.galleryImageIds)) {
    const gallery: string[] = req.body.galleryImageIds.filter((id: any) => typeof id === 'string');
    await (prisma as any).projectMedia.deleteMany({ where: { projectId } });
    await (prisma as any).projectMedia.createMany({
      data: gallery.map((mediaId: string, i: number) => ({ projectId, mediaId, sortOrder: i })),
      skipDuplicates: true
    });
  }
  const project = await (prisma as any).project.update({ where: { id: projectId, siteId }, data, include: { projectMedia: { include: { media: true } } } });
  res.json({ ok: true, project });
});

app.delete('/api/cms/sites/:siteId/projects/:projectId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, projectId } = req.params;
  await (prisma as any).projectMedia.deleteMany({ where: { projectId } });
  await (prisma as any).project.delete({ where: { id: projectId, siteId } });
  res.json({ ok: true });
});

// Services
app.post('/api/cms/sites/:siteId/services', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, shortDescription, blocks, status, imageId, sortOrder, seoTitle, seoDescription } = req.body;
  const s = slug || createSlug(title);
  const service = await (prisma as any).service.create({
    data: { siteId, title, slug: s, shortDescription, blocks: blocks ?? [], imageId: imageId || null, sortOrder: sortOrder ?? 0, status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  res.json({ ok: true, service });
});

app.put('/api/cms/sites/:siteId/services/:serviceId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, serviceId } = req.params;
  const data: any = {};
  ['title', 'slug', 'shortDescription', 'blocks', 'status', 'imageId', 'sortOrder', 'icon', 'seoTitle', 'seoDescription'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.imageId === '') data.imageId = null;
  if (data.status === 'PUBLISHED') data.publishedAt = new Date();
  const service = await (prisma as any).service.update({ where: { id: serviceId, siteId }, data });
  res.json({ ok: true, service });
});

app.delete('/api/cms/sites/:siteId/services/:serviceId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, serviceId } = req.params;
  await (prisma as any).service.delete({ where: { id: serviceId, siteId } });
  res.json({ ok: true });
});

// Vacancies
app.post('/api/cms/sites/:siteId/vacancies', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, location, description, requirements, conditions, contact, status } = req.body;
  const s = slug || createSlug(title);
  const vacancy = await (prisma as any).vacancy.create({
    data: { siteId, title, slug: s, location, description, requirements, conditions, contact, status: status ?? 'DRAFT', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  res.json({ ok: true, vacancy });
});

app.put('/api/cms/sites/:siteId/vacancies/:vacancyId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, vacancyId } = req.params;
  const data: any = {};
  ['title', 'slug', 'location', 'description', 'requirements', 'conditions', 'contact', 'status'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.status === 'PUBLISHED') data.publishedAt = new Date();
  const vacancy = await (prisma as any).vacancy.update({ where: { id: vacancyId, siteId }, data });
  res.json({ ok: true, vacancy });
});

app.delete('/api/cms/sites/:siteId/vacancies/:vacancyId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, vacancyId } = req.params;
  await (prisma as any).vacancy.delete({ where: { id: vacancyId, siteId } });
  res.json({ ok: true });
});

// Menu
app.get('/api/cms/sites/:siteId/menu', requireSiteAccess('siteId'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const items = await (prisma as any).menuItem.findMany({ where: { siteId }, include: { page: { select: { slug: true, title: true } } }, orderBy: { sortOrder: 'asc' } });
  res.json({ items });
});

app.put('/api/cms/sites/:siteId/menu', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const items = req.body.items || [];
  let menu = await (prisma as any).menu.findFirst({ where: { siteId, name: 'Main' } });
  if (!menu) menu = await (prisma as any).menu.create({ data: { siteId, name: 'Main', isMain: true } });
  await (prisma as any).menuItem.deleteMany({ where: { menuId: menu.id } });

  async function createTree(list: any[], parentId: string | null = null) {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const created = await (prisma as any).menuItem.create({
        data: { siteId, menuId: menu.id, label: item.label || item.title || 'Item', pageId: item.pageId || null, url: item.url || null, sortOrder: i, visible: item.isVisible !== false, parentId }
      });
      if (item.children && Array.isArray(item.children)) await createTree(item.children, created.id);
    }
  }

  await createTree(items);
  const result = await (prisma as any).menuItem.findMany({ where: { siteId, menuId: menu.id }, include: { page: { select: { slug: true, title: true } } }, orderBy: { sortOrder: 'asc' } });
  res.json({ ok: true, items: result });
});

// Media
function mediaStorage(siteId: string) {
  const baseDir = path.resolve('data/generated/sites', siteId, 'media');
  return new LocalFilesystemMediaStorage({ baseDir, baseUrl: `/site-media/${siteId}` });
}

app.get('/api/cms/sites/:siteId/media', requireSiteAccess('siteId'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const media = await (prisma as any).media.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' } });
  res.json({ items: media });
});

app.post('/api/cms/sites/:siteId/media', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), upload.single('file'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  if (!req.file) { res.status(400).json({ error: 'no_file' }); return; }
  const storage = mediaStorage(siteId);
  const result = await storage.upload({ data: req.file.buffer, filename: req.file.originalname, mimeType: req.file.mimetype });
  const file = await (prisma as any).media.create({
    data: {
      siteId,
      filename: result.filename,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: result.size,
      storagePath: result.storagePath,
      sourceUrl: storage.getUrl(result.storagePath)
    }
  });
  res.json({ ok: true, media: file });
});

app.put('/api/cms/sites/:siteId/media/:mediaId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, mediaId } = req.params;
  const { alt, caption } = req.body;
  const media = await (prisma as any).media.update({ where: { id: mediaId, siteId }, data: { alt, caption } });
  res.json({ ok: true, media });
});

app.delete('/api/cms/sites/:siteId/media/:mediaId', requireSiteAccess('siteId'), requireSiteRole('ADMIN', 'EDITOR'), async (req: Request, res: Response) => {
  const { siteId, mediaId } = req.params;
  const media = await (prisma as any).media.findUnique({ where: { id: mediaId, siteId } });
  if (media) {
    const storage = mediaStorage(siteId);
    await storage.delete(media.storagePath);
    await (prisma as any).media.delete({ where: { id: mediaId } });
  }
  res.json({ ok: true });
});

// Users
app.get('/api/cms/sites/:siteId/users', requireSiteAccess('siteId'), requireSiteRole('ADMIN'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const users = await (prisma as any).siteUser.findMany({ where: { siteId }, include: { user: { select: { id: true, email: true, createdAt: true } } } });
  res.json({ users });
});

app.post('/api/cms/sites/:siteId/users', requireSiteAccess('siteId'), requireSiteRole('ADMIN'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { email, role = 'EDITOR' } = req.body;
  if (!email) { res.status(400).json({ error: 'missing_email' }); return; }
  let user = await (prisma as any).user.findUnique({ where: { email } });
  if (!user) {
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    user = await (prisma as any).user.create({ data: { email, passwordHash, globalRole: 'USER' } });
  }
  const siteUser = await (prisma as any).siteUser.upsert({
    where: { siteId_userId: { siteId, userId: user.id } },
    create: { siteId, userId: user.id, role },
    update: { role }
  });
  res.json({ ok: true, user: siteUser });
});

app.put('/api/cms/sites/:siteId/users/:userId', requireSiteAccess('siteId'), requireSiteRole('ADMIN'), async (req: Request, res: Response) => {
  const { siteId, userId } = req.params;
  const { role } = req.body;
  const siteUser = await (prisma as any).siteUser.update({ where: { siteId_userId: { siteId, userId } }, data: { role } });
  res.json({ ok: true, user: siteUser });
});

app.delete('/api/cms/sites/:siteId/users/:userId', requireSiteAccess('siteId'), requireSiteRole('ADMIN'), async (req: Request, res: Response) => {
  const { siteId, userId } = req.params;
  await (prisma as any).siteUser.delete({ where: { siteId_userId: { siteId, userId } } });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[STUDIO] ready on http://localhost:${PORT}`);
});
