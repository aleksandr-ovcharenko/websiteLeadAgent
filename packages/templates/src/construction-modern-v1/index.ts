import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderContext } from '../types.js';
import { constructionModernV1Manifest } from './manifest.js';
import { isPresetId, presetCSS } from './stylePresets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function cleanPhone(input: string): string {
  return (input || '').replace(/[^\d+]/g, '');
}

function hexToRgba(hex: string, alpha = 1): string {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const [r, g, b] = h.split('').map((c) => parseInt(c + c, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}

function formatDateRu(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function textFrom(page: any): string {
  if (!page) return '';
  if (Array.isArray(page.blocks)) {
    return page.blocks.map((b: any) => b.content || b.text || '').join('\n');
  }
  return page.content || '';
}

function findPhoneNumbers(text: string, limit = 10): string[] {
  const matches = text.match(/[+\d\s\-\(\)]{7,24}/g) || [];
  const cleaned = matches
    .map((m) => m.replace(/\s+/g, ' ').trim())
    .filter((m) => /\d/.test(m) && m.replace(/\D/g, '').length >= 7)
    .filter((m, i, arr) => arr.indexOf(m) === i);
  return cleaned.slice(0, limit);
}

function mediaUrl(ctx: RenderContext, id?: string): string | undefined {
  if (!id) return undefined;
  const media = ctx.mediaMap.get(id);
  if (!media) return undefined;
  if (media.sourceUrl && media.sourceUrl.startsWith('http')) return media.sourceUrl;
  const filename = media.filename || media.storagePath?.split('/').pop();
  if (filename) return `/site-media/${ctx.site.id}/${filename}`;
  return undefined;
}

function buildCompany(ctx: RenderContext) {
  const settings = ctx.settings || {};
  const site = ctx.site || {};
  const companyName = settings.companyName || site.name || 'Компания';
  const domain = site.domain || site.slug || '';
  const rawPhone = settings.phone || '';
  const phone = rawPhone;
  const phoneHref = cleanPhone(rawPhone) ? `tel:${cleanPhone(rawPhone)}` : '';
  const email = settings.email || '';
  const tenderEmail = settings.email || email;
  const address = settings.address || '';

  const contactsPage = ctx.pages?.find((p) => p.slug === 'contacts' || /контакт/i.test(p.title || ''));
  const contactsText = textFrom(contactsPage);
  const allPhones = findPhoneNumbers(contactsText || rawPhone).slice(0, 4);
  const generalPhones = allPhones.slice(0, 2).map((p) => ({ phone: p, href: `tel:${cleanPhone(p)}`, label: 'приёмная' }));
  const procurementPhones = allPhones.slice(2, 4).map((p) => ({ phone: p, href: `tel:${cleanPhone(p)}` }));

  return {
    name: companyName,
    legalName: settings.legalName || '',
    unp: settings.unp || '',
    founded: settings.founded || '',
    employees: settings.employees || '',
    address: {
      zip: '',
      city: '',
      street: address,
      room: '',
      formatted: address
    },
    hours: settings.workingHours || '',
    phone,
    phoneHref,
    domain,
    contacts: {
      general: generalPhones.length ? generalPhones : (phone ? [{ phone, href: phoneHref, label: 'приёмная' }] : []),
      procurement: procurementPhones.length ? procurementPhones : [],
      email,
      tenderEmail
    }
  };
}

export function constructionModernV1(ctx: RenderContext): string {
  const html = readFileSync(resolve(__dirname, 'public/index.html'), 'utf-8');
  const company = buildCompany(ctx);

  const token = ctx.site?.previewToken || '';
  const base = token ? `/showcase/${token}` : '';

  const SECTION_BY_SLUG: Record<string, string> = {
    about: 'about',
    services: 'services',
    objects: 'projects',
    projects: 'projects',
    news: 'news',
    vacancies: 'vacancies',
    contacts: 'contacts'
  };

  const homepageSections = (ctx.homepageSections || []).filter((s: any) => s.enabled !== false);

  function navItemFromSection(s: any, idx: number): any {
    const byType: Record<string, any> = {
      hero: { label: s.title || 'Главная', targetType: 'HOME', target: '', showInHeader: true, showInFooter: true, showOnHomepage: true },
      about: { label: s.title || 'О компании', targetType: 'HOME_SECTION', target: 'ABOUT', showInHeader: true, showInFooter: true, showOnHomepage: true },
      services: { label: s.title || 'Услуги', targetType: 'COLLECTION', target: 'SERVICES', showInHeader: true, showInFooter: true, showOnHomepage: true },
      projects: { label: s.title || 'Объекты', targetType: 'COLLECTION', target: 'PROJECTS', showInHeader: true, showInFooter: true, showOnHomepage: true },
      news: { label: s.title || 'Новости', targetType: 'COLLECTION', target: 'NEWS', showInHeader: true, showInFooter: true, showOnHomepage: true },
      vacancies: { label: s.title || 'Вакансии', targetType: 'COLLECTION', target: 'VACANCIES', showInHeader: false, showInFooter: true, showOnHomepage: true },
      contacts: { label: s.title || 'Контакты', targetType: 'HOME_SECTION', target: 'CONTACTS', showInHeader: true, showInFooter: true, showOnHomepage: true },
      cta: { label: s.title || 'Контакты', targetType: 'HOME_SECTION', target: 'CONTACTS', showInHeader: false, showInFooter: false, showOnHomepage: true },
    };
    const item = byType[s.type] || { label: s.title || s.type, targetType: 'HOME_SECTION', target: (s.type || '').toUpperCase(), showInHeader: true, showInFooter: true, showOnHomepage: true };
    return { ...item, sortOrder: s.sortOrder ?? idx };
  }

  const navFromSections = homepageSections.map(navItemFromSection);

  const defaultNav = (ctx.menu && ctx.menu.length > 0)
    ? ctx.menu.filter((i: any) => i.visible !== false)
    : navFromSections;

  function resolveNavHref(item: any): string {
    if (!item) return '#';

    const showOnHomepage = item.showOnHomepage !== false;
    const targetType = item.targetType;
    const target = (item.target || '').toUpperCase();
    const key = target.toLowerCase();

    if (targetType === 'HOME') return `${base}/`;
    if (targetType === 'HOME_SECTION') return `${base}/#${key}`;
    if (targetType === 'COLLECTION') {
      if (showOnHomepage) return `${base}/#${key}`;
      return `${base}/${key}`;
    }
    if (targetType === 'PAGE') {
      const slug = item.page?.slug || target || '';
      if (slug) return `${base}/${slug}`;
    }
    if (targetType === 'CONTENT_DETAIL') {
      const [contentType, slug] = (item.target || '').split(':');
      if (contentType && slug) return `${base}/${contentType.toLowerCase()}/${slug}`;
    }
    if (targetType === 'EXTERNAL_URL' || targetType === 'CUSTOM_URL') {
      const u = item.url || item.target || '';
      if (/^https?:\/\//.test(u)) return u;
      if (u.startsWith('http')) return u;
      return u.startsWith('/') ? u : `${base}/${u}`;
    }

    // Legacy fallback for un-migrated menu rows: infer from page.slug or url
    if (item.url && /^https?:\/\//.test(item.url)) return item.url;
    const pageSlug = item.page?.slug || '';
    if (pageSlug) {
      const sectionKey = SECTION_BY_SLUG[pageSlug];
      if (sectionKey) return showOnHomepage ? `${base}/#${sectionKey}` : `${base}/${sectionKey}`;
      if (pageSlug === 'index') return `${base}/`;
      return `${base}/${pageSlug}`;
    }
    const u = (item.url || '').replace(/^\/+/, '').replace(/\/$/, '');
    if (u) {
      const sectionKey = SECTION_BY_SLUG[u];
      if (sectionKey) return showOnHomepage ? `${base}/#${sectionKey}` : `${base}/${sectionKey}`;
      if (u === 'index') return `${base}/`;
      return `${base}/${u}`;
    }
    return '#';
  }

  function buildNav(items: any[], prefix = 'nav_', start = 0): any[] {
    return items.map((item: any, i: number) => {
      const id = item.id || `${prefix}${start + i}`;
      const children = item.children?.length ? buildNav(item.children, `${id}_`, 0) : undefined;
      return {
        id,
        label: item.label || item.title || 'Item',
        href: resolveNavHref(item),
        external: !!item.url && /^https?:\/\//.test(item.url),
        targetType: item.targetType,
        target: item.target,
        pageId: item.pageId,
        sortOrder: item.sortOrder ?? (start + i),
        showInHeader: item.showInHeader !== false,
        showInFooter: item.showInFooter !== false,
        showOnHomepage: item.showOnHomepage !== false,
        children
      };
    });
  }

  const rawNav = buildNav(defaultNav);

  const seen = new Set<string>();
  const nav = rawNav.filter((n: any) => n.href !== '#').filter((n: any) => {
    if (seen.has(n.label)) return false;
    seen.add(n.label);
    return true;
  });

  // No external placeholder images — empty source URL means the template should hide the image.
  const defaultProjectImages: string[] = [];
  const defaultNewsImage: string | undefined = undefined;

  const services = (ctx.services || []).map((s, i) => ({
    id: s.id,
    slug: s.slug,
    num: String(i + 1).padStart(2, '0'),
    title: s.title || 'Услуга',
    desc: s.shortDescription || (Array.isArray(s.blocks) ? s.blocks.map((b: any) => b.content || b.text || '').join(' ').slice(0, 240) : ''),
    content: textFrom(s),
    img: mediaUrl(ctx, s.imageId)
  }));

  function mapBlock(b: any) {
    return {
      ...b,
      type: b.type || 'text',
      imageUrl: b.imageUrl ?? mediaUrl(ctx, b.imageId),
      imageUrls: b.imageUrls ?? (b.imageIds ? b.imageIds.map((id: string) => mediaUrl(ctx, id)).filter(Boolean) : undefined)
    };
  }

  const pages = (ctx.pages || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title || 'Страница',
    isHomepage: p.isHomepage || false,
    content: textFrom(p),
    blocks: (p.blocks || []).map(mapBlock),
    seoTitle: p.seoTitle || '',
    seoDescription: p.seoDescription || ''
  }));

  const projects = (ctx.projects || []).map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: p.title || 'Объект',
    category: p.category || '',
    location: p.location || '',
    status: p.projectStatus || '',
    excerpt: p.excerpt || '',
    content: textFrom(p),
    img: mediaUrl(ctx, p.coverImageId),
    gallery: (p.projectMedia || []).map((pm: any) => mediaUrl(ctx, pm.media?.id) || pm.media?.sourceUrl).filter(Boolean)
  }));

  const news = (ctx.news || []).map((n) => ({
    id: n.id,
    slug: n.slug,
    date: formatDateRu(n.publishedAt),
    title: n.title || 'Новость',
    excerpt: n.excerpt || '',
    content: textFrom(n),
    coverImageUrl: mediaUrl(ctx, n.coverImageId)
  }));

  const vacancies = (ctx.vacancies || []).map((v) => ({
    id: v.id,
    slug: v.slug,
    title: v.title || 'Вакансия',
    location: v.location || '',
    description: v.description || '',
    requirements: v.requirements || '',
    conditions: v.conditions || '',
    contact: v.contact || ''
  }));

  const theme = ctx.theme || {};
  const primaryColor = theme.primaryColor || '#2563EB';
  const secondaryColor = theme.secondaryColor || primaryColor;
  const textColor = theme.textColor || '#1C2B23';
  const bgColor = theme.backgroundColor || '#F2F2F2';
  const surfaceColor = theme.surfaceColor || '#FFFFFF';
  const mutedColor = theme.mutedColor || '#5C7268';
  const borderColor = theme.borderColor || '#C8D5CE';
  const darkColor = '#111827';

  const stylePreset = isPresetId(ctx.stylePreset) ? ctx.stylePreset : undefined;
  const stylePresetTag = stylePreset ? presetCSS(stylePreset) : '';
  const bodyAttr = stylePreset ? ` data-style="${stylePreset}"` : '';

  const themeStyle = `<style>:root {
  --bg: ${bgColor};
  --fg: ${textColor};
  --dark: ${darkColor};
  --brass: ${primaryColor};
  --brass-light: ${secondaryColor};
  --muted: ${mutedColor};
  --border: ${borderColor};
  --card-bg: ${surfaceColor};
  --overlay: ${hexToRgba(darkColor, 0.55)};
}</style>`;

  function resolveHeroCta(raw?: string): string {
    if (!raw) return `${base}/contacts`;
    if (/^https?:\/\//.test(raw)) return raw;
    const target = raw.replace(/^\/+/, '').toUpperCase();
    const isCollection = ['SERVICES', 'PROJECTS', 'NEWS', 'VACANCIES'].includes(target);
    return resolveNavHref({ targetType: isCollection ? 'COLLECTION' : 'HOME_SECTION', target, showOnHomepage: true });
  }

  const logoUrl = mediaUrl(ctx, ctx.logo?.id);
  const faviconUrl = mediaUrl(ctx, ctx.favicon?.id);
  const heroImageUrl = mediaUrl(ctx, ctx.hero?.imageId);
  const aboutImageUrl = mediaUrl(ctx, ctx.about?.imageId);

  const cmsPayload = {
    route: ctx.route,
    subRoute: ctx.subRoute,
    PREVIEW_TOKEN: token,
    SITE_ID: ctx.site?.id || '',
    MANIFEST: constructionModernV1Manifest,
    THEME: theme,
    THEME_CSS: themeStyle,
    SETTINGS: ctx.settings,
    COMPANY: company,
    LOGO: logoUrl,
    FAVICON: faviconUrl,
    HERO: {
      title: ctx.hero?.title || company.name,
      subtitle: ctx.hero?.subtitle || '',
      image: heroImageUrl,
      buttonLabel: ctx.hero?.buttonLabel || 'Связаться',
      buttonUrl: resolveHeroCta(ctx.hero?.buttonUrl),
      secondaryCtaLabel: ctx.hero?.secondaryCtaLabel,
      secondaryCtaUrl: resolveHeroCta(ctx.hero?.secondaryCtaTarget),
      location: ctx.hero?.location || '',
      industry: ctx.hero?.industry || 'Компания'
    },
    ABOUT: {
      heading: ctx.about?.heading || 'О компании',
      content: ctx.about?.content || '',
      image: aboutImageUrl
    },
    CTA: {
      title: ctx.cta?.title || 'Обсудим ваш проект',
      description: ctx.cta?.description || '',
      buttonLabel: ctx.cta?.buttonLabel || 'Связаться',
      buttonUrl: ctx.cta?.buttonUrl || `${base}/contacts`
    },
    HOME_SECTIONS: homepageSections,
    NAV: nav,
    PAGES: pages,
    SERVICES: services,
    PROJECTS: projects,
    NEWS_ITEMS: news,
    VACANCIES: vacancies,
    PROCESS_STEPS: []
  };

  const scriptBlock = `<script>window.__CMS__=${JSON.stringify(cmsPayload)};window.__CMS_ROUTE__=${JSON.stringify({ route: ctx.route, subRoute: ctx.subRoute })};</script>`;

  let result = html
    .replace(/<head>/, `<head>\n    ${themeStyle}\n    ${stylePresetTag}`)
    .replace(/<body>/, `<body${bodyAttr}>`)
    .replace('<title>', `<meta name="robots" content="noindex, nofollow" />\n    <title>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${company.name}</title>`)
    .replace(/{{COMPANY_NAME}}/g, company.name)
    .replace(/{{COMPANY_NAME_LEGAL}}/g, company.legalName)
    .replace(/{{DOMAIN}}/g, company.domain)
    .replace(/{{EMAIL}}/g, company.contacts.email)
    .replace(/{{PHONE}}/g, company.phone)
    .replace(/{{ADDRESS}}/g, company.address.street)
    .replace(/<script type="module"/, `${scriptBlock}\n    <script type="module"`);

  if (faviconUrl) {
    result = result.replace('</head>', `<link rel="icon" type="image/png" href="${faviconUrl}" />\n  </head>`);
  }

  return result;
}
