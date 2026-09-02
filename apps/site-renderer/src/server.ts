import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// @ts-expect-error no declaration file for built templates
import { templates } from '../../../packages/templates/dist/index.js';

const REPO_ROOT = process.cwd();

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.RENDERER_PORT ?? process.env.SITE_RENDERER_PORT ?? 3336);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'renderer', status: 'ok' });
});

function fmtRoute(segments: string[]): { route: string; subRoute: string } {
  const parts = (segments[0] || '').split('/').filter(Boolean);
  const s = parts[0] || '';
  const sub = parts.slice(1).join('/') || '';
  return { route: s, subRoute: sub };
}

async function renderPreview(req: Request, res: Response) {
  const previewToken = (req.params.previewToken || req.params.previewSlug) as string;
  const raw = (req.params[0] as string) || '';
  const { route, subRoute } = fmtRoute([raw]);

  let site: any = null;
  let templateId = '';

  const variant = await (prisma as any).demoVariant.findUnique({
    where: { previewToken },
    include: { site: true }
  });

  if (variant?.site) {
    site = variant.site;
    templateId = variant.templateId;
  } else {
    site = await (prisma as any).site.findUnique({ where: { previewToken } });
    templateId = site?.templateId || 'construction-modern-v1';
  }

  if (!site) { res.status(404).send('Site not found'); return; }

  const settings = await (prisma as any).siteSettings.findUnique({ where: { siteId: site.id } }) ?? {};
  const pages = await (prisma as any).page.findMany({ where: { siteId: site.id, status: 'PUBLISHED' } });
  const services = await (prisma as any).service.findMany({ where: { siteId: site.id, status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' } });
  const projects = await (prisma as any).project.findMany({
    where: { siteId: site.id, status: 'PUBLISHED' },
    include: { projectMedia: { include: { media: true } } }
  });
  const news = await (prisma as any).newsPost.findMany({ where: { siteId: site.id, status: 'PUBLISHED' } });
  const vacancies = await (prisma as any).vacancy.findMany({ where: { siteId: site.id, status: 'PUBLISHED' } });
  const menu = await (prisma as any).menuItem.findMany({
    where: { siteId: site.id, visible: true, parentId: null },
    include: {
      page: { select: { slug: true } },
      children: { include: { page: { select: { slug: true } }, children: { include: { page: { select: { slug: true } } } } } }
    },
    orderBy: { sortOrder: 'asc' },
  });
  const media = await (prisma as any).media.findMany({ where: { siteId: site.id } });
  const mediaMap = new Map<string, any>();
  for (const m of media) {
    mediaMap.set(m.id, m);
    if (m.sourceUrl) mediaMap.set(m.sourceUrl, m);
  }

  const themeConfig = site.themeConfig || {};
  const theme = { ...themeConfig };
  const hero = themeConfig.hero || {};
  const about = themeConfig.about || {};
  const cta = themeConfig.cta || {};
  const homepageSections = themeConfig.homepageSections || [];
  const logo = settings.logoMediaId ? mediaMap.get(settings.logoMediaId) : undefined;
  const favicon = settings.faviconMediaId ? mediaMap.get(settings.faviconMediaId) : undefined;

  const render = templates[templateId] || templates['construction-modern-v1'];
  const html = render({
    site,
    settings,
    theme,
    hero,
    about,
    cta,
    logo,
    favicon,
    homepageSections,
    pages,
    services,
    projects,
    news,
    vacancies,
    menu,
    mediaMap,
    route,
    subRoute,
    stylePreset: req.query.style as string | undefined
  });
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(html);
}

// Showcase (canonical) and preview (legacy alias)
app.get('/showcase/:previewToken', renderPreview);
app.get('/showcase/:previewToken/*', renderPreview);
app.get('/preview/:previewSlug', renderPreview);
app.get('/preview/:previewSlug/*', renderPreview);

// Template static assets (hashed JS/CSS/PNG from packages/templates/dist/<template>/public)
app.use('/template-assets', (req: Request, res: Response, next: any) => {
  const segs = req.path.split('/').filter(Boolean);
  const [templateId, ...rest] = segs;
  if (!templateId) { res.status(404).send(); return; }
  const publicDir = path.resolve(REPO_ROOT, 'packages/templates/dist', templateId, 'public');
  req.url = '/' + rest.join('/');
  express.static(publicDir)(req, res, next);
});

// Site media from the generated sites directory
app.get('/site-media/:siteId/*', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const file = String(req.params[0]).replace(/\.\./g, '');
  const mediaDir = path.resolve(REPO_ROOT, 'data/generated/sites', siteId, 'media');
  const p = path.resolve(mediaDir, file);
  if (!p.startsWith(mediaDir)) { res.status(403).send(); return; }
  try {
    await fs.access(p);
    res.sendFile(p);
  } catch {
    res.status(404).send();
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ENGINE] ready on http://localhost:${PORT}`);
});
