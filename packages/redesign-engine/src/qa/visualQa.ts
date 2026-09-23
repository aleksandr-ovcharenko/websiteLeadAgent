// V3.7.3 — VISUAL_VALIDATED: automated content-and-visual acceptance gate.
//
// Runs between RENDER_VALIDATED and HUMAN_REVIEW_READY. Payload presence and
// HTTP 200 are NOT enough — every check below uses Playwright bounding boxes
// and computed styles on the actually-rendered DOM.
//
// Checks (hero integrity contract + content-density contract):
//   • exactly one visible, non-empty H1 intersecting the first viewport
//   • H1/hero text not invisible (display/visibility/opacity/clip/color/z)
//   • hero media does not displace all meaningful content
//   • CTA visible with a valid destination when a source CTA exists
//   • no technical/accessibility string leakage in rendered text
//   • no internal labels (Clean Room / QA Build / fixture / regen / …)
//   • no reserved media frame without a rendered image
//   • no empty region > ~1 viewport, no blank half-screen column
//   • no horizontal overflow at 320/390/430/1440
//   • required CMS copy keys present (no renderer fallbacks)
//   • console errors and failed requests recorded per screenshot
//
// Screenshots are the review artifact — every shot is correlated with its
// route, viewport, DOM assertions, console errors and failed requests.

import type { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { REQUIRED_COPY_KEYS } from '../import/templateCopy.js';
import { findUnintendedRepeats, resolveEditorControl } from './editabilityAudit.js';

export interface VisualFinding {
  route: string;
  viewport: string;
  check: string;
  severity: 'error' | 'warning';
  detail?: string;
  selector?: string;
}

export interface VisualRepairHint {
  kind: 'clear-broken-image' | 'scrub-leaked-text';
  route: string;
  detail: string;
  /** media URL to detach (clear-broken-image) */
  mediaUrl?: string;
  /** exact rendered text to scrub (scrub-leaked-text) */
  text?: string;
}

export interface VisualShot {
  path: string;
  route: string;
  label: string;
  viewport: { w: number; h: number };
  assertions: { check: string; ok: boolean }[];
  consoleErrors: string[];
  failedRequests: string[];
  leakedStrings: string[];
}

/** renderedText→CMS-path audit row (CMS text ownership contract §9). */
export interface RenderedTextMap {
  renderedText: string;
  cmsPath: string | null;
  ownership: 'SOURCE' | 'AI' | 'EDITOR' | 'SYSTEM' | null;
  sourceUrl: string | null;
  hardcoded: boolean;
}

export interface VisualQaReport {
  generatedAt: string;
  previewBase: string;
  pass: number;
  findings: VisualFinding[];
  errors: string[];
  warnings: string[];
  repairHints: VisualRepairHint[];
  screenshots: VisualShot[];
  missingCopyKeys: string[];
  /** Per-route rendered-text→CMS-path audit. Any `hardcoded: true` row is a
   *  blocking finding — the renderer produced text no CMS field owns. */
  textAudit: Record<string, RenderedTextMap[]>;
  browserTier: 'ran' | 'failed';
}

// Extraction-leak patterns — strings that may only appear as source chrome,
// never as rendered customer text. Contextual (node-level), not a blunt
// substring ban: 'Next' inside a sentence is fine, a standalone carousel
// control label is not.
const LEAK_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /toggle navigation/i, label: 'Toggle navigation' },
  { re: /open menu|close menu/i, label: 'menu control (en)' },
  { re: /открыть меню|закрыть меню/i, label: 'menu control (ru)' },
  { re: /\bskip to (main |)content\b/i, label: 'skip link' },
  { re: /\bslide\s+\d+\s+of\s+\d+/i, label: 'slide counter' },
  { re: /swiper-|slick-|owl-|flickity/i, label: 'carousel widget class/text' },
  { re: /жду звонка|вернуться к чату|заказать звонок!/i, label: 'callback widget' },
  { re: /enable javascript|javascript is required|javascript отключ/i, label: 'js fallback text' },
  { re: /cookie(s)?\s+(policy|consent|настройки)/i, label: 'cookie widget' },
];

// Internal labels must never reach rendered text unless the exact phrase is
// source evidence (verified upstream). Rendered presence = blocking error.
const INTERNAL_LABEL_RE = /\b(clean\s*room|qa\s*build|test\s*site|fixture|regen|generated\s*site|smoke\s*test|e2e[-\s]test)\b/i;

interface BrowserPage {
  goto(u: string, o?: any): Promise<any>;
  evaluate(fn: any, arg?: any): Promise<any>;
  screenshot(o: any): Promise<any>;
  setViewportSize(s: { width: number; height: number }): Promise<void>;
  on(ev: string, fn: (a: any) => void): void;
  click(sel: string): Promise<void>;
  close(): Promise<void>;
}

/** DOM audit run inside the page — returns machine-readable findings. */
const DOM_AUDIT = `(() => {
  const out = { h1s: [], leaked: [], internalLabels: [], emptyFrames: [], emptyRegions: [], invisibleText: [], overlaps: [], overflowPx: 0, hero: null };
  const vw = window.innerWidth, vh = window.innerHeight;
  const txt = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
  const vis = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01 && r.width > 0 && r.height > 0;
  };
  // H1 audit
  document.querySelectorAll('h1').forEach((h) => {
    const r = h.getBoundingClientRect();
    const cs = getComputedStyle(h);
    const center = { x: r.left + r.width / 2, y: Math.min(Math.max(r.top + 2, 1), vh - 1) };
    const topEl = document.elementFromPoint(center.x, Math.max(0, center.y));
    const covered = topEl ? !(h === topEl || h.contains(topEl) || topEl.closest('h1') === h) : true;
    out.h1s.push({
      text: h.innerText.trim().slice(0, 120), visible: vis(h) && !covered,
      top: r.top, bottom: r.bottom, height: r.height,
      fontSize: parseFloat(cs.fontSize), covered,
      color: cs.color, bg: cs.backgroundColor,
    });
  });
  // Standalone slide-control words (nav/pager/button with bare Previous/Next)
  document.querySelectorAll('button, [role="button"], .slick-prev, .slick-next, .swiper-button-prev, .swiper-button-next').forEach((el) => {
    const t = (el.innerText || el.textContent || '').trim();
    if (/^(previous|next|пред\\.?|след\\.?)$/i.test(t) && vis(el)) out.leaked.push('control:' + t.slice(0, 40));
  });
  // Empty media frames: reserved media area with no rendered image
  document.querySelectorAll('figure, .collection__thumb, .case__image, .hero__figure, .services__figure').forEach((f) => {
    const img = f.querySelector('img');
    const r = f.getBoundingClientRect();
    const broken = !img || (img.complete && img.naturalWidth === 0);
    if (broken && r.height > 8 && r.width > 8 && r.bottom > 0 && r.top < vh * 3) {
      out.emptyFrames.push({ selector: f.className || f.tagName, w: Math.round(r.width), h: Math.round(r.height), src: img ? (img.currentSrc || img.src || '').slice(0, 200) : null });
    }
  });
  // Large empty regions: sections/cases with viewport-scale height and ~no text/media
  document.querySelectorAll('section, .case, .block, .page, main').forEach((el) => {
    const r = el.getBoundingClientRect();
    const text = (el.innerText || '').replace(/\\s+/g, '').length;
    const media = el.querySelectorAll('img, svg, video, canvas, iframe').length;
    if (r.height > vh * 0.85 && text < 24 && media === 0 && r.top < vh * 2 && r.bottom > 0) {
      out.emptyRegions.push({ selector: el.className || el.tagName, h: Math.round(r.height) });
    }
  });
  // Invisible text: has text mass but effectively hidden
  ['h1', 'h2', '.hero__lead', '.page__title', '.hero__cta'].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!(el.innerText || '').trim()) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const clipHidden = /inset\\((9[5-9]|100)%/.test(cs.clipPath || '');
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.01 || clipHidden) {
        out.invisibleText.push({ selector: sel, reason: clipHidden ? 'clip-path' : cs.display === 'none' ? 'display' : cs.visibility === 'hidden' ? 'visibility' : 'opacity' });
      } else if (cs.color === cs.backgroundColor && cs.color !== 'rgba(0, 0, 0, 0)') {
        out.invisibleText.push({ selector: sel, reason: 'same color as bg' });
      }
      void r;
    });
  });
  // Hero composition
  const hero = document.querySelector('.hero');
  if (hero) {
    const r = hero.getBoundingClientRect();
    const h1 = hero.querySelector('h1');
    const h1r = h1 ? h1.getBoundingClientRect() : null;
    const cta = hero.querySelector('.hero__cta');
    const ctar = cta ? cta.getBoundingClientRect() : null;
    const fig = hero.querySelector('.hero__figure, .hero__image, figure');
    const figr = fig ? fig.getBoundingClientRect() : null;
    out.hero = {
      height: Math.round(r.height),
      h1Top: h1r ? Math.round(h1r.top) : null,
      h1Bottom: h1r ? Math.round(h1r.bottom) : null,
      h1Text: h1 ? h1.innerText.trim().slice(0, 120) : null,
      cta: cta ? { top: Math.round(ctar.top), visible: ctar.width > 0 && ctar.height > 0, href: cta.getAttribute('href') } : null,
      mediaHeight: figr ? Math.round(figr.height) : 0,
      mediaTop: figr ? Math.round(figr.top) : null,
    };
  }
  out.overflowPx = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.textLen = txt.length;
  out.text = txt;
  return out;
})()`;

/**
 * renderedText → cmsPath audit. Walks every visible text node + user-facing
 * aria-labels, then tries to map each onto a payload string field. COPY
 * templates with {param} placeholders match via interpolation-aware compare.
 * Returns rows; a row with cmsPath=null means the renderer produced text no
 * CMS field owns → hardcoded → blocking.
 */
const TEXT_AUDIT = `(() => {
  const payload = window.__CMS__ || {};
  const flat = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n, i) => { if (typeof n === 'string' && n.trim().length >= 2) flat.push({ path: path + '[' + i + ']', value: n }); else walk(n, path + '[' + i + ']'); }); return; }
    for (const [k, v] of Object.entries(node)) {
      // Skip transport metadata and raw config dumps (THEME/SETTINGS mirror
      // DB config). Ownership must resolve to the canonical editable roots
      // (PAGE/COPY/COMPANY/NAV/entity lists) — not to a mirrored config leaf.
      if (k === 'MANIFEST' || k === 'PREVIEW_TOKEN' || k === 'SITE_ID' || k === 'BASE'
          || k === 'THEME' || k === 'THEME_CSS' || k === 'SETTINGS') continue;
      if (typeof v === 'string' && v.trim().length >= 2) flat.push({ path: path ? path + '.' + k : k, value: v });
      else if (typeof v === 'object') walk(v, path ? path + '.' + k : k);
    }
  };
  walk(payload, '');
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const interpRe = (tmpl) => new RegExp('^' + tmpl.split(/\\{[^}]+\\}/).map((p) => p.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.{0,40}') + '$');
  const findPath = (text) => {
    const t = norm(text);
    if (!t) return null;
    // Pass 1: exact/template matches — they beat substring matches so a styled
    // title split into word spans doesn't latch onto an unrelated field.
    for (const f of flat) {
      const v = norm(f.value);
      if (!v) continue;
      if (v === t) return { path: f.path, exact: true };
      // template-copy interpolation: 'Все {name}' ↔ 'Все объекты'
      if (/\\{[^}]+\\}/.test(v) && interpRe(v).test(t)) return { path: f.path, exact: true };
    }
    // Pass 2: substring match (rendered fragment of a longer value, or a
    // clampCopy-truncated prefix — strip the trailing ellipsis first).
    const tCore = t.replace(/[…\u2026.]+\s*$/, '').trim();
    for (const f of flat) {
      const v = norm(f.value);
      if (!v) continue;
      if (v.includes(t) || t.includes(v)) return { path: f.path, exact: false };
      if (tCore.length >= 8 && v.includes(tCore)) return { path: f.path, exact: false };
    }
    return null;
  };
  const rows = [];
  const seen = new Set();
  const pushText = (s, via) => {
    const t = norm(s);
    if (t.length < 2 || seen.has(t)) return;
    seen.add(t);
    const m = findPath(t) || {};
    rows.push({ renderedText: t.slice(0, 160), cmsPath: m.path || null, exact: m.exact !== false, via, routeType: (payload.ROUTE || {}).type || '', entityId: (payload.ENTITY || {}).id || '', entityKind: (payload.ENTITY || {}).kind || '', pageId: (payload.PAGE || {}).id || '', pageSlug: (payload.PAGE || {}).slug || '' });
  };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const el = n.parentElement;
      if (!el) return NodeFilter.FILTER_REJECT;
      if (el.closest('script,style,noscript,template')) return NodeFilter.FILTER_REJECT;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.01) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = tw.nextNode())) pushText(n.nodeValue, 'text');
  document.querySelectorAll('[aria-label]').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display !== 'none' && cs.visibility !== 'hidden') pushText(el.getAttribute('aria-label'), 'aria');
  });
  return rows;
})()`;

export async function runVisualQa(opts: {
  siteId: string;
  previewToken: string;
  prisma: PrismaClient;
  baseUrl?: string;
  artifactDir?: string;
  pass?: number;
  /** Routes to cover: homepage is mandatory; others from pickQaRoutes-style list. */
  routes?: { route: string; label: string }[];
}): Promise<VisualQaReport> {
  const baseUrl = (opts.baseUrl || process.env.RENDER_QA_BASE_URL || 'http://localhost:3336').replace(/\/+$/, '');
  const previewBase = `${baseUrl}/showcase/${opts.previewToken}`;
  const findings: VisualFinding[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const repairHints: VisualRepairHint[] = [];
  const screenshots: VisualShot[] = [];
  const missingCopyKeys = new Set<string>();
  const textAudit: Record<string, RenderedTextMap[]> = {};

  const push = (route: string, viewport: string, check: string, ok: boolean, detail?: string, severity: 'error' | 'warning' = 'error', selector?: string) => {
    findings.push({ route, viewport, check, severity: ok ? 'error' : severity, detail, selector });
    if (!ok) (severity === 'error' ? errors : warnings).push(`[${route || '/'} @${viewport}] ${check}: ${detail || 'failed'}`);
  };

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();

  // Phase 7 screenshot set: home desktop, home mobile, longest detail,
  // one collection, one entity detail, mobile menu open, pagination page 2.
  const shotDir = opts.artifactDir ? join(opts.artifactDir, 'screenshots') : undefined;
  if (shotDir) await mkdir(shotDir, { recursive: true });

  // ── renderedText→CMS ownership/sourceUrl enrichment ──────────────────────
  // The in-page audit returns cmsPath only; ownership + sourceUrl live in DB
  // provenance (fieldProvenance / sourceUrl), resolved here against the rows
  // the route actually renders.
  const provCache = new Map<string, any>();
  const getSettings = async () => {
    if (!provCache.has('settings')) provCache.set('settings',
      await (opts.prisma as any).siteSettings.findFirst({ where: { siteId: opts.siteId } }).catch(() => null));
    return provCache.get('settings');
  };
  const getEntity = async (kind: string, id: string) => {
    const key = `entity:${kind}:${id}`;
    if (!provCache.has(key)) {
      const model: any = { service: 'service', project: 'project', news: 'newsPost', vacancy: 'vacancy', product: 'product' }[kind] || 'service';
      provCache.set(key, await (opts.prisma as any)[model]?.findUnique?.({ where: { id } }).catch(() => null));
    }
    return provCache.get(key);
  };
  const getPage = async (idOrSlug: string) => {
    const key = `page:${idOrSlug}`;
    if (!provCache.has(key)) provCache.set(key,
      await (opts.prisma as any).page.findFirst({ where: { siteId: opts.siteId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] } }).catch(() => null));
    return provCache.get(key);
  };
  const homePage = async () => {
    if (!provCache.has('home')) provCache.set('home',
      await (opts.prisma as any).page.findFirst({ where: { siteId: opts.siteId, isHomepage: true } }).catch(() => null));
    return provCache.get('home');
  };
  const fieldProv = (prov: any, path: string) => {
    // fieldProvenance is { field: { ownership, sourceUrl, ... } } — look up by
    // the leaf field name of the cmsPath, then the second segment for blocks.
    if (!prov || typeof prov !== 'object') return null;
    const segs = path.split('.').slice(1);
    const leaf = segs[segs.length - 1]?.replace(/\[\d+\]/g, '');
    for (const cand of [segs.join('.').replace(/\[\d+\]/g, ''), leaf, segs[0]]) {
      if (cand && prov[cand]) return prov[cand];
    }
    return null;
  };
  const provenanceFor = async (cmsPath: string, meta: { routeType?: string; entityId?: string; entityKind?: string; pageId?: string; pageSlug?: string }): Promise<{ ownership: string; sourceUrl: string | null } | null> => {
    const root = cmsPath.split('.')[0].replace(/\[\d+\]/g, '');
    if (root === 'COPY') return { ownership: 'SYSTEM', sourceUrl: null };
    if (root === 'COMPANY' || root === 'LOGO' || root === 'NAV') {
      const st = await getSettings();
      const p = fieldProv(st?.fieldProvenance, root === 'COMPANY' ? 'companyName' : cmsPath);
      return { ownership: p?.ownership || 'SOURCE', sourceUrl: p?.sourceUrl || st?.brandSourceUrl || null };
    }
    if (root === 'ENTITY') {
      const e = await getEntity(meta.entityKind || 'service', meta.entityId || '');
      const p = fieldProv(e?.fieldProvenance, cmsPath);
      return { ownership: p?.ownership || (e?.manualModifiedAt ? 'EDITOR' : 'SOURCE'), sourceUrl: p?.sourceUrl || e?.sourceUrl || null };
    }
    if (root === 'PAGE') {
      const pg = await getPage(meta.pageId || meta.pageSlug || '');
      const p = fieldProv(pg?.fieldProvenance, cmsPath);
      return { ownership: p?.ownership || (pg?.manualModifiedAt ? 'EDITOR' : 'SOURCE'), sourceUrl: p?.sourceUrl || pg?.sourceUrl || null };
    }
    if (root === 'SECTIONS' || root === 'COLLECTION') {
      const pg = await homePage();
      const p = fieldProv(pg?.fieldProvenance, cmsPath);
      return { ownership: p?.ownership || (pg?.manualModifiedAt ? 'EDITOR' : 'SOURCE'), sourceUrl: p?.sourceUrl || pg?.sourceUrl || null };
    }
    return { ownership: 'SOURCE', sourceUrl: null };
  };

  const auditPage = async (page: BrowserPage, route: string, vw: { w: number; h: number }, label: string) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (m: any) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e: any) => consoleErrors.push(String(e).slice(0, 160)));
    page.on('requestfailed', (r: any) => failedRequests.push(`${r.url().slice(0, 120)}`));
    page.on('response', (r: any) => { if (r.status() >= 400 && !r.url().includes('favicon')) failedRequests.push(`HTTP ${r.status()} ${r.url().slice(0, 110)}`); });
    await page.goto(`${previewBase}${route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch((e: any) => consoleErrors.push(`goto: ${e.message}`));
    await page.evaluate(`new Promise((r) => setTimeout(r, 600))`);
    const a = await page.evaluate(DOM_AUDIT);
    const vtag = `${vw.w}x${vw.h}`;

    // ── Hero integrity contract ──
    const h1s = (a.h1s || []) as any[];
    const visibleH1 = h1s.filter((h) => h.visible && h.text);
    push(route, vtag, 'exactly one visible h1', visibleH1.length === 1, `${h1s.length} h1s, ${visibleH1.length} visible`);
    const h1 = visibleH1[0];
    if (h1) {
      push(route, vtag, 'h1 in first viewport', h1.top < vw.h && h1.bottom > 0, `top=${h1.top} bottom=${h1.bottom} vh=${vw.h}`);
      push(route, vtag, 'h1 non-empty', !!h1.text && h1.text.length >= 2, `"${(h1.text || '').slice(0, 60)}"`);
      push(route, vtag, 'h1 not covered', !h1.covered, h1.covered ? 'elementFromPoint shows overlay' : 'ok');
      push(route, vtag, 'h1 bounded height', h1.height < vw.h * 1.5, `${h1.height}px`);
    }
    if (a.hero) {
      const hero = a.hero;
      push(route, vtag, 'hero within ~1.4 viewport', hero.height <= vw.h * 1.4, `${hero.height}px vs ${vw.h}`);
      if (hero.cta) {
        push(route, vtag, 'hero cta visible', !!hero.cta.visible && hero.cta.top < vw.h, `top=${hero.cta.top} href=${hero.cta.href}`);
        push(route, vtag, 'hero cta has destination', !!hero.cta.href && hero.cta.href !== '#' && !String(hero.cta.href).startsWith('javascript:'), `href=${hero.cta.href}`);
      }
      if (hero.mediaHeight && h1) {
        push(route, vtag, 'media does not displace h1', hero.h1Top !== null && hero.h1Top < vw.h, `media=${hero.mediaHeight}px h1Top=${hero.h1Top}`);
      }
    }
    if (!(a as any).hero && route === '') {
      push(route, vtag, 'hero section present', false, 'no .hero element on homepage');
    }

    // ── Content density / empty layout ──
    push(route, vtag, 'no horizontal overflow', (a.overflowPx || 0) <= 1, `${a.overflowPx}px`);
    for (const f of (a.emptyFrames || []) as any[]) {
      push(route, vtag, 'media frame has image', false, `${f.selector} ${f.w}x${f.h} src=${f.src || 'none'}`, 'error', f.selector);
      if (f.src) repairHints.push({ kind: 'clear-broken-image', route, mediaUrl: f.src, detail: `${f.selector} reserves ${f.w}x${f.h} with a broken image` });
      else repairHints.push({ kind: 'clear-broken-image', route, detail: `${f.selector} reserves ${f.w}x${f.h} with no image` });
    }
    for (const r of (a.emptyRegions || []) as any[]) {
      push(route, vtag, 'no viewport-scale empty region', false, `${r.selector} h=${r.h}`, 'warning', r.selector);
    }
    for (const it of (a.invisibleText || []) as any[]) {
      push(route, vtag, 'no invisible text', false, `${it.selector} hidden by ${it.reason}`, 'error', it.selector);
    }
    push(route, vtag, 'rendered body non-empty', (a.textLen || 0) > 50, `${a.textLen} chars`);
    push(route, vtag, 'no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ') || 'clean', 'warning');
    push(route, vtag, 'no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | ') || 'clean', 'warning');

    // ── Content leakage ──
    const bodyText = String(a.text || '');
    const leakedStrings: string[] = [];
    for (const lp of LEAK_PATTERNS) {
      const m = bodyText.match(lp.re);
      if (m) {
        leakedStrings.push(lp.label);
        push(route, vtag, 'no technical text leak', false, `"${m[0].slice(0, 60)}" (${lp.label})`);
        repairHints.push({ kind: 'scrub-leaked-text', route, text: m[0], detail: `leaked ${lp.label}` });
      }
    }
    for (const l of (a.leaked || []) as string[]) {
      leakedStrings.push(l);
      push(route, vtag, 'no leaked control label', false, l, 'warning');
    }
    const il = bodyText.match(INTERNAL_LABEL_RE);
    if (il) push(route, vtag, 'no internal label rendered', false, `"${il[0]}" in body text`);

    // ── CMS copy completeness ──
    const copy = await page.evaluate(`(window.__CMS__ && window.__CMS__.COPY) || {}`);
    for (const k of REQUIRED_COPY_KEYS) {
      if (!copy[k] || !String(copy[k]).trim()) {
        missingCopyKeys.add(k);
        push(route, vtag, 'required cms copy', false, `missing COPY["${k}"]`);
      }
    }

    // ── renderedText → cmsPath audit (CMS text ownership §9) ──
    // Every visible rendered string must trace to a CMS field AND a concrete
    // editor control — a value existing in JSON is not ownership (V3.7.4 §4).
    // Desktop routes only — the same strings render at mobile widths.
    if (vw.w >= 1200) {
      const rows = (await page.evaluate(TEXT_AUDIT)) as { renderedText: string; cmsPath: string | null; exact?: boolean; via: string; routeType?: string; entityId?: string; entityKind?: string; pageId?: string; pageSlug?: string }[];
      const wordy = rows.filter((r) => /[A-Za-zА-Яа-яЁё]{2,}/.test(r.renderedText));
      const meta = rows[0] || {};
      // Resolve the entity/page row once for block-id lookups.
      const routeEntity = meta.entityId ? await getEntity(meta.entityKind || 'service', meta.entityId) : null;
      const routePage = meta.pageId || meta.pageSlug ? await getPage(meta.pageId || meta.pageSlug || '') : (meta.routeType === 'HOME' ? await homePage() : null);
      const cmsPayload = (await page.evaluate('window.__CMS__ || {}')) as any;
      const enrich = async (r: (typeof wordy)[number]) => {
        const prov = r.cmsPath ? await provenanceFor(r.cmsPath, meta) : null;
        const editorControlId = r.cmsPath ? resolveEditorControl(r.cmsPath, meta, { entity: routeEntity, page: routePage, home: await homePage(), payload: cmsPayload }) : null;
        return {
          renderedText: r.renderedText, cmsPath: r.cmsPath, exact: r.exact !== false,
          cmsEntityType: meta.entityKind || (meta.pageId ? 'page' : null), cmsEntityId: meta.entityId || meta.pageId || null,
          editorControlId, editable: !!editorControlId,
          ownership: prov?.ownership ?? null, sourceUrl: prov?.sourceUrl ?? null, hardcoded: !r.cmsPath,
        };
      };
      const enriched: any[] = [];
      for (const r of wordy) enriched.push(await enrich(r));
      textAudit[`${route || '/'} @${vw.w}x${vw.h}`] = enriched;
      const unmapped = enriched.filter((r) => !r.cmsPath);
      for (const u of unmapped.slice(0, 8)) {
        push(route, vtag, 'rendered text owned by CMS', false, `"${u.renderedText.slice(0, 70)}" (${u.via})`, 'error');
      }
      if (unmapped.length > 8) push(route, vtag, 'rendered text owned by CMS', false, `+${unmapped.length - 8} more unmapped`, 'error');
      // cmsPath with no editor control is a failure — the string exists in
      // JSON but the CMS UI cannot edit it without data loss.
      const uneditable = enriched.filter((r) => r.cmsPath && !r.editable);
      for (const u of uneditable.slice(0, 8)) {
        push(route, vtag, 'rendered text editable in CMS', false, `"${u.renderedText.slice(0, 60)}" → ${u.cmsPath} has no editor control`, 'error');
      }
      if (uneditable.length > 8) push(route, vtag, 'rendered text editable in CMS', false, `+${uneditable.length - 8} more uneditable`, 'error');
      // Unintended repeats: same CMS value rendered multiple times on a route.
      for (const rep of findUnintendedRepeats(enriched).slice(0, 8)) {
        push(route, vtag, 'no unintentional duplicate render', false, `"${rep.renderedText.slice(0, 60)}" (${rep.cmsPath}) rendered >1×`, 'error');
      }
    }

    const shotPath = shotDir ? join(shotDir, `${label}-${vw.w}x${vw.h}${opts.pass ? `-p${opts.pass}` : ''}.png`) : '';
    if (shotPath) await page.screenshot({ path: shotPath, fullPage: false }).catch(() => undefined);
    if (shotPath) {
      screenshots.push({
        path: shotPath, route: route || '/', label, viewport: vw,
        assertions: findings.filter((f) => f.route === route && f.viewport === vtag).map((f) => ({ check: f.check, ok: !errors.includes(`[${route || '/'} @${vtag}] ${f.check}: ${f.detail || 'failed'}`) })),
        consoleErrors, failedRequests, leakedStrings,
      });
    }
    return a;
  };

  // Route set: homepage + supplied routes (bounded)
  const routes = [{ route: '', label: 'home' }, ...(opts.routes || [])];
  const seen = new Set<string>();
  const unique = routes.filter((r) => (seen.has(`${r.route}`) ? false : (seen.add(r.route), true)));

  // Homepage: four widths for overflow + full audit at 1440 and 390.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage() as unknown as BrowserPage;
    await auditPage(page, '', { w: 1440, h: 900 }, 'home-desktop');
    for (const w of [320, 390, 430]) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.evaluate(`new Promise((r) => setTimeout(r, 250))`);
      const ov = await page.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      push('', `${w}x844`, 'no horizontal overflow', ov <= 1, `${ov}px`);
      if (w === 390) {
        await auditPage(page, '', { w, h: 844 }, 'home-mobile');
        // Mobile menu open shot
        try {
          await page.click('.header__menu-toggle');
          await page.evaluate(`new Promise((r) => setTimeout(r, 350))`);
          const p2 = shotDir ? join(shotDir, 'home-mobile-menu-open.png') : undefined;
          if (p2) { await page.screenshot({ path: p2 }); screenshots.push({ path: p2, route: '/', label: 'home-mobile-menu-open', viewport: { w, h: 844 }, assertions: [], consoleErrors: [], failedRequests: [], leakedStrings: [] }); }
        } catch { /* menu toggle absent — homepage has no nav or desktop layout */ }
      }
    }
    await ctx.close();
  }

  // Other routes at desktop + 390. V3.7.6: no cap — the caller passes the
  // full CMS-derived route manifest and every published route must be
  // covered, since promotion requires a screenshot per manifest route.
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const r of unique.filter((r) => r.route !== '')) {
    const page = await ctx2.newPage() as unknown as BrowserPage;
    await auditPage(page, r.route, { w: 1440, h: 900 }, r.label);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${previewBase}${r.route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => undefined);
    const ov = await page.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    push(r.route, '390x844', 'no horizontal overflow', ov <= 1, `${ov}px`);
    const a = await page.evaluate(DOM_AUDIT);
    const vh1 = (a.h1s || []).filter((h: any) => h.visible && h.text);
    push(r.route, '390x844', 'h1 visible on mobile', vh1.length >= 1, `${vh1.length} visible h1`);
    if (a.hero) push(r.route, '390x844', 'hero within ~1.4 viewport', a.hero.height <= 844 * 1.4, `${a.hero.height}px`);
    if (shotDir) {
      const p = join(shotDir, `${r.label}-mobile${opts.pass ? `-p${opts.pass}` : ''}.png`);
      await page.screenshot({ path: p }).catch(() => undefined);
      screenshots.push({ path: p, route: r.route, label: `${r.label}-mobile`, viewport: { w: 390, h: 844 }, assertions: [], consoleErrors: [], failedRequests: [], leakedStrings: [] });
    }
    await page.close();
  }
  await ctx2.close();
  await browser.close();

  // Write report artifact
  const report: VisualQaReport = {
    generatedAt: new Date().toISOString(),
    previewBase,
    pass: opts.pass ?? 1,
    findings, errors, warnings, repairHints,
    screenshots,
    missingCopyKeys: [...missingCopyKeys],
    textAudit,
    browserTier: 'ran',
  };
  if (opts.artifactDir) {
    await writeFile(join(opts.artifactDir, `visual-qa${opts.pass ? `-p${opts.pass}` : ''}.json`), JSON.stringify(report, null, 2));
  }
  return report;
}
