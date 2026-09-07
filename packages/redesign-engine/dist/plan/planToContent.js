import { cleanCardSummary } from './siteContentPlanV2.js';
// Bridge: SiteContentPlan V2 -> ExtractedContent (the importer's input).
// Deterministic — the plan is authoritative; this only maps shapes.
const clean = (s, n) => s.replace(/\s+/g, ' ').trim().slice(0, n) || undefined;
const media = (src, alt) => (src ? { sourceUrl: src, filename: src.split('/').pop()?.split('?')[0] || 'media', alt } : undefined);
const blocksOf = (e) => {
    const b = [];
    if (e.summary)
        b.push({ type: 'text', content: e.summary });
    // Structured attributes render via the dedicated spec table — do not also
    // dump them into body copy as a "Параметры" text block.
    const gallery = e.media.filter((s) => s !== e.primaryImage).slice(0, 8);
    if (gallery.length)
        b.push({ type: 'gallery', imageIds: gallery });
    return b;
};
// Homepage section types — the template understands 'products' and 'dynamic'
// (dynamic sections carry their component name in `title`).
const HOMEPAGE_TYPE = {
    hero: 'hero', services: 'services', projects: 'projects', products: 'products', news: 'news', articles: 'articles',
    about: 'about', contacts: 'contacts', dynamic: 'dynamic', cta: 'cta',
};
export function planToContent(plan) {
    const id = plan.siteIdentity;
    const byId = new Map(plan.entities.map((e) => [e.id, e]));
    // Navigation: internal semantic targets only.
    const navigation = plan.plannedNavigation.map((n) => ({ label: n.label, url: n.route }));
    const services = plan.entities.filter((e) => e.type === 'service');
    const projects = plan.entities.filter((e) => e.type === 'project');
    const products = plan.entities.filter((e) => e.type === 'product');
    const articles = plan.entities.filter((e) => e.type === 'article');
    const news = plan.entities.filter((e) => e.type === 'news');
    const vacancies = plan.entities.filter((e) => e.type === 'vacancy');
    const pages = [];
    if (articles.length) {
        pages.push({ title: 'Статьи', slug: 'articles', sourceType: 'IMPORTED', isHomepage: false, blocks: articles.slice(0, 30).map((a) => ({ type: 'text', heading: a.title, content: a.summary || '' })) });
        for (const a of articles)
            pages.push({ title: a.title, slug: `articles/${a.slug}`, sourceType: 'IMPORTED', isHomepage: false, sourceUrl: a.detailUrl, blocks: blocksOf(a) });
    }
    for (const d of plan.dynamicSections.filter((d) => d.kind !== 'IGNORED' && d.items.length)) {
        pages.push({
            title: d.heading || d.kind, slug: d.kind.toLowerCase(), sourceType: 'IMPORTED', isHomepage: false,
            blocks: d.items.slice(0, 30).map((i) => ({ type: 'text', heading: i.title, content: i.text || '' })),
        });
    }
    const exp = plan.experience;
    const reviews = plan.dynamicSections.find((d) => d.kind === 'REVIEWS');
    const faq = plan.dynamicSections.find((d) => d.kind === 'FAQ');
    const process = plan.dynamicSections.find((d) => d.kind === 'PROCESS');
    const aboutDyn = plan.dynamicSections.find((d) => d.kind === 'ADVANTAGES');
    const pricingEvidence = plan.dynamicSections.some((d) => d.kind === 'PRICING')
        || plan.entities.some((e) => /руб|₽|\$|цен|стоимост|price/iu.test(JSON.stringify(e.attributes || {})));
    const descCleaned = (id.description || '').replace(/^цены[^.]*\.\s*/i, (m) => (pricingEvidence ? m : ''));
    const aboutContent = [
        descCleaned,
        aboutDyn?.items?.length ? aboutDyn.items.map((i) => i.title || i.text).filter(Boolean).join('\n') : '',
        '',
    ].filter(Boolean).join('\n\n');
    const homepageSections = plan.homepage.plannedSections
        .map((s, i) => {
        const t = HOMEPAGE_TYPE[s.type];
        if (!t)
            return null;
        // dynamic: title carries the component kind the renderer should mount
        const dyn = s.dynamicSectionId ? plan.dynamicSections.find((d) => d.id === s.dynamicSectionId) : undefined;
        return { type: t, enabled: true, sortOrder: i, title: s.heading, sectionType: dyn ? dyn.kind.toLowerCase() : undefined, limit: s.entityIds.length || undefined };
    })
        .filter((s) => s !== null)
        // dedupe same section identity (kind for dynamic, type otherwise)
        .filter((s, i, arr) => arr.findIndex((x) => x.type === s.type && x.sectionType === s.sectionType) === i);
    return {
        theme: { source: 'default', primaryColor: '#2f6b4f', textColor: '#1a1a1a', backgroundColor: '#ffffff' },
        hero: { title: exp?.presentation.heroHeadline || id.displayName, subtitle: exp?.presentation.heroSubheadline || clean(id.description || '', 200), imageId: plan.media.hero, buttonLabel: exp?.presentation.heroCtaLabel || 'Связаться', buttonUrl: 'HOME_SECTION:CONTACTS', secondaryCtaLabel: exp?.presentation.heroCtaSecondary, secondaryCtaTarget: plan.experience?.archetype === 'CATALOG' ? 'COLLECTION:PRODUCTS' : plan.experience?.archetype === 'CREATIVE_PORTFOLIO' ? 'COLLECTION:PROJECTS' : 'COLLECTION:SERVICES' },
        company: {
            name: id.displayName, shortName: id.displayName, description: id.description,
            legalName: id.legalName, unp: id.unp, founded: id.founded, employees: id.employees,
            address: plan.contacts.addresses[0]?.value,
            phone: plan.contacts.phones[0]?.value,
            email: plan.contacts.emails[0]?.value,
            workingHours: plan.contacts.workingHours,
            socialLinks: plan.contacts.socialLinks,
        },
        about: { heading: 'О компании', content: aboutContent, imageId: plan.media.hero },
        branding: { companyName: id.displayName, logo: media(plan.media.logo, id.displayName), defaultSeoTitle: id.displayName },
        navigation,
        homepageSections,
        pages,
        services: services.map((s) => ({ title: s.title, slug: s.slug, sourceType: 'IMPORTED', shortDescription: s.cardSummary || cleanCardSummary(s.summary, s.title), blocks: blocksOf(s), sourceUrl: s.detailUrl, image: media(s.primaryImage, s.title) })),
        projects: projects.map((p) => ({ title: p.title, slug: p.slug, sourceType: 'IMPORTED', excerpt: p.cardSummary || cleanCardSummary(p.summary, p.title), blocks: blocksOf(p), sourceUrl: p.detailUrl, coverImage: media(p.primaryImage, p.title), gallery: p.media.slice(0, 8).map((s) => media(s, p.title)).filter(Boolean) })),
        news: news.map((n) => ({ title: n.title, slug: n.slug, sourceType: 'IMPORTED', excerpt: n.summary, blocks: blocksOf(n), sourceUrl: n.detailUrl, coverImage: media(n.primaryImage, n.title) })),
        vacancies: vacancies.map((v) => ({ title: v.title, slug: v.slug, sourceType: 'IMPORTED', description: v.summary, sourceUrl: v.detailUrl })),
        reviews: (reviews?.items || []).slice(0, 12).map((i) => ({ author: i.meta?.author || i.title, text: i.text || i.title || '' })),
        contacts: {
            phone: plan.contacts.phones[0]?.value,
            email: plan.contacts.emails[0]?.value,
            address: plan.contacts.addresses[0]?.value,
            workingHours: plan.contacts.workingHours,
            socialLinks: plan.contacts.socialLinks,
        },
        products: products.map((p) => ({
            title: p.title, slug: p.slug, sourceType: 'IMPORTED',
            summary: p.cardSummary || undefined, attributes: p.attributes,
            blocks: blocksOf(p), sourceUrl: p.detailUrl,
            coverImage: media(p.primaryImage, p.title),
            gallery: p.media.slice(0, 8).map((u) => media(u, p.title)).filter(Boolean),
        })),
        dynamicSections: plan.dynamicSections
            .filter((d) => d.kind !== 'IGNORED' && d.items.length)
            .map((d) => ({ kind: d.kind, heading: d.heading, cta: d.cta, items: d.items.slice(0, 30).map((i) => ({ title: i.title, text: i.text, meta: i.meta })) })),
        media: plan.media.images.map((m) => media(m.src)),
        cta: { title: exp?.presentation.heroCtaSecondary && plan.experience?.archetype === 'CATALOG' ? 'Подберите дом в каталоге' : 'Обсудить ваш проект', description: '', buttonLabel: 'Связаться', buttonUrl: 'HOME_SECTION:CONTACTS' },
    };
}
