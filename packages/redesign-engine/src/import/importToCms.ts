import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient, PageStatus, ContentSourceType } from '@prisma/client';
import type { ExtractedContent } from '../../../content-schema/dist/index.js';
import { LocalFilesystemMediaStorage } from '../../../media-storage/dist/index.js';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanPhoneDigits(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

export function normalizePhone(input?: string | null): string | undefined {
  if (!input) return undefined;
  const phoneRe = /(\+\d[\d\s\(\)\-]{5,}|\d[\d\s\(\)\-]{6,})/g;
  const candidates: { raw: string; digits: string }[] = [];
  let m;
  while ((m = phoneRe.exec(input)) !== null) {
    const raw = m[0].trim();
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length >= 7) candidates.push({ raw, digits });
  }
  if (!candidates.length) return input.trim().replace(/[^\d+\s\(\)\-]/g, '').replace(/\s+/g, ' ').trim() || undefined;
  candidates.sort((a, b) => {
    const aHasPlus = a.raw.startsWith('+') ? 1 : 0;
    const bHasPlus = b.raw.startsWith('+') ? 1 : 0;
    if (aHasPlus !== bHasPlus) return bHasPlus - aHasPlus;
    if (b.digits.length !== a.digits.length) return b.digits.length - a.digits.length;
    return a.raw.length - b.raw.length;
  });
  const best = candidates[0].raw;
  return best.replace(/[^\d+\s\(\)\-]/g, '').replace(/\s+/g, ' ').trim();
}

const GENERIC_NAME_RE = /^\s*(home|about(?:\s+us)?|contacts?|services?|projects?|news|careers?|vacancies?|главная|о компании|о нас|контакты|услуги|проекты|новости|вакансии|о-нас|о-компании)\s*$/iu;

export function isGenericCompanyName(name?: string | null): boolean {
  if (!name) return true;
  if (name.length < 2) return true;
  return GENERIC_NAME_RE.test(name);
}

export interface LeadIdentity {
  id: string;
  companyName?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ImportOptions {
  leadId: string;
  lead: LeadIdentity;
  siteName: string;
  siteSlug: string;
  previewSlug: string;
  templateId: string;
  content: ExtractedContent;
  artifactDir: string;
  storageBaseUrl: string;
  /** RedesignRun that owns generated records. */
  runId?: string;
  /** If true, reconcile CMS content: remove generated records from previous runs not present in the new content set. */
  regenerateContent?: boolean;
  /** Marks the site as a test fixture — filtered out of Forge by default. */
  fixture?: boolean;
  fixtureOwner?: string;
}

export interface ImportResult {
  siteId: string;
  siteSlug: string;
  previewSlug: string;
  demoVariantId: string;
  stats: {
    pages: number;
    services: number;
    projects: number;
    news: number;
    vacancies: number;
    media: number;
    menuItems: number;
  };
}

function staleGeneratedWhere(siteId: string, runId: string, keptIds: Set<string>) {
  // keptIds — not runId — is the authority on what is current: the same
  // crawlRunId is reused across regenerations, so a stale generated row can
  // carry today's runId and must still be removed when nothing referenced it.
  return {
    where: {
      siteId,
      AND: [
        { generatedByRunId: { not: null } },
        { id: { notIn: [...keptIds] } },
      ],
    }
  };
}

function staleContentWhere(siteId: string, runId: string, keptIds: Set<string>) {
  return {
    where: {
      siteId,
      AND: [
        { id: { notIn: [...keptIds] } },
        { manualModifiedAt: null },
        { OR: [{ generatedByRunId: { not: null } }, { sourceType: { not: 'MANUAL' } }] },
      ],
    }
  };
}

export async function importToCms(options: ImportOptions, prisma = new PrismaClient()): Promise<ImportResult> {
  await mkdir(options.artifactDir, { recursive: true });
  await writeFile(join(options.artifactDir, 'content.json'), JSON.stringify(options.content, null, 2));

  const runId = options.runId;
  const regenerateContent = options.regenerateContent ?? false;
  const ownership = runId ? { generatedByRunId: runId, generatedByDemoVariantId: '' as string | undefined } : ({} as { generatedByRunId?: string; generatedByDemoVariantId?: string });
  const generatedSource = ContentSourceType.GENERATED;
  const previewUrl = `http://localhost:3000/showcase/${options.previewSlug}`;
  const themeConfig: any = options.content.theme ? { ...options.content.theme, homepageSections: options.content.homepageSections, hero: options.content.hero, about: options.content.about, cta: options.content.cta, dynamicSections: (options.content as any).dynamicSections || [] } : {};

  const priorSite = await prisma.site.findUnique({ where: { leadId: options.leadId }, select: { settings: true } });
  const fixtureMarker = options.fixture
    ? { fixture: true, fixtureOwner: options.fixtureOwner || 'unknown', visibility: 'TEST' }
    : {};
  const mergedSettings = { ...((priorSite?.settings as any) || {}), ...fixtureMarker, previewUrl };

  const site = await prisma.site.upsert({
    where: { leadId: options.leadId },
    update: { name: options.siteName, slug: options.siteSlug, templateId: options.templateId, themeConfig, settings: mergedSettings as any, status: 'DRAFT' },
    create: { leadId: options.leadId, name: options.siteName, slug: options.siteSlug, previewToken: options.previewSlug, templateId: options.templateId, themeConfig: themeConfig as any, settings: mergedSettings as any, status: 'DRAFT' }
  });
  const siteId = site.id;

  // DemoVariant identity is (siteId, templateId): retrying the same template
  // updates the existing variant and keeps its previewToken stable; a new
  // variant (and a new token) is created only for a genuinely new template.
  let demoVariant = await prisma.demoVariant.findFirst({
    where: { siteId, templateId: options.templateId }
  });
  if (demoVariant) {
    demoVariant = await prisma.demoVariant.update({
      where: { id: demoVariant.id },
      data: { name: options.templateId, status: 'ACTIVE', themeConfig, ...(runId ? { generatedByRunId: runId } : {}) }
    });
  } else {
    let variantToken = randomId().replace(/[^a-z0-9]/gi, '').slice(0, 12) || `v${Date.now().toString(36)}`;
    // previewToken is globally unique across sites and variants.
    while (await prisma.demoVariant.findUnique({ where: { previewToken: variantToken } })
        || await prisma.site.findUnique({ where: { previewToken: variantToken } })) {
      variantToken = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }
    demoVariant = await prisma.demoVariant.create({
      data: { siteId, templateId: options.templateId, previewToken: variantToken, name: options.templateId, status: 'ACTIVE', themeConfig: themeConfig as any, ...(runId ? { generatedByRunId: runId } : {}) }
    });
  }

  // Exactly one preferred variant per site: the freshly built one.
  await prisma.demoVariant.updateMany({
    where: { siteId, id: { not: demoVariant.id }, isPreferred: true },
    data: { isPreferred: false }
  });
  if (!demoVariant.isPreferred) {
    demoVariant = await prisma.demoVariant.update({ where: { id: demoVariant.id }, data: { isPreferred: true } });
  }

  await prisma.site.update({
    where: { id: siteId },
    data: { preferredDemoVariantId: demoVariant.id }
  });

  if (runId) {
    ownership.generatedByRunId = runId;
    ownership.generatedByDemoVariantId = demoVariant.id;
  }

  const mediaDir = join('data/generated/sites', siteId, 'media');
  await mkdir(mediaDir, { recursive: true });
  const storage = new LocalFilesystemMediaStorage({ baseDir: mediaDir, baseUrl: `/site-media/${siteId}` });

  const usedSlugs = new Set<string>();
  function uniqueSlug(base: string): string {
    let s = base || 'untitled';
    let i = 0;
    while (usedSlugs.has(s)) s = `${base || 'untitled'}-${++i}`;
    usedSlugs.add(s);
    return s;
  }

  const mediaMap = new Map<string, any>();
  const allExistingMedia = await prisma.media.findMany({
    where: { siteId },
    select: { id: true, sourceUrl: true, generatedByRunId: true, generatedByDemoVariantId: true }
  });
  for (const m of allExistingMedia) {
    if (m.sourceUrl) mediaMap.set(m.sourceUrl, m);
  }
  const keptMediaIds = new Set<string>();

  // Media ownership semantics:
  // - sourceUrl is the immutable provenance/identity of an image asset.
  // - A media row is a per-site copy of that asset; it is reused across runs by sourceUrl.
  // - generatedByRunId records the run that originally fetched/stored the asset (provenance),
  //   NOT the most recent run that referenced it. Current-run usage is expressed by keptMediaIds.
  for (const m of options.content.media || []) {
    const sourceUrl = m.sourceUrl;
    if (!sourceUrl) continue;
    const existing = mediaMap.get(sourceUrl);
    if (existing) {
      // Reuse the existing stored copy. Do not overwrite generatedByRunId; provenance stays.
      keptMediaIds.add(existing.id);
      continue;
    }
    try {
      const referer = `https://${new URL(sourceUrl).hostname}/`;
      const resp = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', Referer: referer } });
      if (!resp.ok) {
        console.warn('media fetch non-ok', sourceUrl, resp.status);
        continue;
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      const mime = (resp.headers.get('content-type') || '').split(';')[0].trim() || 'image/jpeg';
      // Never store HTML/404 bodies or empty payloads as images.
      if (!mime.startsWith('image/')) {
        console.warn('media rejected: non-image mime', sourceUrl, mime);
        continue;
      }
      if (buf.length === 0) {
        console.warn('media rejected: zero-byte', sourceUrl);
        continue;
      }
      if (buf.length > 20 * 1024 * 1024) {
        console.warn('media rejected: too large', sourceUrl, buf.length);
        continue;
      }
      const result = await storage.upload({ data: buf, filename: m.filename, mimeType: mime });
      const dbMedia = await prisma.media.create({
        data: {
          siteId,
          filename: result.filename,
          originalFilename: m.originalFilename,
          mimeType: mime,
          size: result.size,
          storagePath: result.storagePath,
          sourceUrl,
          alt: m.alt,
          ...ownership
        } as any
      });
      mediaMap.set(sourceUrl, dbMedia);
      keptMediaIds.add(dbMedia.id);
    } catch (err) {
      console.warn('media import failed', sourceUrl, err);
    }
  }

  function mapImageId(sourceUrl?: string): string | undefined {
    if (!sourceUrl) return undefined;
    if (sourceUrl.startsWith('http')) {
      const dbm = mediaFromSourceUrl(sourceUrl);
      return dbm?.id;
    }
    return sourceUrl;
  }

  // themeConfig was written before media import — resolve hero/about image refs now.
  {
    const hero = site.themeConfig && (site.themeConfig as any).hero;
    const about = site.themeConfig && (site.themeConfig as any).about;
    const heroId = mapImageId(hero?.imageId) || hero?.imageId;
    const aboutId = mapImageId(about?.imageId) || about?.imageId;
    if (heroId !== hero?.imageId || aboutId !== about?.imageId) {
      const tc: any = { ...(site.themeConfig as any), hero: { ...(hero || {}), imageId: heroId }, about: { ...(about || {}), imageId: aboutId } };
      await prisma.site.update({ where: { id: siteId }, data: { themeConfig: tc } });
      await prisma.demoVariant.updateMany({ where: { siteId, generatedByRunId: runId }, data: { themeConfig: tc } });
    }
  }

  function mapBlocks(blocks: any[]): any[] {
    return (blocks || []).map((b: any) => {
      const mapped: any = { ...b };
      if (mapped.imageId && typeof mapped.imageId === 'string') {
        mapped.imageId = mapImageId(mapped.imageId);
      }
      if (Array.isArray(mapped.imageIds)) {
        mapped.imageIds = mapped.imageIds.map(mapImageId).filter(Boolean);
      }
      return mapped;
    });
  }

  // Some pipelines persisted sourceUrl with a '.webp' suffix — try both forms.
  function mediaFromSourceUrl(sourceUrl?: string) {
    if (!sourceUrl) return undefined;
    return mediaMap.get(sourceUrl) || mediaMap.get(`${sourceUrl}.webp`) || mediaMap.get(sourceUrl.replace(/\.webp$/, ''));
  }

  const leadDisplayName = options.lead.companyName?.split(/[,;]/)[0]?.trim();
  const extractedCompanyName = options.content.company?.shortName ?? options.content.company?.name;
  const companyName = !isGenericCompanyName(leadDisplayName)
    ? leadDisplayName
    : (!isGenericCompanyName(extractedCompanyName) ? extractedCompanyName : options.content.branding?.companyName ?? options.siteName);

  const contacts = options.content.contacts ?? {};
  const normalizedContacts = {
    ...contacts,
    phone: normalizePhone(contacts.phone) ?? contacts.phone,
    address: options.lead.address ?? contacts.address,
  };

  const logoMedia = options.content.branding?.logo?.sourceUrl ? mediaMap.get(options.content.branding.logo.sourceUrl) : undefined;
  const faviconMedia = options.content.branding?.favicon?.sourceUrl ? mediaMap.get(options.content.branding.favicon.sourceUrl) : undefined;

  const siteSettingsBase: any = {
    companyName: companyName || undefined,
    legalName: options.content.company?.legalName ?? undefined,
    unp: options.content.company?.unp ?? undefined,
    founded: options.content.company?.founded ?? undefined,
    employees: options.content.company?.employees ?? undefined,
    logoMediaId: logoMedia?.id || undefined,
    faviconMediaId: faviconMedia?.id || undefined,
    phone: normalizePhone(options.lead.phone ?? options.content.company?.phone) ?? undefined,
    email: options.content.company?.email || undefined,
    address: (options.lead.address ?? options.content.company?.address) || undefined,
    workingHours: options.content.company?.workingHours || undefined,
    socialLinks: options.content.company?.socialLinks ?? [],
    contacts: normalizedContacts,
    primaryColor: options.content.branding?.primaryColor ?? options.content.theme?.primaryColor,
    secondaryColor: options.content.branding?.secondaryColor ?? options.content.theme?.secondaryColor,
    defaultSeoTitle: options.content.branding?.defaultSeoTitle,
    defaultSeoDescription: options.content.branding?.defaultSeoDescription,
    previewUrl: undefined,
    language: 'ru',
    timezone: 'Europe/Minsk'
  };

  function resolveThemeImage(themeObject?: any) {
    if (!themeObject || !themeObject.imageId || typeof themeObject.imageId !== 'string' || !themeObject.imageId.startsWith('http')) return themeObject;
    const dbm = mediaFromSourceUrl(themeObject.imageId);
    if (dbm) {
      return { ...themeObject, imageId: dbm.id };
    }
    return { ...themeObject, imageUrl: themeObject.imageId, imageId: undefined };
  }

  const existingSettings = await prisma.siteSettings.findUnique({ where: { siteId }, select: { generatedByRunId: true, manualModifiedAt: true } });
  if (!existingSettings) {
    await prisma.siteSettings.create({ data: { siteId, ...siteSettingsBase, ...ownership } as any });
  } else if (runId && (regenerateContent || existingSettings.generatedByRunId) && !existingSettings.manualModifiedAt) {
    await prisma.siteSettings.update({ where: { siteId }, data: { ...siteSettingsBase, ...ownership } as any });
  }

  const keptPageIds = new Set<string>();
  const keptServiceIds = new Set<string>();
  const keptProjectIds = new Set<string>();
  const keptProductIds = new Set<string>();
  const keptNewsIds = new Set<string>();
  const keptVacancyIds = new Set<string>();
  const keptMenuItemIds = new Set<string>();

  // Ownership: sourceUrl is the immutable identity of a generated row — the
  // same source object must always resolve to the same CMS row. A manually
  // edited row (manualModifiedAt) is kept as-is; regeneration must never
  // overwrite it or spawn a duplicate sibling at a bumped slug.
  const ownedSelect = { id: true, slug: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true } as const;
  async function findOwned(model: any, sourceUrl: string | undefined, slug: string) {
    if (sourceUrl) {
      const bySource = await model.findFirst({
        where: { siteId, sourceUrl },
        orderBy: { createdAt: 'asc' },
        select: ownedSelect
      });
      if (bySource) return bySource;
    }
    return model.findUnique({ where: { siteId_slug: { siteId, slug } }, select: ownedSelect });
  }

  async function upsertPage(p: any) {
    const existing = await findOwned(prisma.page, p.sourceUrl, p.slug);
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    if (existing && existing.manualModifiedAt) {
      keptPageIds.add(existing.id);
      return existing;
    }
    const slug = existing ? existing.slug : uniqueSlug(p.slug);
    const data: any = {
      siteId,
      title: p.title,
      slug,
      isHomepage: p.isHomepage,
      blocks: mapBlocks(p.blocks) as any,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      sourceUrl: p.sourceUrl,
      sourceType: generatedSource,
      status: PageStatus.PUBLISHED,
      publishedAt: new Date(),
      ...ownership
    };
    const record = existing ? await prisma.page.update({ where: { id: existing.id }, data }) : await prisma.page.create({ data });
    keptPageIds.add(record.id);
    return record;
  }

  for (const p of options.content.pages || []) {
    await upsertPage(p);
  }

  async function upsertService(s: any) {
    const existing = await findOwned(prisma.service, s.sourceUrl, s.slug);
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    if (existing && existing.manualModifiedAt) {
      keptServiceIds.add(existing.id);
      return existing;
    }
    const slug = existing ? existing.slug : uniqueSlug(s.slug);
    const image = mediaFromSourceUrl(s.image?.sourceUrl);
    const data: any = {
      siteId,
      title: s.title,
      slug,
      shortDescription: s.shortDescription ?? null,
      blocks: mapBlocks(s.blocks) as any,
      imageId: image?.id ?? null,
      seoTitle: s.seoTitle,
      seoDescription: s.seoDescription,
      sourceUrl: s.sourceUrl,
      sourceType: generatedSource,
      status: PageStatus.PUBLISHED,
      sortOrder: 0,
      ...ownership
    };
    const record = existing ? await prisma.service.update({ where: { id: existing.id }, data }) : await prisma.service.create({ data });
    keptServiceIds.add(record.id);
    return record;
  }

  for (const s of options.content.services || []) {
    await upsertService(s);
  }

  async function upsertProject(p: any) {
    const existing = await findOwned(prisma.project, p.sourceUrl, p.slug);
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    if (existing && existing.manualModifiedAt) {
      keptProjectIds.add(existing.id);
      return existing;
    }
    const slug = existing ? existing.slug : uniqueSlug(p.slug);
    const cover = mediaFromSourceUrl(p.coverImage?.sourceUrl);
    const data: any = {
      siteId,
      title: p.title,
      slug,
      excerpt: p.excerpt ?? null,
      category: p.category,
      location: p.location,
      completionDate: p.completionDate,
      blocks: mapBlocks(p.blocks) as any,
      coverImageId: cover?.id ?? null,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      sourceUrl: p.sourceUrl,
      sourceType: generatedSource,
      status: PageStatus.PUBLISHED,
      publishedAt: new Date(),
      ...ownership
    };
    const record = existing ? await prisma.project.update({ where: { id: existing.id }, data }) : await prisma.project.create({ data });
    keptProjectIds.add(record.id);

    const newMediaIds = [...new Set<string>((p.gallery || []).map((img: any) => mediaFromSourceUrl(img.sourceUrl)?.id).filter(Boolean))];
    await prisma.projectMedia.deleteMany({ where: { projectId: record.id, mediaId: { notIn: newMediaIds } } });
    for (const mediaId of newMediaIds) {
      await prisma.projectMedia.upsert({
        where: { projectId_mediaId: { projectId: record.id, mediaId } },
        create: { projectId: record.id, mediaId, sortOrder: 0 },
        update: { sortOrder: 0 }
      });
    }
    return record;
  }

  for (const p of options.content.projects || []) {
    await upsertProject(p);
  }

  async function upsertProduct(p: any) {
    const existing = await findOwned(prisma.product, p.sourceUrl, p.slug);
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    // Human-edited records are authoritative — never overwrite or duplicate
    // them; keep the CMS record and mark it kept.
    if (existing && existing.manualModifiedAt) { keptProductIds.add(existing.id); return existing; }
    const slug = existing ? existing.slug : uniqueSlug(p.slug);
    const cover = mediaFromSourceUrl(p.coverImage?.sourceUrl);
    const data: any = {
      siteId,
      title: p.title,
      slug,
      summary: p.summary ?? null,
      attributes: (p.attributes || {}) as any,
      category: p.category,
      price: p.attributes?.price || p.attributes?.['Цена'] || p.attributes?.['цена'],
      blocks: mapBlocks(p.blocks) as any,
      coverImageId: cover?.id ?? null,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      sourceUrl: p.sourceUrl,
      sourceType: generatedSource,
      status: PageStatus.PUBLISHED,
      publishedAt: new Date(),
      ...ownership
    };
    const record = existing ? await prisma.product.update({ where: { id: existing.id }, data }) : await prisma.product.create({ data });
    keptProductIds.add(record.id);

    const newMediaIds = [...new Set<string>((p.gallery || []).map((img: any) => mediaFromSourceUrl(img.sourceUrl)?.id).filter(Boolean))];
    await prisma.productMedia.deleteMany({ where: { productId: record.id, mediaId: { notIn: newMediaIds } } });
    for (const mediaId of newMediaIds) {
      await prisma.productMedia.upsert({
        where: { productId_mediaId: { productId: record.id, mediaId } },
        create: { productId: record.id, mediaId, sortOrder: 0 },
        update: { sortOrder: 0 }
      });
    }
    return record;
  }

  for (const p of (options.content as any).products || []) {
    await upsertProduct(p);
  }

  async function upsertNews(n: any) {
    const existing = await findOwned(prisma.newsPost, n.sourceUrl, n.slug);
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    if (existing && existing.manualModifiedAt) {
      keptNewsIds.add(existing.id);
      return existing;
    }
    const slug = existing ? existing.slug : uniqueSlug(n.slug);
    const cover = mediaFromSourceUrl(n.coverImage?.sourceUrl);
    const data: any = {
      siteId,
      title: n.title,
      slug,
      excerpt: n.excerpt,
      blocks: mapBlocks(n.blocks) as any,
      coverImageId: cover?.id ?? null,
      seoTitle: n.seoTitle,
      seoDescription: n.seoDescription,
      sourceUrl: n.sourceUrl,
      sourceType: generatedSource,
      status: PageStatus.PUBLISHED,
      publishedAt: n.publishedAt ? new Date(n.publishedAt) : new Date(),
      ...ownership
    };
    const record = existing ? await prisma.newsPost.update({ where: { id: existing.id }, data }) : await prisma.newsPost.create({ data });
    keptNewsIds.add(record.id);
    return record;
  }

  for (const n of options.content.news || []) {
    await upsertNews(n);
  }

  async function upsertVacancy(v: any) {
    const existing = await findOwned(prisma.vacancy, v.sourceUrl, v.slug);
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    if (existing && existing.manualModifiedAt) {
      keptVacancyIds.add(existing.id);
      return existing;
    }
    const slug = existing ? existing.slug : uniqueSlug(v.slug);
    const data: any = {
      siteId,
      title: v.title,
      slug,
      location: v.location,
      description: v.description,
      requirements: v.requirements,
      conditions: v.conditions,
      contact: v.contact,
      sourceUrl: v.sourceUrl,
      status: PageStatus.PUBLISHED,
      sourceType: generatedSource,
      publishedAt: new Date(),
      ...ownership
    };
    const record = existing ? await prisma.vacancy.update({ where: { id: existing.id }, data }) : await prisma.vacancy.create({ data });
    keptVacancyIds.add(record.id);
    return record;
  }

  for (const v of options.content.vacancies || []) {
    await upsertVacancy(v);
  }

  let menu = await prisma.menu.findFirst({ where: { siteId, isMain: true }, select: { id: true, generatedByRunId: true } });
  if (menu && runId && (regenerateContent || menu.generatedByRunId)) {
    await prisma.menu.update({ where: { id: menu.id }, data: { ...ownership } });
  } else if (!menu) {
    menu = await prisma.menu.create({ data: { siteId, name: 'main', isMain: true, ...ownership } as any });
  }

  const allPages = await prisma.page.findMany({ where: { siteId }, orderBy: { createdAt: 'asc' }, select: { id: true, sourceUrl: true, isHomepage: true, slug: true } });
  const pageByUrl = new Map<string, string>(allPages.filter((p: any) => p.sourceUrl).map((p: any) => [p.sourceUrl, p.id]));
  const pageBySlug = new Map<string, string>(allPages.map((p: any) => [p.slug, p.id]));
  const homepageId = allPages.find((p: any) => p.isHomepage)?.id;

  const SECTION_TARGETS: Record<string, string> = {
    services: 'SERVICES', service: 'SERVICES', uslugi: 'SERVICES',
    projects: 'PROJECTS', project: 'PROJECTS', portfolio: 'PROJECTS', objects: 'PROJECTS', works: 'PROJECTS',
    news: 'NEWS', novosti: 'NEWS',
    vacancies: 'VACANCIES', vacancy: 'VACANCIES', careers: 'VACANCIES', jobs: 'VACANCIES', vakansii: 'VACANCIES',
    products: 'PRODUCTS', catalog: 'PRODUCTS', katalog: 'PRODUCTS',
    about: 'ABOUT', company: 'ABOUT', 'o-kompanii': 'ABOUT', 'o-nas': 'ABOUT',
    contacts: 'CONTACTS', contact: 'CONTACTS', kontakty: 'CONTACTS',
  };

  function classifyNavUrl(rawUrl?: string): { targetType: string; target: string; pageId?: string; url?: string } {
    if (!rawUrl) return { targetType: 'HOME', target: '' };
    if (rawUrl.startsWith('#')) {
      const key = rawUrl.replace(/^#/, '').toLowerCase();
      return { targetType: 'HOME_SECTION', target: (SECTION_TARGETS[key] || key).toUpperCase() };
    }
    let path = '';
    try { path = new URL(rawUrl).pathname; } catch { path = rawUrl; }
    const clean = path.replace(/^\/+|\/+$/g, '');
    const lastSeg = clean.split('/').pop() || '';
    if (!clean || clean === 'index' || clean === 'home') return { targetType: 'HOME', target: '', pageId: homepageId };

    // Single-segment well-known section slugs resolve to homepage sections —
    // single-page templates render these as anchors, not separate routes.
    if (!clean.includes('/')) {
      const section = SECTION_TARGETS[clean] || SECTION_TARGETS[lastSeg];
      if (section) return { targetType: 'HOME_SECTION', target: section };
    }

    const pageId = (rawUrl && pageByUrl.get(rawUrl)) || pageBySlug.get(clean) || pageBySlug.get(lastSeg);
    if (pageId) return { targetType: 'PAGE', target: clean || lastSeg, pageId };

    const section = SECTION_TARGETS[clean] || SECTION_TARGETS[lastSeg];
    if (section) return { targetType: 'HOME_SECTION', target: section };

    // Unresolvable crawler links stay as external URLs pointing at the source
    // site — honest provenance, never a dead in-app anchor.
    if (/^https?:\/\//.test(rawUrl)) return { targetType: 'EXTERNAL_URL', target: '', url: rawUrl };
    return { targetType: 'CUSTOM_URL', target: '', url: rawUrl.startsWith('/') ? rawUrl : `/${clean}` };
  }

  // Menu items are deduplicated by resolved-target identity (page/url/target
  // inside the same parent chain), not by label — a label is editable content.
  // An existing row that resolves to the same destination is updated in place:
  // its label is preserved (a manual rename survives regeneration) while
  // position/flags/ownership are refreshed. Truly stale generated rows are
  // removed by the keptIds cleanup at the end of the import.
  const existingMenuItems = menu
    ? await prisma.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { createdAt: 'asc' } })
    : [];
  const menuItemById = new Map<string, any>(existingMenuItems.map((m: any) => [m.id, m]));
  // HOME is a singleton destination — its identity must not depend on whether
  // pageId happened to be resolved when the row was first written.
  const itemIdentity = (m: any) =>
    m.targetType === 'HOME' ? 'HOME' : `${m.pageId || ''}|${m.url || ''}|${m.targetType || ''}|${m.target || ''}`;
  const existingItemByKey = new Map<string, any>();
  for (const m of existingMenuItems) {
    const chain = [itemIdentity(m)];
    let p = m.parentId ? menuItemById.get(m.parentId) : null;
    while (p) { chain.unshift(itemIdentity(p)); p = p.parentId ? menuItemById.get(p.parentId) : null; }
    const key = chain.join('>');
    if (!existingItemByKey.has(key)) existingItemByKey.set(key, m);
  }

  async function createMenuItems(items: any[], menuId: string, parentId: string | null = null, sortStart = 0, parentKey = '') {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const resolved = classifyNavUrl(item.url);
      const identity = resolved.targetType === 'HOME'
        ? 'HOME'
        : `${resolved.pageId || ''}|${resolved.url || ''}|${resolved.targetType || ''}|${resolved.target || ''}`;
      const key = parentKey ? `${parentKey}>${identity}` : identity;
      const flags = {
        visible: item.visible !== false,
        showInHeader: item.showInHeader !== false,
        showInFooter: item.showInFooter !== false,
        showOnHomepage: item.showOnHomepage !== false,
      };
      const existing = existingItemByKey.get(key);
      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            parentId, sortOrder: sortStart + i,
            pageId: resolved.pageId ?? null,
            url: resolved.url ?? null,
            targetType: resolved.targetType,
            target: resolved.target || null,
            ...flags, ...ownership
          } as any
        });
        keptMenuItemIds.add(existing.id);
        if (item.children?.length) {
          await createMenuItems(item.children, menuId, existing.id, 0, key);
        }
        continue;
      }
      const data: any = {
        siteId,
        menuId,
        parentId,
        label: item.label || '—',
        sortOrder: sortStart + i,
        pageId: resolved.pageId ?? null,
        url: resolved.url ?? null,
        targetType: resolved.targetType,
        target: resolved.target || null,
        ...flags,
        ...ownership
      };
      const created = await prisma.menuItem.create({ data } as any);
      keptMenuItemIds.add(created.id);
      if (item.children?.length) {
        await createMenuItems(item.children, menuId, created.id, 0, key);
      }
    }
  }

  const nav = (options.content as any).navigation ?? [];
  if (nav.length > 0 && menu) {
    // Guarantee a Home entry: crawler nav often omits it.
    const hasHome = nav.some((i: any) => {
      try { const p = new URL(i.url || '', 'http://x').pathname.replace(/^\/+|\/+$/g, ''); return !p || p === 'index'; } catch { return false; }
    });
    const fullNav = hasHome ? nav : [{ label: 'Главная', url: '/' }, ...nav];
    await createMenuItems(fullNav, menu.id);
  }

  async function ensureCollectionPage(title: string, baseSlug: string, blockType: string) {
    const existing = await prisma.page.findUnique({
      where: { siteId_slug: { siteId, slug: baseSlug } },
      select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true, slug: true }
    });
    if (existing && existing.sourceType === 'MANUAL') return undefined;
    if (existing && existing.manualModifiedAt) {
      keptPageIds.add(existing.id);
      return existing;
    }
    const slug = existing ? existing.slug : uniqueSlug(baseSlug);
    const data: any = {
      siteId,
      title,
      slug,
      isHomepage: false,
      blocks: [{ type: blockType }] as any,
      status: PageStatus.PUBLISHED,
      sourceType: generatedSource,
      ...ownership
    };
    const record = existing ? await prisma.page.update({ where: { id: existing.id }, data }) : await prisma.page.create({ data });
    keptPageIds.add(record.id);
    return record;
  }

  // Localized system labels — customer-visible fallback strings must match
  // the site language, never hardcoded English on a Russian site.
  const lang = siteSettingsBase?.language === 'en' ? 'en' : 'ru';
  const L: Record<string, string> = lang === 'en'
    ? { home: 'Home', services: 'Services', projects: 'Projects', news: 'News', contacts: 'Contacts' }
    : { home: 'Главная', services: 'Услуги', projects: 'Проекты', news: 'Новости', contacts: 'Контакты' };

  const home = await prisma.page.findFirst({ where: { siteId, isHomepage: true }, select: { id: true, generatedByRunId: true } });
  if (nav.length === 0 && home && menu) {
    const homeItem = await prisma.menuItem.create({
      data: { siteId, menuId: menu.id, label: L.home, pageId: home.id, targetType: 'HOME', target: '', sortOrder: 0, visible: true, showInFooter: true, showInHeader: true, showOnHomepage: true, ...ownership } as any
    });
    keptMenuItemIds.add(homeItem.id);

    const fallbackCollectionItem = async (label: string, slug: string, blockType: string, targetType: string, target: string, sortOrder: number) => {
      const page = await ensureCollectionPage(label, slug, blockType);
      if (!page) return;
      const mi = await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label, pageId: page.id, targetType, target, sortOrder, visible: true, showInHeader: true, showInFooter: true, showOnHomepage: true, ...ownership } });
      keptMenuItemIds.add(mi.id);
    };

    const sort = [1, 2, 3, 4];
    if (options.content.services.length > 0) await fallbackCollectionItem(L.services, 'services', 'services', 'COLLECTION', 'SERVICES', sort.shift()!);
    if (options.content.projects.length > 0) await fallbackCollectionItem(L.projects, 'projects', 'projects', 'COLLECTION', 'PROJECTS', sort.shift()!);
    if (options.content.news.length > 0) await fallbackCollectionItem(L.news, 'news', 'news', 'COLLECTION', 'NEWS', sort.shift()!);
    const existingContacts = await prisma.page.findUnique({ where: { siteId_slug: { siteId, slug: 'contacts' } }, select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true } });
    if (!existingContacts) {
      await fallbackCollectionItem(L.contacts, 'contacts', 'contacts', 'HOME_SECTION', 'CONTACTS', sort.shift()!);
    } else if ((existingContacts.sourceType !== 'MANUAL' && !existingContacts.manualModifiedAt) || regenerateContent) {
      await prisma.page.update({ where: { id: existingContacts.id }, data: { title: L.contacts, blocks: [{ type: 'contacts' }] as any, status: PageStatus.PUBLISHED, sourceType: generatedSource, ...ownership } });
      keptPageIds.add(existingContacts.id);
    }
  }

  // Resolve hero/about images in themeConfig after media import so validation/rendering can use DB media IDs.
  if (themeConfig.hero) themeConfig.hero = resolveThemeImage(themeConfig.hero);
  if (themeConfig.about) themeConfig.about = resolveThemeImage(themeConfig.about);
  await prisma.site.update({ where: { id: siteId }, data: { themeConfig } as any });
  await prisma.demoVariant.update({ where: { id: demoVariant.id }, data: { themeConfig } as any });

  const homepage = await prisma.page.findFirst({ where: { siteId, isHomepage: true }, select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true } });
  // Never overwrite a manually edited homepage on regeneration.
  if (homepage && (!runId || (homepage.sourceType !== 'MANUAL' && !homepage.manualModifiedAt))) {
    const hero = options.content.hero;
    const cta = options.content.cta;
    const about = options.content.about;
    const sections = options.content.homepageSections || [];

    // Stable block ids: deterministic per type occurrence, stable across regenerations.
    const counters = new Map<string, number>();
    const blockId = (type: string) => {
      const n = (counters.get(type) || 0) + 1;
      counters.set(type, n);
      return `${type}-${n}`;
    };

    const heroBlock = hero?.title ? {
      id: blockId('hero'), type: 'hero', enabled: true,
      title: hero.title,
      subtitle: hero.subtitle,
      imageId: mapImageId(hero.imageId),
      // No invented CTAs: render the button only when the source provides both
      // a label and a real target.
      ...(hero.buttonLabel && hero.buttonUrl ? { buttonLabel: hero.buttonLabel, buttonUrl: hero.buttonUrl } : {})
    } : null;
    const aboutBlock = about?.content ? {
      id: blockId('about'), type: 'about', enabled: true,
      heading: about.heading,
      content: about.content,
      imageId: mapImageId(about.imageId)
    } : null;
    const ctaBlock = cta?.title ? {
      id: blockId('cta'), type: 'cta', enabled: true,
      title: cta.title,
      description: cta.description,
      ...(cta.buttonLabel && cta.buttonUrl ? { buttonLabel: cta.buttonLabel, buttonUrl: cta.buttonUrl } : {})
    } : null;

    const entityCount: Record<string, number> = {
      services: options.content.services.length,
      projects: options.content.projects.length,
      news: options.content.news.length,
      vacancies: options.content.vacancies.length,
    };
    const defaultLimits: Record<string, number> = { services: 6, projects: 4, news: 3, vacancies: 3 };

    const collectionBlock = (s: any) => ({
      id: blockId(s.type), type: s.type, enabled: s.enabled !== false,
      heading: s.title || L[s.type] || s.type,
      limit: s.limit ?? defaultLimits[s.type],
    });

    const homeBlocks: any[] = [];
    if (sections.length > 0) {
      // Canonical composition: array order of generated homepageSections.
      for (const s of sections) {
        const enabled = s.enabled !== false;
        switch (s.type) {
          case 'hero': if (heroBlock) homeBlocks.push({ ...heroBlock, enabled }); break;
          case 'about': if (aboutBlock) homeBlocks.push({ ...aboutBlock, enabled }); break;
          case 'cta': if (ctaBlock) homeBlocks.push({ ...ctaBlock, enabled }); break;
          case 'services': case 'projects': case 'news': case 'vacancies':
            if ((entityCount[s.type] || 0) > 0) homeBlocks.push(collectionBlock(s));
            break;
          case 'contacts': homeBlocks.push({ id: blockId('contacts'), type: 'contacts', enabled, heading: s.title || L.contacts }); break;
          default: break;
        }
      }
      // hero/about/cta must live in Page.blocks even if the generator omitted
      // them from homepageSections.
      if (!homeBlocks.some((b) => b.type === 'hero') && heroBlock) homeBlocks.unshift(heroBlock);
      if (!homeBlocks.some((b) => b.type === 'about') && aboutBlock) homeBlocks.splice(Math.min(1, homeBlocks.length), 0, aboutBlock);
      if (!homeBlocks.some((b) => b.type === 'cta') && ctaBlock) homeBlocks.push(ctaBlock);
    } else {
      // No generated sections: legacy fixed-order fallback.
      if (heroBlock) homeBlocks.push(heroBlock);
      if (aboutBlock) homeBlocks.push(aboutBlock);
      for (const type of ['services', 'projects', 'news', 'vacancies']) {
        if ((entityCount[type] || 0) > 0) homeBlocks.push(collectionBlock({ type, enabled: true }));
      }
      if (ctaBlock) homeBlocks.push(ctaBlock);
    }

    await prisma.page.update({
      where: { id: homepage.id },
      data: { blocks: homeBlocks as any }
    });
  }

  if (runId && regenerateContent) {
    await prisma.page.deleteMany(staleContentWhere(siteId, runId, keptPageIds) as any);
    await prisma.service.deleteMany(staleContentWhere(siteId, runId, keptServiceIds) as any);
    await prisma.project.deleteMany(staleContentWhere(siteId, runId, keptProjectIds) as any);
    await prisma.product.deleteMany(staleContentWhere(siteId, runId, keptProductIds) as any);
    await prisma.newsPost.deleteMany(staleContentWhere(siteId, runId, keptNewsIds) as any);
    await prisma.vacancy.deleteMany(staleContentWhere(siteId, runId, keptVacancyIds) as any);
    await prisma.menuItem.deleteMany(staleGeneratedWhere(siteId, runId, keptMenuItemIds) as any);
    await prisma.media.deleteMany(staleGeneratedWhere(siteId, runId, keptMediaIds) as any);
  }

  const stats = {
    pages: await prisma.page.count({ where: { siteId } as any }),
    services: await prisma.service.count({ where: { siteId } as any }),
    projects: await prisma.project.count({ where: { siteId } as any }),
    news: await prisma.newsPost.count({ where: { siteId } as any }),
    vacancies: await prisma.vacancy.count({ where: { siteId } as any }),
    media: await prisma.media.count({ where: { siteId } as any }),
    menuItems: await prisma.menuItem.count({ where: { siteId } as any })
  };

  return { siteId, siteSlug: options.siteSlug, previewSlug: options.previewSlug, demoVariantId: demoVariant.id, stats };
}
