import express, { type Request, type Response } from 'express';
import { prisma, requireSuperAdmin } from './auth.js';
import { captureSitePreview, getScreenshotStoragePath, getScreenshotUrl } from '../../../packages/screenshot/src/index.js';
import { getPipelineStageLabel } from '@minsk/redesign-engine';

const router = express.Router();
router.use(express.json());
router.use(requireSuperAdmin);

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function uiStatus(site: any) {
  if (site.status === 'ARCHIVED') return 'ARCHIVED';
  if (site.status === 'ACTIVE') return 'ACTIVE';
  const stage = site.lead?.redesignStage ?? 'NOT_SELECTED';
  if (['DEMO_APPROVED', 'READY_TO_CONTACT'].includes(stage)) return 'DEMO_APPROVED';
  if (['DEMO_GENERATED', 'SITE_RENDERED', 'AUDIT_DONE'].includes(stage)) return 'DEMO_GENERATED';
  if (['CONTENT_TRANSFORMED', 'CMS_IMPORTED'].includes(stage)) return 'CONTENT_READY';
  return 'DRAFT';
}

function computeAttention(site: any, screenshot: any) {
  if (!site.domain) return { attention: 'Missing domain', attentionAction: 'Fix' as const };
  const lastBuild = site.builds?.[0];
  if (lastBuild && lastBuild.status === 'FAILED') return { attention: 'Preview build failed', attentionAction: 'Retry' as const };
  if (!screenshot) return { attention: 'Screenshot missing', attentionAction: 'Retry' as const };
  if (new Date(site.updatedAt) > new Date(screenshot.siteUpdatedAt)) return { attention: 'Preview outdated', attentionAction: 'Retry' as const };
  return { attention: undefined, attentionAction: undefined };
}

async function toPlatformSite(site: any): Promise<any> {
  const [pages, projects, news, services, media, screenshot, build] = await Promise.all([
    prisma.page.count({ where: { siteId: site.id } }),
    prisma.project.count({ where: { siteId: site.id } }),
    prisma.newsPost.count({ where: { siteId: site.id } }),
    prisma.service.count({ where: { siteId: site.id } }),
    prisma.media.count({ where: { siteId: site.id } }),
    prisma.sitePreviewScreenshot.findUnique({ where: { siteId: site.id } }),
    prisma.siteBuild.findFirst({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' } })
  ]);

  const status = uiStatus(site);
  const stageLabel = getPipelineStageLabel(site.lead?.redesignStage);
  const { attention, attentionAction } = computeAttention(site, screenshot);
  const image = screenshot ? screenshot.url : 'https://via.placeholder.com/800x500?text=No+preview';

  return {
    id: site.id,
    name: site.name,
    domain: site.domain || '—',
    status,
    template: site.templateId,
    pages,
    projects,
    news,
    services,
    mediaCount: media,
    lastUpdated: formatDate(site.updatedAt),
    created: formatDate(site.createdAt),
    lastBuild: build ? formatDate(build.createdAt) : '—',
    lastAudit: '—',
    previewCaptured: screenshot ? formatDate(screenshot.capturedAt) : '—',
    previewOutdated: attention === 'Preview outdated',
    image,
    attention,
    attentionAction,
    previewToken: site.previewToken,
    stageLabel
  };
}

router.get('/api/platform/sites', async (_req: Request, res: Response) => {
  const sites = await prisma.site.findMany({
    include: {
      lead: { select: { redesignStage: true } },
      builds: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });
  const items = await Promise.all(sites.map(toPlatformSite));
  res.json({ sites: items });
});

router.get('/api/platform/sites/:siteId', async (req: Request, res: Response) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.siteId },
    include: {
      lead: { select: { redesignStage: true } },
      builds: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } }
    }
  });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({ site: await toPlatformSite(site) });
});

router.post('/api/platform/sites', async (req: Request, res: Response) => {
  const { name, slug, domain, templateId } = req.body;
  if (!name || !slug || !templateId) { res.status(400).json({ error: 'missing_fields' }); return; }
  const existing = await prisma.site.findUnique({ where: { slug } });
  if (existing) { res.status(409).json({ error: 'slug_exists' }); return; }
  const site = await prisma.site.create({
    data: { name, slug, domain: domain || null, templateId, previewToken: randomToken(), status: 'DRAFT' }
  });
  res.json({ ok: true, site: await toPlatformSite(site) });
});

router.post('/api/platform/sites/:siteId/archive', async (req: Request, res: Response) => {
  const site = await prisma.site.update({
    where: { id: req.params.siteId },
    data: { status: 'ARCHIVED' }
  });
  res.json({ ok: true, site: await toPlatformSite(site) });
});

router.post('/api/platform/sites/:siteId/screenshot', async (req: Request, res: Response) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.siteId },
    include: {
      builds: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } }
    }
  });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const { url } = await captureSitePreview(site as any, prisma);
  res.json({ ok: true, url });
});

router.get('/site-screenshots/:siteId/preview.png', async (req: Request, res: Response) => {
  const p = getScreenshotStoragePath(req.params.siteId);
  try {
    await import('node:fs/promises').then((fs) => fs.access(p));
    res.sendFile(p);
  } catch {
    res.status(404).send();
  }
});

export { router as platformRouter };
