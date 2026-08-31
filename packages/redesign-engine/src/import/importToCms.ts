import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { ExtractedContent } from '../../../content-schema/dist/index.js';
import { LocalFilesystemMediaStorage } from '../../../media-storage/dist/index.js';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё\-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ImportOptions {
  leadId: string;
  siteName: string;
  siteSlug: string;
  previewSlug: string;
  templateId: string;
  content: ExtractedContent;
  artifactDir: string;
  storageBaseUrl: string;
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

export async function importToCms(options: ImportOptions, prisma = new PrismaClient()): Promise<ImportResult> {
  await mkdir(options.artifactDir, { recursive: true });
  await writeFile(join(options.artifactDir, 'content.json'), JSON.stringify(options.content, null, 2));

  const previewUrl = `http://localhost:3000/showcase/${options.previewSlug}`;

  // Create site with site-specific theme config.
  const site = await prisma.site.create({
    data: {
      leadId: options.leadId,
      name: options.siteName,
      slug: options.siteSlug,
      previewToken: options.previewSlug,
      templateId: options.templateId,
      themeConfig: options.content.theme ? { ...options.content.theme, homepageSections: options.content.homepageSections, hero: options.content.hero, about: options.content.about, cta: options.content.cta } : ({} as any),
      settings: { previewUrl } as any,
      status: 'DRAFT'
    } as any
  });

  const siteId = site.id;

  const demoVariant = await (prisma as any).demoVariant.create({
    data: {
      siteId,
      templateId: options.templateId,
      previewToken: options.previewSlug,
      name: options.templateId,
      isPreferred: true,
      status: 'ACTIVE',
      themeConfig: site.themeConfig as any
    } as any
  });

  await (prisma as any).site.update({
    where: { id: siteId },
    data: { preferredDemoVariantId: demoVariant.id } as any
  });

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

  // Download and store media.
  const mediaMap = new Map<string, any>();
  for (const m of options.content.media || []) {
    const sourceUrl = m.sourceUrl;
    if (!sourceUrl) continue;
    try {
      const resp = await fetch(sourceUrl);
      if (!resp.ok) {
        console.warn('media fetch non-ok', sourceUrl, resp.status);
        continue;
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      const mime = resp.headers.get('content-type') || 'image/jpeg';
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
          alt: m.alt
        } as any
      });
      mediaMap.set(sourceUrl, dbMedia);
    } catch (err) {
      console.warn('media import failed', sourceUrl, err);
    }
  }

  const logoMedia = options.content.branding?.logo?.sourceUrl ? mediaMap.get(options.content.branding.logo.sourceUrl) : undefined;
  const faviconMedia = options.content.branding?.favicon?.sourceUrl ? mediaMap.get(options.content.branding.favicon.sourceUrl) : undefined;

  // Create site settings with extracted identity and theme.
  await prisma.siteSettings.create({
    data: {
      siteId,
      companyName: options.content.company?.shortName ?? options.content.company?.name ?? options.content.branding?.companyName ?? options.siteName,
      legalName: options.content.company?.legalName,
      unp: options.content.company?.unp,
      founded: options.content.company?.founded,
      employees: options.content.company?.employees,
      logoMediaId: logoMedia?.id,
      faviconMediaId: faviconMedia?.id,
      phone: options.content.company?.phone,
      email: options.content.company?.email,
      address: options.content.company?.address,
      workingHours: options.content.company?.workingHours,
      socialLinks: options.content.company?.socialLinks ?? [],
      contacts: options.content.contacts ?? {},
      primaryColor: options.content.branding?.primaryColor ?? options.content.theme?.primaryColor,
      secondaryColor: options.content.branding?.secondaryColor ?? options.content.theme?.secondaryColor,
      defaultSeoTitle: options.content.branding?.defaultSeoTitle,
      defaultSeoDescription: options.content.branding?.defaultSeoDescription,
      previewUrl,
      language: 'ru',
      timezone: 'Europe/Minsk'
    } as any
  });

  function mapImageId(sourceUrl?: string): string | undefined {
    if (!sourceUrl) return undefined;
    if (sourceUrl.startsWith('http')) {
      const dbm = mediaMap.get(sourceUrl);
      return dbm?.id;
    }
    return sourceUrl;
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

  function mediaFromSourceUrl(sourceUrl?: string) {
    return sourceUrl ? mediaMap.get(sourceUrl) : undefined;
  }

  // Pages
  for (const p of options.content.pages || []) {
    await prisma.page.create({
      data: {
        siteId,
        title: p.title,
        slug: uniqueSlug(p.slug),
        isHomepage: p.isHomepage,
        blocks: mapBlocks(p.blocks),
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        sourceUrl: p.sourceUrl,
        sourceType: p.sourceType,
        status: 'PUBLISHED',
        publishedAt: new Date()
      } as any
    });
  }

  // Services
  for (const s of options.content.services || []) {
    const image = mediaFromSourceUrl(s.image?.sourceUrl);
    await prisma.service.create({
      data: {
        siteId,
        title: s.title,
        slug: uniqueSlug(s.slug),
        shortDescription: s.shortDescription,
        blocks: mapBlocks(s.blocks),
        imageId: image?.id,
        seoTitle: s.seoTitle,
        seoDescription: s.seoDescription,
        sourceUrl: s.sourceUrl,
        sourceType: s.sourceType,
        status: 'PUBLISHED',
        sortOrder: 0
      } as any
    });
  }

  // Projects
  for (const p of options.content.projects || []) {
    const cover = mediaFromSourceUrl(p.coverImage?.sourceUrl);
    const project = await prisma.project.create({
      data: {
        siteId,
        title: p.title,
        slug: uniqueSlug(p.slug),
        excerpt: p.excerpt,
        category: p.category,
        location: p.location,
        completionDate: p.completionDate,
        blocks: mapBlocks(p.blocks),
        coverImageId: cover?.id,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        sourceUrl: p.sourceUrl,
        sourceType: p.sourceType,
        status: 'PUBLISHED',
        publishedAt: new Date()
      } as any
    });

    for (const img of p.gallery || []) {
      const dbm = mediaFromSourceUrl(img.sourceUrl);
      if (dbm) {
        await prisma.projectMedia.create({
          data: {
            projectId: project.id,
            mediaId: dbm.id,
            sortOrder: 0
          } as any
        });
      }
    }
  }

  // News
  for (const n of options.content.news || []) {
    const cover = mediaFromSourceUrl(n.coverImage?.sourceUrl);
    await prisma.newsPost.create({
      data: {
        siteId,
        title: n.title,
        slug: uniqueSlug(n.slug),
        excerpt: n.excerpt,
        blocks: mapBlocks(n.blocks),
        coverImageId: cover?.id,
        seoTitle: n.seoTitle,
        seoDescription: n.seoDescription,
        sourceUrl: n.sourceUrl,
        sourceType: n.sourceType,
        status: 'PUBLISHED',
        publishedAt: n.publishedAt ? new Date(n.publishedAt) : new Date()
      } as any
    });
  }

  // Vacancies
  for (const v of options.content.vacancies || []) {
    await prisma.vacancy.create({
      data: {
        siteId,
        title: v.title,
        slug: uniqueSlug(v.slug),
        location: v.location,
        description: v.description,
        requirements: v.requirements,
        conditions: v.conditions,
        contact: v.contact,
        sourceUrl: v.sourceUrl,
        status: 'PUBLISHED',
        publishedAt: new Date()
      } as any
    });
  }

  // Main menu with hierarchy preserved.
  const menu = await prisma.menu.create({
    data: { siteId, name: 'main', isMain: true } as any
  });

  const allPages = await prisma.page.findMany({ where: { siteId } as any, select: { id: true, sourceUrl: true, isHomepage: true, slug: true } });
  const pageByUrl = new Map<string, string>(allPages.filter((p: any) => p.sourceUrl).map((p: any) => [p.sourceUrl, p.id]));
  const pageBySlug = new Map<string, string>(allPages.map((p: any) => [p.slug, p.id]));

  async function createMenuItems(items: any[], parentId: string | null = null, sortStart = 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let pageId: string | undefined;
      if (item.url) {
        pageId = pageByUrl.get(item.url);
        if (!pageId) {
          try {
            const u = new URL(item.url);
            const slug = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/').pop() || '';
            pageId = pageBySlug.get(slug);
          } catch {}
        }
      }
      const data: any = {
        siteId,
        menuId: menu.id,
        parentId,
        label: item.label || '—',
        sortOrder: sortStart + i,
        pageId,
        url: pageId ? undefined : (item.url ?? undefined)
      };
      const created = await prisma.menuItem.create({ data } as any);
      if (item.children?.length) {
        await createMenuItems(item.children, created.id, 0);
      }
    }
  }

  const nav = (options.content as any).navigation ?? [];
  if (nav.length > 0) {
    await createMenuItems(nav);
  }

  // Fallback generic menu if no navigation was extracted.
  const home = await prisma.page.findFirst({ where: { siteId, isHomepage: true } as any });
  if (nav.length === 0 && home) {
    const sort = [1, 2, 3, 4];
    await prisma.menuItem.create({
      data: { siteId, menuId: menu.id, label: 'Главная', pageId: home.id, sortOrder: 0, showInFooter: true, showInHeader: true } as any
    });

    if (options.content.services.length > 0) {
      const sp = await prisma.page.create({
        data: { siteId, title: 'Услуги', slug: uniqueSlug('services'), isHomepage: false, blocks: [{ type: 'services' }], status: 'PUBLISHED', sourceType: 'MANUAL' } as any
      });
      await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Услуги', pageId: sp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } as any });
    }
    if (options.content.projects.length > 0) {
      const pp = await prisma.page.create({
        data: { siteId, title: 'Объекты', slug: uniqueSlug('projects'), isHomepage: false, blocks: [{ type: 'projects' }], status: 'PUBLISHED', sourceType: 'MANUAL' } as any
      });
      await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Объекты', pageId: pp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } as any });
    }
    if (options.content.news.length > 0) {
      const np = await prisma.page.create({
        data: { siteId, title: 'Новости', slug: uniqueSlug('news'), isHomepage: false, blocks: [{ type: 'news' }], status: 'PUBLISHED', sourceType: 'MANUAL' } as any
      });
      await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Новости', pageId: np.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } as any });
    }
    const contactsPage = await prisma.page.findFirst({ where: { siteId, slug: 'contacts' } as any });
    if (!contactsPage) {
      const cp = await prisma.page.create({
        data: { siteId, title: 'Контакты', slug: uniqueSlug('contacts'), isHomepage: false, blocks: [{ type: 'contacts' }], status: 'PUBLISHED', sourceType: 'MANUAL' } as any
      });
      await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Контакты', pageId: cp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } as any });
    }
  }

  // Compose the homepage from CMS entities.
  const homepage = await prisma.page.findFirst({ where: { siteId, isHomepage: true } as any });
  if (homepage) {
    const hero = options.content.hero;
    const cta = options.content.cta;
    const about = options.content.about;
    const sections = options.content.homepageSections || [];
    const sectionTitle = (type: string, fallback: string) => sections.find((s) => s.type === type)?.title || fallback;
    const sectionLimit = (type: string, fallback: number) => sections.find((s) => s.type === type)?.limit ?? fallback;

    const homeBlocks: any[] = [];
    if (hero?.title) {
      homeBlocks.push({
        type: 'hero',
        title: hero.title,
        subtitle: hero.subtitle,
        imageId: mapImageId(hero.imageId),
        buttonLabel: hero.buttonLabel || 'Связаться',
        buttonUrl: hero.buttonUrl || '/contacts'
      });
    }
    if (about?.heading && about?.content) {
      homeBlocks.push({
        type: 'about',
        heading: about.heading,
        content: about.content,
        imageId: mapImageId(about.imageId)
      });
    }
    if (sections.find((s) => s.type === 'services' && s.enabled) && options.content.services.length > 0) {
      homeBlocks.push({ type: 'services', heading: sectionTitle('services', 'Услуги'), limit: sectionLimit('services', 6) });
    }
    if (sections.find((s) => s.type === 'projects' && s.enabled) && options.content.projects.length > 0) {
      homeBlocks.push({ type: 'projects', heading: sectionTitle('projects', 'Объекты'), limit: sectionLimit('projects', 4) });
    }
    if (sections.find((s) => s.type === 'news' && s.enabled) && options.content.news.length > 0) {
      homeBlocks.push({ type: 'news', heading: sectionTitle('news', 'Новости'), limit: sectionLimit('news', 3) });
    }
    if (sections.find((s) => s.type === 'vacancies' && s.enabled) && options.content.vacancies.length > 0) {
      homeBlocks.push({ type: 'vacancies', heading: sectionTitle('vacancies', 'Вакансии'), limit: sectionLimit('vacancies', 3) });
    }
    if (cta?.title) {
      homeBlocks.push({
        type: 'cta',
        title: cta.title,
        description: cta.description,
        buttonLabel: cta.buttonLabel || 'Связаться',
        buttonUrl: cta.buttonUrl || '/contacts'
      });
    }
    if (sections.find((s) => s.type === 'contacts' && s.enabled)) {
      homeBlocks.push({ type: 'contacts', heading: sectionTitle('contacts', 'Контакты') });
    }

    await prisma.page.update({
      where: { id: homepage.id },
      data: { blocks: homeBlocks } as any
    });
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
