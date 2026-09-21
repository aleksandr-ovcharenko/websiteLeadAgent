// graphToImportContent.ts — canonical adapter.
//
// Turns the SourceContentGraph (+ SourceDocuments for body text and media
// geometry) into the ExtractedContent payload that importToCms persists.
// This is the ONLY path used by canonical generation. Legacy extractFromCrawl
// remains for compatibility tests but is not the source of CMS entities.
//
// Invariants:
//  - every imported value carries provenance (sourceUrl + sourceDocumentId);
//  - entities are only imported from graph entities that were themselves
//    created from proven detail pages;
//  - the adapter never invents customer copy — absent fields stay absent.

import type { ExtractedContent } from '../../../content-schema/dist/index.js';
import type { CrawledPage, SourceDocument, SourceDocumentSection } from '../types.js';
import { inferTheme } from '../extract/extractFromCrawl.js';
import type {
  ImageCandidate,
  SourceContentGraph,
  ServiceEntity,
  ProjectEntity,
  NewsEntity,
  VacancyEntity,
} from '../semantic/schema.js';

// ---------------------------------------------------------------------------
// Provenance report — consumed by the pipeline artifact + v36 reports.
// ---------------------------------------------------------------------------

export interface EntityProvenance {
  title: string;
  slug: string;
  sourceUrl?: string;
  sourceDocumentId?: string;
  pageType?: string;
  confidence: number;
  status: string;
}

export interface MediaDecision {
  src: string;
  role: string;
  suitabilityScore: number;
  suitable: boolean;
  reasons: string[];
  usedAs?: string;
  sourceDocumentId?: string;
}

export interface DroppedEntity {
  title: string;
  reason: string;
  sourceDocumentId?: string;
}

export interface GraphImportProvenance {
  pages: EntityProvenance[];
  services: EntityProvenance[];
  projects: EntityProvenance[];
  news: EntityProvenance[];
  vacancies: EntityProvenance[];
  media: MediaDecision[];
  droppedEntities: DroppedEntity[];
}

// ---------------------------------------------------------------------------
// Media suitability scoring (Phase 5): evidence-backed, dimension-aware.
// ---------------------------------------------------------------------------

const COVER_REJECT_ROLES = new Set(['LOGO', 'UTILITY_ICON', 'LANGUAGE_ICON', 'ADVERTISEMENT']);
const BAD_FILENAME = /logo|icon|лого|favicon|fav-|removebg|placeholder|spinner|avatar|thumb(?!nail-?large)/i;

export interface MediaSuitability {
  score: number;
  suitable: boolean;
  reasons: string[];
}

export function scoreMediaSuitability(
  media: Pick<ImageCandidate, 'src' | 'alt' | 'width' | 'height' | 'role'>,
  usage: 'cover' | 'hero' | 'gallery' | 'inline' = 'cover'
): MediaSuitability {
  const reasons: string[] = [];
  const w = media.width || 0;
  const h = media.height || 0;
  const altFile = `${media.alt || ''} ${media.src.split('/').pop() || ''}`;

  if (COVER_REJECT_ROLES.has(media.role)) {
    return { score: 0, suitable: false, reasons: [`role:${media.role}`] };
  }
  if (BAD_FILENAME.test(altFile)) {
    return { score: 0, suitable: false, reasons: ['logo/icon filename or alt'] };
  }
  if (w > 0 && h > 0) {
    if (w < 320 || h < 200) {
      return { score: 0, suitable: false, reasons: [`too-small:${w}x${h}`] };
    }
    const ratio = w / h;
    if (ratio > 4 || ratio < 0.25) {
      return { score: 0, suitable: false, reasons: [`extreme-aspect:${ratio.toFixed(2)}`] };
    }
    if (usage === 'cover' || usage === 'hero') {
      if (ratio < 0.8) reasons.push(`portrait:${ratio.toFixed(2)}`);
    }
  } else {
    // Dimensions unknown (e.g. CSS background / data-* slider surfaces) —
    // neutral: region and role evidence decide, no penalty and no bonus.
    reasons.push('unknown-dimensions');
  }

  const base =
    media.role === 'HERO_CANDIDATE' ? 0.85 :
    media.role === 'SERVICE_IMAGE' || media.role === 'PROJECT_IMAGE' || media.role === 'ARTICLE_IMAGE' ? 0.8 :
    media.role === 'TEAM_IMAGE' ? 0.6 : 0.5;
  let score = base;
  if (w >= 1200) score += 0.1;
  if (w >= 2000) score += 0.05;
  if (w > 0 && h > 0 && w / h >= 1.2 && w / h <= 2.2) score += 0.05;
  if (reasons.some((r) => r.startsWith('portrait'))) score -= 0.15;
  score = Math.max(0, Math.min(1, score));
  return { score, suitable: score >= 0.5, reasons };
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}

function slugFromDocPath(path: string): string {
  const clean = path.replace(/\/+$/, '');
  const last = clean.split('/').pop() || 'index';
  return last === '' ? 'index' : last;
}

function firstSentences(text: string, count = 2, maxLen = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const parts = clean.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [clean];
  let out = parts.slice(0, count).join(' ').trim();
  if (out.length > maxLen) out = out.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  return out;
}

function cleanPhone(input: string): string {
  return input.replace(/[^\d+()\- ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function dropLeadingTitle(text: string, title: string | undefined): string {
  if (!text || !title) return text;
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  const t = norm(title);
  // Exact-line matches anywhere (headings get folded into paragraphs).
  const lines = text.split('\n').filter((line) => norm(line) !== t);
  let out = lines.join('\n');
  // Title glued to the front of a longer line (no newline separation).
  if (norm(out).startsWith(t)) out = out.trim().slice(title.length).replace(/^[\s.—–-]+/, '');
  return out;
}

const GENERIC_TITLES = new Set([
  'услуги', 'services', 'портфолио', 'portfolio', 'проекты', 'projects',
  'новости', 'news', 'контакты', 'contacts', 'главная', 'home',
  'вакансии', 'vacancies', 'о нас', 'about', 'о компании', 'компания', 'company',
]);

function isGenericTitle(t: string | undefined): boolean {
  if (!t) return true;
  return GENERIC_TITLES.has(t.trim().toLowerCase().replace(/\s+/g, ' '));
}

// Build the set of chrome tokens to strip from body text.
function chromeTokens(doc: SourceDocument, extraTokens: string[] = []): string[] {
  const tokens = new Set<string>();
  for (const t of extraTokens) tokens.add(t.trim().toLowerCase());
  for (const line of (doc.chrome.header?.text || '').split('\n')) {
    const t = line.trim().toLowerCase();
    if (t && t.length <= 60) tokens.add(t);
  }
  for (const p of doc.chrome.contacts?.phones || []) tokens.add(p.trim().toLowerCase());
  for (const e of doc.chrome.contacts?.emails || []) tokens.add(e.trim().toLowerCase());
  const addNav = (nodes?: { label: string; children?: any[] }[]) => {
    for (const n of nodes || []) {
      tokens.add(n.label.trim().toLowerCase());
      addNav(n.children);
    }
  };
  addNav(doc.chrome.nav?.primary);
  addNav(doc.chrome.nav?.secondary);
  tokens.add('x');
  return [...tokens].filter(Boolean);
}

function stripChromeLines(text: string, tokens: string[]): string {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const low = line.toLowerCase();
    // Drop lines that are pure chrome (nav label / phone / brand) or that are
    // dominated by chrome tokens (e.g. "Лишэн X +375 29 673-84-35").
    let residual = low;
    for (const t of tokens) residual = residual.split(t).join(' ');
    residual = residual.replace(/\+?[\d\s()\-]{6,}/g, ' ').replace(/\s+/g, ' ').trim();
    if (!residual || residual.length < 3) continue;
    // Skip lines that are just a phone or email.
    if (/^\+?[\d\s()\-]{6,}$/.test(low) || /^[\w.]+@[\w.]+\.\w+$/.test(low)) continue;
    out.push(line);
  }
  return out.join('\n');
}

function docBodyText(doc: SourceDocument | undefined, extraTokens: string[] = []): string {
  if (!doc) return '';
  const text = doc.mainText || doc.rawText || '';
  // The page's own h1 is metadata, not body copy — drop duplicate title lines.
  const tokens = [...extraTokens, doc.h1 || ''].filter(Boolean);
  return stripChromeLines(text, chromeTokens(doc, tokens)).trim();
}

function paragraphsToBlocks(text: string): { type: 'text'; content: string }[] {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  const blocks: { type: 'text'; content: string }[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > 900 && buf) {
      blocks.push({ type: 'text', content: buf });
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf) blocks.push({ type: 'text', content: buf });
  return blocks.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

function filenameFromUrl(src: string): string {
  try {
    const u = new URL(src);
    const last = decodeURIComponent(u.pathname.split('/').pop() || 'image');
    return last || 'image';
  } catch {
    return src.split('/').pop() || 'image';
  }
}

function mimeFromFilename(name: string): string {
  if (/\.(png)$/i.test(name)) return 'image/png';
  if (/\.(webp)$/i.test(name)) return 'image/webp';
  if (/\.(gif)$/i.test(name)) return 'image/gif';
  if (/\.(svg)$/i.test(name)) return 'image/svg+xml';
  if (/\.(avif)$/i.test(name)) return 'image/avif';
  return 'image/jpeg';
}

function mediaById(graph: SourceContentGraph): Map<string, ImageCandidate> {
  return new Map(graph.media.map((m) => [m.id, m]));
}

function entityImages(
  graph: SourceContentGraph,
  entity: { imageIds?: string[]; sourceDocumentIds: string[] },
  docsById: Map<string, SourceDocument>
): ImageCandidate[] {
  const mediaMap = mediaById(graph);
  const out: ImageCandidate[] = [];
  const seen = new Set<string>();
  for (const id of entity.imageIds || []) {
    const m = mediaMap.get(id);
    if (m && !seen.has(m.src)) { seen.add(m.src); out.push(m); }
  }
  // Fallback: suitable images from the entity's own source document.
  if (!out.length) {
    const doc = docsById.get(entity.sourceDocumentIds[0]);
    if (doc) {
      for (const img of doc.images || []) {
        if (img.region === 'main' && !seen.has(img.src)) {
          seen.add(img.src);
          out.push({
            id: `doc-img-${seen.size}`,
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height,
            role: 'UNKNOWN',
            confidence: 0.5,
            provenance: { sourceDocumentIds: [doc.id], sourceUrls: [doc.url] },
          });
        }
      }
    }
  }
  return out;
}

function pickCover(
  images: ImageCandidate[],
  usage: 'cover' | 'hero',
  decisions: MediaDecision[],
  usedAs: string
): ImageCandidate | undefined {
  let best: ImageCandidate | undefined;
  let bestScore = -1;
  for (const img of images) {
    const s = scoreMediaSuitability(img, usage);
    decisions.push({
      src: img.src, role: img.role, suitabilityScore: s.score,
      suitable: s.suitable, reasons: s.reasons, usedAs: s.suitable ? usedAs : undefined,
      sourceDocumentId: img.provenance?.sourceDocumentIds?.[0],
    });
    if (s.suitable && s.score > bestScore) { best = img; bestScore = s.score; }
  }
  return best;
}

function toContentMedia(img: ImageCandidate) {
  return {
    sourceUrl: img.src,
    filename: filenameFromUrl(img.src),
    originalFilename: filenameFromUrl(img.src),
    mimeType: mimeFromFilename(filenameFromUrl(img.src)),
    alt: img.alt,
  };
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

export interface GraphToContentOptions {
  graph: SourceContentGraph;
  sourceDocuments: SourceDocument[];
  baseUrl: string;
  navigation?: { label: string; url?: string; children?: any[] }[];
}

export function graphToImportContent(opts: GraphToContentOptions): {
  content: ExtractedContent;
  provenance: GraphImportProvenance;
} {
  const { graph, sourceDocuments, baseUrl } = opts;
  const docsById = new Map(sourceDocuments.map((d) => [d.id, d]));
  const classByDoc = new Map(graph.pages.map((p) => [p.sourceDocumentId, p.classification]));
  const mediaDecisions: MediaDecision[] = [];
  const dropped: DroppedEntity[] = [];
  const provenance: GraphImportProvenance = {
    pages: [], services: [], projects: [], news: [], vacancies: [],
    media: mediaDecisions, droppedEntities: dropped,
  };

  const homeDoc = sourceDocuments.find((d) => d.isHomepage) || sourceDocuments[0];
  const docByUrl = new Map(sourceDocuments.map((d) => [d.url.replace(/\/+$/, ''), d]));
  // Map a source URL to the internal page path ('/slug' or '/' for homepage).
  const internalHref = (href?: string): string | undefined => {
    if (!href) return undefined;
    if (href.startsWith('#')) return href;
    if (/^\//.test(href) && !href.startsWith('//')) return href;
    try {
      const u = new URL(href);
      const doc = docByUrl.get(u.origin + u.pathname.replace(/\/+$/, '')) || docByUrl.get((u.origin + u.pathname).replace(/\/+$/, ''));
      if (doc) return doc.isHomepage ? '/' : `/${slugFromDocPath(doc.path)}`;
      if (new URL(baseUrl).host === u.host) return u.pathname === '/' ? '/' : u.pathname.replace(/\/+$/, '');
      return href; // external link — keep absolute
    } catch { return href; }
  };
  // Every image referenced by the contract must be downloadable media.
  const referencedMedia = new Map<string, ReturnType<typeof toContentMedia>>();
  const addMedia = (img?: ImageCandidate) => {
    if (img && !referencedMedia.has(img.src)) referencedMedia.set(img.src, toContentMedia(img));
  };
  const company = graph.company;
  const contacts = graph.contacts;
  const companyTokens = [company?.displayName, company?.shortName, company?.legalName]
    .filter((t): t is string => !!t);

  // ---- company / contacts / branding ------------------------------------
  const phone = contacts?.phones?.[0]?.value ? cleanPhone(contacts.phones[0].value) : undefined;
  const email = contacts?.emails?.[0]?.value?.trim();
  // Company name must never become the address.
  let address = contacts?.addresses?.[0]?.value?.trim();
  if (address && company?.displayName && address.toLowerCase().includes(company.displayName.toLowerCase())) {
    address = undefined;
  }
  const socialLinks = (contacts?.socialLinks || []).map((s) => ({ platform: s.platform, url: s.url }));
  const workingHours = contacts?.workingHours?.value?.trim();

  const logoImg = graph.media.find((m) => m.role === 'LOGO')
    || (homeDoc?.chrome.logo?.src
      ? { id: 'logo', src: homeDoc.chrome.logo.src, alt: homeDoc.chrome.logo.alt, role: 'LOGO' as const, confidence: 0.8, provenance: { sourceDocumentIds: [homeDoc.id], sourceUrls: [homeDoc.url] } }
      : undefined);

  // ---- hero ---------------------------------------------------------------
  const heroDoc = homeDoc;
  const heroDocImages = (heroDoc?.images || [])
    .filter((i) => i.region === 'main' || i.provenance?.isHero)
    .map((i, idx) => ({
      id: `hero-img-${idx}`, src: i.src, alt: i.alt, width: i.width, height: i.height,
      role: (i.provenance?.isHero ? 'HERO_CANDIDATE' : 'UNKNOWN') as ImageCandidate['role'],
      confidence: 0.6,
      provenance: { sourceDocumentIds: [heroDoc!.id], sourceUrls: [heroDoc!.url] },
    }));
  const heroImg = pickCover(heroDocImages, 'hero', mediaDecisions, 'hero');

  // Find a CTA link on the homepage (a body link that is not navigation).
  const navLabels = new Set<string>();
  const collectNavLabels = (nodes?: { label: string; children?: any[] }[]) => {
    for (const n of nodes || []) { navLabels.add(n.label.trim().toLowerCase()); collectNavLabels(n.children); }
  };
  collectNavLabels(homeDoc?.chrome.nav?.primary);
  let heroCta: { buttonLabel: string; buttonUrl: string } | undefined;
  for (const sec of heroDoc?.sections || []) {
    for (const l of sec.links || []) {
      const label = (l.text || '').trim();
      if (!label || label.length > 60 || navLabels.has(label.toLowerCase())) continue;
      if (!l.href || l.href === '#') continue;
      if (/^(tel:|mailto:|javascript:)/.test(l.href)) continue;
      heroCta = { buttonLabel: label, buttonUrl: l.href };
      break;
    }
    if (heroCta) break;
  }

  // ---- hero subtitle / about / cta from homepage sections -------------------
  const homePage = homeDoc ? graph.pages.find((p) => p.sourceDocumentId === homeDoc.id) : undefined;
  const sectionTypeById = new Map((homePage?.sections || []).map((s) => [s.sectionId, s.type]));
  const CTAISH = /[?]|заявк|планиру|обсуд|заказ|консульт|свяж|оставьте|discuss|contact us|get a quote/i;

  const homeSections = (homeDoc?.sections || []).map((sec) => ({
    sec,
    stype: sectionTypeById.get(sec.id),
    text: homeDoc ? stripChromeLines(sec.paragraphs.join('\n'), chromeTokens(homeDoc, companyTokens)).trim() : '',
  }));
  const norm = (t?: string) => (t || '').trim().toLowerCase();

  // Hero subtitle: the section whose heading equals the h1 — remaining paras.
  const heroSec = homeSections.find((h) => norm(h.sec.heading) === norm(homeDoc?.h1));
  const heroSubtitle = heroSec
    ? firstSentences(heroSec.sec.paragraphs.slice(1).join(' '), 2, 240)
    : '';

  // CTA: CTA-typed section, else the last section with a question/CTA heading.
  let cta: { title?: string; description?: string; buttonLabel?: string; buttonUrl?: string } = {};
  let ctaSec: typeof homeSections[number] | undefined;
  ctaSec = homeSections.find((h) => h.stype === 'CTA')
    || [...homeSections].reverse().find((h) => h.sec.heading && CTAISH.test(h.sec.heading) && h.text.length > 20);
  if (ctaSec) {
    const ctaLink = (ctaSec.sec.links || []).find((l) => l.text && l.href && l.href !== '#');
    // A bare adjacent section whose only content is a short imperative heading
    // is the form/button label of the CTA (e.g. "Оставить заявку").
    const next = homeSections[homeSections.indexOf(ctaSec) + 1];
    const formLabel = next && !ctaLink && next.sec.heading && next.text.length < 40
      ? next.sec.heading.trim()
      : undefined;
    const contactsDoc = sourceDocuments.find((d) => classByDoc.get(d.id)?.type === 'CONTACTS');
    cta = {
      title: ctaSec.sec.heading || firstSentences(ctaSec.text, 1, 120) || undefined,
      description: firstSentences(
        ctaSec.sec.paragraphs.filter((p) => norm(p) !== norm(ctaSec!.sec.heading)).join(' '),
        2, 300
      ) || undefined,
      buttonLabel: ctaLink?.text?.trim().slice(0, 60) || formLabel,
      buttonUrl: internalHref(ctaLink?.href) || (contactsDoc ? `/${slugFromDocPath(contactsDoc.path)}` : undefined),
    };
  }

  // About: the richest non-hero, non-CTA description/manifesto section.
  // Prefer a section that names the company (manifesto), then COMPANY_DESCRIPTION,
  // then longest remaining text. Never a collection heading or CTA.
  let about: { heading?: string; content?: string; imageId?: string } = {};
  const serviceTitles = new Set(graph.services.map((x) => norm(x.title)));
  const aboutCands = homeSections
    .filter((h) =>
      h !== heroSec && h !== ctaSec &&
      (h.stype === 'COMPANY_DESCRIPTION' || h.stype === 'TESTIMONIAL') &&
      h.sec.heading && !serviceTitles.has(norm(h.sec.heading)) &&
      !norm(h.sec.heading).match(/^наши направления|последние проекты|почему|услуги|портфолио|проекты/) &&
      h.text.length > 80);
  // Distinctive company words (strip legal-form prefixes): "ООО \"Лишэн\"" →
  // ["лишэн"], so a manifesto heading "«Лишэн» — это стройка…" still matches
  // even when displayName is transliterated ("Lishen").
  const companyWords = new Set(
    companyTokens
      .flatMap((t) => norm(t).replace(/ооо|одо|ип|чтуп|зао|оао|llc|ltd|inc|["'«»]/g, ' ').split(/\s+/))
      .filter((w) => w.length > 3)
  );
  const aboutSec =
    aboutCands.find((h) => [...companyWords].some((w) => norm(h.sec.heading).includes(w))) ||
    aboutCands.find((h) => h.stype === 'COMPANY_DESCRIPTION') ||
    aboutCands.sort((a, b) => b.text.length - a.text.length)[0];
  if (aboutSec) {
    // A manifesto-style section may glue the whole statement into the heading;
    // in that case the statement is the content, not a heading.
    const stripped = dropLeadingTitle(aboutSec.text, aboutSec.sec.heading).trim();
    if ((aboutSec.sec.heading || '').length > 90 || !stripped) {
      about = { heading: undefined, content: firstSentences(aboutSec.text, 4, 800) };
    } else {
      about = { heading: aboutSec.sec.heading || undefined, content: firstSentences(stripped, 4, 800) };
    }
  } else if (company?.description) {
    about = { content: firstSentences(company.description, 4, 800) };
  }

  // ---- pages ---------------------------------------------------------------
  const pages: ExtractedContent['pages'] = [];
  for (const doc of sourceDocuments) {
    const pc = classByDoc.get(doc.id);
    const slug = doc.isHomepage ? 'index' : slugFromDocPath(doc.path);
    const title = (doc.h1 || doc.title || slug).trim();
    const body = docBodyText(doc, companyTokens);
    const blocks: any[] = paragraphsToBlocks(body);
    const suitableImgs = (doc.images || [])
      .filter((i) => i.region === 'main')
      .map((i, idx) => ({
        id: `${doc.id}-img-${idx}`, src: i.src, alt: i.alt, width: i.width, height: i.height,
        role: 'UNKNOWN' as const, confidence: 0.5,
        provenance: { sourceDocumentIds: [doc.id], sourceUrls: [doc.url] },
      }))
      .filter((i) => scoreMediaSuitability(i, 'inline').suitable);
    if (suitableImgs.length > 1) {
      for (const i of suitableImgs) addMedia(i);
      blocks.push({ type: 'gallery', imageIds: suitableImgs.map((i) => i.src) });
    }
    pages.push({
      title,
      slug,
      sourceUrl: doc.url,
      sourceType: 'IMPORTED',
      isHomepage: doc.isHomepage,
      seoTitle: doc.title || undefined,
      seoDescription: doc.metaDescription || undefined,
      blocks,
    });
    provenance.pages.push({
      title, slug, sourceUrl: doc.url, sourceDocumentId: doc.id,
      pageType: pc?.type, confidence: pc?.confidence ?? 0.5, status: 'OK',
    });
  }

  // ---- services -------------------------------------------------------------
  const services: ExtractedContent['services'] = [];
  for (const e of graph.services) {
    const doc = docsById.get(e.sourceDocumentIds[0]);
    const pc = doc ? classByDoc.get(doc.id) : undefined;
    if (pc?.type !== 'SERVICE_DETAIL') {
      dropped.push({ title: e.title, reason: `not-from-service-detail:${pc?.type || 'unknown'}`, sourceDocumentId: e.sourceDocumentIds[0] });
      continue;
    }
    if (isGenericTitle(e.title)) {
      dropped.push({ title: e.title, reason: 'generic-title', sourceDocumentId: e.sourceDocumentIds[0] });
      continue;
    }
    const body = docBodyText(doc, companyTokens);
    const cover = pickCover(entityImages(graph, e, docsById), 'cover', mediaDecisions, `service:${e.title}`);
    services.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      shortDescription: firstSentences(dropLeadingTitle(e.description || body, doc?.h1 || e.title), 2, 300) || undefined,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
      seoTitle: doc?.title || undefined,
      seoDescription: doc?.metaDescription || undefined,
      image: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      blocks: paragraphsToBlocks(body),
    });
    provenance.services.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      sourceUrl: doc?.url, sourceDocumentId: doc?.id,
      pageType: pc?.type, confidence: e.confidence, status: e.status,
    });
  }

  // ---- projects -------------------------------------------------------------
  const projects: ExtractedContent['projects'] = [];
  for (const e of graph.projects) {
    const doc = docsById.get(e.sourceDocumentIds[0]);
    const pc = doc ? classByDoc.get(doc.id) : undefined;
    if (pc?.type !== 'PROJECT_DETAIL') {
      dropped.push({ title: e.title, reason: `not-from-project-detail:${pc?.type || 'unknown'}`, sourceDocumentId: e.sourceDocumentIds[0] });
      continue;
    }
    if (isGenericTitle(e.title)) {
      dropped.push({ title: e.title, reason: 'generic-title', sourceDocumentId: e.sourceDocumentIds[0] });
      continue;
    }
    const body = docBodyText(doc, companyTokens);
    const imgs = entityImages(graph, e, docsById);
    const cover = pickCover(imgs, 'cover', mediaDecisions, `project:${e.title}`);
    const galleryImgs = imgs
      .filter((i) => i.src !== cover?.src && scoreMediaSuitability(i, 'gallery').suitable);
    const gallery = galleryImgs.map((i) => (addMedia(i), toContentMedia(i)));
    // 'Company' is not a real category — only evidence-backed values survive.
    const category = e.category && !isGenericTitle(e.category) ? e.category : undefined;
    projects.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      excerpt: firstSentences(dropLeadingTitle(e.description || body, doc?.h1 || e.title), 2, 280) || undefined,
      category,
      location: e.location,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
      seoTitle: doc?.title || undefined,
      seoDescription: doc?.metaDescription || undefined,
      coverImage: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      gallery,
      blocks: paragraphsToBlocks(body),
    });
    provenance.projects.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      sourceUrl: doc?.url, sourceDocumentId: doc?.id,
      pageType: pc?.type, confidence: e.confidence, status: e.status,
    });
  }

  // ---- news / vacancies ------------------------------------------------------
  const news: ExtractedContent['news'] = [];
  for (const e of graph.news) {
    const doc = docsById.get(e.sourceDocumentIds[0]);
    const pc = doc ? classByDoc.get(doc.id) : undefined;
    if (pc?.type !== 'NEWS_DETAIL' || isGenericTitle(e.title)) continue;
    const body = docBodyText(doc, companyTokens);
    const cover = pickCover(entityImages(graph, e, docsById), 'cover', mediaDecisions, `news:${e.title}`);
    news.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      excerpt: e.description ? firstSentences(e.description, 2, 280) : undefined,
      publishedAt: e.date || undefined,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
      coverImage: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      blocks: paragraphsToBlocks(body),
    });
  }
  const vacancies: ExtractedContent['vacancies'] = [];
  for (const e of graph.vacancies) {
    const doc = docsById.get(e.sourceDocumentIds[0]);
    const pc = doc ? classByDoc.get(doc.id) : undefined;
    if (pc?.type !== 'VACANCY_DETAIL' || isGenericTitle(e.title)) continue;
    const body = docBodyText(doc, companyTokens);
    vacancies.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      location: e.location,
      description: firstSentences(body || e.description || '', 4, 600) || undefined,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
    });
  }

  // ---- navigation -------------------------------------------------------------
  const navigation = opts.navigation?.length
    ? opts.navigation
    : (homeDoc?.chrome.nav?.primary || []).map((n) => ({
        label: n.label, url: n.url, children: n.children as any,
      }));

  // ---- homepage sections -------------------------------------------------------
  const homepageSections: ExtractedContent['homepageSections'] = [];
  let order = 0;
  homepageSections.push({ type: 'hero', enabled: true, sortOrder: order++ });
  if (about.content) homepageSections.push({ type: 'about', enabled: true, sortOrder: order++, title: about.heading });
  if (services.length) {
    const idx = sourceDocuments.find((d) => classByDoc.get(d.id)?.type === 'SERVICES_INDEX');
    homepageSections.push({ type: 'services', enabled: true, sortOrder: order++, title: idx?.h1?.trim() || undefined });
  }
  if (projects.length) {
    const idx = sourceDocuments.find((d) => classByDoc.get(d.id)?.type === 'PROJECTS_INDEX');
    homepageSections.push({ type: 'projects', enabled: true, sortOrder: order++, title: idx?.h1?.trim() || undefined });
  }
  if (news.length) homepageSections.push({ type: 'news', enabled: true, sortOrder: order++ });
  if (cta.title) homepageSections.push({ type: 'cta', enabled: true, sortOrder: order++ });
  if (phone || email || address) homepageSections.push({ type: 'contacts', enabled: true, sortOrder: order++ });

  const content: ExtractedContent = {
    company: {
      name: company?.displayName || company?.title,
      shortName: company?.shortName,
      legalName: company?.legalName,
      unp: company?.unp,
      founded: company?.founded,
      employees: company?.employees,
      description: company?.description,
      address, phone, email, workingHours, socialLinks,
    },
    theme: inferTheme(homeDoc ? { themeColors: homeDoc.chrome.themeColors, html: homeDoc.html } as CrawledPage : undefined),
    hero: {
      title: heroDoc?.h1?.trim() || company?.displayName,
      subtitle: heroSubtitle || (company?.description ? firstSentences(company.description, 2, 240) : undefined),
      imageId: heroImg ? (addMedia(heroImg), heroImg.src) : undefined,
      buttonLabel: heroCta?.buttonLabel,
      buttonUrl: internalHref(heroCta?.buttonUrl),
    },
    about,
    cta,
    homepageSections,
    branding: {
      companyName: company?.displayName || company?.title,
      logo: logoImg ? (addMedia(logoImg), toContentMedia(logoImg)) : undefined,
      favicon: homeDoc?.chrome.favicon
        ? { sourceUrl: homeDoc.chrome.favicon, filename: 'favicon', mimeType: 'image/x-icon' }
        : undefined,
    },
    navigation: navigation as ExtractedContent['navigation'],
    pages,
    services,
    projects,
    news,
    vacancies,
    products: [],
    reviews: [],
    dynamicSections: [],
    media: [...referencedMedia.values()],
    contacts: { phone, email, address, workingHours, socialLinks },
  };

  return { content, provenance };
}
