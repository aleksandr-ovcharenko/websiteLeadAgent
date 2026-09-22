import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, escapeHtmlAttribute, escapeJsonForScript } from '@minsk/security';
import type { RenderContext } from '../types.js';
import { selectBlockItems } from '../resolveHomepage.js';
import { mediaUrlOf } from '../media.js';
import { buildNavItems, navForArea } from '../nav.js';
import { resolveRoute, pathOf, entitySourceDir, entityRoute, collectionRoute, paginate, clampPageSize } from '../routes.js';
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
  const companyName = settings.companyName || ctx.site?.name || '';
  const token = ctx.previewToken || ctx.site?.previewToken || '';
  const base = token ? `/showcase/${token}` : '';
  // Internal absolute-path links in CMS content (CTA/hero buttons) must stay
  // inside the preview context — same scoping as navigation.
  const scopeHref = (href?: string) =>
    href && base && /^\/(?!\/|site-media\/|api\/|showcase\/)/.test(href) ? `${base}${href}` : href || '';

  const phone = settings.phone || '';
  const phoneHref = cleanPhone(phone) ? `tel:${cleanPhone(phone)}` : '';
  // CMS-owned template copy — resolved once per render. Missing keys render
  // as empty strings; required keys are enforced by the visual QA gate.
  const templateCopy: Record<string, string> = (settings.templateCopy && typeof settings.templateCopy === 'object' ? settings.templateCopy : {}) as Record<string, string>;

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

  // ── Route resolution ────────────────────────────────────────────────────
  // Every showcase URL resolves to a concrete view. The payload carries only
  // what the current route needs plus navigation/settings/media relations.
  const resolved = resolveRoute(ctx);
  const isHome = resolved.kind === 'HOME';

  // Canonical composition: ctx.homepageSections is already resolved from
  // published homepage Page.blocks (preferred) or themeConfig fallback.
  const sections = isHome
    ? (ctx.homepageSections || []).filter((s: any) => s.enabled !== false)
    : [];

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
    content: textFrom(n),
    image: mediaUrl(ctx, n.coverImageId),
  });

  const mapProduct = (p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title || '',
    summary: p.summary || '',
    content: textFrom(p),
    image: mediaUrl(ctx, p.coverImageId),
    gallery: (p.productMedia || []).map((pm: any) => mediaUrl(ctx, pm.media?.id) || pm.media?.sourceUrl).filter(Boolean),
  });

  const mapVacancy = (v: any) => ({
    id: v.id,
    slug: v.slug,
    title: v.title || '',
    location: v.location || '',
    description: v.description || '',
  });

  // Display gate: draft/hidden/archived entities never reach a rendered list
  // even if a caller passes them through — the loader filters too, but the
  // template enforces the contract at the payload boundary as well.
  const publishedOnly = (items: any[]) =>
    (items || []).filter((x) => !x?.status || String(x.status).toUpperCase() === 'PUBLISHED');

  const collectionMappers: Record<string, { items: any[]; map: (x: any) => any }> = {
    services: { items: publishedOnly(ctx.services), map: mapService },
    projects: { items: publishedOnly(ctx.projects), map: mapProject },
    news: { items: publishedOnly(ctx.news), map: mapNews },
    vacancies: { items: publishedOnly(ctx.vacancies), map: mapVacancy },
    products: { items: publishedOnly(ctx.products || []), map: mapProduct },
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
      // Entity-navigation contract: every routable teaser carries a real
      // internal href via the shared builder; the section itself advertises
      // its collection route for the "Все …" action.
      return {
        ...baseOut,
        collectionHref: collectionRoute(type as any, ctx) ? `${base}${collectionRoute(type as any, ctx)}` : '',
        totalItems: col.items.length,
        showAllLink: s.showAllLink ?? s.block?.showAllLink ?? true,
        items: selected.map((x: any) => {
          const m = col.map(x);
          const r = entityRoute(x, ctx.pages || []);
          return { ...m, href: r ? `${base}${r}` : '' };
        }),
      };
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
    return { ...baseOut, ...mapPageBlock(b) };
  });

  // Map a raw CMS Page block to a renderable section payload — used for
  // inner page routes (PAGE / detail backing blocks / collections intros).
  function mapPageBlock(b: any): any {
    const type = String(b?.type || 'text').toLowerCase();
    const out: any = {
      id: b?.id,
      type,
      heading: b?.heading || b?.title || '',
      content: b?.content || b?.text || '',
      caption: b?.caption || '',
      image: resolveBlockMedia(b),
      imageUrls: Array.isArray(b?.imageIds) ? b.imageIds.map((id: string) => mediaUrl(ctx, id)).filter(Boolean) : undefined,
      enabled: b?.enabled !== false,
    };
    if (type === 'cta') {
      out.title = b?.title || b?.heading || '';
      out.description = b?.description || '';
      out.buttonLabel = b?.buttonLabel || '';
      out.buttonUrl = scopeHref(b?.buttonUrl);
    }
    const col = collectionMappers[type];
    if (col) {
      const selected = selectBlockItems(col.items, {
        limit: b?.limit, selectedItemIds: b?.selectedItemIds,
      });
      out.items = selected.map((x: any) => {
        const m = col.map(x);
        const r = entityRoute(x, ctx.pages || []);
        return { ...m, href: r ? `${base}${r}` : '' };
      });
    }
    if (type === 'certificates') {
      out.description = b?.description || '';
      out.items = (Array.isArray(b?.items) ? b.items : [])
        .filter((it: any) => it && it.enabled !== false)
        .map((it: any) => ({
          mediaId: it.mediaId,
          src: mediaUrl(ctx, it.mediaId) || (typeof it.mediaId === 'string' && /^https?:\/\//.test(it.mediaId) ? it.mediaId : undefined),
          caption: it.caption || '',
          docType: it.docType || '',
          issuedBy: it.issuedBy || '',
          issuedAt: it.issuedAt || '',
          sourceUrl: it.sourceUrl || '',
        }))
        .filter((it: any) => it.src);
    }
    // Typed structure blocks keep their item arrays verbatim.
    if (['faq', 'processsteps', 'features', 'richtext'].includes(type) && Array.isArray(b?.items)) {
      out.items = b.items;
    }
    if (type === 'reviews') {
      out.reviews = (Array.isArray(b?.reviews) ? b.reviews : [])
        .map((r: any) => ({ author: r?.author || '', text: r?.text || '', rating: typeof r?.rating === 'number' ? r.rating : undefined }))
        .filter((r: any) => r.text);
    }
    return out;
  }

  // Route-scoped payload — only what the current route renders.
  let pagePayload: any;
  let entityPayload: any;
  let collectionPayload: any;
  if (resolved.kind === 'PAGE' && resolved.page) {
    const p = resolved.page;
    pagePayload = {
      id: p.id, slug: p.slug, title: p.title,
      blocks: (p.blocks || []).filter((b: any) => b?.enabled !== false).map(mapPageBlock),
      sourceUrl: p.sourceUrl || '',
    };
  }
  if (resolved.kind.endsWith('_DETAIL') && resolved.entity) {
    const e = resolved.entity;
    const mapped =
      resolved.kind === 'SERVICE_DETAIL' ? mapService(e) :
      resolved.kind === 'PROJECT_DETAIL' ? mapProject(e) :
      resolved.kind === 'NEWS_DETAIL' ? mapNews(e) :
      resolved.kind === 'VACANCY_DETAIL' ? mapVacancy(e) :
      resolved.kind === 'PRODUCT_DETAIL' ? mapProduct(e) :
      { id: e.id, slug: e.slug, title: e.title || '', content: textFrom(e) };
    const backingBlocks = (Array.isArray(e.blocks) && e.blocks.length ? e.blocks : resolved.page?.blocks) || [];
    const kindToCollection: Record<string, any> = {
      SERVICE_DETAIL: 'services', PROJECT_DETAIL: 'projects', NEWS_DETAIL: 'news',
      VACANCY_DETAIL: 'vacancies', PRODUCT_DETAIL: 'products',
    };
    const colKind = kindToCollection[resolved.kind];
    const back = colKind ? collectionRoute(colKind, ctx) : undefined;
    entityPayload = {
      ...mapped,
      kind: resolved.kind,
      sourceUrl: e.sourceUrl || '',
      backHref: back ? `${base}${back}` : '',
      backLabel: colKind ? templateCopy[`back.${colKind}`] || '' : '',
      sections: backingBlocks.filter((b: any) => b?.enabled !== false).map(mapPageBlock),
    };
  }
  if (resolved.kind === 'COLLECTION' && resolved.collectionKind) {
    const col = collectionMappers[resolved.collectionKind];
    // Scope items to this index: an entity belongs to the collection page whose
    // path is its provenance parent dir (anchored '#item-*' sources report
    // their own path). When no entity provably belongs to this page (e.g.
    // root-slug details under a hinted index), show the full collection —
    // the index is global.
    const pagePath = pathOf(resolved.page?.sourceUrl || `/${resolved.page?.slug || resolved.path || ''}`);
    const all = col?.items || [];
    const scoped = all.filter((x: any) => x?.sourceUrl && entitySourceDir(x.sourceUrl) === pagePath);
    const items = (scoped.length ? scoped : all)
      .map((x: any) => {
        const m = col.map(x);
        // Collection cards link to the entity's own route — the imported page
        // slug when the source document became a Page, else the entity slug.
        const r = entityRoute(x, ctx.pages || []);
        return { ...m, href: r ? `${base}${r}` : '' };
      });
    // V3.7.2 pagination: the same-kind collection block on the index page is
    // the config carrier (pageSize / showAllLink) — it configures the list,
    // it is never rendered as a duplicate section.
    const pageBlocks = (resolved.page?.blocks || []) as any[];
    const cfgBlock = pageBlocks.find((b: any) => b && String(b.type) === resolved.collectionKind);
    const pageSize = clampPageSize(cfgBlock?.pageSize);
    const requested = Math.max(1, Math.floor(Number(ctx.page) || 1));
    const colRoute = collectionRoute(resolved.collectionKind, ctx) || `/${resolved.path}`;
    const sliced = paginate(items, requested, pageSize, (p) => `${base}${colRoute}?page=${p}`);
    collectionPayload = {
      kind: resolved.collectionKind,
      heading: resolved.page?.title || '',
      items: sliced.items,
      page: sliced.page,
      pageCount: sliced.pageCount,
      pageSize: sliced.pageSize,
      totalItems: sliced.total,
      pager: sliced.pager,
      blocks: pageBlocks.filter((b: any) => b?.enabled !== false && String(b.type) !== resolved.collectionKind).map(mapPageBlock),
    };
  }

  // Canonical navigation: CMS MenuItem records are the single source of truth.
  // The template never fabricates a menu from homepage sections.
  const navItems = buildNavItems(ctx.menu, base);
  // Drop menu items whose in-page anchor is not rendered by this composition —
  // a menu must never produce a dead anchor. Only meaningful on the homepage:
  // on inner routes `base/#anchor` links are valid full-page navigations.
  const anchorByType: Record<string, string> = {
    hero: 'hero', services: 'services', projects: 'projects', about: 'about',
    contacts: 'contact', cta: 'contact', news: 'news', vacancies: 'vacancies',
    products: 'products',
  };
  const renderedAnchors = new Set(sections.map((s: any) => anchorByType[s.type] || `section-${s.type || 'block'}`));
  const navRenderable = (items: typeof navItems): typeof navItems =>
    items
      .filter((i) => {
        if (!isHome) return true;
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

  const cmsPayload: Record<string, any> = {
    route: ctx.route,
    subRoute: ctx.subRoute,
    ROUTE: {
      type: resolved.kind,
      path: resolved.path,
      slug: resolved.slug,
      title: resolved.title || '',
    },
    BASE: base,
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
    // CMS-owned template copy dictionary — every user-visible furniture
    // string (pager, 404, menu labels, back links) comes from here.
    COPY: templateCopy,
  };
  if (pagePayload) cmsPayload.PAGE = pagePayload;
  if (entityPayload) cmsPayload.ENTITY = entityPayload;
  if (collectionPayload) cmsPayload.COLLECTION = collectionPayload;

  const scriptBlock = `<script>window.__CMS__=${escapeJsonForScript(cmsPayload)};</script>`;

  let result = html
    .replace(/<head>/, `<head>\n    ${themeStyle}`)
    .replace('<title>', `<meta name="robots" content="noindex, nofollow" />\n    <title>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(resolved.title ? `${resolved.title} — ${companyName}` : companyName)}</title>`)
    .replace(/{{COMPANY_NAME}}/g, escapeHtml(companyName))
    .replace(/<script type="module"/, `${scriptBlock}\n    <script type="module"`);

  const favicon = cmsPayload.FAVICON;
  if (favicon) {
    result = result.replace('</head>', `<link rel="icon" href="${escapeHtmlAttribute(favicon)}" />\n  </head>`);
  }

  return result;
}
