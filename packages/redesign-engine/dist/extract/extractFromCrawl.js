import { extractedContentSchema } from '../../../content-schema/dist/index.js';
function toSlug(title) {
    return title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9а-яё\-]/g, '')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || `page-${Date.now()}`;
}
function normalizeUrl(base, href) {
    try {
        const u = new URL(href, base);
        const b = new URL(base);
        if (u.hostname !== b.hostname)
            return null;
        u.hash = '';
        return u.toString().replace(/\?$/, '');
    }
    catch {
        return null;
    }
}
function firstSentences(text, count = 2, maxLen = 240) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned)
        return '';
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, count);
    const joined = sentences.join(' ');
    return joined.length > maxLen ? joined.slice(0, maxLen).replace(/\s+\S*$/, '') + '…' : joined;
}
function cleanPhone(input) {
    return input.replace(/[^\d+]/g, '');
}
function findPhones(text) {
    const re = /[\+\d\s\-\(\)]{7,24}/g;
    const matches = (text.match(re) || [])
        .map((m) => m.replace(/\s+/g, ' ').trim())
        .filter((m) => cleanPhone(m).length >= 7 && /\d{5,}/.test(m.replace(/\D/g, '')))
        .map((m) => m.replace(/\s+/g, ' ').trim());
    return [...new Set(matches)];
}
function findEmails(text) {
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(text.match(re) || [])];
}
function findSocialLinks(text, links = []) {
    const domains = [
        { platform: 'VK', rx: /vk\.com|vkontakte\.ru/ },
        { platform: 'Instagram', rx: /instagram\.com|instagr\.am/ },
        { platform: 'Facebook', rx: /facebook\.com|fb\.com/ },
        { platform: 'Telegram', rx: /t\.me|telegram\.me/ },
        { platform: 'YouTube', rx: /youtube\.com|youtu\.be/ },
        { platform: 'LinkedIn', rx: /linkedin\.com/ },
        { platform: 'OK', rx: /ok\.ru/ },
    ];
    const out = [];
    const seen = new Set();
    const all = [...new Set([text, ...links.map((l) => l.href)])];
    for (const raw of all) {
        for (const d of domains) {
            if (d.rx.test(raw)) {
                const match = raw.match(/https?:\/\/[^\s\"<>]+/);
                if (match) {
                    const u = match[0].replace(/[\"'<>]/g, '');
                    if (!seen.has(u)) {
                        seen.add(u);
                        out.push({ platform: d.platform, url: u });
                    }
                }
                break;
            }
        }
    }
    return out;
}
function findWorkingHours(text) {
    const m = text.match(/(?:пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)[–\-—]?\s*(?:пн|вт|ср|чт|пт|сб|вс)?.*?(?:\d{1,2}[\:\.]\d{2}).*?(?:\d{1,2}[\:\.]\d{2})/i);
    if (m)
        return m[0].trim();
    return undefined;
}
function findLegalName(text) {
    const re = /((?:ООО|ЗАО|ОАО|АО|ИП|ООО\s+«[^»]+»|ОАО\s+«[^»]+»|ЗАО\s+«[^»]+»|АО\s+«[^»]+»|«[^»]+»))/gi;
    const m = text.match(re);
    if (m) {
        const cleaned = m[0].replace(/\s+/g, ' ').trim();
        if (cleaned.length > 3 && cleaned.length < 120)
            return cleaned;
    }
    return undefined;
}
function findUNP(text) {
    const m = text.match(/(?:УНП|ЕГР|UNP)[^\d]*(\d{9})/i);
    return m?.[1];
}
function findFounded(text) {
    const m = text.match(/(?:основан[аы]?|работаем)\s+(?:с\s+)?(\d{4})/i) || text.match(/(\d{4})\s*(?:год|г\.)/);
    return m?.[1];
}
function findEmployees(text) {
    const m = text.match(/(\d{2,4})\+?\s*(?:сотрудник|человек|специалист|работник|штат)/i) ||
        text.match(/(?:штат|сотрудников)\s*(?:составляет|более|свыше)?\s*(\d{2,4})/i);
    return m ? m[1] + (m[0].includes('+') ? '+' : '') : undefined;
}
function inferIndustry(services, text) {
    const lower = text.toLowerCase();
    if (lower.includes('интернет') || lower.includes('телевидение') || lower.includes('wi-fi') || lower.includes('связь')) {
        return 'Интернет-провайдер · Беларусь';
    }
    if (services.some((s) => /интернет|телевид|wifi|wi-fi|связь/i.test(s.title))) {
        return 'Интернет-провайдер · Беларусь';
    }
    if (lower.includes('строитель') || lower.includes('монтаж') || lower.includes('генподряд') || lower.includes('бетон') || lower.includes('железобетон') || lower.includes('объект')) {
        return 'Строительная компания · Беларусь';
    }
    if (services.some((s) => /строитель|монтаж|проектирование|бетон|объект/i.test(s.title))) {
        return 'Строительная компания · Беларусь';
    }
    return 'Компания · Беларусь';
}
function inferLocation(address) {
    if (!address)
        return '';
    const lower = address.toLowerCase();
    if (lower.includes('минск'))
        return 'Минск · Беларусь';
    if (lower.includes('гродно'))
        return 'Гродно · Беларусь';
    if (lower.includes('брест'))
        return 'Брест · Беларусь';
    if (lower.includes('витебск'))
        return 'Витебск · Беларусь';
    if (lower.includes('могилев'))
        return 'Могилев · Беларусь';
    if (lower.includes('гомель'))
        return 'Гомель · Беларусь';
    return '';
}
function classifyPage(p, baseUrl) {
    const lowerUrl = p.url.toLowerCase();
    const lowerTitle = (p.title + ' ' + p.h1).toLowerCase();
    const homeUrl = normalizeUrl(baseUrl, baseUrl);
    const self = normalizeUrl(baseUrl, p.url);
    if (self && homeUrl && (self === homeUrl || self === homeUrl + '/' || p.path === 'index'))
        return 'home';
    const has = (keys) => keys.some((k) => lowerUrl.includes(k) || lowerTitle.includes(k));
    if (has(['vakansii', 'vacanc', 'career', 'rabota', 'job', 'ваканс', 'карьера', 'работа']) && !has(['vakansiya', 'vacancy-', 'job-', 'position']))
        return 'vacancies';
    if (has(['vakansiya', 'vacancy-', 'job-', 'position', 'вакансия']))
        return 'vacancy';
    if (has(['contact', 'kontakt', 'контакт']))
        return 'contacts';
    if (has(['about', 'o-kompanii', 'o-nas', 'о-нас', 'о-компании', 'about-us', 'о-застройщике', 'о-нас']))
        return 'about';
    if (has(['news', 'novost', 'новост', 'press', 'blog', 'press-reliz']))
        return 'news';
    if (has(['service', 'uslugi', 'услуг', 'servis', 'решения', 'montazh', 'монтаж', 'проектирование', 'дизайн']))
        return 'service';
    if (has(['services', 'spisok-uslug', 'catalog', 'каталог-услуг', 'all-services']))
        return 'services';
    if (has(['project', 'object', 'objecty', 'объект', 'портфолио', 'portfolio', 'строительство', 'kommercheskie']))
        return 'project';
    if (has(['projects', 'objects', 'obekty', 'объекты', 'portfolio', 'портфолио']))
        return 'projects';
    return 'page';
}
function parseColor(input) {
    const hex = input.match(/^#([0-9a-fA-F]{3})$/);
    if (hex) {
        const s = hex[1];
        const r = parseInt(s[0] + s[0], 16);
        const g = parseInt(s[1] + s[1], 16);
        const b = parseInt(s[2] + s[2], 16);
        return { r, g, b };
    }
    const hex6 = input.match(/^#([0-9a-fA-F]{6})$/);
    if (hex6) {
        const s = hex6[1];
        return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
    }
    const rgb = input.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb)
        return { r: parseInt(rgb[1], 10), g: parseInt(rgb[2], 10), b: parseInt(rgb[3], 10) };
    return null;
}
function toHex(c) {
    const p = (v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
    return `#${p(c.r)}${p(c.g)}${p(c.b)}`;
}
function isNeutral(c) {
    const { r, g, b } = c;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max - min < 30 || (r > 240 && g > 240 && b > 240) || (r < 40 && g < 40 && b < 40);
}
function darkenColor(c, amount = 0.15) {
    const k = 1 - amount;
    return toHex({ r: c.r * k, g: c.g * k, b: c.b * k });
}
function extractHtmlColors(html) {
    const re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/g;
    const matches = html.match(re) || [];
    return [...new Set(matches)];
}
function inferTheme(homepage) {
    const tc = homepage?.themeColors || {};
    const candidates = [tc.buttonBg, tc.headerBg, tc.linkColor, tc.accent].filter(Boolean);
    let primary;
    let source = 'extracted';
    for (const c of candidates) {
        const parsed = parseColor(c);
        if (parsed && !isNeutral(parsed)) {
            primary = toHex(parsed);
            break;
        }
    }
    if (!primary && homepage?.html) {
        const colors = extractHtmlColors(homepage.html);
        for (const c of colors) {
            const parsed = parseColor(c);
            if (parsed && !isNeutral(parsed)) {
                primary = toHex(parsed);
                break;
            }
        }
        source = primary ? 'inferred' : 'default';
    }
    if (!primary) {
        primary = '#2563EB';
        source = 'default';
    }
    const p = parseColor(primary);
    return {
        primaryColor: primary,
        secondaryColor: darkenColor(p, 0.2),
        accentColor: primary,
        backgroundColor: '#F8F8F8',
        surfaceColor: '#FFFFFF',
        textColor: '#1F2937',
        mutedColor: '#6B7280',
        borderColor: '#E5E7EB',
        source
    };
}
function filenameFromUrl(src) {
    try {
        const u = new URL(src);
        const name = u.pathname.split('/').pop() || 'image.jpg';
        return name.split('?')[0].split('#')[0] || 'image.jpg';
    }
    catch {
        return 'image.jpg';
    }
}
function mimeFromFilename(name) {
    const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
    const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon' };
    return map[ext] || 'image/jpeg';
}
function pickCoverImage(images) {
    return images
        .filter((i) => !i.src.startsWith('data:') && !i.likelyLogo && (i.width || 0) > 120 && (i.height || 0) > 120)
        .sort((a, b) => (b.area || 0) - (a.area || 0))[0];
}
function pageMedia(p, used) {
    const cover = pickCoverImage(p.images);
    const gallery = p.images
        .filter((i) => i !== cover && !i.src.startsWith('data:') && !i.likelyLogo && (i.width || 0) > 200 && (i.height || 0) > 150)
        .sort((a, b) => (b.area || 0) - (a.area || 0))
        .slice(0, 8);
    return { cover, gallery };
}
function contentMediaFromImage(img) {
    if (!img)
        return undefined;
    return {
        filename: filenameFromUrl(img.src),
        sourceUrl: img.src,
        originalFilename: filenameFromUrl(img.src),
        mimeType: mimeFromFilename(img.src),
        alt: img.alt || ''
    };
}
function summarizeServices(services) {
    const titles = services.slice(0, 3).map((s) => s.title).filter(Boolean);
    if (!titles.length)
        return '';
    if (titles.length === 1)
        return titles[0];
    const last = titles[titles.length - 1];
    const rest = titles.slice(0, -1).join(', ');
    return `${rest} и ${last}`;
}
function makeHeroTitle(companyName, shortName, services, projects, h1) {
    if (h1 && !/главная|home|о-нас|o-nas/i.test(h1) && h1.length < 120) {
        return h1.split(/[\|—–\-]/)[0].trim();
    }
    if (services.length) {
        const s = summarizeServices(services);
        return s ? s.slice(0, 120) : shortName || companyName;
    }
    if (projects.length && projects[0].category) {
        return `Объекты ${projects[0].category.toLowerCase()}`;
    }
    return shortName || companyName;
}
function makeHeroSubtitle(companyName, shortName, description, services, projects, location, industry) {
    const parts = [];
    const name = shortName || companyName;
    if (name)
        parts.push(name);
    if (industry)
        parts.push(`— ${industry}`);
    if (location)
        parts.push(`· ${location}`);
    if (services.length) {
        parts.push(`Основные направления: ${summarizeServices(services)}.`);
    }
    else if (projects.length) {
        parts.push(`Реализовано проектов: ${projects.length}.`);
    }
    else if (description) {
        parts.push(firstSentences(description, 1, 160));
    }
    return parts.join(' ').slice(0, 280);
}
function pickHeroImage(allImages, homepage, aboutPage, projects) {
    const homeHero = homepage?.heroImage ? allImages.find((i) => i.src === homepage.heroImage) : undefined;
    if (homeHero)
        return homeHero;
    const likelyHero = allImages.find((i) => i.likelyHero);
    if (likelyHero)
        return likelyHero;
    for (const p of projects) {
        const src = p.coverImage?.sourceUrl;
        if (src) {
            const img = allImages.find((i) => i.src === src);
            if (img)
                return img;
            return { src, alt: p.title || '', width: 0, height: 0, area: 0 };
        }
    }
    const aboutCover = aboutPage?.images?.length ? pickCoverImage(aboutPage.images) : undefined;
    if (aboutCover)
        return aboutCover;
    return pickCoverImage(allImages);
}
function chooseHeroCta(services, projects) {
    if (services.length) {
        return { buttonLabel: 'Наши услуги', buttonUrl: '/services', secondaryCtaLabel: 'Смотреть объекты', secondaryCtaTarget: 'PROJECTS' };
    }
    if (projects.length) {
        return { buttonLabel: 'Смотреть объекты', buttonUrl: '/projects', secondaryCtaLabel: 'О компании', secondaryCtaTarget: 'ABOUT' };
    }
    return { buttonLabel: 'Связаться', buttonUrl: '/contacts', secondaryCtaLabel: 'О компании', secondaryCtaTarget: 'ABOUT' };
}
function buildHero(opts) {
    const allImages = opts.pages.flatMap((p) => p.images);
    const industry = inferIndustry(opts.services, opts.homepage?.text || '');
    const location = inferLocation(opts.address);
    const title = makeHeroTitle(opts.companyName, opts.shortName, opts.services, opts.projects, opts.homepage?.h1);
    const subtitle = makeHeroSubtitle(opts.companyName, opts.shortName, opts.description, opts.services, opts.projects, location, industry);
    const image = pickHeroImage(allImages, opts.homepage, opts.aboutPage, opts.projects);
    const cta = chooseHeroCta(opts.services, opts.projects);
    return {
        title,
        subtitle,
        imageId: image?.src,
        ...cta,
        location,
        industry
    };
}
export function extractFromCrawl(pages, baseUrl, navigation) {
    const homepage = pages.find((p) => classifyPage(p, baseUrl) === 'home') || pages[0];
    const companyName = homepage?.h1?.split(/[\|—–\-]/)[0]?.trim() || homepage?.title?.split(/[\|—–\-]/)[0]?.trim() || 'Компания';
    const shortName = companyName.replace(/(?:ООО|ЗАО|ОАО|АО|ИП)\s*/gi, '').replace(/[«»]/g, '').trim();
    const navItems = navigation ?? [];
    const allPhones = [];
    const allEmails = [];
    const allSocial = [];
    let contactsPage;
    let aboutPage;
    const classified = new Map();
    for (const p of pages) {
        const cat = classifyPage(p, baseUrl);
        classified.set(p, cat);
        if (cat === 'contacts')
            contactsPage = p;
        if (cat === 'about')
            aboutPage = p;
        allPhones.push(...findPhones(p.text));
        allEmails.push(...findEmails(p.text));
        allSocial.push(...findSocialLinks(p.text, p.links));
    }
    const uniquePhones = [...new Set(allPhones)];
    const uniqueEmails = [...new Set(allEmails)];
    const uniqueSocial = [...new Map(allSocial.map((s) => [s.url, s])).values()];
    const contactsText = contactsPage?.text || '';
    const workingHours = contactsPage ? findWorkingHours(contactsPage.text) : undefined;
    const address = contactsPage ? contactsPage.text.split('\n').slice(0, 4).join(' ').slice(0, 300) : undefined;
    const aboutText = aboutPage ? firstSentences(aboutPage.text, 4, 1200) : firstSentences(homepage?.text || '', 4, 1200);
    const aboutHeading = aboutPage?.h1 || aboutPage?.title || 'О компании';
    const aboutImage = contentMediaFromImage(pickCoverImage(aboutPage?.images || homepage?.images || []));
    const theme = inferTheme(homepage);
    const logoSrc = homepage?.logo || homepage?.images.find((i) => i.likelyLogo)?.src;
    const services = [];
    const projects = [];
    const news = [];
    const vacancies = [];
    const contentPages = [];
    const media = [];
    const seenMedia = new Set();
    function addMedia(img) {
        if (!img || !img.src || img.src.startsWith('data:'))
            return;
        if (seenMedia.has(img.src))
            return;
        seenMedia.add(img.src);
        media.push({
            filename: filenameFromUrl(img.src),
            sourceUrl: img.src,
            originalFilename: filenameFromUrl(img.src),
            mimeType: mimeFromFilename(img.src),
            alt: img.alt || ''
        });
    }
    for (const p of pages) {
        const cat = classified.get(p) || 'page';
        const path = p.path || toSlug(p.title);
        const isHome = cat === 'home';
        const title = p.h1 || p.title || companyName;
        const { cover, gallery } = pageMedia(p, seenMedia);
        [cover, ...gallery, ...p.images].forEach(addMedia);
        const baseBlocks = [];
        if (cover)
            baseBlocks.push({ type: 'image', imageId: cover.src, caption: cover.alt });
        baseBlocks.push({ type: 'text', heading: title, content: p.text.slice(0, 3000) });
        if (gallery.length) {
            baseBlocks.push({ type: 'gallery', imageIds: gallery.map((i) => i.src) });
        }
        if (cat === 'service' || cat === 'services') {
            services.push({
                title,
                slug: toSlug(title),
                shortDescription: p.metaDescription || firstSentences(p.text, 1, 220),
                blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
                sourceUrl: p.url,
                image: contentMediaFromImage(cover)
            });
        }
        else if (cat === 'project' || cat === 'projects') {
            projects.push({
                title,
                slug: toSlug(title),
                excerpt: p.metaDescription || firstSentences(p.text, 1, 250),
                category: inferIndustry([], p.text).replace(' · Беларусь', ''),
                location: '',
                blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
                sourceUrl: p.url,
                coverImage: contentMediaFromImage(cover),
                gallery: gallery.map(contentMediaFromImage).filter(Boolean)
            });
        }
        else if (cat === 'news') {
            const yearMatch = p.url.match(/\/([12]\d{3})\//);
            const publishedAt = yearMatch ? `${yearMatch[1]}-01-01` : new Date().toISOString();
            news.push({
                title,
                slug: toSlug(title),
                excerpt: p.metaDescription || firstSentences(p.text, 1, 250),
                publishedAt,
                blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
                sourceUrl: p.url,
                coverImage: contentMediaFromImage(cover)
            });
        }
        else if (cat === 'vacancy' || cat === 'vacancies') {
            vacancies.push({
                title,
                slug: toSlug(title),
                location: '',
                description: p.metaDescription || firstSentences(p.text, 2, 400),
                requirements: firstSentences(p.text, 2, 400),
                conditions: firstSentences(p.text, 2, 400),
                contact: uniquePhones[0] || uniqueEmails[0] || '',
                sourceUrl: p.url
            });
        }
        contentPages.push({
            title,
            slug: isHome ? 'index' : path,
            sourceUrl: p.url,
            isHomepage: isHome,
            seoTitle: p.title || '',
            seoDescription: p.metaDescription || '',
            blocks: isHome ? [] : baseBlocks
        });
    }
    if (logoSrc)
        addMedia({ src: logoSrc, alt: 'logo', width: 0, height: 0 });
    const allImages = pages.flatMap((p) => p.images);
    const description = homepage?.metaDescription || firstSentences(homepage?.text || '', 2, 300);
    const hero = buildHero({ companyName, shortName, description, services, projects, pages, homepage, aboutPage, address });
    if (hero.imageId) {
        const heroImg = allImages.find((i) => i.src === hero.imageId) || { src: hero.imageId, alt: hero.title || '', width: 0, height: 0, area: 0 };
        addMedia(heroImg);
    }
    const about = {
        heading: aboutHeading,
        content: aboutText,
        imageId: aboutImage?.sourceUrl
    };
    const cta = {
        title: 'Обсудим ваш проект',
        description: about.content || firstSentences(contactsText || homepage?.text || '', 2, 220),
        buttonLabel: 'Связаться',
        buttonUrl: '/contacts'
    };
    const homepageSections = [
        { type: 'hero', enabled: true, sortOrder: 0, title: hero.title },
        { type: 'about', enabled: !!about.content, sortOrder: 1, title: about.heading },
        { type: 'services', enabled: services.length > 0, sortOrder: 2, title: 'Услуги', limit: 6 },
        { type: 'projects', enabled: projects.length > 0, sortOrder: 3, title: 'Объекты', limit: 4 },
        { type: 'news', enabled: news.length > 0, sortOrder: 4, title: 'Новости', limit: 3 },
        { type: 'vacancies', enabled: vacancies.length > 0, sortOrder: 5, title: 'Вакансии', limit: 3 },
        { type: 'contacts', enabled: true, sortOrder: 6, title: 'Контакты' },
    ];
    const result = {
        company: {
            name: companyName,
            shortName,
            description: homepage?.metaDescription || firstSentences(homepage?.text || '', 2, 300),
            address: address || '',
            phone: uniquePhones[0] || '',
            email: uniqueEmails[0] || '',
            workingHours: workingHours || '',
            socialLinks: uniqueSocial,
            legalName: findLegalName(contactsText || homepage?.text || ''),
            unp: findUNP(contactsText || homepage?.text || ''),
            founded: findFounded(homepage?.text || ''),
            employees: findEmployees(homepage?.text || '')
        },
        theme,
        hero,
        about,
        cta,
        homepageSections,
        branding: {
            companyName,
            logo: logoSrc ? { filename: filenameFromUrl(logoSrc), sourceUrl: logoSrc, mimeType: mimeFromFilename(logoSrc) } : undefined,
            favicon: homepage?.favicon ? { filename: filenameFromUrl(homepage.favicon), sourceUrl: homepage.favicon, mimeType: mimeFromFilename(homepage.favicon) } :
                logoSrc ? { filename: filenameFromUrl(logoSrc), sourceUrl: logoSrc, mimeType: mimeFromFilename(logoSrc) } : undefined,
            primaryColor: theme.primaryColor,
            secondaryColor: theme.secondaryColor,
            defaultSeoTitle: homepage?.title || companyName,
            defaultSeoDescription: homepage?.metaDescription || ''
        },
        navigation: navItems,
        pages: contentPages,
        services,
        projects,
        news,
        vacancies,
        reviews: [],
        contacts: {
            phone: uniquePhones[0],
            email: uniqueEmails[0],
            address,
            workingHours,
            socialLinks: uniqueSocial
        },
        media
    };
    return extractedContentSchema.parse(result);
}
