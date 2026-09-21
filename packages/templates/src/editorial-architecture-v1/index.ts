import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, escapeHtmlAttribute, escapeJsonForScript } from '@minsk/security';
import type { RenderContext } from '../types.js';
import { selectBlockItems } from '../resolveHomepage.js';
import { mediaUrlOf } from '../media.js';
import { buildNavItems, navForArea } from '../nav.js';
import { editorialArchitectureV1Manifest } from './manifest.js';

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

function mediaUrl(ctx: RenderContext, id?: string): string | undefined {
  if (!id) return undefined;
  const media = ctx.mediaMap.get(id);
  if (!media) return undefined;
  return mediaUrlOf(ctx.site?.id, media);
}

export function editorialArchitectureV1(ctx: RenderContext): string {
  const html = readFileSync(resolve(__dirname, 'public/index.html'), 'utf-8');
  const settings = ctx.settings || {};
  const companyName = settings.companyName || ctx.site?.name || 'Компания';
  const token = ctx.previewToken || ctx.site?.previewToken || '';
  const base = token ? `/showcase/${token}` : '';
  // Internal absolute-path links in CMS content (CTA/hero buttons) must stay
  // inside the preview context — same scoping as navigation.
  const scopeHref = (href?: string) =>
    href && base && /^\/(?!\/|site-media\/|api\/|showcase\/)/.test(href) ? `${base}${href}` : href || '';

  const phone = settings.phone || '';
  const phoneHref = cleanPhone(phone) ? `tel:${cleanPhone(phone)}` : '';

  const theme = ctx.theme || {};
  const primaryColor = theme.primaryColor || editorialArchitectureV1Manifest.fallbackPrimaryColor!;
  const themeStyle = `<style>:root {
  --bg: ${theme.backgroundColor || '#f2ede4'};
  --bg-2: ${theme.surfaceColor || '#e8e2d6'};
  --ink: ${theme.textColor || '#181512'};
  --muted: ${theme.mutedColor || '#6b6257'};
  --accent: ${primaryColor};
  --rule: ${hexToRgba(theme.textColor || '#181512', 0.18)};
  --rule-strong: ${hexToRgba(theme.textColor || '#181512', 0.4)};
}</style>`;

  // Canonical composition: ctx.homepageSections is already resolved from
  // published homepage Page.blocks (preferred) or themeConfig fallback.
  const sections = (ctx.homepageSections || []).filter((s: any) => s.enabled !== false);

  const mapService = (s: any) => ({
    id: s.id,
    slug: s.slug,
    title: s.title || '',
    summary: s.shortDescription || '',
    image: mediaUrl(ctx, s.imageId),
    content: textFrom(s),
  });

  const mapProject = (p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title || '',
    category: p.category || '',
    location: p.location || '',
    excerpt: p.excerpt || '',
    content: textFrom(p),
    image: mediaUrl(ctx, p.coverImageId),
    gallery: (p.projectMedia || []).map((pm: any) => mediaUrl(ctx, pm.media?.id) || pm.media?.sourceUrl).filter(Boolean),
  });

  const mapNews = (n: any) => ({
    id: n.id,
    slug: n.slug,
    title: n.title || '',
    date: formatDateRu(n.publishedAt),
    excerpt: n.excerpt || '',
    image: mediaUrl(ctx, n.coverImageId),
  });

  const mapVacancy = (v: any) => ({
    id: v.id,
    slug: v.slug,
    title: v.title || '',
    location: v.location || '',
    description: v.description || '',
  });

  const collectionMappers: Record<string, { items: any[]; map: (x: any) => any }> = {
    services: { items: ctx.services || [], map: mapService },
    projects: { items: ctx.projects || [], map: mapProject },
    news: { items: ctx.news || [], map: mapNews },
    vacancies: { items: ctx.vacancies || [], map: mapVacancy },
  };

  const heroBlock = sections.find((s: any) => s.type === 'hero')?.block;
  const heroSrc = { ...(ctx.hero || {}), ...(heroBlock || {}) };
  const aboutBlock = sections.find((s: any) => s.type === 'about')?.block;
  const aboutSrc = { ...(ctx.about || {}), ...(aboutBlock || {}) };
  const ctaBlock = sections.find((s: any) => s.type === 'cta')?.block;
  const ctaSrc = { ...(ctx.cta || {}), ...(ctaBlock || {}) };

  const resolveBlockMedia = (b: any): string | undefined => {
    if (!b) return undefined;
    if (b.imageId) return mediaUrl(ctx, b.imageId);
    if (b.image && typeof b.image === 'string' && b.image.startsWith('http')) return b.image;
    return undefined;
  };

  const outSections = sections.map((s: any) => {
    const type = s.type;
    const baseOut: any = {
      id: s.id,
      type,
      heading: s.heading || s.title || s.block?.heading || s.block?.title || '',
      displayVariant: s.displayVariant || s.block?.displayVariant,
      supported: true,
    };
    const col = collectionMappers[type];
    if (col) {
      const selected = selectBlockItems(col.items, {
        limit: s.limit ?? s.block?.limit,
        selectedItemIds: s.selectedItemIds ?? s.block?.selectedItemIds,
      });
      return { ...baseOut, items: selected.map(col.map) };
    }
    if (type === 'hero') {
      return {
        ...baseOut,
        title: heroSrc.title || companyName,
        subtitle: heroSrc.subtitle || heroSrc.body || heroSrc.tag || '',
        image: resolveBlockMedia(heroSrc) || mediaUrl(ctx, heroSrc.imageId),
        // No invented CTAs: a button renders only when CMS provides both
        // a label and a real target.
        buttonLabel: heroSrc.buttonLabel || '',
        buttonUrl: scopeHref(heroSrc.buttonUrl),
      };
    }
    if (type === 'about') {
      return {
        ...baseOut,
        content: aboutSrc.content || aboutSrc.text || '',
        image: resolveBlockMedia(aboutSrc) || mediaUrl(ctx, aboutSrc.imageId),
      };
    }
    if (type === 'cta') {
      return {
        ...baseOut,
        title: ctaSrc.title || baseOut.heading || '',
        description: ctaSrc.description || '',
        buttonLabel: ctaSrc.buttonLabel || '',
        buttonUrl: scopeHref(ctaSrc.buttonUrl),
      };
    }
    if (type === 'contacts') return { ...baseOut };
    // text / image / gallery / unknown blocks pass through their payload.
    const b = s.block || {};
    return {
      ...baseOut,
      content: b.content || b.text || '',
      image: resolveBlockMedia(b),
      caption: b.caption || '',
      imageUrls: Array.isArray(b.imageIds) ? b.imageIds.map((id: string) => mediaUrl(ctx, id)).filter(Boolean) : undefined,
    };
  });

  // Canonical navigation: CMS MenuItem records are the single source of truth.
  // The template never fabricates a menu from homepage sections.
  const navItems = buildNavItems(ctx.menu, base);
  // Drop menu items whose in-page anchor is not rendered by this composition —
  // a menu must never produce a dead anchor. Studio still shows all items.
  const anchorByType: Record<string, string> = {
    hero: 'hero', services: 'services', projects: 'projects', about: 'about',
    contacts: 'contact', cta: 'contact', news: 'news', vacancies: 'vacancies',
  };
  const renderedAnchors = new Set(sections.map((s: any) => anchorByType[s.type] || `section-${s.type || 'block'}`));
  const navRenderable = (items: typeof navItems): typeof navItems =>
    items
      .filter((i) => {
        const hash = i.href.indexOf('#');
        if (hash < 0) return true;
        const anchor = i.href.slice(hash + 1);
        return anchor === 'hero' || renderedAnchors.has(anchor);
      })
      .map((i) => ({ ...i, children: i.children ? navRenderable(i.children) : undefined }));
  const nav = {
    header: navForArea(navRenderable(navItems), 'header'),
    footer: navForArea(navRenderable(navItems), 'footer'),
  };

  const cmsPayload = {
    route: ctx.route,
    subRoute: ctx.subRoute,
    PREVIEW_TOKEN: token,
    SITE_ID: ctx.site?.id || '',
    NAV: nav,
    MANIFEST: editorialArchitectureV1Manifest,
    COMPANY: {
      name: companyName,
      legalName: settings.legalName || '',
      unp: settings.unp || '',
      founded: settings.founded || '',
      employees: settings.employees || '',
      address: settings.address || '',
      workingHours: settings.workingHours || '',
      phone,
      phoneHref,
      email: settings.email || '',
    },
    LOGO: mediaUrl(ctx, ctx.logo?.id),
    FAVICON: mediaUrl(ctx, ctx.favicon?.id),
    SECTIONS: outSections,
  };

  const scriptBlock = `<script>window.__CMS__=${escapeJsonForScript(cmsPayload)};</script>`;

  let result = html
    .replace(/<head>/, `<head>\n    ${themeStyle}`)
    .replace('<title>', `<meta name="robots" content="noindex, nofollow" />\n    <title>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(companyName)}</title>`)
    .replace(/{{COMPANY_NAME}}/g, escapeHtml(companyName))
    .replace(/<script type="module"/, `${scriptBlock}\n    <script type="module"`);

  const favicon = cmsPayload.FAVICON;
  if (favicon) {
    result = result.replace('</head>', `<link rel="icon" href="${escapeHtmlAttribute(favicon)}" />\n  </head>`);
  }

  return result;
}
