import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.CMS_PORT ?? 3335);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Admin API: sites
app.get('/api/cms/sites', async (_req: Request, res: Response) => {
  const sites = await (prisma as any).site.findMany({
    include: { lead: { select: { companyName: true, website: true } }, siteSettings: true }
  });
  res.json({ sites });
});

app.get('/api/cms/sites/:siteId', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const site = await (prisma as any).site.findUnique({ where: { id: siteId }, include: { siteSettings: true } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const [pages, services, projects, news, menu, media] = await Promise.all([
    (prisma as any).page.findMany({ where: { siteId } }),
    (prisma as any).service.findMany({ where: { siteId } }),
    (prisma as any).project.findMany({ where: { siteId }, include: { projectMedia: { include: { media: true } } } }),
    (prisma as any).newsPost.findMany({ where: { siteId } }),
    (prisma as any).menuItem.findMany({ where: { siteId }, include: { page: { select: { slug: true, title: true } } }, orderBy: { sortOrder: 'asc' } }),
    (prisma as any).media.findMany({ where: { siteId } })
  ]);
  res.json({ site, pages, services, projects, news, menu, media });
});

app.post('/api/cms/sites/:siteId/settings', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const data = req.body;
  const updated = await (prisma as any).siteSettings.update({ where: { siteId }, data });
  res.json({ ok: true, settings: updated });
});

// Pages
function createSlug(title: string) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё\-]/g, '').replace(/--+/g, '-').slice(0, 80);
}

app.post('/api/cms/sites/:siteId/pages', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, blocks, status, isHomepage, seoTitle, seoDescription } = req.body;
  const s = slug || createSlug(title);
  const page = await (prisma as any).page.create({
    data: { siteId, title, slug: s, blocks: blocks ?? [], status: status ?? 'DRAFT', isHomepage: !!isHomepage, seoTitle, seoDescription, sourceType: 'MANUAL' }
  });
  res.json({ ok: true, page });
});

app.put('/api/cms/sites/:siteId/pages/:pageId', async (req: Request, res: Response) => {
  const { pageId } = req.params;
  const { title, blocks, status, isHomepage, seoTitle, seoDescription } = req.body;
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (blocks !== undefined) data.blocks = blocks;
  if (status !== undefined) data.status = status;
  if (isHomepage !== undefined) data.isHomepage = isHomepage;
  if (seoTitle !== undefined) data.seoTitle = seoTitle;
  if (seoDescription !== undefined) data.seoDescription = seoDescription;
  if (status === 'PUBLISHED' && data.publishedAt === undefined) data.publishedAt = new Date();
  const page = await (prisma as any).page.update({ where: { id: pageId }, data });
  res.json({ ok: true, page });
});

app.post('/api/cms/sites/:siteId/news', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, excerpt, blocks, status } = req.body;
  const s = slug || createSlug(title);
  const news = await (prisma as any).newsPost.create({
    data: { siteId, title, slug: s, excerpt, blocks: blocks ?? [], status: status ?? 'DRAFT', sourceType: 'MANUAL', publishedAt: new Date() }
  });
  res.json({ ok: true, news });
});

app.post('/api/cms/sites/:siteId/projects', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, excerpt, category, location, completionDate, blocks, status } = req.body;
  const s = slug || createSlug(title);
  const project = await (prisma as any).project.create({
    data: { siteId, title, slug: s, excerpt, category, location, completionDate, blocks: blocks ?? [], status: status ?? 'DRAFT', sourceType: 'MANUAL' }
  });
  res.json({ ok: true, project });
});

app.post('/api/cms/sites/:siteId/services', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, shortDescription, blocks, status } = req.body;
  const s = slug || createSlug(title);
  const service = await (prisma as any).service.create({
    data: { siteId, title, slug: s, shortDescription, blocks: blocks ?? [], status: status ?? 'DRAFT', sourceType: 'MANUAL' }
  });
  res.json({ ok: true, service });
});

app.post('/api/cms/sites/:siteId/menu', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { label, pageId, url, sortOrder } = req.body;
  const menu = await (prisma as any).menu.findFirst({ where: { siteId, isMain: true } });
  if (!menu) { res.status(404).json({ error: 'no_main_menu' }); return; }
  const item = await (prisma as any).menuItem.create({
    data: { siteId, menuId: menu.id, label, pageId, url, sortOrder: sortOrder ?? 0, visible: true }
  });
  res.json({ ok: true, item });
});

app.listen(PORT, () => {
  console.log(`CMS running: http://localhost:${PORT}`);
});
