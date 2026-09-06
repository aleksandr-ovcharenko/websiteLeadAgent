import type { ExtractedContent, ContentBlock, ContentNavigationItem } from '../../../content-schema/dist/index.js';
import type { SiteContentPlanV2, PlannedEntity } from './siteContentPlanV2.js';

// Bridge: SiteContentPlan V2 -> ExtractedContent (the importer's input).
// Deterministic — the plan is authoritative; this only maps shapes.

const media = (src?: string, alt?: string) => (src ? { sourceUrl: src, filename: src.split('/').pop()?.split('?')[0] || 'media', alt } : undefined);
const blocksOf = (e: PlannedEntity): ContentBlock[] => {
  const b: ContentBlock[] = [];
  if (e.summary) b.push({ type: 'text', content: e.summary });
  const attrs = Object.entries(e.attributes || {}).filter(([, v]) => v);
  if (attrs.length) b.push({ type: 'text', heading: 'Параметры', content: attrs.map(([k, v]) => `${k}: ${v}`).join('\n') });
  const gallery = e.media.filter((s) => s !== e.primaryImage).slice(0, 8);
  if (gallery.length) b.push({ type: 'gallery', imageIds: gallery });
  return b;
};

// CMS homepage section enum lacks 'products'/'articles' — products get a CTA
// banner into /products (never a fake "projects" block); articles live on
// their own pages and are not forced into a News block.
const HOMEPAGE_TYPE: Record<string, 'hero' | 'about' | 'services' | 'projects' | 'news' | 'contacts' | 'cta' | null> = {
  hero: 'hero', services: 'services', projects: 'projects', products: 'cta', news: 'news', articles: null,
  about: 'about', contacts: 'contacts', dynamic: 'about', cta: 'cta',
};

export function planToContent(plan: SiteContentPlanV2): ExtractedContent {
  const id = plan.siteIdentity;
  const byId = new Map(plan.entities.map((e) => [e.id, e]));

  // Navigation: internal semantic targets only.
  const navigation: ContentNavigationItem[] = plan.plannedNavigation.map((n) => ({ label: n.label, url: n.route }));

  const services = plan.entities.filter((e) => e.type === 'service');
  const projects = plan.entities.filter((e) => e.type === 'project');
  const products = plan.entities.filter((e) => e.type === 'product');
  const articles = plan.entities.filter((e) => e.type === 'article');
  const news = plan.entities.filter((e) => e.type === 'news');
  const vacancies = plan.entities.filter((e) => e.type === 'vacancy');

  // Products: CMS has no Product entity — render as catalog pages.
  const pages: ExtractedContent['pages'] = [];
  if (products.length) {
    pages.push({
      title: 'Каталог', slug: 'products', sourceType: 'IMPORTED', isHomepage: false,
      blocks: [
        { type: 'text', heading: 'Каталог', content: '' },
        ...products.slice(0, 60).map((p) => ({ type: 'text' as const, heading: p.title, content: p.summary || Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`).join('; ') })),
      ],
    });
    for (const p of products) {
      pages.push({ title: p.title, slug: `products/${p.slug}`, sourceType: 'IMPORTED', isHomepage: false, sourceUrl: p.detailUrl, blocks: blocksOf(p) });
    }
  }
  if (articles.length) {
    pages.push({ title: 'Статьи', slug: 'articles', sourceType: 'IMPORTED', isHomepage: false, blocks: articles.slice(0, 30).map((a) => ({ type: 'text' as const, heading: a.title, content: a.summary || '' })) });
    for (const a of articles) pages.push({ title: a.title, slug: `articles/${a.slug}`, sourceType: 'IMPORTED', isHomepage: false, sourceUrl: a.detailUrl, blocks: blocksOf(a) });
  }
  for (const d of plan.dynamicSections.filter((d) => d.kind !== 'IGNORED' && d.items.length)) {
    pages.push({
      title: d.heading || d.kind, slug: d.kind.toLowerCase(), sourceType: 'IMPORTED', isHomepage: false,
      blocks: d.items.slice(0, 30).map((i) => ({ type: 'text' as const, heading: i.title, content: i.text || '' })),
    });
  }

  const reviews = plan.dynamicSections.find((d) => d.kind === 'REVIEWS');
  const faq = plan.dynamicSections.find((d) => d.kind === 'FAQ');
  const process = plan.dynamicSections.find((d) => d.kind === 'PROCESS');
  const aboutDyn = plan.dynamicSections.find((d) => d.kind === 'ADVANTAGES' || d.kind === 'STATS');
  const aboutContent = [
    id.description,
    aboutDyn?.items?.length ? aboutDyn.items.map((i) => i.title || i.text).filter(Boolean).join('\n') : '',
    process?.items?.length ? process.items.map((i) => `${i.title ? i.title + ': ' : ''}${i.text || ''}`).join('\n') : '',
  ].filter(Boolean).join('\n\n');

  const homepageSections = plan.homepage.plannedSections
    .map((s, i) => {
      const t = HOMEPAGE_TYPE[s.type];
      if (!t) return null;
      if (s.type === 'products') return { type: 'cta' as const, enabled: true, sortOrder: i, title: s.heading };
      return { type: t, enabled: true, sortOrder: i, title: s.heading, limit: s.entityIds.length || undefined };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    // dedupe same-type sections (e.g. several dynamic sections all map to 'about')
    .filter((s, i, arr) => arr.findIndex((x) => x.type === s.type) === i);

  return {
    theme: { source: 'default', primaryColor: '#2f6b4f', textColor: '#1a1a1a', backgroundColor: '#ffffff' },
    hero: { title: id.displayName, subtitle: id.description, imageId: plan.media.hero, buttonLabel: 'Связаться', buttonUrl: '/contacts' },
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
    services: services.map((s) => ({ title: s.title, slug: s.slug, sourceType: 'IMPORTED' as const, shortDescription: s.summary, blocks: blocksOf(s), sourceUrl: s.detailUrl, image: media(s.primaryImage, s.title) })),
    projects: projects.map((p) => ({ title: p.title, slug: p.slug, sourceType: 'IMPORTED' as const, excerpt: p.summary, blocks: blocksOf(p), sourceUrl: p.detailUrl, coverImage: media(p.primaryImage, p.title), gallery: p.media.slice(0, 8).map((s) => media(s, p.title)!).filter(Boolean) })),
    news: news.map((n) => ({ title: n.title, slug: n.slug, sourceType: 'IMPORTED' as const, excerpt: n.summary, blocks: blocksOf(n), sourceUrl: n.detailUrl, coverImage: media(n.primaryImage, n.title) })),
    vacancies: vacancies.map((v) => ({ title: v.title, slug: v.slug, sourceType: 'IMPORTED' as const, description: v.summary, sourceUrl: v.detailUrl })),
    reviews: (reviews?.items || []).slice(0, 12).map((i) => ({ author: i.meta?.author || i.title, text: i.text || i.title || '' })),
    contacts: {
      phone: plan.contacts.phones[0]?.value,
      email: plan.contacts.emails[0]?.value,
      address: plan.contacts.addresses[0]?.value,
      workingHours: plan.contacts.workingHours,
      socialLinks: plan.contacts.socialLinks,
    },
    media: plan.media.images.map((m) => media(m.src)!),
    cta: faq ? { title: 'Часто задаваемые вопросы', description: faq.items.slice(0, 5).map((i) => i.title || i.text).filter(Boolean).join('\n'), buttonLabel: 'Связаться', buttonUrl: '/contacts' } : {},
  };
}
