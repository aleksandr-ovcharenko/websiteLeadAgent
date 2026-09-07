import type { ExtractedContent, ContentBlock, ContentNavigationItem } from '../../../content-schema/dist/index.js';
import type { SiteContentPlanV2, PlannedEntity } from './siteContentPlanV2.js';
import { cleanCardSummary } from './siteContentPlanV2.js';

// Bridge: SiteContentPlan V2 -> ExtractedContent (the importer's input).
// Deterministic — the plan is authoritative; this only maps shapes.

const clean = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n) || undefined;

const media = (src?: string, alt?: string) => (src ? { sourceUrl: src, filename: src.split('/').pop()?.split('?')[0] || 'media', alt } : undefined);
const normT = (t: string) => (t || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”'‘’`]/g, '').replace(/\s+/g, ' ').trim();

// Entity body text never carries raw scrape chrome: prefer the card-cleaned
// summary, then a cleaned summary, then a grounded dynamic-section item whose
// title matches the entity (e.g. project write-ups stored under "Последние
// проекты"). No copy is invented — only real source text is reused.
// Raw copy that is obviously site chrome (phone/nav/CTA) is never entity text.
const JUNK_COPY = /запросить|оставьте заявку|позвоните|звоните|закажите|заказать|записаться|подробнее|читать далее|порядок выполнения|наши контакты|меню|наверх|✔|➔|✓|\+?\d[\d\s()\-]{6,}/i;
const entityText = (e: PlannedEntity, dynCopy: Map<string, string>): string | undefined => {
  const t = (e.cardSummary && !JUNK_COPY.test(e.cardSummary) ? e.cardSummary : undefined) || cleanCardSummary(e.summary, e.title);
  if (t) return t;
  // Short but real copy still belongs on the detail page — only chrome is dropped.
  const raw = (e.summary || '').replace(/\s+/g, ' ').trim();
  if (raw && raw.length >= 8 && !JUNK_COPY.test(raw) && !normT(raw).includes(normT(e.title))) return raw.slice(0, 300);
  const nt = normT(e.title);
  for (const [dt, text] of dynCopy) {
    if (nt.length >= 8 && dt.length >= 8 && (nt.includes(dt) || dt.includes(nt))) return text;
  }
  return undefined;
};

const blocksOf = (e: PlannedEntity, dynCopy: Map<string, string>): ContentBlock[] => {
  const b: ContentBlock[] = [];
  const txt = entityText(e, dynCopy);
  if (txt) b.push({ type: 'text', content: txt });
  // Structured attributes render via the dedicated spec table — do not also
  // dump them into body copy as a "Параметры" text block.
  const gallery = e.media.filter((s) => s !== e.primaryImage).slice(0, 8);
  if (gallery.length) b.push({ type: 'gallery', imageIds: gallery });
  return b;
};

// Homepage section types — the template understands 'products' and 'dynamic'
// (dynamic sections carry their component name in `title`).
const HOMEPAGE_TYPE: Record<string, string | null> = {
  hero: 'hero', services: 'services', projects: 'projects', products: 'products', news: 'news', articles: 'articles',
  about: 'about', contacts: 'contacts', dynamic: 'dynamic', cta: 'cta',
};

export function planToContent(plan: SiteContentPlanV2): ExtractedContent {
  const id = plan.siteIdentity;
  const byId = new Map(plan.entities.map((e) => [e.id, e]));

  // Grounded copy pool from dynamic-section items (any kind incl. IGNORED):
  // sections like "Последние проекты" hold real per-entity descriptions.
  const dynCopy = new Map<string, string>();
  for (const d of plan.dynamicSections) {
    for (const i of d.items || []) {
      const t = normT(i.title || '');
      const text = cleanCardSummary(i.text || '', i.title || '') || clean(i.text || '', 400);
      if (t && text && text.length >= 40 && !JUNK_COPY.test(text) && !dynCopy.has(t)) dynCopy.set(t, text);
    }
  }

  // Navigation: internal semantic targets only.
  const navigation: ContentNavigationItem[] = plan.plannedNavigation.map((n) => ({ label: n.label, url: n.route }));

  const services = plan.entities.filter((e) => e.type === 'service');
  const projects = plan.entities.filter((e) => e.type === 'project');
  const products = plan.entities.filter((e) => e.type === 'product');
  const articles = plan.entities.filter((e) => e.type === 'article');
  const news = plan.entities.filter((e) => e.type === 'news');
  const vacancies = plan.entities.filter((e) => e.type === 'vacancy');

  const pages: ExtractedContent['pages'] = [];
  if (articles.length) {
    pages.push({ title: 'Статьи', slug: 'articles', sourceType: 'IMPORTED', isHomepage: false, blocks: articles.slice(0, 30).map((a) => ({ type: 'text' as const, heading: a.title, content: a.summary || '' })) });
    for (const a of articles) pages.push({ title: a.title, slug: `articles/${a.slug}`, sourceType: 'IMPORTED', isHomepage: false, sourceUrl: a.detailUrl, blocks: blocksOf(a, dynCopy) });
  }
  for (const d of plan.dynamicSections.filter((d) => d.kind !== 'IGNORED' && d.items.length)) {
    pages.push({
      title: d.heading || d.kind, slug: d.kind.toLowerCase(), sourceType: 'IMPORTED', isHomepage: false,
      blocks: d.items.slice(0, 30).map((i) => ({ type: 'text' as const, heading: i.title, content: i.text || '' })),
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
  // Ignored/editorial fragments can still hold grounded company copy — a
  // self-description item ("X — это …", "Почему мы") enriches About.
  const aboutExtra = plan.dynamicSections.flatMap((d) => d.items || [])
    .find((i) => /это|мы |компания|студия|нас\b/i.test(i.title || '') && (i.text || '').length >= 150);
  const aboutContent = [
    descCleaned,
    aboutExtra ? cleanCardSummary(aboutExtra.text, aboutExtra.title || '') || clean(aboutExtra.text || '', 400) : '',
    aboutDyn?.items?.length ? aboutDyn.items.map((i) => i.title || i.text).filter(Boolean).join('\n') : '',
    '',
  ].filter(Boolean).join('\n\n');

  const homepageSections = plan.homepage.plannedSections
    .map((s, i) => {
      const t = HOMEPAGE_TYPE[s.type];
      if (!t) return null;
      // dynamic: title carries the component kind the renderer should mount
      const dyn = s.dynamicSectionId ? plan.dynamicSections.find((d) => d.id === s.dynamicSectionId) : undefined;
      return { type: t, enabled: true, sortOrder: i, title: s.heading, sectionType: dyn ? dyn.kind.toLowerCase() : undefined, limit: s.entityIds.length || undefined } as any;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    // dedupe same section identity (kind for dynamic, type otherwise)
    .filter((s, i, arr) => arr.findIndex((x: any) => x.type === s.type && x.sectionType === s.sectionType) === i);

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
    about: {
      heading: 'О компании', content: aboutContent,
      // About never reuses the hero photo and never uses utility/placeholder
      // art — pick another grounded entity image first.
      imageId: (() => {
        const hero = plan.media.hero;
        const entityImg = plan.entities.map((e) => e.primaryImage).find((src) => src && src !== hero && !/logo|icon|sprite|placeholder|removebg/i.test(src));
        return entityImg || plan.media.images.map((m) => m.src).find((src) => src && src !== hero && !/logo|icon|sprite|placeholder|removebg/i.test(src)) || undefined;
      })(),
    },
    branding: { companyName: id.displayName, logo: media(plan.media.logo, id.displayName), defaultSeoTitle: id.displayName },
    navigation,
    homepageSections,
    pages,
    services: services.map((s) => ({ title: s.title, slug: s.slug, sourceType: 'IMPORTED' as const, shortDescription: s.cardSummary || cleanCardSummary(s.summary, s.title), blocks: blocksOf(s, dynCopy), sourceUrl: s.detailUrl, image: media(s.primaryImage, s.title) })),
    projects: projects.map((p) => ({ title: p.title, slug: p.slug, sourceType: 'IMPORTED' as const, excerpt: p.cardSummary || cleanCardSummary(p.summary, p.title), blocks: blocksOf(p, dynCopy), sourceUrl: p.detailUrl, coverImage: media(p.primaryImage, p.title), gallery: p.media.slice(0, 8).map((s) => media(s, p.title)!).filter(Boolean) })),
    news: news.map((n) => ({ title: n.title, slug: n.slug, sourceType: 'IMPORTED' as const, excerpt: cleanCardSummary(n.summary, n.title), blocks: blocksOf(n, dynCopy), sourceUrl: n.detailUrl, coverImage: media(n.primaryImage, n.title) })),
    vacancies: vacancies.map((v) => ({ title: v.title, slug: v.slug, sourceType: 'IMPORTED' as const, description: v.summary, sourceUrl: v.detailUrl })),
    reviews: (reviews?.items || []).slice(0, 12).map((i) => ({ author: i.meta?.author || i.title, text: i.text || i.title || '' })),
    contacts: {
      phone: plan.contacts.phones[0]?.value,
      email: plan.contacts.emails[0]?.value,
      address: plan.contacts.addresses[0]?.value,
      workingHours: plan.contacts.workingHours,
      socialLinks: plan.contacts.socialLinks,
    },
    products: products.map((p) => ({
      title: p.title, slug: p.slug, sourceType: 'IMPORTED' as const,
      summary: p.cardSummary || undefined, attributes: p.attributes,
      blocks: blocksOf(p, dynCopy), sourceUrl: p.detailUrl,
      coverImage: media(p.primaryImage, p.title),
      gallery: p.media.slice(0, 8).map((u) => media(u, p.title)!).filter(Boolean),
    })),
    dynamicSections: plan.dynamicSections
      .filter((d) => d.kind !== 'IGNORED' && d.items.length)
      .map((d) => ({ kind: d.kind, heading: d.heading, cta: (d as any).cta, items: d.items.slice(0, 30).map((i) => ({ title: i.title, text: i.text, meta: i.meta })) })),
    media: plan.media.images.map((m) => media(m.src)!),
    cta: { title: exp?.presentation.heroCtaSecondary && plan.experience?.archetype === 'CATALOG' ? 'Подберите дом в каталоге' : 'Обсудить ваш проект', description: '', buttonLabel: 'Связаться', buttonUrl: 'HOME_SECTION:CONTACTS' },
  };
}
