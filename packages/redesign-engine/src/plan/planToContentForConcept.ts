import type { ExtractedContent } from '../../../content-schema/dist/index.js';
import type { SiteContentPlanV2, PlannedEntity } from './siteContentPlanV2.js';
import type { ConceptSpec, HomepageSectionSpec } from './conceptSpec.js';
import { cleanCardSummary } from './siteContentPlanV2.js';

const clean = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n) || undefined;

const media = (src?: string, alt?: string) => (src ? { sourceUrl: src, filename: src.split('/').pop()?.split('?')[0] || 'media', alt } : undefined);

const JUNK_COPY = /запросить|оставьте заявку|позвоните|звоните|закажите|заказать|записаться|подробнее|читать далее|порядок выполнения|наши контакты|меню|наверх|✔|➔|✓|\+?\d[\d\s()\-]{6,}/i;

const entityText = (e: PlannedEntity): string | undefined => {
  const t = (e.cardSummary && !JUNK_COPY.test(e.cardSummary) ? e.cardSummary : undefined) || cleanCardSummary(e.summary, e.title);
  if (t) return t;
  const raw = (e.summary || '').replace(/\s+/g, ' ').trim();
  if (raw && raw.length >= 8 && !JUNK_COPY.test(raw)) return raw.slice(0, 300);
  return undefined;
};

const blocksOf = (e: PlannedEntity): any[] => {
  const b: any[] = [];
  const txt = entityText(e);
  if (txt) b.push({ type: 'text', content: txt });
  const gallery = e.media.filter((s) => s !== e.primaryImage).slice(0, 8);
  if (gallery.length) b.push({ type: 'gallery', imageIds: gallery });
  return b;
};

const HOMEPAGE_TYPE: Record<string, string | null> = {
  hero: 'hero', services: 'services', projects: 'projects', products: 'products', news: 'news', articles: 'articles',
  about: 'about', contacts: 'contacts', cta: 'cta', dynamic: 'dynamic',
};

function pickHeroImage(plan: SiteContentPlanV2, concept: ConceptSpec): string | undefined {
  const heroMedia = concept.heroMediaIntent;
  const archetype = plan.experience?.archetype || 'SERVICE_PORTFOLIO';
  const isRelevant = (title: string) => {
    const t = (title || '').toLowerCase();
    if (archetype === 'CATALOG') return /дом|модел|проект|коттедж/i.test(t);
    if (archetype === 'CREATIVE_PORTFOLIO') return /интерьер|дизайн|ремонт|квартира|студия/i.test(t);
    // SERVICE_PORTFOLIO: prefer house/building, avoid generic/industrial unless no alternative
    return /дом|брус|каркас|фундамент|строительство|объект|бассейн/i.test(t) && !/промышлен/i.test(t);
  };

  if (heroMedia === 'no image') return undefined;
  if (heroMedia === 'show product') {
    const p = plan.entities.find((e) => e.type === 'product' && e.primaryImage);
    if (p) return p.primaryImage;
  }
  if (heroMedia === 'show work' || heroMedia === 'show building') {
    const candidates = plan.entities.filter((e) => (e.type === 'project' || e.type === 'product') && e.primaryImage && !/лого|logo|icon|sprite|banner/i.test(e.primaryImage));
    const p = candidates.find((e) => isRelevant(e.title)) || candidates[0];
    if (p) return p.primaryImage;
  }
  if (heroMedia === 'show process') {
    const m = plan.media.images.find((i) => !/лого|logo|icon|sprite|banner/i.test(i.src));
    if (m) return m.src;
  }
  if (heroMedia === 'show team') {
    const m = plan.media.images.find((i) => !/лого|logo|icon|sprite|banner/i.test(i.src));
    if (m) return m.src;
  }
  return plan.media.hero || plan.media.images.find((i) => !/лого|logo|icon|sprite|banner/i.test(i.src))?.src;
}

function heroHeadline(plan: SiteContentPlanV2, concept: ConceptSpec): string {
  const site = plan.siteIdentity.displayName || plan.experience?.brand?.name || '';
  if (concept.ctaStrategy.primary.target.includes('PRODUCTS') && plan.entities.some((e) => e.type === 'product')) {
    return `${site} — готовые решения`;
  }
  if (concept.ctaStrategy.primary.target.includes('PROJECTS') && plan.entities.some((e) => e.type === 'project')) {
    return `${site} — реализованные проекты`;
  }
  return plan.experience?.presentation?.heroHeadline || `${site} — ${plan.siteIdentity.description?.slice(0, 60)}`;
}

export function planToContentForConcept(plan: SiteContentPlanV2, concept: ConceptSpec): ExtractedContent {
  const id = plan.siteIdentity;
  const byId = new Map(plan.entities.map((e) => [e.id, e]));

  const includeEntity = (e: PlannedEntity) => {
    if (e.type === 'article' || e.type === 'news') return !concept.layoutFamily || concept.layoutFamily !== 'portfolio';
    return true;
  };

  const services = plan.entities.filter((e) => e.type === 'service' && includeEntity(e));
  const projects = plan.entities.filter((e) => e.type === 'project' && includeEntity(e));
  const products = plan.entities.filter((e) => e.type === 'product' && includeEntity(e));

  const sectionForConcept = (s: HomepageSectionSpec, i: number) => {
    const t = HOMEPAGE_TYPE[s.type];
    if (!t) return null;
    const base: any = { type: t, enabled: true, sortOrder: i, title: s.heading };
    if (s.entityIds?.length) base.entityIds = s.entityIds;
    if (s.dynamicSectionId) base.dynamicSectionId = s.dynamicSectionId;
    if (s.sectionType) base.sectionType = s.sectionType;
    return base;
  };

  const homepageSections = concept.homepageSections
    .map(sectionForConcept)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s, i, arr) => arr.findIndex((x) => x.type === s.type && x.sectionType === s.sectionType) === i);

  const aboutExtra = plan.dynamicSections.flatMap((d) => d.items || [])
    .find((i) => /это|мы |компания|студия|нас\b/i.test(i.title || '') && (i.text || '').length >= 150);

  const aboutContent = [
    id.description,
    aboutExtra ? cleanCardSummary(aboutExtra.text, aboutExtra.title || '') || clean(aboutExtra.text || '', 400) : '',
    '',
  ].filter(Boolean).join('\n\n');

  const navigation: any[] = plan.plannedNavigation.map((n) => ({ label: n.label, url: n.route }));

  const heroImage = pickHeroImage(plan, concept);

  const ctaTitle = concept.ctaStrategy.footerCta || (plan.experience?.archetype === 'CATALOG' ? 'Подберите дом в каталоге' : 'Обсудим ваш проект');

  return {
    theme: { source: 'inferred' as const, primaryColor: '#2f6b4f', textColor: '#1a1a1a', backgroundColor: '#ffffff' },
    hero: {
      title: heroHeadline(plan, concept),
      subtitle: plan.experience?.presentation?.heroSubheadline || clean(id.description || '', 200),
      imageId: heroImage,
      buttonLabel: concept.ctaStrategy.primary.label,
      buttonUrl: 'HOME_SECTION:CONTACTS',
      secondaryCtaLabel: concept.ctaStrategy.secondary?.label,
      secondaryCtaTarget: concept.ctaStrategy.secondary?.target,
      industry: plan.experience?.archetype === 'CATALOG' ? 'Каталог готовых решений' : plan.experience?.archetype === 'CREATIVE_PORTFOLIO' ? 'Интерьерная студия' : 'Строительная компания',
    },
    company: {
      name: id.displayName, shortName: id.displayName, description: id.description,
      legalName: id.legalName, unp: id.unp, founded: id.founded, employees: id.employees,
      address: plan.contacts.addresses[0]?.value,
      phone: plan.contacts.phones[0]?.value,
      email: plan.contacts.emails[0]?.value,
      workingHours: plan.contacts.workingHours,
      socialLinks: plan.contacts.socialLinks,
    },
    about: {
      heading: 'О компании',
      content: aboutContent,
      imageId: (() => {
        const hero = heroImage;
        const entityImg = plan.entities.map((e) => e.primaryImage).find((src) => src && src !== hero && !/logo|icon|sprite|placeholder|removebg/i.test(src));
        return entityImg || plan.media.images.map((m) => m.src).find((src) => src && src !== hero && !/logo|icon|sprite|placeholder|removebg/i.test(src)) || undefined;
      })(),
    },
    branding: { companyName: id.displayName, logo: media(plan.media.logo, id.displayName), defaultSeoTitle: id.displayName },
    navigation,
    homepageSections,
    pages: [],
    services: services.map((s) => ({ title: s.title, slug: s.slug, sourceType: 'IMPORTED' as const, shortDescription: s.cardSummary || cleanCardSummary(s.summary, s.title), blocks: blocksOf(s), sourceUrl: s.detailUrl, image: media(s.primaryImage, s.title) })),
    projects: projects.map((p) => ({ title: p.title, slug: p.slug, sourceType: 'IMPORTED' as const, excerpt: p.cardSummary || cleanCardSummary(p.summary, p.title), blocks: blocksOf(p), sourceUrl: p.detailUrl, coverImage: media(p.primaryImage, p.title), gallery: p.media.slice(0, 8).map((s) => media(s, p.title)!).filter(Boolean) })),
    products: products.map((p) => ({ title: p.title, slug: p.slug, sourceType: 'IMPORTED' as const, summary: p.cardSummary || undefined, attributes: p.attributes, blocks: blocksOf(p), sourceUrl: p.detailUrl, coverImage: media(p.primaryImage, p.title), gallery: p.media.slice(0, 8).map((u) => media(u, p.title)!).filter(Boolean) })),
    news: [],
    reviews: [],
    vacancies: [],
    contacts: {
      phone: plan.contacts.phones[0]?.value,
      email: plan.contacts.emails[0]?.value,
      address: plan.contacts.addresses[0]?.value,
      workingHours: plan.contacts.workingHours,
      socialLinks: plan.contacts.socialLinks,
    },
    dynamicSections: plan.dynamicSections
      .filter((d) => d.kind !== 'IGNORED' && d.items.length)
      .map((d) => ({ kind: d.kind, heading: d.heading, cta: (d as any).cta, items: d.items.slice(0, 30).map((i) => ({ title: i.title, text: i.text, meta: i.meta })) })),
    media: plan.media.images.map((m) => media(m.src)!),
    cta: { title: ctaTitle, description: '', buttonLabel: concept.ctaStrategy.primary.label, buttonUrl: 'HOME_SECTION:CONTACTS' },
  } as unknown as ExtractedContent;
}
