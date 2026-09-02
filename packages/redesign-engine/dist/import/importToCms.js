import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient, PageStatus, ContentSourceType } from '@prisma/client';
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
export function cleanPhoneDigits(input) {
    return input.replace(/[^\d+]/g, '');
}
export function normalizePhone(input) {
    if (!input)
        return undefined;
    // Some extraction returns noise like "15 +375(17)209 87 00" or
    // "Реализация квартир: +375 (17) 209-87-32". Extract the best phone-like
    // substring, preferring one that starts with + and has the most digits.
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
const GENERIC_NAME_RE = /^\s*(контакты|о компании|о нас|главная|наши услуги|объекты|новости|вакансии)\s*$/i;
export function isGenericCompanyName(name) {
    if (!name)
        return true;
    if (name.length < 2)
        return true;
    return GENERIC_NAME_RE.test(name);
}
export async function importToCms(options, prisma = new PrismaClient()) {
    await mkdir(options.artifactDir, { recursive: true });
    await writeFile(join(options.artifactDir, 'content.json'), JSON.stringify(options.content, null, 2));
    const previewUrl = `http://localhost:3000/showcase/${options.previewSlug}`;
    const themeConfig = options.content.theme ? { ...options.content.theme, homepageSections: options.content.homepageSections, hero: options.content.hero, about: options.content.about, cta: options.content.cta } : {};
    // Canonical Site is upserted by leadId. Same previewToken and same id are kept on retry.
    const site = await prisma.site.upsert({
        where: { leadId: options.leadId },
        update: { name: options.siteName, slug: options.siteSlug, previewToken: options.previewSlug, templateId: options.templateId, themeConfig, settings: { previewUrl }, status: 'DRAFT' },
        create: { leadId: options.leadId, name: options.siteName, slug: options.siteSlug, previewToken: options.previewSlug, templateId: options.templateId, themeConfig: themeConfig, settings: { previewUrl }, status: 'DRAFT' }
    });
    const siteId = site.id;
    const demoVariant = await prisma.demoVariant.upsert({
        where: { previewToken: options.previewSlug },
        update: { siteId, templateId: options.templateId, name: options.templateId, isPreferred: true, status: 'ACTIVE', themeConfig },
        create: { siteId, templateId: options.templateId, previewToken: options.previewSlug, name: options.templateId, isPreferred: true, status: 'ACTIVE', themeConfig: themeConfig }
    });
    await prisma.site.update({
        where: { id: siteId },
        data: { preferredDemoVariantId: demoVariant.id }
    });
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
    // Download and store media, reusing existing records by sourceUrl for the same site.
    const mediaMap = new Map();
    const existingMedia = await prisma.media.findMany({ where: { siteId } });
    for (const m of existingMedia) {
        if (m.sourceUrl)
            mediaMap.set(m.sourceUrl, m);
        mediaMap.set(m.id, m);
    }
    for (const m of options.content.media || []) {
        const sourceUrl = m.sourceUrl;
        if (!sourceUrl)
            continue;
        if (mediaMap.has(sourceUrl))
            continue;
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
                }
            });
            mediaMap.set(sourceUrl, dbMedia);
        }
        catch (err) {
            console.warn('media import failed', sourceUrl, err);
        }
    }
    const logoMedia = options.content.branding?.logo?.sourceUrl ? mediaMap.get(options.content.branding.logo.sourceUrl) : undefined;
    const faviconMedia = options.content.branding?.favicon?.sourceUrl ? mediaMap.get(options.content.branding.favicon.sourceUrl) : undefined;
    // Prefer trusted Lead identity over noisy extracted page headings.
    // Strip location qualifiers such as ", центральный офис" from the public display name.
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
    const siteSettingsData = {
        site: { connect: { id: siteId } },
        companyName: companyName || undefined,
        legalName: options.content.company?.legalName ?? undefined,
        unp: options.content.company?.unp ?? undefined,
        founded: options.content.company?.founded ?? undefined,
        employees: options.content.company?.employees ?? undefined,
        logo: logoMedia?.id ? { connect: { id: logoMedia.id } } : undefined,
        favicon: faviconMedia?.id ? { connect: { id: faviconMedia.id } } : undefined,
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
    // Upsert site settings by the unique siteId. Preserves manual Studio edits to unrelated fields only when not touched by this payload.
    await prisma.siteSettings.upsert({
        where: { siteId },
        create: siteSettingsData,
        update: siteSettingsData
    });
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
    // Pages — upsert by unique (siteId, slug) so retries do not create duplicates.
    for (const p of options.content.pages || []) {
        const slug = uniqueSlug(p.slug);
        const pageData = {
            siteId,
            title: p.title,
            slug,
            isHomepage: p.isHomepage,
            blocks: mapBlocks(p.blocks),
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            sourceUrl: p.sourceUrl,
            sourceType: p.sourceType,
            status: PageStatus.PUBLISHED,
            publishedAt: new Date()
        };
        await prisma.page.upsert({
            where: { siteId_slug: { siteId, slug } },
            create: pageData,
            update: pageData
        });
    }
    // Services — upsert by (siteId, slug).
    for (const s of options.content.services || []) {
        const slug = uniqueSlug(s.slug);
        const image = mediaFromSourceUrl(s.image?.sourceUrl);
        const serviceData = {
            siteId,
            title: s.title,
            slug,
            shortDescription: s.shortDescription,
            blocks: mapBlocks(s.blocks),
            imageId: image?.id,
            seoTitle: s.seoTitle,
            seoDescription: s.seoDescription,
            sourceUrl: s.sourceUrl,
            sourceType: s.sourceType,
            status: PageStatus.PUBLISHED,
            sortOrder: 0
        };
        await prisma.service.upsert({
            where: { siteId_slug: { siteId, slug } },
            create: serviceData,
            update: serviceData
        });
    }
    // Projects — upsert by (siteId, slug). Gallery rows are upserted by (projectId, mediaId).
    for (const p of options.content.projects || []) {
        const slug = uniqueSlug(p.slug);
        const cover = mediaFromSourceUrl(p.coverImage?.sourceUrl);
        const projectData = {
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
            sourceType: p.sourceType,
            status: PageStatus.PUBLISHED,
            publishedAt: new Date()
        };
        const project = await prisma.project.upsert({
            where: { siteId_slug: { siteId, slug } },
            create: projectData,
            update: projectData
        });
        for (const img of p.gallery || []) {
            const dbm = mediaFromSourceUrl(img.sourceUrl);
            if (dbm) {
                await prisma.projectMedia.upsert({
                    where: { projectId_mediaId: { projectId: project.id, mediaId: dbm.id } },
                    create: { projectId: project.id, mediaId: dbm.id, sortOrder: 0 },
                    update: { sortOrder: 0 }
                });
            }
        }
    }
    // News — upsert by (siteId, slug).
    for (const n of options.content.news || []) {
        const slug = uniqueSlug(n.slug);
        const cover = mediaFromSourceUrl(n.coverImage?.sourceUrl);
        const newsData = {
            siteId,
            title: n.title,
            slug,
            excerpt: n.excerpt,
            blocks: mapBlocks(n.blocks),
            coverImageId: cover?.id,
            seoTitle: n.seoTitle,
            seoDescription: n.seoDescription,
            sourceUrl: n.sourceUrl,
            sourceType: n.sourceType,
            status: PageStatus.PUBLISHED,
            publishedAt: n.publishedAt ? new Date(n.publishedAt) : new Date()
        };
        await prisma.newsPost.upsert({
            where: { siteId_slug: { siteId, slug } },
            create: newsData,
            update: newsData
        });
    }
    // Vacancies — upsert by (siteId, slug).
    for (const v of options.content.vacancies || []) {
        const slug = uniqueSlug(v.slug);
        const vacancyData = {
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
            publishedAt: new Date()
        };
        await prisma.vacancy.upsert({
            where: { siteId_slug: { siteId, slug } },
            create: vacancyData,
            update: vacancyData
        });
    }
    // Main menu with hierarchy preserved. Reuse existing main menu, replace its items with current import set.
    let menu = await prisma.menu.findFirst({ where: { siteId, isMain: true } });
    if (!menu) {
        menu = await prisma.menu.create({ data: { siteId, name: 'main', isMain: true } });
    }
    else {
        await prisma.menuItem.deleteMany({ where: { menuId: menu.id } });
    }
    const allPages = await prisma.page.findMany({ where: { siteId }, select: { id: true, sourceUrl: true, isHomepage: true, slug: true } });
    const pageByUrl = new Map(allPages.filter((p) => p.sourceUrl).map((p) => [p.sourceUrl, p.id]));
    const pageBySlug = new Map(allPages.map((p) => [p.slug, p.id]));
    async function createMenuItems(items, parentId = null, sortStart = 0) {
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
    // Fallback generic menu if no navigation was extracted.
    const home = await prisma.page.findFirst({ where: { siteId, isHomepage: true } });
    if (nav.length === 0 && home) {
        const sort = [1, 2, 3, 4];
        await prisma.menuItem.create({
            data: { siteId, menuId: menu.id, label: 'Главная', pageId: home.id, sortOrder: 0, showInFooter: true, showInHeader: true }
        });
        if (options.content.services.length > 0) {
            const servicesSlug = uniqueSlug('services');
            const sp = await prisma.page.upsert({
                where: { siteId_slug: { siteId, slug: servicesSlug } },
                create: { siteId, title: 'Услуги', slug: servicesSlug, isHomepage: false, blocks: [{ type: 'services' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL },
                update: { title: 'Услуги', blocks: [{ type: 'services' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Услуги', pageId: sp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } });
        }
        if (options.content.projects.length > 0) {
            const projectsSlug = uniqueSlug('projects');
            const pp = await prisma.page.upsert({
                where: { siteId_slug: { siteId, slug: projectsSlug } },
                create: { siteId, title: 'Объекты', slug: projectsSlug, isHomepage: false, blocks: [{ type: 'projects' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL },
                update: { title: 'Объекты', blocks: [{ type: 'projects' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Объекты', pageId: pp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } });
        }
        if (options.content.news.length > 0) {
            const newsSlug = uniqueSlug('news');
            const np = await prisma.page.upsert({
                where: { siteId_slug: { siteId, slug: newsSlug } },
                create: { siteId, title: 'Новости', slug: newsSlug, isHomepage: false, blocks: [{ type: 'news' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL },
                update: { title: 'Новости', blocks: [{ type: 'news' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Новости', pageId: np.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } });
        }
        const contactsPage = await prisma.page.findFirst({ where: { siteId, slug: 'contacts' } });
        if (!contactsPage) {
            const contactsSlug = uniqueSlug('contacts');
            const cp = await prisma.page.upsert({
                where: { siteId_slug: { siteId, slug: contactsSlug } },
                create: { siteId, title: 'Контакты', slug: contactsSlug, isHomepage: false, blocks: [{ type: 'contacts' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL },
                update: { title: 'Контакты', blocks: [{ type: 'contacts' }], status: PageStatus.PUBLISHED, sourceType: ContentSourceType.MANUAL }
            });
            await prisma.menuItem.create({ data: { siteId, menuId: menu.id, label: 'Контакты', pageId: cp.id, sortOrder: sort.shift(), showInHeader: true, showInFooter: true } });
        }
    }
    // Compose the homepage from CMS entities.
    const homepage = await prisma.page.findFirst({ where: { siteId, isHomepage: true } });
    if (homepage) {
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
            data: { blocks: homeBlocks }
        });
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
