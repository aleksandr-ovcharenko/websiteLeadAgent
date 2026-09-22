import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { sessionMiddleware, getSessionUser } from '../../dashboard/src/auth.js';
import { apiSecurityHeaders } from '../../dashboard/src/security/headers.js';
import { apiRateLimiter } from '../../dashboard/src/security/rateLimit.js';
import { originRefererCheck, requireJsonContentType } from '../../dashboard/src/security/csrf.js';
import { requireSitePermission } from '../../dashboard/src/security/authz.js';
import { LocalFilesystemMediaStorage } from '../../../packages/media-storage/dist/index.js';
import { validateContentBlocks } from '../../../packages/content-schema/dist/index.js';
// @ts-expect-error no declaration file for built templates
import { mediaUrlOf, entityPreviewPath } from '../../../packages/templates/dist/index.js';

const prisma = new PrismaClient();
const _canReadCms = requireSitePermission(prisma, 'cms.read', 'siteId');
const _canEditCms = requireSitePermission(prisma, 'cms.edit', 'siteId');
const _canManageCmsUsers = requireSitePermission(prisma, 'cms.users.manage', 'siteId');
const canReadCms = (req: Request, res: Response, next: NextFunction) => requireAuth(req, res, () => _canReadCms(req, res, next));
const canEditCms = (req: Request, res: Response, next: NextFunction) => requireAuth(req, res, () => _canEditCms(req, res, next));
const canManageCmsUsers = (req: Request, res: Response, next: NextFunction) => requireAuth(req, res, () => _canManageCmsUsers(req, res, next));
const app = express();
const PORT = Number(process.env.CMS_PORT ?? 3335);

// Trust the gateway only when it is the immediate loopback proxy.
app.set('trust proxy', 'loopback');

app.use(apiSecurityHeaders());
app.use(apiRateLimiter);
app.use(sessionMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(originRefererCheck);
app.use(requireJsonContentType);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAuth(req: Request, res: Response, next: NextFunction) {
  getSessionUser(req).then((user) => {
    if (!user) { res.status(401).send('Unauthorized'); return; }
    (req as any).user = user;
    next();
  }).catch((e: any) => next(e));
}

// V3.7.3 — text ownership contract: a manual save flips edited fields to
// ownership 'EDITOR' inside fieldProvenance. Generation must never overwrite
// EDITOR-owned fields; the merge keeps prior sourceText/sourceUrl/aiRevision.
async function editorProvenance(model: any, id: string, changed: Record<string, any>) {
  const row = await model.findUnique({ where: { id }, select: { fieldProvenance: true } }).catch(() => null);
  const prev = (row?.fieldProvenance && typeof row.fieldProvenance === 'object') ? row.fieldProvenance as Record<string, any> : {};
  const prov: Record<string, any> = { ...prev };
  for (const k of Object.keys(changed)) {
    if (k === 'manualModifiedAt' || k === 'fieldProvenance') continue;
    const prior = prev[k] && typeof prev[k] === 'object' ? prev[k] : {};
    prov[k] = {
      sourceText: prior.sourceText ?? null,
      sourceUrl: prior.sourceUrl ?? null,
      aiRevision: prior.aiRevision ?? null,
      value: changed[k] == null ? null : String(typeof changed[k] === 'object' ? JSON.stringify(changed[k]) : changed[k]).slice(0, 2000),
      ownership: 'EDITOR',
    };
  }
  return prov;
}



app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'cms', status: 'ok' });
});

// Legacy admin UI removed — Studio lives in platform web SPA under /studio/:siteId
app.get('/admin', requireAuth, (_req: Request, res: Response) => {
  res.redirect('/forge');
});

const CMS_READ_PERMISSIONS = ['cms.read', 'cms.edit', 'studio.read', 'studio.edit', 'cms.users.manage'];

function isGlobalCmsAccess(user: any): boolean {
  return (user?.permissions || []).some((p: any) => p.scope === 'GLOBAL' && CMS_READ_PERMISSIONS.includes(p.name));
}

app.get('/api/cms/sites', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const where: any = {};
  if (!isGlobalCmsAccess(user)) {
    const siteIds = (user?.permissions || [])
      .filter((p: any) => p.scope === 'SITE' && CMS_READ_PERMISSIONS.includes(p.name))
      .map((p: any) => p.siteId)
      .filter(Boolean);
    where.id = { in: siteIds };
  }
  // V3.7.4 — consolidated duplicates are hidden from the site picker.
  where.mergedIntoSiteId = null;
  const sites = await (prisma as any).site.findMany({
    where,
    include: { lead: { select: { companyName: true, website: true } }, siteSettings: true }
  });
  res.json({ sites });
});

app.get('/api/cms/sites/:siteId', canReadCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const site = await (prisma as any).site.findUnique({
    where: { id: siteId },
    include: { siteSettings: true, lead: { select: { website: true, websiteDomain: true, companyName: true } } }
  });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const originalWebsiteUrl = site.lead?.website && /^https?:\/\//.test(site.lead.website) ? site.lead.website : null;
  (site as any).originalWebsiteUrl = originalWebsiteUrl;
  const [pages, services, projects, products, news, menu, media, vacancies, users] = await Promise.all([
    (prisma as any).page.findMany({ where: { siteId } }),
    (prisma as any).service.findMany({ where: { siteId } }),
    (prisma as any).project.findMany({ where: { siteId }, include: { projectMedia: { include: { media: true } } } }),
    (prisma as any).product.findMany({ where: { siteId }, include: { productMedia: { include: { media: true } } }, orderBy: { sortOrder: 'asc' } }),
    (prisma as any).newsPost.findMany({ where: { siteId } }),
    (prisma as any).menuItem.findMany({ where: { siteId }, include: { page: { select: { slug: true, title: true } } }, orderBy: { sortOrder: 'asc' } }),
    (prisma as any).media.findMany({ where: { siteId } }),
    (prisma as any).vacancy.findMany({ where: { siteId } }),
    (prisma as any).siteUser.findMany({ where: { siteId }, include: { user: { select: { id: true, email: true, createdAt: true } } } })
  ]);
  // V3.7.4 Phase 5 — shared route resolver: every entity carries the exact
  // detail route the renderer would serve (entityPreviewPath). Undefined when
  // no detail route resolves — Studio renders "Detail preview unavailable".
  const withPreview = (list: any[]) => list.map((e) => ({ ...e, previewPath: entityPreviewPath(e, pages) ?? null }));
  res.json({ site, pages, services: withPreview(services), projects: withPreview(projects), products: withPreview(products), news: withPreview(news), vacancies: withPreview(vacancies), menu, media, users });
});

// ── V3.7.4 Phase 2/8 — Site → DesignVariant → SiteRevision version history ──
// Factory and Studio read revisions through this contract; promotion is atomic.

app.get('/api/cms/sites/:siteId/revisions', canReadCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const variants = await (prisma as any).demoVariant.findMany({
    where: { siteId },
    orderBy: { createdAt: 'asc' },
    include: {
      revisions: {
        orderBy: { version: 'asc' },
        include: { screenshots: { orderBy: [{ route: 'asc' }, { viewport: 'asc' }] } },
      },
    },
  });
  const out = variants.map((v: any) => ({
    id: v.id,
    name: v.name,
    templateId: v.templateId,
    previewToken: v.previewToken,
    isPreferred: !!v.isPreferred,
    activeRevisionId: v.activeRevisionId ?? null,
    revisions: v.revisions.map((r: any) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      templateId: r.templateId,
      templateVersion: r.templateVersion,
      contentHash: r.contentHash,
      basedOnRevisionId: r.basedOnRevisionId,
      generatedByRunId: r.generatedByRunId,
      failureReason: r.failureReason,
      currentStage: r.currentStage,
      stageCheckpoints: r.stageCheckpoints,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationMs: r.startedAt && r.completedAt ? new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime() : null,
      active: v.activeRevisionId === r.id,
      screenshots: r.screenshots.map((s: any) => ({
        id: s.id,
        route: s.route,
        viewport: s.viewport,
        capturedAt: s.capturedAt,
        current: s.current,
        buildId: s.buildId,
        contentHash: s.contentHash,
        url: `/api/cms/sites/${siteId}/revision-screenshots/${s.id}`,
      })),
    })),
  }));
  res.json({ variants: out });
});

// Screenshot binary for a revision row — scoped to the site so canReadCms
// covers authorization; storagePath is confined to the repo working dir.
app.get('/api/cms/sites/:siteId/revision-screenshots/:shotId', canReadCms, async (req: Request, res: Response) => {
  const { siteId, shotId } = req.params;
  const shot = await (prisma as any).revisionScreenshot.findFirst({
    where: { id: shotId, revision: { siteId } },
  });
  if (!shot) { res.status(404).json({ error: 'not_found' }); return; }
  const abs = path.resolve(process.cwd(), shot.storagePath);
  if (!abs.startsWith(process.cwd() + path.sep)) { res.status(403).json({ error: 'forbidden' }); return; }
  res.sendFile(abs, (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'file_missing' }); });
});

// Atomic promotion: only REVIEW_READY/PUBLISHED revisions may become active;
// the previous active revision's screenshots are demoted in one transaction.
app.post('/api/cms/sites/:siteId/revisions/:revisionId/promote', canEditCms, async (req: Request, res: Response) => {
  const { siteId, revisionId } = req.params;
  const revision = await (prisma as any).siteRevision.findFirst({ where: { id: revisionId, siteId }, include: { variant: true } });
  if (!revision) { res.status(404).json({ error: 'not_found' }); return; }
  if (!['REVIEW_READY', 'PUBLISHED'].includes(revision.status)) {
    res.status(409).json({ error: 'not_promotable', status: revision.status, failureReason: revision.failureReason });
    return;
  }
  await prisma.$transaction([
    (prisma as any).revisionScreenshot.updateMany({ where: { revision: { variantId: revision.variantId } }, data: { current: false } }),
    (prisma as any).revisionScreenshot.updateMany({ where: { revisionId: revision.id }, data: { current: true } }),
    (prisma as any).demoVariant.update({ where: { id: revision.variantId }, data: { activeRevisionId: revision.id } }),
  ]);
  res.json({ ok: true, activeRevisionId: revision.id });
});

app.post('/api/cms/sites/:siteId/settings', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const data = { ...req.body, manualModifiedAt: new Date() };
  const existing = await (prisma as any).siteSettings.findUnique({ where: { siteId }, select: { id: true, fieldProvenance: true } });
  if (existing) {
    data.fieldProvenance = await editorProvenance((prisma as any).siteSettings, existing.id, data);
  }
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

// Canonical composition contract: Page.blocks must validate at write time.
// Returns the normalized block array (defaults applied, unknown fields preserved)
// or null after responding 400.
function coerceBlocks(res: Response, blocks: unknown): any[] | null {
  if (blocks === undefined || blocks === null) return [];
  const r = validateContentBlocks(blocks);
  if (!r.ok) {
    res.status(400).json({ ok: false, error: 'Invalid blocks payload', details: r.errors });
    return null;
  }
  return r.blocks;
}

// Pages
app.post('/api/cms/sites/:siteId/pages', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, blocks, status, isHomepage, seoTitle, seoDescription, showInNav } = req.body;
  const normalizedBlocks = coerceBlocks(res, blocks);
  if (normalizedBlocks === null) return;
  const s = slug || createSlug(title);
  // A site can only have one homepage — atomically move the flag.
  if (isHomepage) {
    await (prisma as any).page.updateMany({ where: { siteId, isHomepage: true }, data: { isHomepage: false } });
  }
  const page = await (prisma as any).page.create({
    data: { siteId, title, slug: s, blocks: normalizedBlocks, status: status ?? 'DRAFT', isHomepage: !!isHomepage, seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  if (showInNav) {
    let menu = await (prisma as any).menu.findFirst({ where: { siteId, name: 'Main' } });
    if (!menu) menu = await (prisma as any).menu.create({ data: { siteId, name: 'Main', isMain: true } });
    await (prisma as any).menuItem.create({ data: { siteId, menuId: menu.id, label: title, pageId: page.id, url: `/${s}`, sortOrder: 0, visible: true } });
  }
  res.json({ ok: true, page });
});

app.put('/api/cms/sites/:siteId/pages/:pageId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, pageId } = req.params;
  const { title, slug, blocks, status, isHomepage, seoTitle, seoDescription } = req.body;
  const data: any = { manualModifiedAt: new Date() };
  if (title !== undefined) data.title = title;
  if (slug !== undefined) data.slug = slug;
  if (blocks !== undefined) {
    const normalizedBlocks = coerceBlocks(res, blocks);
    if (normalizedBlocks === null) return;
    data.blocks = normalizedBlocks;
  }
  if (status !== undefined) { data.status = status; if (status === 'PUBLISHED') data.publishedAt = new Date(); }
  if (isHomepage !== undefined) data.isHomepage = isHomepage;
  if (isHomepage === true) {
    // Single-homepage invariant: clear the flag on all other pages first.
    await (prisma as any).page.updateMany({ where: { siteId, isHomepage: true, id: { not: pageId } }, data: { isHomepage: false } });
  }
  if (seoTitle !== undefined) data.seoTitle = seoTitle;
  if (seoDescription !== undefined) data.seoDescription = seoDescription;
  data.fieldProvenance = await editorProvenance((prisma as any).page, pageId, data);
  const page = await (prisma as any).page.update({ where: { id: pageId, siteId }, data });
  res.json({ ok: true, page });
});

app.delete('/api/cms/sites/:siteId/pages/:pageId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, pageId } = req.params;
  await (prisma as any).page.delete({ where: { id: pageId, siteId } });
  res.json({ ok: true });
});

// News
app.post('/api/cms/sites/:siteId/news', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, excerpt, blocks, status, coverImageId, seoTitle, seoDescription, publishedAt } = req.body;
  const s = slug || createSlug(title);
  const providedDate = publishedAt ? new Date(publishedAt) : null;
  const newsBlocks = coerceBlocks(res, blocks);
  if (newsBlocks === null) return;
  const news = await (prisma as any).newsPost.create({
    data: { siteId, title, slug: s, excerpt, blocks: newsBlocks, coverImageId: coverImageId || null, status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? (providedDate || new Date()) : providedDate }
  });
  res.json({ ok: true, news });
});

app.put('/api/cms/sites/:siteId/news/:newsId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, newsId } = req.params;
  const data: any = { manualModifiedAt: new Date() };
  ['title', 'slug', 'excerpt', 'blocks', 'status', 'coverImageId', 'publishedAt', 'seoTitle', 'seoDescription'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.blocks !== undefined) { const nb = coerceBlocks(res, data.blocks); if (nb === null) return; data.blocks = nb; }
  if (data.coverImageId === '') data.coverImageId = null;
  if (data.publishedAt !== undefined) data.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
  if (data.status === 'PUBLISHED' && !data.publishedAt) data.publishedAt = new Date();
  data.fieldProvenance = await editorProvenance((prisma as any).newsPost, newsId, data);
  const news = await (prisma as any).newsPost.update({ where: { id: newsId, siteId }, data });
  res.json({ ok: true, news });
});

app.delete('/api/cms/sites/:siteId/news/:newsId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, newsId } = req.params;
  await (prisma as any).newsPost.delete({ where: { id: newsId, siteId } });
  res.json({ ok: true });
});

// Projects
app.post('/api/cms/sites/:siteId/projects', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, excerpt, category, location, completionDate, blocks, status, coverImageId, galleryImageIds, projectStatus, seoTitle, seoDescription } = req.body;
  const s = slug || createSlug(title);
  const gallery: string[] = Array.isArray(galleryImageIds) ? galleryImageIds.filter((id: any) => typeof id === 'string') : [];
  const projectBlocks = coerceBlocks(res, blocks);
  if (projectBlocks === null) return;
  const project = await (prisma as any).project.create({
    data: {
      siteId, title, slug: s, excerpt, category, location, completionDate, blocks: projectBlocks, coverImageId: coverImageId || null,
      projectStatus: projectStatus ?? 'completed', status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL',
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      projectMedia: { create: gallery.map((mediaId: string, i: number) => ({ mediaId, sortOrder: i })) }
    },
    include: { projectMedia: { include: { media: true } } }
  });
  res.json({ ok: true, project });
});

app.put('/api/cms/sites/:siteId/projects/:projectId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, projectId } = req.params;
  const data: any = { manualModifiedAt: new Date() };
  ['title', 'slug', 'excerpt', 'category', 'location', 'completionDate', 'blocks', 'status', 'coverImageId', 'projectStatus', 'seoTitle', 'seoDescription'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.blocks !== undefined) { const nb = coerceBlocks(res, data.blocks); if (nb === null) return; data.blocks = nb; }
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
  data.fieldProvenance = await editorProvenance((prisma as any).project, projectId, data);
  const project = await (prisma as any).project.update({ where: { id: projectId, siteId }, data, include: { projectMedia: { include: { media: true } } } });
  res.json({ ok: true, project });
});

app.delete('/api/cms/sites/:siteId/projects/:projectId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, projectId } = req.params;
  await (prisma as any).projectMedia.deleteMany({ where: { projectId } });
  await (prisma as any).project.delete({ where: { id: projectId, siteId } });
  res.json({ ok: true });
});

// Services
app.post('/api/cms/sites/:siteId/services', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, shortDescription, blocks, status, imageId, sortOrder, seoTitle, seoDescription } = req.body;
  const s = slug || createSlug(title);
  const serviceBlocks = coerceBlocks(res, blocks);
  if (serviceBlocks === null) return;
  const service = await (prisma as any).service.create({
    data: { siteId, title, slug: s, shortDescription, blocks: serviceBlocks, imageId: imageId || null, sortOrder: sortOrder ?? 0, status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  res.json({ ok: true, service });
});

app.put('/api/cms/sites/:siteId/services/:serviceId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, serviceId } = req.params;
  const data: any = { manualModifiedAt: new Date() };
  ['title', 'slug', 'shortDescription', 'blocks', 'status', 'imageId', 'sortOrder', 'icon', 'seoTitle', 'seoDescription'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.blocks !== undefined) { const nb = coerceBlocks(res, data.blocks); if (nb === null) return; data.blocks = nb; }
  if (data.imageId === '') data.imageId = null;
  if (data.status === 'PUBLISHED') data.publishedAt = new Date();
  data.fieldProvenance = await editorProvenance((prisma as any).service, serviceId, data);
  const service = await (prisma as any).service.update({ where: { id: serviceId, siteId }, data });
  res.json({ ok: true, service });
});

app.delete('/api/cms/sites/:siteId/services/:serviceId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, serviceId } = req.params;
  await (prisma as any).service.delete({ where: { id: serviceId, siteId } });
  res.json({ ok: true });
});

// Products — catalogue entities are first-class, independently editable
app.post('/api/cms/sites/:siteId/products', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, summary, attributes, blocks, coverImageId, category, price, status, sortOrder, seoTitle, seoDescription, gallery } = req.body;
  const s = slug || createSlug(title);
  const productBlocks = coerceBlocks(res, blocks);
  if (productBlocks === null) return;
  const product = await (prisma as any).product.create({
    data: { siteId, title, slug: s, summary, attributes: attributes ?? {}, blocks: productBlocks, coverImageId: coverImageId || null, category, price, sortOrder: sortOrder ?? 0, status: status ?? 'DRAFT', seoTitle, seoDescription, sourceType: 'MANUAL', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  if (Array.isArray(gallery)) {
    await (prisma as any).productMedia.createMany({ data: gallery.filter((m: string) => m).map((mediaId: string, i: number) => ({ productId: product.id, mediaId, sortOrder: i })) });
  }
  res.json({ ok: true, product });
});

app.put('/api/cms/sites/:siteId/products/:productId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, productId } = req.params;
  const { title, slug, summary, attributes, blocks, coverImageId, category, price, status, sortOrder, seoTitle, seoDescription, gallery } = req.body;
  const data: any = { manualModifiedAt: new Date() };
  for (const [k, v] of Object.entries({ title, slug, summary, attributes, blocks, coverImageId, category, price, sortOrder, seoTitle, seoDescription })) {
    if (v !== undefined) data[k] = v;
  }
  if (data.blocks !== undefined) { const nb = coerceBlocks(res, data.blocks); if (nb === null) return; data.blocks = nb; }
  if (status !== undefined) { data.status = status; if (status === 'PUBLISHED') data.publishedAt = new Date(); }
  data.fieldProvenance = await editorProvenance((prisma as any).product, productId, data);
  const product = await (prisma as any).product.update({ where: { id: productId, siteId }, data });
  if (Array.isArray(gallery)) {
    await (prisma as any).productMedia.deleteMany({ where: { productId } });
    await (prisma as any).productMedia.createMany({ data: gallery.filter((m: string) => m).map((mediaId: string, i: number) => ({ productId, mediaId, sortOrder: i })) });
  }
  res.json({ ok: true, product });
});

app.delete('/api/cms/sites/:siteId/products/:productId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, productId } = req.params;
  await (prisma as any).product.delete({ where: { id: productId, siteId } });
  res.json({ ok: true });
});

// Vacancies
app.post('/api/cms/sites/:siteId/vacancies', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { title, slug, location, description, requirements, conditions, contact, status } = req.body;
  const s = slug || createSlug(title);
  const vacancy = await (prisma as any).vacancy.create({
    data: { siteId, title, slug: s, location, description, requirements, conditions, contact, status: status ?? 'DRAFT', publishedAt: status === 'PUBLISHED' ? new Date() : null }
  });
  res.json({ ok: true, vacancy });
});

app.put('/api/cms/sites/:siteId/vacancies/:vacancyId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, vacancyId } = req.params;
  const data: any = { manualModifiedAt: new Date() };
  ['title', 'slug', 'location', 'description', 'requirements', 'conditions', 'contact', 'status'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.status === 'PUBLISHED') data.publishedAt = new Date();
  data.fieldProvenance = await editorProvenance((prisma as any).vacancy, vacancyId, data);
  const vacancy = await (prisma as any).vacancy.update({ where: { id: vacancyId, siteId }, data });
  res.json({ ok: true, vacancy });
});

app.delete('/api/cms/sites/:siteId/vacancies/:vacancyId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, vacancyId } = req.params;
  await (prisma as any).vacancy.delete({ where: { id: vacancyId, siteId } });
  res.json({ ok: true });
});

// Menu
app.get('/api/cms/sites/:siteId/menu', canReadCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const items = await (prisma as any).menuItem.findMany({ where: { siteId }, include: { page: { select: { slug: true, title: true } } }, orderBy: { sortOrder: 'asc' } });
  res.json({ items });
});

app.put('/api/cms/sites/:siteId/menu', canEditCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const items = req.body.items || [];
  // Canonical navigation lives on the isMain menu — never look it up by a
  // hardcoded display name, that creates a second menu and orphans items.
  let menu = await (prisma as any).menu.findFirst({ where: { siteId, isMain: true } });
  if (!menu) menu = await (prisma as any).menu.create({ data: { siteId, name: 'main', isMain: true } });
  await (prisma as any).menuItem.deleteMany({ where: { menuId: menu.id } });

  async function createTree(list: any[], parentId: string | null = null) {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const created = await (prisma as any).menuItem.create({
        data: {
          siteId,
          menuId: menu.id,
          label: item.label || item.title || 'Item',
          pageId: item.pageId || null,
          url: item.url || null,
          targetType: item.targetType || item.type || null,
          target: item.target || null,
          sortOrder: i,
          visible: item.visible !== false && item.isVisible !== false,
          showInHeader: item.showInHeader !== false,
          showInFooter: item.showInFooter !== false,
          showOnHomepage: item.showOnHomepage !== false,
          parentId
        }
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

app.get('/api/cms/sites/:siteId/media', canReadCms, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const media = await (prisma as any).media.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' } });
  // Canonical URL resolution: local storage first-class, sourceUrl as provenance.
  const items = media.map((m: any) => ({ ...m, url: mediaUrlOf(String(siteId), m) || null }));
  res.json({ items });
});

app.post('/api/cms/sites/:siteId/media', canEditCms, upload.single('file'), async (req: Request, res: Response) => {
  const { siteId } = req.params;
  if (!req.file) { res.status(400).json({ error: 'no_file' }); return; }
  const storage = mediaStorage(String(siteId));
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

app.put('/api/cms/sites/:siteId/media/:mediaId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, mediaId } = req.params;
  const { alt, caption } = req.body;
  const media = await (prisma as any).media.update({ where: { id: mediaId, siteId }, data: { alt, caption } });
  res.json({ ok: true, media });
});

app.delete('/api/cms/sites/:siteId/media/:mediaId', canEditCms, async (req: Request, res: Response) => {
  const { siteId, mediaId } = req.params;
  const media = await (prisma as any).media.findUnique({ where: { id: mediaId, siteId } });
  if (!media) { res.json({ ok: true }); return; }

  // Deleting media that is still referenced would produce broken images in
  // Studio and on the public renderer — report usages instead of deleting.
  const [svc, proj, prod, news, pm, prm, settings] = await Promise.all([
    (prisma as any).service.count({ where: { siteId, imageId: mediaId } }),
    (prisma as any).project.count({ where: { siteId, coverImageId: mediaId } }),
    (prisma as any).product.count({ where: { siteId, coverImageId: mediaId } }),
    (prisma as any).newsPost.count({ where: { siteId, coverImageId: mediaId } }),
    (prisma as any).projectMedia.count({ where: { mediaId } }),
    (prisma as any).productMedia.count({ where: { mediaId } }),
    (prisma as any).siteSettings.findFirst({ where: { siteId, OR: [{ logoMediaId: mediaId }, { faviconMediaId: mediaId }] }, select: { siteId: true } })
  ]);
  const usages = { services: svc, projects: proj, products: prod, news, projectGalleries: pm, productGalleries: prm, siteSettings: settings ? 1 : 0 };
  const total = Object.values(usages).reduce((a: number, b: any) => a + (b as number), 0);
  if (total > 0 && req.query.force !== 'true') {
    res.status(409).json({ error: 'media_in_use', usages });
    return;
  }

  const storage = mediaStorage(String(siteId));
  await storage.delete(media.storagePath);
  await (prisma as any).media.delete({ where: { id: mediaId } });
  res.json({ ok: true });
});

// Users
app.get('/api/cms/sites/:siteId/users', canManageCmsUsers, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const users = await (prisma as any).siteUser.findMany({ where: { siteId }, include: { user: { select: { id: true, email: true, createdAt: true } } } });
  res.json({ users });
});

const SITE_ROLE_MAP: Record<string, string> = { ADMIN: 'SITE_ADMIN', EDITOR: 'SITE_EDITOR' };

app.post('/api/cms/sites/:siteId/users', canManageCmsUsers, async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const rawRole = req.body?.role;
  const legacyRole: 'ADMIN' | 'EDITOR' = rawRole === 'ADMIN' ? 'ADMIN' : 'EDITOR';
  const rbacRoleName = SITE_ROLE_MAP[legacyRole];
  if (!email) { res.status(400).json({ error: 'missing_email' }); return; }
  let user = await (prisma as any).user.findUnique({ where: { email } });
  if (!user) {
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    user = await (prisma as any).user.create({ data: { email, passwordHash, globalRole: 'USER' } });
  }
  const siteUser = await (prisma as any).siteUser.upsert({
    where: { siteId_userId: { siteId, userId: user.id } },
    create: { siteId, userId: user.id, role: legacyRole },
    update: { role: legacyRole }
  });
  const role = await (prisma as any).role.findUnique({ where: { name: rbacRoleName } });
  if (role) {
    await (prisma as any).userRole.upsert({
      where: { userId_roleId_siteId: { userId: user.id, roleId: role.id, siteId } },
      create: { userId: user.id, roleId: role.id, siteId },
      update: {}
    });
  }
  res.json({ ok: true, user: siteUser });
});

app.put('/api/cms/sites/:siteId/users/:userId', canManageCmsUsers, async (req: Request, res: Response) => {
  const { siteId, userId } = req.params;
  const legacyRole: 'ADMIN' | 'EDITOR' = req.body?.role === 'ADMIN' ? 'ADMIN' : 'EDITOR';
  const rbacRoleName = SITE_ROLE_MAP[legacyRole];
  const siteUser = await (prisma as any).siteUser.update({ where: { siteId_userId: { siteId, userId } }, data: { role: legacyRole } });
  const role = await (prisma as any).role.findUnique({ where: { name: rbacRoleName } });
  if (role) {
    // Remove any other site role for this user at this site to keep one role per membership.
    await (prisma as any).userRole.deleteMany({ where: { userId, siteId } });
    await (prisma as any).userRole.create({ data: { userId, roleId: role.id, siteId } });
  }
  res.json({ ok: true, user: siteUser });
});

app.delete('/api/cms/sites/:siteId/users/:userId', canManageCmsUsers, async (req: Request, res: Response) => {
  const { siteId, userId } = req.params;
  await (prisma as any).siteUser.delete({ where: { siteId_userId: { siteId, userId } } });
  await (prisma as any).userRole.deleteMany({ where: { userId, siteId } });
  res.json({ ok: true });
});

// Async route errors (e.g. Prisma validation) must return 400/500 — never
// crash the process and take the CMS down mid-operation.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const isValidation = err?.name === 'PrismaClientValidationError' || /Unknown argument|Invalid/.test(err?.message || '');
  res.status(isValidation ? 400 : 500).json({ ok: false, error: isValidation ? 'invalid_payload' : 'internal_error', detail: String(err?.message || err).slice(0, 300) });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[STUDIO] ready on http://localhost:${PORT}`);
});
