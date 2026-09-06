import { createHash } from 'node:crypto';
const normTitle = (t) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim();
function canonicalize(entities) {
    // Homepage teasers and detail-page items for the same real entity collapse
    // to ONE canonical entity — homepage is a placement, not a second source.
    const byTitle = new Map();
    for (const e of entities) {
        const k = normTitle(e.title);
        if (!k)
            continue;
        const existing = byTitle.get(k);
        if (!existing || (e.sourceDocumentIds?.length || 0) > (existing.sourceDocumentIds?.length || 0))
            byTitle.set(k, e);
    }
    return [...byTitle.values()];
}
function entityRef(e, docs, graph) {
    const urls = e.sourceDocumentIds.map((id) => docs.find((d) => d.id === id)?.url).filter(Boolean);
    const homeDoc = docs.find((d) => d.isHomepage);
    const onHomepage = homeDoc ? e.sourceDocumentIds.includes(homeDoc.id) : false;
    const img = e.imageIds?.length ? graph.media.find((m) => m.id === e.imageIds[0])?.src : undefined;
    return { id: e.id, title: e.title, sourceUrls: urls, onHomepage, image: img, origin: 'SOURCE_CONTENT' };
}
function collectionKind(c) {
    if (c.type === 'CONTENT_COLLECTION') {
        switch (c.contentSubtype) {
            case 'SERVICES': return 'SERVICE_COLLECTION';
            case 'PROJECTS': return 'PROJECT_COLLECTION';
            case 'PRODUCTS': return 'PRODUCT_COLLECTION';
            case 'NEWS': return 'NEWS_COLLECTION';
            case 'VACANCIES': return 'VACANCY_COLLECTION';
            default: return 'OTHER';
        }
    }
    if (c.type === 'NAVIGATION')
        return 'IGNORED';
    if (c.type === 'SOCIAL_LINKS')
        return 'IGNORED';
    if (c.type === 'ADVERTISEMENT')
        return 'IGNORED';
    if (c.type === 'LANGUAGE_SWITCHER' || c.type === 'THEME_WIDGET')
        return 'IGNORED';
    return 'OTHER';
}
const PAGE_ROLE = {
    HOME: 'home',
    ABOUT: 'corporate',
    CONTACTS: 'contacts',
    SERVICES_INDEX: 'collection', SERVICE_DETAIL: 'detail',
    PROJECTS_INDEX: 'collection', PROJECT_DETAIL: 'detail',
    PRODUCTS_INDEX: 'collection', PRODUCT_DETAIL: 'detail',
    NEWS_INDEX: 'collection', NEWS_DETAIL: 'detail',
    VACANCIES_INDEX: 'collection', VACANCY_DETAIL: 'detail',
};
export function buildSiteContentPlan(opts) {
    const { graph, documents: docs } = opts;
    const warnings = [...(graph.warnings || [])];
    const omittedContent = [];
    const homeDoc = docs.find((d) => d.isHomepage);
    const homePage = homeDoc && graph.pages.find((p) => p.sourceDocumentId === homeDoc.id);
    // --- identity -------------------------------------------------------------
    const company = graph.company;
    const contacts = graph.contacts;
    // --- navigation (header chrome of the homepage) ---------------------------
    const navNodes = homeDoc?.chrome?.nav?.primary || [];
    const navigation = navNodes.slice(0, 12).map((n, i) => ({ label: n.label, url: n.url, order: i }));
    // --- entities: canonical dedup (teaser vs detail) -------------------------
    const services = canonicalize(graph.services || []).map((e) => entityRef(e, docs, graph));
    const projects = canonicalize(graph.projects || []).map((e) => entityRef(e, docs, graph));
    const products = canonicalize(graph.products || []).map((e) => entityRef(e, docs, graph));
    const news = canonicalize(graph.news || []).map((e) => entityRef(e, docs, graph));
    const vacancies = canonicalize(graph.vacancies || []).map((e) => entityRef(e, docs, graph));
    // --- dynamic sections: every classified collection is accounted for -------
    const dynamicSections = [];
    for (const page of graph.pages) {
        const doc = docs.find((d) => d.id === page.sourceDocumentId);
        for (const c of page.collections) {
            const raw = doc?.collections?.find((x) => x.id === c.collectionId);
            const kind = collectionKind(c);
            const items = (raw?.items || []).map((i) => i.title || i.text || '').filter(Boolean);
            dynamicSections.push({
                collectionId: c.collectionId,
                sourcePage: doc?.url || page.sourceDocumentId,
                kind,
                itemCount: items.length || raw?.items?.length || 0,
                heading: raw?.heading,
                classificationReason: c.reason,
                ignoredReason: kind === 'IGNORED' ? `type=${c.type} is structural chrome, not content` : undefined,
                sampleItems: items.slice(0, 5),
            });
        }
    }
    // --- pages plan -----------------------------------------------------------
    const pages = graph.pages.map((p) => ({
        type: p.classification.type,
        title: docs.find((d) => d.id === p.sourceDocumentId)?.title || '',
        sourceDocumentId: p.sourceDocumentId,
        url: docs.find((d) => d.id === p.sourceDocumentId)?.url || '',
        role: PAGE_ROLE[p.classification.type] || 'other',
    }));
    // --- homepage plan ----------------------------------------------------------
    const sourceSections = [];
    if (homeDoc) {
        for (const s of homeDoc.sections || []) {
            const cls = homePage?.sections.find((x) => x.sectionId === s.id);
            sourceSections.push({ sectionId: s.id, type: cls?.type || 'UNKNOWN', heading: s.heading, itemCount: s.items?.length || 0 });
        }
        for (const c of homeDoc.collections || []) {
            const cls = homePage?.collections.find((x) => x.collectionId === c.id);
            sourceSections.push({ sectionId: c.id, type: `${cls?.type || 'UNKNOWN'}/${cls?.contentSubtype || ''}`, heading: c.heading, itemCount: c.items?.length || 0 });
        }
    }
    const plannedSections = [];
    const heroMedia = graph.media.find((m) => m.role === 'HERO_CANDIDATE');
    plannedSections.push({
        type: 'hero', heading: company?.displayName || '', origin: 'SOURCE_CONTENT',
        entityIds: [], evidence: homeDoc ? [homeDoc.url] : [],
        rationale: 'Site identity + hero media from source homepage', sourceSectionId: sourceSections.find((s) => s.type === 'HERO_CONTENT')?.sectionId,
    });
    const featured = (list, n = 6) => list.filter((e) => e.onHomepage).concat(list.filter((e) => !e.onHomepage)).slice(0, n);
    if (services.length)
        plannedSections.push({ type: 'services', heading: 'Services', origin: 'SOURCE_CONTENT', entityIds: featured(services).map((e) => e.id), evidence: services.flatMap((e) => e.sourceUrls).slice(0, 5), rationale: `${services.length} services discovered; homepage shows a representative subset` });
    if (projects.length)
        plannedSections.push({ type: 'projects', heading: 'Projects', origin: 'SOURCE_CONTENT', entityIds: featured(projects).map((e) => e.id), evidence: projects.flatMap((e) => e.sourceUrls).slice(0, 5), rationale: `${projects.length} projects discovered; full collection preserved on the collection page` });
    if (products.length)
        plannedSections.push({ type: 'products', heading: 'Products', origin: 'SOURCE_CONTENT', entityIds: featured(products).map((e) => e.id), evidence: products.flatMap((e) => e.sourceUrls).slice(0, 5), rationale: `${products.length} products discovered; catalogue preserved on the collection page` });
    if (news.length)
        plannedSections.push({ type: 'news', heading: 'News', origin: 'SOURCE_CONTENT', entityIds: featured(news, 3).map((e) => e.id), evidence: news.flatMap((e) => e.sourceUrls).slice(0, 3), rationale: 'Latest news teaser' });
    if (company?.description)
        plannedSections.push({ type: 'about', heading: 'About', origin: 'SOURCE_CONTENT', entityIds: [company.id], evidence: company.sourceDocumentIds || [], rationale: 'Company description from source' });
    plannedSections.push({ type: 'contacts', heading: 'Contacts', origin: 'SOURCE_FACT', entityIds: [], evidence: contacts ? (contacts.sourceDocumentIds || []) : [], rationale: 'Validated contact facts only' });
    // --- media ------------------------------------------------------------------
    const media = {
        logo: graph.media.find((m) => m.role === 'LOGO')?.src || homeDoc?.chrome?.logo?.src,
        hero: heroMedia?.src || homeDoc?.openGraph?.['og:image'],
        images: (graph.media || []).filter((m) => m.role !== 'UTILITY_ICON' && m.role !== 'LANGUAGE_ICON').slice(0, 60).map((m) => ({ id: m.id, src: m.src, role: m.role })),
    };
    // --- omitted ----------------------------------------------------------------
    for (const rc of graph.rejectedCollections || []) {
        omittedContent.push({ what: `collection ${rc.collectionId}`, reason: rc.reason });
    }
    // --- readiness ---------------------------------------------------------------
    if (!company?.displayName && !contacts?.phones?.length && !contacts?.emails?.length)
        warnings.push('No company identity or contacts discovered');
    if (!homeDoc)
        warnings.push('No homepage SourceDocument (root unresolved or missing)');
    const contentCount = services.length + projects.length + products.length + news.length;
    let readiness = 'READY';
    if (!homeDoc || contentCount === 0)
        readiness = 'NOT_READY';
    else if (warnings.length > 0 || !contacts)
        readiness = 'READY_WITH_WARNINGS';
    const plan = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        siteKey: opts.siteKey,
        baseUrl: opts.baseUrl,
        sourceGraphHash: opts.sourceGraphHash,
        siteIdentity: {
            displayName: company?.displayName,
            legalName: company?.legalName,
            industry: company?.industry,
            founded: company?.founded,
            employees: company?.employees,
            unp: company?.unp,
            confidence: company?.confidence ?? 0,
            evidenceDocIds: company?.sourceDocumentIds || [],
        },
        contacts: {
            phones: (contacts?.phones || []).map((p) => ({ value: p.value, sourceUrl: p.evidence?.sourceUrl })),
            emails: (contacts?.emails || []).map((p) => ({ value: p.value, sourceUrl: p.evidence?.sourceUrl })),
            addresses: (contacts?.addresses || []).map((p) => ({ value: p.value, sourceUrl: p.evidence?.sourceUrl })),
            socialLinks: (contacts?.socialLinks || []).map((s) => ({ platform: s.platform, url: s.url })),
            workingHours: contacts?.workingHours?.value,
        },
        navigation,
        homepage: { sourceSections, plannedSections },
        pages,
        services, projects, products, news, vacancies,
        dynamicSections,
        media,
        omittedContent,
        warnings,
        readiness,
    };
    plan.planHash = computePlanHash(plan);
    return plan;
}
/** sha256 over the canonical plan JSON (planHash excluded). */
export function computePlanHash(plan) {
    const { planHash: _drop, ...rest } = plan;
    return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
}
/** Contract for Phase 2B-B: the generator must receive exactly this plan. */
export function verifyPlanHash(plan) {
    return plan.planHash === computePlanHash(plan);
}
