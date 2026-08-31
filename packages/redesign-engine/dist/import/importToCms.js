import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { LocalFilesystemMediaStorage } from '../../../media-storage/dist/index.js';
function slugify(input) {
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
export async function importToCms(options, prisma = new PrismaClient()) {
    await mkdir(options.artifactDir, { recursive: true });
    await writeFile(join(options.artifactDir, 'content.json'), JSON.stringify(options.content, null, 2));
    let storage;
    // Create site
    const site = await prisma.site.create({
        data: {
            leadId: options.leadId,
            name: options.siteName,
            slug: options.siteSlug,
            previewToken: options.previewSlug,
            templateId: options.templateId,
            status: 'DRAFT'
        }
    });
    const siteId = site.id;
    const mediaDir = join('data/generated/sites', siteId, 'media');
    await mkdir(mediaDir, { recursive: true });
    storage = new LocalFilesystemMediaStorage({ baseDir: mediaDir, baseUrl: `/site-media/${siteId}` });
    const usedSlugs = new Set();
    function uniqueSlug(base) {
        let s = base || 'untitled';
        let i = 0;
        while (usedSlugs.has(s))
            s = `${base || 'untitled'}-${++i}`;
        usedSlugs.add(s);
        return s;
    }
    // Settings
    await prisma.siteSettings.create({
        data: {
            siteId,
            companyName: options.content.branding?.companyName ?? options.content.company?.name ?? options.siteName,
            phone: options.content.company?.phone,
            email: options.content.company?.email,
            address: options.content.company?.address,
            workingHours: options.content.company?.workingHours,
            socialLinks: options.content.company?.socialLinks ?? [],
            primaryColor: options.content.branding?.primaryColor,
            secondaryColor: options.content.branding?.secondaryColor,
            defaultSeoTitle: options.content.branding?.defaultSeoTitle,
            defaultSeoDescription: options.content.branding?.defaultSeoDescription
        }
    });
    // Download media
    const mediaMap = new Map();
    for (const m of options.content.media || []) {
        const sourceUrl = m.sourceUrl;
        if (!sourceUrl)
            continue;
        try {
            const resp = await fetch(sourceUrl);
            if (!resp.ok)
                continue;
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
                }
            });
            mediaMap.set(sourceUrl, dbMedia);
        }
        catch (err) {
            console.warn('media import failed', sourceUrl, err);
        }
    }
    function mapBlocks(blocks) {
        return blocks.map((b) => {
            if (b.imageId && typeof b.imageId === 'string' && b.imageId.startsWith('http')) {
                const dbm = mediaMap.get(b.imageId);
                return { ...b, imageId: dbm?.id };
            }
            return b;
        });
    }
    // Pages
    const homepageId = randomId();
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
            }
        });
    }
    // Services
    for (const s of options.content.services || []) {
        const imgUrl = s.image?.sourceUrl;
        const image = imgUrl ? mediaMap.get(imgUrl) : undefined;
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
            }
        });
    }
    // Projects
    for (const p of options.content.projects || []) {
        const coverUrl = p.coverImage?.sourceUrl;
        const cover = coverUrl ? mediaMap.get(coverUrl) : undefined;
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
            }
        });
        for (const img of p.gallery || []) {
            const imgUrl = img.sourceUrl;
            if (!imgUrl)
                continue;
            const dbm = mediaMap.get(imgUrl);
            if (dbm) {
                await prisma.projectMedia.create({
                    data: {
                        projectId: project.id,
                        mediaId: dbm.id,
                        sortOrder: 0
                    }
                });
            }
        }
    }
    // News
    for (const n of options.content.news || []) {
        const coverUrl = n.coverImage?.sourceUrl;
        const cover = coverUrl ? mediaMap.get(coverUrl) : undefined;
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
            }
        });
    }
    // Main menu
    const menu = await prisma.menu.create({
        data: { siteId, name: 'main', isMain: true }
    });
    const allPages = await prisma.page.findMany({ where: { siteId }, select: { id: true, sourceUrl: true, isHomepage: true } });
    const pageByUrl = new Map(allPages.filter((p) => p.sourceUrl).map((p) => [p.sourceUrl, p.id]));
    async function createMenuItems(items, parentId = null, sortStart = 0) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const pageId = item.url ? pageByUrl.get(item.url) : undefined;
            const data = {
                siteId,
                menuId: menu.id,
                parentId,
                label: item.label || '—',
                sortOrder: sortStart + i,
                pageId,
                url: pageId ? undefined : (item.url ?? undefined)
            };
            const created = await prisma.menuItem.create({ data });
            if (item.children?.length) {
                await createMenuItems(item.children, created.id, 0);
            }
        }
    }
    const nav = options.content.navigation ?? [];
    if (nav.length > 0) {
        await createMenuItems(nav);
    }
    // Fallback generic menu if no navigation was extracted
    const home = await prisma.page.findFirst({ where: { siteId, isHomepage: true } });
    if (nav.length === 0 && home) {
        await prisma.menuItem.create({
            data: { siteId, menuId: menu.id, label: 'Главная', pageId: home.id, sortOrder: 0 }
        });
        const sort = [1, 2, 3, 4];
        if (options.content.services.length > 0) {
            const sp = await prisma.page.create({
                data: { siteId, title: 'Услуги', slug: uniqueSlug('services'), isHomepage: false, blocks: [{ type: 'services' }], status: 'PUBLISHED', sourceType: 'MANUAL' }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Услуги', pageId: sp.id, sortOrder: sort.shift() } });
        }
        if (options.content.projects.length > 0) {
            const pp = await prisma.page.create({
                data: { siteId, title: 'Объекты', slug: uniqueSlug('projects'), isHomepage: false, blocks: [{ type: 'projects' }], status: 'PUBLISHED', sourceType: 'MANUAL' }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Объекты', pageId: pp.id, sortOrder: sort.shift() } });
        }
        if (options.content.news.length > 0) {
            const np = await prisma.page.create({
                data: { siteId, title: 'Новости', slug: uniqueSlug('news'), isHomepage: false, blocks: [{ type: 'news' }], status: 'PUBLISHED', sourceType: 'MANUAL' }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Новости', pageId: np.id, sortOrder: sort.shift() } });
        }
        const contactsPage = await prisma.page.findFirst({ where: { siteId, slug: 'contacts' } });
        if (!contactsPage) {
            const cp = await prisma.page.create({
                data: { siteId, title: 'Контакты', slug: uniqueSlug('contacts'), isHomepage: false, blocks: [{ type: 'contacts' }], status: 'PUBLISHED', sourceType: 'MANUAL' }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Контакты', pageId: cp.id, sortOrder: sort.shift() } });
        }
    }
    return { siteId, siteSlug: options.siteSlug, previewSlug: options.previewSlug };
}
