// V3.7.2 Phase 8 — automatic post-render QA gate.
//
// Runs after CMS import. Two tiers:
//   payload tier (always): fetch rendered routes over HTTP, analyse with
//     cheerio — identity, dead links, technical payload, broken images,
//     fabricated dates, duplicate adjacent content, visible technical blocks.
//   browser tier (playwright): console errors, horizontal overflow,
//     non-zero natural image dimensions, screenshots.
//
// The generator cannot report success without this gate — a missing renderer
// is a FAIL, not a skip.

import type { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface PostRenderCheck {
  route: string;
  check: string;
  ok: boolean;
  detail?: string;
}

export interface PostRenderQaReport {
  generatedAt: string;
  baseUrl: string;
  previewBase: string;
  routesChecked: string[];
  checks: PostRenderCheck[];
  errors: string[];
  warnings: string[];
  metrics: Record<string, number | string>;
  screenshots: string[];
  browserTier: 'ran' | 'failed' | 'skipped';
}

const TECH_MARKERS = [/t-form\s+js-form-proccess/i, /"fields"\s*:\s*\[\s*\{[^}]*"name"/i, /t396__/i, /data-formcarry/i];

function abs(base: string, href: string): string | undefined {
  try { return new URL(href, base).href; } catch { return undefined; }
}

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const r = await fetch(url, { redirect: 'follow' });
  return { status: r.status, body: await r.text() };
}

/** Bounded default route set: home, one route per generated entity type,
 *  the longest-text page, the largest-gallery entity, the news collection
 *  (when news exists), and a deliberate 404. */
export async function pickQaRoutes(prisma: PrismaClient, siteId: string): Promise<{ route: string; label: string }[]> {
  const routes: { route: string; label: string }[] = [{ route: '', label: 'home' }];
  const kinds: [string, string][] = [
    ['service', 'service-detail'], ['project', 'project-detail'],
    ['product', 'product-detail'], ['newsPost', 'news-detail'], ['vacancy', 'vacancy-detail'],
  ];
  let longest: { slug: string; len: number } | undefined;
  let gallery: { slug: string; count: number } | undefined;
  for (const [model, label] of kinds) {
    const items: any[] = await (prisma as any)[model].findMany({ where: { siteId, status: 'PUBLISHED' } }).catch(() => []);
    if (!items.length) continue;
    const first = items.find((i) => i.slug) || items[0];
    routes.push({ route: `/${first.slug}`, label });
    for (const i of items) {
      const len = JSON.stringify(i.blocks || []).length + (i.title?.length || 0);
      if (!longest || len > longest.len) longest = { slug: i.slug, len };
      const mediaCount = (i.projectMedia?.length ?? 0) + (i.productMedia?.length ?? 0);
      if (mediaCount && (!gallery || mediaCount > gallery.count)) gallery = { slug: i.slug, count: mediaCount };
    }
  }
  const newsCount = await (prisma as any).newsPost.count({ where: { siteId, status: 'PUBLISHED' } }).catch(() => 0);
  if (newsCount) routes.push({ route: '/blog', label: 'news-collection' }, { route: '/novosti', label: 'news-collection-alt' });
  if (newsCount > 9) routes.push({ route: '/blog?page=2', label: 'collection-page-2' });
  if (longest) routes.push({ route: `/${longest.slug}`, label: 'longest-text' });
  if (gallery) routes.push({ route: `/${gallery.slug}`, label: 'largest-gallery' });
  routes.push({ route: '/__definitely-not-a-page-v372__', label: 'deliberate-404' });
  const seen = new Set<string>();
  return routes.filter((r) => (seen.has(r.route) ? false : (seen.add(r.route), true)));
}

export async function runPostRenderQa(opts: {
  siteId: string;
  previewToken: string;
  prisma: PrismaClient;
  baseUrl?: string;
  browser?: boolean;
  artifactDir?: string;
  expectedEntityTitles?: { route: string; title: string }[];
}): Promise<PostRenderQaReport> {
  const baseUrl = (opts.baseUrl || process.env.RENDER_QA_BASE_URL || 'http://localhost:3336').replace(/\/+$/, '');
  const previewBase = `${baseUrl}/showcase/${opts.previewToken}`;
  const checks: PostRenderCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const screenshots: string[] = [];
  const routes = await pickQaRoutes(opts.prisma, opts.siteId);

  const push = (route: string, check: string, ok: boolean, detail?: string, severity: 'error' | 'warning' = 'error') => {
    checks.push({ route, check, ok, detail });
    if (!ok) (severity === 'error' ? errors : warnings).push(`[${route || '/'}] ${check}: ${detail || 'failed'}`);
  };

  // Renderer must be reachable — the gate cannot run without it.
  try {
    const h = await fetch(`${baseUrl}/health`);
    if (!h.ok) throw new Error(`health ${h.status}`);
  } catch (e: any) {
    errors.push(`renderer unreachable at ${baseUrl}: ${e?.message || e}`);
    return {
      generatedAt: new Date().toISOString(), baseUrl, previewBase,
      routesChecked: [], checks, errors, warnings,
      metrics: { routes: 0 }, screenshots, browserTier: 'skipped',
    };
  }

  const expectedByRoute = new Map((opts.expectedEntityTitles || []).map((x) => [x.route, x.title]));
  const internalLinks = new Set<string>();
  const imgSrcs = new Set<string>();

  /** Extract the embedded CMS payload — the renderer is client-side React, so
   *  the window.__CMS__ script IS the content contract for HTTP-tier checks. */
  const extractPayload = (body: string): Record<string, any> | undefined => {
    const i = body.indexOf('window.__CMS__=');
    if (i < 0) return undefined;
    const j = body.indexOf('</script>', i);
    const raw = body.slice(i + 'window.__CMS__='.length, j > i ? j : undefined).replace(/;\s*$/, '');
    try { return JSON.parse(raw); } catch { return undefined; }
  };

  // Recursive href/text walk over the payload: finds dead links and collects
  // internal links + image URLs regardless of which section carries them.
  const walkPayload = (node: any, onHref: (href: string, ctx: string) => void, onText: (t: string) => void, onImg: (src: string) => void, path = 'payload') => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n, i) => walkPayload(n, onHref, onText, onImg, `${path}[${i}]`)); return; }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'MANIFEST') continue; // component-registry metadata, not content
      if (typeof v === 'string') {
        if ((k === 'href' || k === 'url' || k === 'buttonUrl' || k === 'collectionHref' || k === 'backHref') && v) onHref(v, `${path}.${k}`);
        else if ((k === 'image' || k === 'src' || k === 'imageUrl' || k === 'logo' || k === 'favicon') && /^(\/|https?:|data:)/.test(v)) onImg(v);
        else if (['title', 'heading', 'content', 'summary', 'excerpt', 'description', 'subtitle', 'label', 'date', 'text'].includes(k)) onText(v);
      } else if (Array.isArray(v) && (k === 'imageUrls' || k === 'gallery')) {
        v.forEach((s) => typeof s === 'string' && onImg(s));
      } else if (typeof v === 'object') {
        walkPayload(v, onHref, onText, onImg, `${path}.${k}`);
      }
    }
  };

  for (const { route, label } of routes) {
    const url = `${previewBase}${route}`;
    const { status, body } = await fetchText(url);
    const is404 = label === 'deliberate-404';
    push(route, 'status', is404 ? status === 404 : status === 200, `HTTP ${status}`);

    const payload = extractPayload(body);
    push(route, 'cms payload present', !!payload, payload ? 'window.__CMS__ parsed' : 'no __CMS__ payload');
    if (!payload && !is404) continue;

    // Route identity: the payload's resolved route kind must match the request
    // (a 200 on an unknown path that silently renders HOME is a defect).
    const routeType = payload?.ROUTE?.type;
    if (is404) push(route, 'route kind', routeType === 'NOT_FOUND', `ROUTE.type=${routeType}`);
    else push(route, 'route kind', !!routeType && routeType !== 'NOT_FOUND', `ROUTE.type=${routeType}`);

    // Non-empty content measured on the payload's visible text mass.
    if (!is404) {
      const texts: string[] = [];
      walkPayload(payload, () => undefined, (t) => texts.push(t), () => undefined);
      const mass = texts.join(' ').replace(/\s+/g, ' ').trim().length;
      push(route, 'non-empty content', mass > 50, `${mass} chars of payload text`);
    }

    for (const m of TECH_MARKERS) {
      if (m.test(body)) push(route, 'technical payload', false, `marker ${m.source.slice(0, 40)}`);
    }
    push(route, 'no technical payload', !TECH_MARKERS.some((m) => m.test(body)), 'clean');

    // Entity identity: the payload's ROUTE title must carry the CMS title.
    const expected = expectedByRoute.get(route);
    if (expected) {
      const normT = expected.toLowerCase().slice(0, 24);
      const rt = String(payload?.ROUTE?.title || payload?.ENTITY?.title || '').toLowerCase();
      push(route, 'entity identity', rt.includes(normT), `expected "${expected.slice(0, 40)}", got "${rt.slice(0, 40)}"`);
    }

    walkPayload(payload, (href, where) => {
      if (href === '#' || href.startsWith('javascript:')) {
        push(route, 'dead entity link', false, `href="${href}" at ${where}`);
      } else if (href.startsWith(`/showcase/${opts.previewToken}`)) {
        internalLinks.add(href);
      }
    }, () => undefined, (src) => {
      if (src && !src.startsWith('data:')) imgSrcs.add(src.startsWith('/') ? `${baseUrl}${src}` : src);
    });

    // Duplicate adjacent content on homepage SECTIONS.
    const secNorms = (payload?.SECTIONS || []).map((s: any) =>
      JSON.stringify([s?.heading || '', (s?.items || []).map((i: any) => i?.title || '')]).slice(0, 400));
    for (let i = 1; i < secNorms.length; i++) {
      if (secNorms[i] && secNorms[i] === secNorms[i - 1]) {
        push(route, 'duplicate adjacent content', false, `sections ${i - 1}/${i} identical`);
      }
    }
  }

  // Internal link resolution (bounded): every in-scope link must resolve.
  for (const href of [...internalLinks].slice(0, 80)) {
    const u = abs(baseUrl, href);
    if (!u) continue;
    try {
      const r = await fetch(u, { method: 'GET' });
      if (r.status === 404) push(href, 'internal link resolves', false, 'HTTP 404');
      await r.arrayBuffer().then(() => undefined).catch(() => undefined);
    } catch (e: any) {
      push(href, 'internal link resolves', false, e?.message || 'fetch failed');
    }
  }

  // Broken images: every rendered image URL must return bytes.
  for (const src of [...imgSrcs].slice(0, 80)) {
    const u = abs(baseUrl, src);
    if (!u) continue;
    try {
      const r = await fetch(u, { method: 'HEAD' }).catch(() => fetch(u));
      push(src.slice(0, 80), 'image resolves', r.ok, `HTTP ${r.status}`);
    } catch (e: any) {
      push(src.slice(0, 80), 'image resolves', false, e?.message || 'fetch failed');
    }
  }

  // Fabricated publication dates: a news post with no CMS publishedAt must
  // render an empty ENTITY.date — never an import-time fallback like today.
  const newsNoDate = await (opts.prisma as any).newsPost.findMany({
    where: { siteId: opts.siteId, status: 'PUBLISHED', publishedAt: null },
    select: { slug: true },
  }).catch(() => []);
  for (const n of newsNoDate.slice(0, 10)) {
    const { body } = await fetchText(`${previewBase}/${n.slug}`);
    const payload = extractPayload(body);
    const rendered = payload?.ENTITY?.date;
    push(`/${n.slug}`, 'fabricated date', !rendered, rendered ? `renders "${rendered}" with no source date` : 'no date rendered');
    // Collection teasers must not carry a date for the dateless post either.
    for (const coll of ['/blog', '/novosti', '/news']) {
      const { body: cb } = await fetchText(`${previewBase}${coll}`);
      const cp = extractPayload(cb);
      const item = (cp?.COLLECTION?.items || []).find((i: any) => i.href?.endsWith(`/${n.slug}`));
      if (item?.date) push(coll, 'fabricated date', false, `teaser for ${n.slug} shows "${item.date}"`);
      if (item) break; // found the teaser — other candidate routes are alternates
    }
  }

  // Browser tier: console errors + horizontal overflow + natural image dims.
  let browserTier: PostRenderQaReport['browserTier'] = 'skipped';
  if (opts.browser !== false) {
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const shotDir = opts.artifactDir ? join(opts.artifactDir, 'screenshots') : undefined;
      if (shotDir) await mkdir(shotDir, { recursive: true });
      for (const { route, label } of routes.filter((r) => r.label !== 'deliberate-404')) {
        const page = await ctx.newPage();
        const consoleErrors: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
        page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 140)));
        await page.goto(`${previewBase}${route}`, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => consoleErrors.push(`goto: ${e.message}`));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        push(route, 'no horizontal overflow', overflow <= 1, `${overflow}px`);
        push(route, 'no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ') || 'clean');
        // Rendered DOM checks — the SPA shell is empty at HTTP level, so
        // content/link verification lives here where React has run.
        const bodyText = await page.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().length || 0);
        push(route, 'rendered body non-empty', bodyText > 50, `${bodyText} chars`);
        const deadLinks = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a')).filter((a) => {
            const h = (a.getAttribute('href') || '').trim();
            return h === '#' || h.startsWith('javascript:');
          }).length);
        push(route, 'no dead links in DOM', deadLinks === 0, `${deadLinks} dead`);
        const zeroImgs = await page.evaluate(() =>
          Array.from(document.querySelectorAll('img')).filter((i) => i.complete && i.naturalWidth === 0).length);
        push(route, 'image natural dimensions', zeroImgs === 0, `${zeroImgs} zero-dim`);
        // Giant unbounded heading guard.
        const giant = await page.evaluate(() =>
          Array.from(document.querySelectorAll('h1')).some((h) => h.getBoundingClientRect().height > window.innerHeight * 1.5));
        push(route, 'bounded heading', !giant, 'h1 exceeds 1.5× viewport');
        if (shotDir) {
          const p = join(shotDir, `${label || 'route'}.png`);
          await page.screenshot({ path: p, fullPage: true }).catch(() => undefined);
          screenshots.push(p);
        }
        await page.close();
      }
      // Mobile spot-check on homepage.
      const mp = await ctx.newPage();
      await mp.setViewportSize({ width: 390, height: 844 });
      await mp.goto(previewBase + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
      const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      push('home@390', 'no horizontal overflow', mOverflow <= 1, `${mOverflow}px`);
      if (shotDir) { const p = join(shotDir, 'home-390.png'); await mp.screenshot({ path: p, fullPage: true }).catch(() => undefined); screenshots.push(p); }
      await mp.close();
      await browser.close();
      browserTier = 'ran';
    } catch (e: any) {
      browserTier = 'failed';
      errors.push(`browser tier failed: ${e?.message || e}`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    previewBase,
    routesChecked: routes.map((r) => r.route),
    checks,
    errors,
    warnings,
    metrics: {
      routes: routes.length,
      checks: checks.length,
      failed: checks.filter((c) => !c.ok).length,
      internalLinks: internalLinks.size,
      images: imgSrcs.size,
    },
    screenshots,
    browserTier,
  };
}
