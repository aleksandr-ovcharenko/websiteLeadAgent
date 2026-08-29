import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import { templates } from '../../../packages/templates/dist/index.js';

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.RENDERER_PORT ?? process.env.SITE_RENDERER_PORT ?? 3336);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'renderer', status: 'ok' });
});

function fmtRoute(segments: string[]): { route: string; subRoute: string } {
  const s = (segments[0] || '').replace(/^\//, '').replace(/\/$/, '');
  const sub = (segments[1] || '').replace(/^\//, '').replace(/\/$/, '');
  return { route: s, subRoute: sub };
}

async function renderPreview(req: Request, res: Response) {
  const { previewSlug } = req.params;
  const raw = (req.params[0] as string) || '';
  const { route, subRoute } = fmtRoute([raw]);

  const site = await (prisma as any).site.findUnique({ where: { previewToken: previewSlug } });
  if (!site) { res.status(404).send('Site not found'); return; }

  const settings = await (prisma as any).siteSettings.findUnique({ where: { siteId: site.id } }) ?? {};
  const pages = await (prisma as any).page.findMany({ where: { siteId: site.id, status: 'PUBLISHED' } });
  const services = await (prisma as any).service.findMany({ where: { siteId: site.id, status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' } });
  const projects = await (prisma as any).project.findMany({
    where: { siteId: site.id, status: 'PUBLISHED' },
    include: { projectMedia: { include: { media: true } } }
  });
  const news = await (prisma as any).newsPost.findMany({ where: { siteId: site.id, status: 'PUBLISHED' } });
  const menu = await (prisma as any).menuItem.findMany({
    where: { siteId: site.id, visible: true },
    include: { page: { select: { slug: true } } },
    orderBy: { sortOrder: 'asc' }
  });
  const media = await (prisma as any).media.findMany({ where: { siteId: site.id } });
  const mediaMap = new Map<string, any>();
  for (const m of media) mediaMap.set(m.id, m);

  const render = templates[site.templateId] || templates['construction-modern-v1'];
  const html = render({
    site,
    settings,
    pages,
    services,
    projects,
    news,
    menu,
    mediaMap,
    route,
    subRoute
  });
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(html);
}

app.get('/preview/:previewSlug', renderPreview);
app.get('/preview/:previewSlug/*', renderPreview);

// Template static assets (hashed JS/CSS/PNG from packages/templates/dist/<template>/public)
app.use('/template-assets/:templateId', (req: Request, res: Response, next: any) => {
  const publicDir = path.resolve('packages/templates/dist', req.params.templateId, 'public');
  express.static(publicDir)(req, res, next);
});

// Site media from the generated sites directory
app.get('/site-media/:siteId/*', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const file = String(req.params[0]).replace(/\.\./g, '');
  const p = path.resolve('data/generated/sites', siteId, 'media', file);
  const allowed = path.resolve('data/generated/sites', siteId, 'media');
  if (!p.startsWith(allowed)) { res.status(403).send(); return; }
  try {
    await fs.access(p);
    res.sendFile(p);
  } catch {
    res.status(404).send();
  }
});

app.listen(PORT, () => {
  console.log(`Site renderer running: http://localhost:${PORT}`);
});
