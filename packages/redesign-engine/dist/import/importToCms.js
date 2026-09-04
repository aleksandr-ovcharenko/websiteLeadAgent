import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient, PageStatus, ContentSourceType } from '@prisma/client';
import { LocalFilesystemMediaStorage } from '../../../media-storage/dist/index.js';
function slugify(input) {
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
export function cleanPhoneDigits(input) {
    return input.replace(/[^\d+]/g, '');
}
export function normalizePhone(input) {
    if (!input)
        return undefined;
    const phoneRe = /(\+\d[\d\s\(\)\-]{5,}|\d[\d\s\(\)\-]{6,})/g;
    const candidates = [];
    let m;
    while ((m = phoneRe.exec(input)) !== null) {
        const raw = m[0].trim();
        const digits = raw.replace(/[^\d]/g, '');
        if (digits.length >= 7)
            candidates.push({ raw, digits });
    }
    if (!candidates.length)
        return input.trim().replace(/[^\d+\s\(\)\-]/g, '').replace(/\s+/g, ' ').trim() || undefined;
    candidates.sort((a, b) => {
        const aHasPlus = a.raw.startsWith('+') ? 1 : 0;
        const bHasPlus = b.raw.startsWith('+') ? 1 : 0;
        if (aHasPlus !== bHasPlus)
            return bHasPlus - aHasPlus;
        if (b.digits.length !== a.digits.length)
            return b.digits.length - a.digits.length;
        return a.raw.length - b.raw.length;
    });
    const best = candidates[0].raw;
    return best.replace(/[^\d+\s\(\)\-]/g, '').replace(/\s+/g, ' ').trim();
}
const GENERIC_NAME_RE = /^\s*(home|about(?:\s+us)?|contacts?|services?|projects?|news|careers?|vacancies?|главная|о компании|о нас|контакты|услуги|проекты|новости|вакансии|о-нас|о-компании)\s*$/iu;
export function isGenericCompanyName(name) {
    if (!name)
        return true;
    if (name.length < 2)
        return true;
    return GENERIC_NAME_RE.test(name);
}
function staleGeneratedWhere(siteId, runId, keptIds) {
    return {
        where: {
            siteId,
            AND: [
                { generatedByRunId: { not: null } },
                { generatedByRunId: { not: runId } },
                { id: { notIn: [...keptIds] } },
            ],
        }
    };
}
function staleContentWhere(siteId, runId, keptIds) {
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
export async function importToCms(options, prisma = new PrismaClient()) {
    await mkdir(options.artifactDir, { recursive: true });
    await writeFile(join(options.artifactDir, 'content.json'), JSON.stringify(options.content, null, 2));
    const runId = options.runId;
    const regenerateContent = options.regenerateContent ?? false;
    const ownership = runId ? { generatedByRunId: runId, generatedByDemoVariantId: '' } : {};
    const generatedSource = ContentSourceType.GENERATED;
    const previewUrl = `http://localhost:3000/showcase/${options.previewSlug}`;
    const themeConfig = options.content.theme ? { ...options.content.theme, homepageSections: options.content.homepageSections, hero: options.content.hero, about: options.content.about, cta: options.content.cta } : {};
    const site = await prisma.site.upsert({
        where: { leadId: options.leadId },
        update: { name: options.siteName, slug: options.siteSlug, previewToken: options.previewSlug, templateId: options.templateId, themeConfig, settings: { previewUrl }, status: 'DRAFT' },
        create: { leadId: options.leadId, name: options.siteName, slug: options.siteSlug, previewToken: options.previewSlug, templateId: options.templateId, themeConfig: themeConfig, settings: { previewUrl }, status: 'DRAFT' }
    });
    const siteId = site.id;
    const demoVariant = await prisma.demoVariant.upsert({
        where: { previewToken: options.previewSlug },
        update: { siteId, templateId: options.templateId, name: options.templateId, isPreferred: true, status: 'ACTIVE', themeConfig, ...(runId ? { generatedByRunId: runId } : {}) },
        create: { siteId, templateId: options.templateId, previewToken: options.previewSlug, name: options.templateId, isPreferred: true, status: 'ACTIVE', themeConfig: themeConfig, ...(runId ? { generatedByRunId: runId } : {}) }
    });
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
    const usedSlugs = new Set();
    function uniqueSlug(base) {
        let s = base || 'untitled';
        let i = 0;
        while (usedSlugs.has(s))
            s = `${base || 'untitled'}-${++i}`;
        usedSlugs.add(s);
        return s;
    }
    const mediaMap = new Map();
    const allExistingMedia = await prisma.media.findMany({
        where: { siteId },
        select: { id: true, sourceUrl: true, generatedByRunId: true, generatedByDemoVariantId: true }
    });
    for (const m of allExistingMedia) {
        if (m.sourceUrl)
            mediaMap.set(m.sourceUrl, m);
    }
    const keptMediaIds = new Set();
    // Media ownership semantics:
    // - sourceUrl is the immutable provenance/identity of an image asset.
    // - A media row is a per-site copy of that asset; it is reused across runs by sourceUrl.
    // - generatedByRunId records the run that originally fetched/stored the asset (provenance),
    //   NOT the most recent run that referenced it. Current-run usage is expressed by keptMediaIds.
    for (const m of options.content.media || []) {
        const sourceUrl = m.sourceUrl;
        if (!sourceUrl)
            continue;
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
                    alt: m.alt,
                    ...ownership
                }
            });
            mediaMap.set(sourceUrl, dbMedia);
            keptMediaIds.add(dbMedia.id);
        }
        catch (err) {
            console.warn('media import failed', sourceUrl, err);
        }
    }
    function mapImageId(sourceUrl) {
        if (!sourceUrl)
            return undefined;
        if (sourceUrl.startsWith('http')) {
            const dbm = mediaMap.get(sourceUrl);
            return dbm?.id;
        }
        return sourceUrl;
    }
    function mapBlocks(blocks) {
        return (blocks || []).map((b) => {
            const mapped = { ...b };
            if (mapped.imageId && typeof mapped.imageId === 'string') {
                mapped.imageId = mapImageId(mapped.imageId);
            }
            if (Array.isArray(mapped.imageIds)) {
                mapped.imageIds = mapped.imageIds.map(mapImageId).filter(Boolean);
            }
            return mapped;
        });
    }
    function mediaFromSourceUrl(sourceUrl) {
        return sourceUrl ? mediaMap.get(sourceUrl) : undefined;
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
    const siteSettingsBase = {
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
    function resolveThemeImage(themeObject) {
        if (!themeObject || !themeObject.imageId || typeof themeObject.imageId !== 'string' || !themeObject.imageId.startsWith('http'))
            return themeObject;
        const dbm = mediaMap.get(themeObject.imageId);
        if (dbm) {
            return { ...themeObject, imageId: dbm.id };
        }
        return { ...themeObject, imageUrl: themeObject.imageId, imageId: undefined };
    }
    const existingSettings = await prisma.siteSettings.findUnique({ where: { siteId }, select: { generatedByRunId: true, manualModifiedAt: true } });
    if (!existingSettings) {
        await prisma.siteSettings.create({ data: { siteId, ...siteSettingsBase, ...ownership } });
    }
    else if (runId && (regenerateContent || existingSettings.generatedByRunId) && !existingSettings.manualModifiedAt) {
        await prisma.siteSettings.update({ where: { siteId }, data: { ...siteSettingsBase, ...ownership } });
    }
    const keptPageIds = new Set();
    const keptServiceIds = new Set();
    const keptProjectIds = new Set();
    const keptNewsIds = new Set();
    const keptVacancyIds = new Set();
    const keptMenuItemIds = new Set();
    async function upsertPage(p) {
        let slug = uniqueSlug(p.slug);
        const existing = await prisma.page.findUnique({
            where: { siteId_slug: { siteId, slug } },
            select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true }
        });
        if (existing && existing.sourceType === 'MANUAL')
            return undefined;
        if (existing && existing.manualModifiedAt) {
            slug = uniqueSlug(p.slug);
        }
        const data = {
            siteId,
            title: p.title,
            slug,
            isHomepage: p.isHomepage,
            blocks: mapBlocks(p.blocks),
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            sourceUrl: p.sourceUrl,
            sourceType: generatedSource,
            status: PageStatus.PUBLISHED,
            publishedAt: new Date(),
            ...ownership
        };
        const record = existing && !existing.manualModifiedAt ? await prisma.page.update({ where: { id: existing.id }, data }) : await prisma.page.create({ data });
        keptPageIds.add(record.id);
        return record;
    }
    for (const p of options.content.pages || []) {
        await upsertPage(p);
    }
    async function upsertService(s) {
        let slug = uniqueSlug(s.slug);
        const existing = await prisma.service.findUnique({
            where: { siteId_slug: { siteId, slug } },
            select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true }
        });
        if (existing && existing.sourceType === 'MANUAL')
            return undefined;
        if (existing && existing.manualModifiedAt) {
            slug = uniqueSlug(s.slug);
        }
        const image = mediaFromSourceUrl(s.image?.sourceUrl);
        const data = {
            siteId,
            title: s.title,
            slug,
            shortDescription: s.shortDescription,
            blocks: mapBlocks(s.blocks),
            imageId: image?.id,
            seoTitle: s.seoTitle,
            seoDescription: s.seoDescription,
            sourceUrl: s.sourceUrl,
            sourceType: generatedSource,
            status: PageStatus.PUBLISHED,
            sortOrder: 0,
            ...ownership
        };
        const record = existing && !existing.manualModifiedAt ? await prisma.service.update({ where: { id: existing.id }, data }) : await prisma.service.create({ data });
        keptServiceIds.add(record.id);
        return record;
    }
    for (const s of options.content.services || []) {
        await upsertService(s);
    }
    async function upsertProject(p) {
        let slug = uniqueSlug(p.slug);
        const existing = await prisma.project.findUnique({
            where: { siteId_slug: { siteId, slug } },
            select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true }
        });
        if (existing && existing.sourceType === 'MANUAL')
            return undefined;
        if (existing && existing.manualModifiedAt) {
            slug = uniqueSlug(p.slug);
        }
        const cover = mediaFromSourceUrl(p.coverImage?.sourceUrl);
        const data = {
            siteId,
            title: p.title,
            slug,
            excerpt: p.excerpt,
            category: p.category,
            location: p.location,
            completionDate: p.completionDate,
            blocks: mapBlocks(p.blocks),
            coverImageId: cover?.id,
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            sourceUrl: p.sourceUrl,
            sourceType: generatedSource,
            status: PageStatus.PUBLISHED,
            publishedAt: new Date(),
            ...ownership
        };
        const record = existing && !existing.manualModifiedAt ? await prisma.project.update({ where: { id: existing.id }, data }) : await prisma.project.create({ data });
        keptProjectIds.add(record.id);
        const newMediaIds = [...new Set((p.gallery || []).map((img) => mediaFromSourceUrl(img.sourceUrl)?.id).filter(Boolean))];
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
    async function upsertNews(n) {
        let slug = uniqueSlug(n.slug);
        const existing = await prisma.newsPost.findUnique({
            where: { siteId_slug: { siteId, slug } },
            select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true }
        });
        if (existing && existing.sourceType === 'MANUAL')
            return undefined;
        if (existing && existing.manualModifiedAt) {
            slug = uniqueSlug(n.slug);
        }
        const cover = mediaFromSourceUrl(n.coverImage?.sourceUrl);
        const data = {
            siteId,
            title: n.title,
            slug,
            excerpt: n.excerpt,
            blocks: mapBlocks(n.blocks),
            coverImageId: cover?.id,
            seoTitle: n.seoTitle,
            seoDescription: n.seoDescription,
            sourceUrl: n.sourceUrl,
            sourceType: generatedSource,
            status: PageStatus.PUBLISHED,
            publishedAt: n.publishedAt ? new Date(n.publishedAt) : new Date(),
            ...ownership
        };
        const record = existing && !existing.manualModifiedAt ? await prisma.newsPost.update({ where: { id: existing.id }, data }) : await prisma.newsPost.create({ data });
        keptNewsIds.add(record.id);
        return record;
    }
    for (const n of options.content.news || []) {
        await upsertNews(n);
    }
    async function upsertVacancy(v) {
        let slug = uniqueSlug(v.slug);
        const existing = await prisma.vacancy.findUnique({
            where: { siteId_slug: { siteId, slug } },
            select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true }
        });
        if (existing && existing.sourceType === 'MANUAL')
            return undefined;
        if (existing && existing.manualModifiedAt) {
            slug = uniqueSlug(v.slug);
        }
        const data = {
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
        const record = existing && !existing.manualModifiedAt ? await prisma.vacancy.update({ where: { id: existing.id }, data }) : await prisma.vacancy.create({ data });
        keptVacancyIds.add(record.id);
        return record;
    }
    for (const v of options.content.vacancies || []) {
        await upsertVacancy(v);
    }
    let menu = await prisma.menu.findFirst({ where: { siteId, isMain: true }, select: { id: true, generatedByRunId: true } });
    if (menu && runId && (regenerateContent || menu.generatedByRunId)) {
        await prisma.menu.update({ where: { id: menu.id }, data: { ...ownership } });
    }
    else if (!menu) {
        menu = await prisma.menu.create({ data: { siteId, name: 'main', isMain: true, ...ownership } });
    }
    if (menu) {
        await prisma.menuItem.deleteMany({ where: { menuId: menu.id, generatedByRunId: { not: null } } });
    }
    const allPages = await prisma.page.findMany({ where: { siteId }, select: { id: true, sourceUrl: true, isHomepage: true, slug: true } });
    const pageByUrl = new Map(allPages.filter((p) => p.sourceUrl).map((p) => [p.sourceUrl, p.id]));
    const pageBySlug = new Map(allPages.map((p) => [p.slug, p.id]));
    async function createMenuItems(items, menuId, parentId = null, sortStart = 0) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let pageId;
            if (item.url) {
                pageId = pageByUrl.get(item.url);
                if (!pageId) {
                    try {
                        const u = new URL(item.url);
                        const slug = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/').pop() || '';
                        pageId = pageBySlug.get(slug);
                    }
                    catch { }
                }
            }
            const data = {
                siteId,
                menuId,
                parentId,
                label: item.label || '—',
                sortOrder: sortStart + i,
                pageId,
                url: pageId ? undefined : (item.url ?? undefined),
                ...ownership
            };
            const created = await prisma.menuItem.create({ data });
            keptMenuItemIds.add(created.id);
            if (item.children?.length) {
                await createMenuItems(item.children, menuId, created.id, 0);
            }
        }
    }
    const nav = options.content.navigation ?? [];
    if (nav.length > 0 && menu) {
        await createMenuItems(nav, menu.id);
    }
    async function ensureCollectionPage(title, baseSlug, blockType) {
        let slug = uniqueSlug(baseSlug);
        const existing = await prisma.page.findUnique({
            where: { siteId_slug: { siteId, slug: baseSlug } },
            select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true }
        });
        if (existing && existing.sourceType === 'MANUAL')
            return undefined;
        if (existing && existing.manualModifiedAt) {
            slug = uniqueSlug(baseSlug);
        }
        const data = {
            siteId,
            title,
            slug,
            isHomepage: false,
            blocks: [{ type: blockType }],
            status: PageStatus.PUBLISHED,
            sourceType: generatedSource,
            ...ownership
        };
        const record = existing && !existing.manualModifiedAt ? await prisma.page.update({ where: { id: existing.id }, data }) : await prisma.page.create({ data });
        keptPageIds.add(record.id);
        return record;
    }
    const home = await prisma.page.findFirst({ where: { siteId, isHomepage: true }, select: { id: true, generatedByRunId: true } });
    if (nav.length === 0 && home && menu) {
        const homeItem = await prisma.menuItem.create({
            data: { siteId, menuId: menu.id, label: 'Home', pageId: home.id, sortOrder: 0, showInFooter: true, showInHeader: true, ...ownership }
        });
        keptMenuItemIds.add(homeItem.id);
        const sort = [1, 2, 3, 4];
        if (options.content.services.length > 0) {
            const sp = await ensureCollectionPage('Services', 'services', 'services');
            if (sp) {
                const mi = await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Services', pageId: sp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true, ...ownership } });
                keptMenuItemIds.add(mi.id);
            }
        }
        if (options.content.projects.length > 0) {
            const pp = await ensureCollectionPage('Projects', 'projects', 'projects');
            if (pp) {
                const mi = await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Projects', pageId: pp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true, ...ownership } });
                keptMenuItemIds.add(mi.id);
            }
        }
        if (options.content.news.length > 0) {
            const np = await ensureCollectionPage('News', 'news', 'news');
            if (np) {
                const mi = await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'News', pageId: np.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true, ...ownership } });
                keptMenuItemIds.add(mi.id);
            }
        }
        const existingContacts = await prisma.page.findUnique({ where: { siteId_slug: { siteId, slug: 'contacts' } }, select: { id: true, sourceType: true, generatedByRunId: true, manualModifiedAt: true } });
        if (!existingContacts) {
            const cp = await ensureCollectionPage('Contacts', 'contacts', 'contacts');
            if (cp) {
                const mi = await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Contacts', pageId: cp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true, ...ownership } });
                keptMenuItemIds.add(mi.id);
            }
        }
        else if ((existingContacts.sourceType !== 'MANUAL' && !existingContacts.manualModifiedAt) || regenerateContent) {
            await prisma.page.update({ where: { id: existingContacts.id }, data: { title: 'Contacts', blocks: [{ type: 'contacts' }], status: PageStatus.PUBLISHED, sourceType: generatedSource, ...ownership } });
            keptPageIds.add(existingContacts.id);
        }
    }
    // Resolve hero/about images in themeConfig after media import so validation/rendering can use DB media IDs.
    if (themeConfig.hero)
        themeConfig.hero = resolveThemeImage(themeConfig.hero);
    if (themeConfig.about)
        themeConfig.about = resolveThemeImage(themeConfig.about);
    await prisma.site.update({ where: { id: siteId }, data: { themeConfig } });
    await prisma.demoVariant.update({ where: { id: demoVariant.id }, data: { themeConfig } });
    const homepage = await prisma.page.findFirst({ where: { siteId, isHomepage: true }, select: { id: true, sourceType: true, generatedByRunId: true } });
    if (homepage && (!runId || homepage.sourceType !== 'MANUAL')) {
        const hero = options.content.hero;
        const cta = options.content.cta;
        const about = options.content.about;
        const sections = options.content.homepageSections || [];
        const sectionTitle = (type, fallback) => sections.find((s) => s.type === type)?.title || fallback;
        const sectionLimit = (type, fallback) => sections.find((s) => s.type === type)?.limit ?? fallback;
        const homeBlocks = [];
        if (hero?.title) {
            homeBlocks.push({
                type: 'hero',
                title: hero.title,
                subtitle: hero.subtitle,
                imageId: mapImageId(hero.imageId),
                buttonLabel: hero.buttonLabel || 'Contact us',
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
            homeBlocks.push({ type: 'services', heading: sectionTitle('services', 'Services'), limit: sectionLimit('services', 6) });
        }
        if (sections.find((s) => s.type === 'projects' && s.enabled) && options.content.projects.length > 0) {
            homeBlocks.push({ type: 'projects', heading: sectionTitle('projects', 'Projects'), limit: sectionLimit('projects', 4) });
        }
        if (sections.find((s) => s.type === 'news' && s.enabled) && options.content.news.length > 0) {
            homeBlocks.push({ type: 'news', heading: sectionTitle('news', 'News'), limit: sectionLimit('news', 3) });
        }
        if (sections.find((s) => s.type === 'vacancies' && s.enabled) && options.content.vacancies.length > 0) {
            homeBlocks.push({ type: 'vacancies', heading: sectionTitle('vacancies', 'Vacancies'), limit: sectionLimit('vacancies', 3) });
        }
        if (cta?.title) {
            homeBlocks.push({
                type: 'cta',
                title: cta.title,
                description: cta.description,
                buttonLabel: cta.buttonLabel || 'Contact us',
                buttonUrl: cta.buttonUrl || '/contacts'
            });
        }
        if (sections.find((s) => s.type === 'contacts' && s.enabled)) {
            homeBlocks.push({ type: 'contacts', heading: sectionTitle('contacts', 'Contacts') });
        }
        await prisma.page.update({
            where: { id: homepage.id },
            data: { blocks: homeBlocks }
        });
    }
    if (runId && regenerateContent) {
        await prisma.page.deleteMany(staleContentWhere(siteId, runId, keptPageIds));
        await prisma.service.deleteMany(staleContentWhere(siteId, runId, keptServiceIds));
        await prisma.project.deleteMany(staleContentWhere(siteId, runId, keptProjectIds));
        await prisma.newsPost.deleteMany(staleContentWhere(siteId, runId, keptNewsIds));
        await prisma.vacancy.deleteMany(staleContentWhere(siteId, runId, keptVacancyIds));
        await prisma.menuItem.deleteMany(staleGeneratedWhere(siteId, runId, keptMenuItemIds));
        await prisma.media.deleteMany(staleGeneratedWhere(siteId, runId, keptMediaIds));
    }
    const stats = {
        pages: await prisma.page.count({ where: { siteId } }),
        services: await prisma.service.count({ where: { siteId } }),
        projects: await prisma.project.count({ where: { siteId } }),
        news: await prisma.newsPost.count({ where: { siteId } }),
        vacancies: await prisma.vacancy.count({ where: { siteId } }),
        media: await prisma.media.count({ where: { siteId } }),
        menuItems: await prisma.menuItem.count({ where: { siteId } })
    };
    return { siteId, siteSlug: options.siteSlug, previewSlug: options.previewSlug, demoVariantId: demoVariant.id, stats };
}
