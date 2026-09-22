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
import { detectTechnicalPayload, type TechnicalPayloadDrop } from '../extract/technicalPayload.js';
// @ts-expect-error no declaration file for built templates
import { COLLECTION_SLUG_HINTS } from '../../../templates/dist/index.js';
import type {
  ImageCandidate,
  SourceContentGraph,
  ServiceEntity,
  ProjectEntity,
  NewsEntity,
  VacancyEntity,
  ProductEntity,
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
  products: EntityProvenance[];
  media: MediaDecision[];
  droppedEntities: DroppedEntity[];
  /** Technical payloads excluded from visible content (extraction + adapter
   *  defense-in-depth), each with detector rule + evidence sample. */
  technicalPayloads?: TechnicalPayloadDrop[];
  /** Index-page blocks dropped as teaser echoes of the page's own collection. */
  removedTeaserEchoes?: { pageSlug: string; rule: string; sample: string }[];
  /** True when no hero candidate passed the evidence gate (text-led hero). */
  heroMediaMissing?: boolean;
  /** Per-slot media decisions (V3.7.2 Phase 5): every hero/cover slot records
   *  its candidates, rejection reasons and explicit fallback mode — hero
   *  selection never requires a human pick; TEXT_ONLY is a valid result. */
  mediaSlots?: MediaSlotDecision[];
}

export interface MediaSlotDecision {
  slot: 'hero' | 'cover';
  /** Owning entity ('home', 'service:<title>', 'news:<title>', …). */
  entityId: string;
  selectedSrc?: string;
  candidates: { src: string; score: number; suitable: boolean; reasons: string[] }[];
  acceptedReasons: string[];
  rejectedReasons: string[];
  fallbackMode: 'SELECTED' | 'TEXT_ONLY';
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
  const segs = clean.split('/').filter(Boolean);
  const last = segs[segs.length - 1] || 'index';
  // Paginated continuations /a/b/page/2 → 'b-page-2' — a bare numeric slug is
  // meaningless and collides across different parent listings.
  if (/^\d+$/.test(last) && segs[segs.length - 2] === 'page' && segs.length >= 3) {
    return `${segs[segs.length - 3]}-page-${last}`;
  }
  return last;
}

/** Entity excerpt from the detail document itself: the first real sentence
 *  (terminal punctuation, ≥40 chars, not a label/CTA/heading echo). Entity
 *  descriptions from the semantic pass glue taglines/dates/venue stubs into
 *  prose — never excerpt those directly. */
function excerptFromDoc(
  doc: SourceDocument | undefined,
  pageH1: string | undefined,
  extraTokens: string[],
  boilerplate?: Set<string>,
): string | undefined {
  if (!doc) return undefined;
  const h1n = (pageH1 || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const clip = (t: string) => (t.length > 280 ? t.slice(0, 280).replace(/\s+\S*$/, '') + '…' : t);
  const candidates: string[] = [];
  const headingCandidates: string[] = [];
  for (const sec of doc.sections || []) {
    // A long sentence-like heading is the section's subtitle — a valid lede
    // candidate when no paragraph qualifies (Tilda stores subtitles as atoms).
    const h = normTxt(sec.heading);
    if (h.length >= 40 && h.toLowerCase() !== h1n && !isCtaText(h) && !detectTechnicalPayload(h).technical) {
      headingCandidates.push(h);
    }
    for (const p of sec.paragraphs || []) {
      const t = stripChromeLines(p, [...extraTokens, pageH1 || ''].filter(Boolean), boilerplate).trim();
      if (t.length < 40 || detectTechnicalPayload(t).technical) continue;
      const tn = t.toLowerCase();
      if (tn === h1n || tn === (sec.heading || '').replace(/\s+/g, ' ').trim().toLowerCase()) continue;
      if (CTA_IMPERATIVE_RE.test(t) || /^[а-яa-zё]+ите(?![а-яёa-z0-9])/.test(tn)) continue;
      candidates.push(t);
      if (/[.!?…]$/.test(t)) return clip(t);
    }
  }
  // First non-CTA substantive paragraph wins — a prose atom ending in ':' that
  // introduces a list is a valid lede; then any candidate, then a subtitle.
  const fallback = candidates.find((t) => t.length >= 45) || candidates[0] || headingCandidates[0];
  const out = fallback ? clip(fallback) : undefined;
  return out && !isCtaText(out) ? out : undefined;
}

/** Semantic-pass entity descriptions can be a glued table of contents —
 *  every section label concatenated without punctuation. Reject a fallback
 *  description that literally contains ≥2 of the doc's section headings. */
export function isGluedDescription(desc: string, doc: SourceDocument | undefined): boolean {
  if (!desc || !doc) return false;
  const d = desc.toLowerCase();
  // Label atoms may live in `heading` or as short standalone paragraphs —
  // count both so a glued "Проблемы Решения … Для кого информация?" is caught.
  const labels = (doc.sections || []).flatMap((s) => {
    const out: string[] = [];
    const h = (s.heading || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (h.length >= 6) out.push(h);
    for (const p of s.paragraphs || []) {
      const t = p.replace(/\s+/g, ' ').trim().toLowerCase();
      if (t.length >= 6 && t.length <= 40 && !/[.!…:;,]$/.test(t)) out.push(t);
    }
    return out;
  });
  return labels.filter((l) => d.includes(l)).length >= 2;
}

/** A call-to-action line is chrome, never a summary — excerpt/excerpt-fallback
 *  guard shared by entity teaser fields. */
export function isCtaText(t: string): boolean {
  return CTA_IMPERATIVE_RE.test(t) || (t.length < 120 && /консультац|заявк|закажите|заказать|обсудим/i.test(t));
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

function stripChromeLines(text: string, tokens: string[], exactLines?: Set<string>): string {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const low = line.toLowerCase();
    // Lines identical to site-wide boilerplate drop unconditionally — a
    // shorter token (e.g. the company name) must not split them into a
    // surviving residual fragment.
    if (exactLines?.has(low)) continue;
    // Drop lines that are pure chrome (nav label / phone / brand) or that are
    // dominated by chrome tokens (e.g. "Лишэн X +375 29 673-84-35").
    let residual = low;
    for (const t of tokens) residual = residual.split(t).join(' ');
    residual = residual.replace(/\+?[\d\s()\-]{6,}/g, ' ').replace(/\s+/g, ' ').trim();
    if (!residual || residual.length < 3) continue;
    // Skip lines that are just a phone or email.
    if (/^\+?[\d\s()\-]{6,}$/.test(low) || /^[\w.]+@[\w.]+\.\w+$/.test(low)) continue;
    // Defense in depth: serialized widget/form payloads never render as prose.
    if (detectTechnicalPayload(line).technical) continue;
    out.push(line);
  }
  return out.join('\n');
}

function docBodyText(doc: SourceDocument | undefined, extraTokens: string[] = [], exactLines?: Set<string>): string {
  if (!doc) return '';
  const text = doc.mainText || doc.rawText || '';
  // The page's own h1 is metadata, not body copy — drop duplicate title lines.
  const tokens = [...extraTokens, doc.h1 || ''].filter(Boolean);
  return stripChromeLines(text, chromeTokens(doc, tokens), exactLines).trim();
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
// Structured section → typed block mapping (V3.6.2).
// Preserves source semantics instead of flattening into anonymous text slabs:
// process groups, feature groups, FAQ accordions, lists, closing CTA and
// editorial text each become typed blocks with provenance.
// ---------------------------------------------------------------------------

const PROCESS_HEADING_RE = /как мы работаем|этапы?|процесс|стадии|порядок работ|порядок выполнения|how we work|work steps?|process|workflow|stages?/i;
const FEATURES_HEADING_RE = /почему|преимуществ|выгод|результат|доверя|плюсы|особенност|сильные стороны|отличаемся|why us|why choose|advantages?|features?|benefits?|trust|results?/i;
const FAQ_HEADING_RE = /faq|вопросы?|часто спрашива|вопрос-ответ|questions?/i;
const CTA_HEADING_RE_LOCAL = /\?|заявк|планиру|обсуд|заказ|консульт|свяж|оставьте|расчет|рассчит|discuss|contact us|get a quote|request/i;
/** Imperative opening of a standalone call-to-action line. */
// NB: \b never fires next to Cyrillic in JS regex (Cyrillic isn't \w) — use a
// letter lookahead so imperative detection actually works on Russian text.
const CTA_IMPERATIVE_RE = /^(закажите|заказать|оставьте|оставить|получите|получить|свяжитесь|обсудите|обсудим|позвоните|напишите|запишитесь|рассчитайте|отправьте|оформите|уточните)(?![а-яёa-z])/i;

interface SectionsToBlocksOptions {
  /** Page title/h1 — headings identical to it are dropped from blocks. */
  pageH1?: string;
  /** Chrome tokens to strip from paragraph text. */
  chromeTokens?: string[];
  /** Site-wide boilerplate lines (repeated on most documents) — dropped from
   *  lists and item text, e.g. footer/widget text on CMSs without landmarks. */
  boilerplateLines?: Set<string>;
  /** Sink for technical payloads removed from visible content (defense in
   *  depth — extraction drops most; this catches stragglers). */
  technicalDrops?: TechnicalPayloadDrop[];
  /** Canonical internal-link resolver: rewrites source URLs/paths to internal
   *  routes, section anchors, or undefined when nothing resolvable exists —
   *  an unresolvable CTA loses its button rather than shipping a dead link. */
  internalHref?: (href?: string) => string | undefined;
}

const normTxt = (t?: string) => (t || '').replace(/\s+/g, ' ').trim();

/** Map a document's typed sections into CMS blocks, preserving structure.
 *  A heading-only section followed by deeper-level title+text sections groups
 *  into processSteps/features/faq by heading evidence — never invented. */
export function sectionsToBlocks(doc: SourceDocument | undefined, opts: SectionsToBlocksOptions = {}): any[] {
  if (!doc) return [];
  const blocks: any[] = [];
  const secs = (doc.sections || []).filter((s) => s.region === 'main' || s.region === 'aside' || s.region === 'article' || s.region === 'unknown');
  const tokens = opts.chromeTokens || [];
  const pageH1N = normTxt(opts.pageH1).toLowerCase();
  const clean = (t: string) => stripChromeLines(t, tokens, opts.boilerplateLines).trim();
  const headingOf = (sec: SourceDocumentSection): string | undefined => {
    const h = normTxt(sec.heading);
    if (!h || h.toLowerCase() === pageH1N) return undefined;
    return h;
  };
  const prov = (sec: SourceDocumentSection) => ({ sourceUrl: doc.url, sourceDocumentId: doc.id, sourceSectionId: sec.id });
  const bodyOf = (sec: SourceDocumentSection): string =>
    clean(sec.paragraphs
      .filter((p) => normTxt(p).toLowerCase() !== normTxt(sec.heading).toLowerCase())
      .filter((p) => !recordTechnicalDrop(p, sec))
      .join('\n\n'));
  const isBoiler = (t: string) => !!opts.boilerplateLines?.has(normTxt(t).toLowerCase());
  const recordTechnicalDrop = (t: string, sec: SourceDocumentSection): boolean => {
    const v = detectTechnicalPayload(t);
    if (!v.technical) return false;
    opts.technicalDrops?.push({
      rule: v.rule!, confidence: v.confidence, sample: normTxt(t).slice(0, 160),
      domPath: sec.domPath, context: `section:${sec.id}`,
    });
    return true;
  };

  /** A standalone label line: short, few words, no sentence-ending punctuation
   *  ('?' allowed — "Почему X?" is a section label). Site builders (Tilda
   *  atoms) emit labels as text, not headings — adjacency to a following
   *  anonymous list/text section is the grouping evidence. */
  const isLabelText = (t: string): boolean => {
    const n = normTxt(t);
    return n.length >= 2 && n.length <= 48 && n.split(/\s+/).length <= 6
      && !/[.!…:;,]$/.test(n) && !isBoiler(n) && !detectTechnicalPayload(n).technical;
  };
  const isLabelSection = (s: SourceDocumentSection): boolean =>
    !headingOf(s) && s.paragraphs.length === 1 && isLabelText(s.paragraphs[0])
    && !s.lists.length && !s.images.length && !s.faqs.length && !s.links.length;
  /** Anonymous imperative/question CTA section (label is a text atom, so the
   *  heading-based CTA branch never sees it). */
  const ctaFromAnonymous = (s: SourceDocumentSection): any | undefined => {
    if (headingOf(s) || s.lists.length || s.faqs.length || s.paragraphs.length > 3) return undefined;
    const first = normTxt(s.paragraphs[0]);
    if (!first || (!/[?]$/.test(first) && !CTA_IMPERATIVE_RE.test(first) && !CTA_HEADING_RE_LOCAL.test(first))) return undefined;
    const link = s.links.find((l) => l.text && l.href && l.href !== '#');
    return {
      type: 'cta',
      title: first,
      description: clean(s.paragraphs.slice(1).join('\n\n')) || undefined,
      buttonLabel: link?.text?.trim().slice(0, 60) || undefined,
      buttonUrl: opts.internalHref?.(link?.href) ?? undefined,
      ...prov(s),
    };
  };
  const itemsOf = (children: SourceDocumentSection[]) =>
    children.map((c) => ({
      title: normTxt(c.heading),
      text: [bodyOf(c), ...c.lists.flat().map((t) => clean(t))]
        .filter((t) => t && !isBoiler(t) && !detectTechnicalPayload(t).technical).join('\n'),
      sourceSectionId: c.id,
    })).filter((it) => it.title || it.text);

  /** A label section's run of anonymous followers becomes one typed block:
   *  keyword-matched labels map to processSteps/features; neutral labels stay
   *  richText with heading + items. Copy is verbatim — only grouping changes. */
  const groupedBlock = (label: string, run: SourceDocumentSection[], labelSec: SourceDocumentSection) => {
    const content = clean(
      run.map((s) => s.paragraphs.filter((p) => normTxt(p).toLowerCase() !== label.toLowerCase()).join('\n\n'))
        .filter(Boolean).join('\n\n')
    );
    const items = run
      .flatMap((s) => s.lists.flat().map((t) => clean(t)))
      .filter((t) => t && !isBoiler(t) && !detectTechnicalPayload(t).technical);
    const type = PROCESS_HEADING_RE.test(label) ? 'processSteps'
      : FEATURES_HEADING_RE.test(label) ? 'features' : 'richText';
    if (type === 'richText') {
      return { type, heading: label, content: content || undefined, items: items.length ? items : undefined, ...prov(labelSec) };
    }
    return {
      type,
      heading: label,
      content: content || undefined,
      items: items.map((t) => (t.length <= 90 ? { title: t } : { text: t })),
      ...prov(labelSec),
    };
  };

  const faqBlock = (secs2: SourceDocumentSection[], faqs: SourceDocumentSection['faqs'], heading?: string) => ({
    type: 'faq',
    heading: heading && FAQ_HEADING_RE.test(heading) ? heading : undefined,
    items: faqs.map((f) => ({ question: f.question, answer: f.answer, sourceUrl: doc.url, evidenceIds: [f.domPath, secs2[0]?.id].filter(Boolean) as string[] })),
    ...prov(secs2[0]),
  });

  let i = 0;
  while (i < secs.length) {
    const sec = secs[i];
    const heading = headingOf(sec);
    const body = bodyOf(sec);
    const ownFaqs = sec.faqs || [];

    // Anonymous trailing/mid CTA: a short imperative or question atom that is
    // the page's closing action or a divider between content groups.
    const nearEnd = i >= secs.length - 2;
    if (!heading && !isLabelSection(sec) && (nearEnd || (sec.paragraphs.length === 1 && CTA_IMPERATIVE_RE.test(normTxt(sec.paragraphs[0]))))) {
      const ctaB = ctaFromAnonymous(sec);
      if (ctaB) { blocks.push(ctaB); i++; continue; }
    }

    // Label + following anonymous sections: a text-atom label owns the run of
    // heading-less sections until the next heading or label. Lists/paragraphs
    // accumulate into ONE typed block — "Проблемы" + its list, "Выгоды" + two
    // lists — instead of orphan fragments.
    if (isLabelSection(sec)) {
      const label = normTxt(sec.paragraphs[0]);
      const run: SourceDocumentSection[] = [];
      let midCta: any;
      let j = i + 1;
      while (j < secs.length && !headingOf(secs[j]) && !isLabelSection(secs[j])) {
        const s2 = secs[j];
        if (!s2.paragraphs.length && !s2.lists.length && !s2.images.length && !s2.faqs.length) break;
        midCta = ctaFromAnonymous(s2);
        if (midCta) { j++; break; }
        run.push(s2); j++;
      }
      if (run.length) {
        blocks.push(groupedBlock(label, run, sec));
        const runFaqs = run.flatMap((s) => s.faqs || []);
        if (runFaqs.length) blocks.push(faqBlock(run, runFaqs, label));
        if (midCta) blocks.push(midCta);
        i = j;
        continue;
      }
      // Orphan label — keep it as a heading-only block rather than dropping copy.
      blocks.push({ type: 'richText', heading: label, ...prov(sec) });
      i++;
      continue;
    }

    // Grouping: only keyword-proven parents (level ≥2 — the h1 never groups,
    // or it would swallow the whole page).
    const isProcess = !!heading && PROCESS_HEADING_RE.test(heading);
    const isFeatures = !!heading && FEATURES_HEADING_RE.test(heading);
    let children: SourceDocumentSection[] = [];
    if ((isProcess || isFeatures) && sec.level >= 2) {
      let j = i + 1;
      while (j < secs.length && secs[j].level > sec.level) children.push(secs[j++]);
      if (children.length) {
        const childFaqs = children.flatMap((c) => c.faqs || []);
        blocks.push({
          type: isProcess ? 'processSteps' : 'features',
          heading,
          content: body || undefined,
          items: itemsOf(children),
          ...prov(sec),
        });
        if (childFaqs.length) blocks.push(faqBlock(children, childFaqs));
        i = j;
        continue;
      }
    }

    // Bare heading + anonymous run: a heading atom with no own body/items whose
    // content lives in the following heading-less atoms ("Почему NextTrade?" +
    // proof list, "Для кого информация?" + audience list). Same adjacency
    // evidence as the label rule; the run stops at the next heading or label.
    if (heading && !body && !sec.lists.flat().length && !ownFaqs.length) {
      const run: SourceDocumentSection[] = [];
      let midCta: any;
      let j = i + 1;
      while (j < secs.length && !headingOf(secs[j]) && !isLabelSection(secs[j])) {
        const s2 = secs[j];
        if (!s2.paragraphs.length && !s2.lists.length && !s2.images.length && !s2.faqs.length) break;
        midCta = ctaFromAnonymous(s2);
        if (midCta) { j++; break; }
        run.push(s2); j++;
      }
      if (run.length) {
        blocks.push(groupedBlock(heading, run, sec));
        const runFaqs = run.flatMap((s) => s.faqs || []);
        if (runFaqs.length) blocks.push(faqBlock(run, runFaqs, heading));
        if (midCta) blocks.push(midCta);
        i = j;
        continue;
      }
    }

    const isLastContent = i >= secs.length - 2;
    if (heading && CTA_HEADING_RE_LOCAL.test(heading) && isLastContent && (sec.links.length || body.length < 300)) {
      const link = sec.links.find((l) => l.text && l.href && l.href !== '#');
      // A bare trailing section with a short imperative heading is the CTA's
      // form/button label (e.g. "Оставить заявку") — fold it in.
      const next = secs[i + 1];
      const nextBody = next ? bodyOf(next) : '';
      const formLabel = next && !link && normTxt(next.heading) && !nextBody && !next.faqs.length && normTxt(next.heading).length < 40
        ? normTxt(next.heading)
        : undefined;
      blocks.push({
        type: 'cta',
        title: heading,
        description: body || undefined,
        buttonLabel: link?.text?.trim().slice(0, 60) || formLabel || undefined,
        buttonUrl: opts.internalHref?.(link?.href) ?? undefined,
        ...prov(sec),
      });
      i += formLabel ? 2 : 1;
      continue;
    }

    const items = sec.lists.flat().map((t) => clean(t)).filter((t) => t && !isBoiler(t) && !recordTechnicalDrop(t, sec));
    // A FAQ-heading section's title lives on the faq block — don't emit a
    // bare duplicate heading as richText.
    const isFaqHeadOnly = ownFaqs.length > 0 && !!heading && FAQ_HEADING_RE.test(heading) && !body && !items.length;
    // Images-only sections emit no block — section images already surface via
    // the page-level gallery; an empty richText would render as a stray label.
    if (!isFaqHeadOnly && (heading || body || items.length)) {
      // A sentence-like "heading" with no body/items is really a paragraph atom
      // (Tilda stores subtitles as heading atoms) — emit as text, not an
      // orphan heading-only section.
      const headingIsSentence = !!heading && !body && !items.length
        && (heading.length >= 40 || /[.!?…]$/.test(heading));
      blocks.push({
        type: 'richText',
        heading: headingIsSentence ? undefined : heading,
        content: headingIsSentence ? heading : body || undefined,
        items: items.length ? items : undefined,
        ...prov(sec),
      });
    }
    if (ownFaqs.length) blocks.push(faqBlock([sec], ownFaqs, heading));
    i++;
  }

  // Automatic repair (allowed): collapse proven responsive/slider duplicates —
  // adjacent blocks of the same type with identical normalized content are
  // desktop/mobile twins of one source section, never two pieces of content.
  const normBlock = (b: any) =>
    `${b?.type}|${normTxt(b?.heading || b?.title || '')}|${normTxt(b?.content || b?.description || '')}|${(Array.isArray(b?.items) ? b.items : []).map((i: any) => normTxt(typeof i === 'string' ? i : i?.text || i?.title || '')).join('|')}`.toLowerCase();
  const collapsed: any[] = [];
  for (const b of blocks) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.type === b.type && normBlock(prev) === normBlock(b) && normBlock(b).length > (b.type.length + 3)) {
      opts.technicalDrops?.push({
        rule: 'responsive-duplicate-collapsed', confidence: 0.9,
        sample: normTxt(b.heading || b.content || '').slice(0, 120),
        domPath: b.domPath || '', context: `block:${b.type}`,
      });
      continue;
    }
    collapsed.push(b);
  }
  return collapsed;
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
  usedAs: string,
  slots?: MediaSlotDecision[],
  slotEntityId?: string,
): ImageCandidate | undefined {
  let best: ImageCandidate | undefined;
  let bestScore = -1;
  const candidates: MediaSlotDecision['candidates'] = [];
  for (const img of images) {
    const s = scoreMediaSuitability(img, usage);
    decisions.push({
      src: img.src, role: img.role, suitabilityScore: s.score,
      suitable: s.suitable, reasons: s.reasons, usedAs: s.suitable ? usedAs : undefined,
      sourceDocumentId: img.provenance?.sourceDocumentIds?.[0],
    });
    candidates.push({ src: img.src, score: s.score, suitable: s.suitable, reasons: s.reasons });
    if (s.suitable && s.score > bestScore) { best = img; bestScore = s.score; }
  }
  if (slots) {
    const rejected = candidates.filter((c) => !c.suitable).flatMap((c) => c.reasons.map((r) => `${c.src.split('/').pop()}: ${r}`));
    slots.push({
      slot: usage === 'hero' ? 'hero' : 'cover',
      entityId: slotEntityId || usedAs,
      selectedSrc: best?.src,
      candidates,
      acceptedReasons: best ? [`score:${bestScore.toFixed(2)}`] : [],
      rejectedReasons: rejected,
      fallbackMode: best ? 'SELECTED' : 'TEXT_ONLY',
    });
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
  const mediaSlots: MediaSlotDecision[] = [];
  const dropped: DroppedEntity[] = [];
  const technicalDrops: TechnicalPayloadDrop[] = [];
  const teaserEchoes: { pageSlug: string; rule: string; sample: string }[] = [];
  const provenance: GraphImportProvenance = {
    pages: [], services: [], projects: [], news: [], vacancies: [], products: [],
    media: mediaDecisions, droppedEntities: dropped,
    technicalPayloads: technicalDrops, removedTeaserEchoes: teaserEchoes,
    mediaSlots,
  };

  const homeDoc = sourceDocuments.find((d) => d.isHomepage) || sourceDocuments[0];
  const docByUrl = new Map(sourceDocuments.map((d) => [d.url.replace(/\/+$/, ''), d]));
  // Collection-hint slugs resolve to real collection routes in the renderer —
  // keep their path. Non-collection section slugs fall back to the homepage
  // anchor when no document backs them (same vocabulary as SECTION_TARGETS).
  const SECTION_LINK_ANCHORS: Record<string, string> = {
    about: 'about', 'o-kompanii': 'about', 'o-nas': 'about',
    contacts: 'contact', contact: 'contact', kontakty: 'contact',
  };
  const stripDocExt = (s: string) => s.replace(/\.(html?|php\d?|aspx?)$/i, '');
  // Map a source URL to the internal page path ('/slug', '/' for homepage, or
  // a '/#section' anchor). Returns undefined when the path has no backing
  // document and no section/collection equivalent — callers drop the
  // affordance rather than ship a dead link.
  const internalHref = (href?: string): string | undefined => {
    if (!href) return undefined;
    if (href.startsWith('#')) return href;
    try {
      const u = new URL(href, baseUrl); // root-relative paths resolve against the source origin
      if (baseUrl && u.host !== new URL(baseUrl).host) return href; // external — keep absolute
      const cleanPath = u.pathname.replace(/\/+$/, '');
      const doc = docByUrl.get(u.origin + cleanPath) || docByUrl.get(u.origin + cleanPath + '/');
      if (doc) return doc.isHomepage ? '/' : `/${slugFromDocPath(doc.path)}`;
      if (cleanPath === '' || cleanPath === '/') return '/';
      const seg = stripDocExt(cleanPath.split('/').pop() || '').toLowerCase();
      if (COLLECTION_SLUG_HINTS[seg]) return `/${seg}`; // hinted collection route
      const anchor = SECTION_LINK_ANCHORS[seg];
      if (anchor) return `/#${anchor}`;
      return undefined;
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

  // Site-wide boilerplate: paragraph/list lines repeated across most documents
  // are chrome (footer text, widget copy, nav menus) on CMSs that lack
  // landmark markup. Evidence = cross-document frequency, not vocabulary.
  const lineFreq = new Map<string, number>();
  for (const d of sourceDocuments) {
    const seen = new Set<string>();
    for (const s of d.sections || []) {
      for (const p of s.paragraphs || []) {
        for (const line of String(p).split('\n')) {
          const t = line.trim().toLowerCase();
          if (t.length >= 4 && t.length <= 160) seen.add(t);
        }
      }
      for (const l of s.lists || []) {
        for (const it of l || []) {
          const t = String(it).trim().toLowerCase();
          if (t.length >= 4 && t.length <= 160) seen.add(t);
        }
      }
    }
    for (const t of seen) lineFreq.set(t, (lineFreq.get(t) || 0) + 1);
  }
  const boilerplateLines = new Set(
    [...lineFreq.entries()]
      .filter(([, n]) => n >= Math.max(3, Math.ceil(sourceDocuments.length * 0.4)))
      .map(([t]) => t),
  );
  const pageTokens = [...companyTokens, ...boilerplateLines];

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
  // Hero evidence gate: a hero image must look like content, not decoration.
   //  Photographic raster formats (jpg/webp/avif) qualify directly; anything
   //  else (opaque PNG, SVG, zero-block shape assets) needs explicit evidence —
   //  meaningful alt text, or reuse as a main-region content image on another
   //  page. Decorative atoms (the abstract ring on this site) fail all three.
  const PHOTO_EXT_RE = /\.(jpe?g|webp|avif)(\?|#|$)/i;
  const contentSrcsElsewhere = new Set(
    sourceDocuments
      .filter((d) => d !== heroDoc)
      .flatMap((d) => (d.images || []).filter((i) => i.region === 'main').map((i) => i.src)),
  );
  const heroGate = (img: ImageCandidate) =>
    PHOTO_EXT_RE.test(img.src) || (img.alt || '').trim().length >= 8 || contentSrcsElsewhere.has(img.src);
  const heroPool = heroDocImages.filter(heroGate);
  for (const img of heroDocImages.filter((i) => !heroPool.includes(i))) {
    mediaDecisions.push({
      src: img.src, role: img.role, suitabilityScore: 0, suitable: false,
      reasons: ['hero-gate: non-photographic asset without alt/content-section evidence'],
      sourceDocumentId: img.provenance?.sourceDocumentIds?.[0],
    });
  }
  const heroImg = pickCover(heroPool, 'hero', mediaDecisions, 'hero', mediaSlots, 'home');
  if (!heroImg) {
    provenance.heroMediaMissing = true;
    mediaDecisions.push({
      src: '', role: 'HERO_GATE', suitabilityScore: 0, suitable: false,
      reasons: ['HERO_MEDIA_MISSING: no candidate passed the evidence gate — text-led hero'],
      sourceDocumentId: heroDoc?.id,
    });
  }

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
    text: homeDoc ? stripChromeLines(sec.paragraphs.join('\n'), chromeTokens(homeDoc, pageTokens), boilerplateLines).trim() : '',
  }));
  const norm = (t?: string) => (t || '').trim().toLowerCase();

  // Hero subtitle: the section whose heading equals the h1 — remaining paras.
  const heroSec = homeSections.find((h) => norm(h.sec.heading) === norm(homeDoc?.h1));
  const heroSubtitle = heroSec
    ? firstSentences(heroSec.sec.paragraphs.filter((p) => norm(p) !== norm(homeDoc?.h1)).join(' '), 2, 240)
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
    const body = docBodyText(doc, pageTokens, boilerplateLines);
    const blocks: any[] = sectionsToBlocks(doc, { pageH1: title, chromeTokens: chromeTokens(doc, pageTokens), boilerplateLines, technicalDrops, internalHref });
    const suitableImgs = (doc.images || [])
      .filter((i) => i.region === 'main')
      .map((i, idx) => ({
        id: `${doc.id}-img-${idx}`, src: i.src, alt: i.alt, width: i.width, height: i.height,
        role: 'UNKNOWN' as const, confidence: 0.5,
        provenance: { sourceDocumentIds: [doc.id], sourceUrls: [doc.url] },
      }))
      .filter((i) => scoreMediaSuitability(i, 'inline').suitable);
    const isIndexPage = /_INDEX$/.test(pc?.type || '') || /_INDEX$/.test(pc?.subType || '');
    // Certificate/legal-document evidence: rule-based runs emit CERTIFICATES,
    // AI providers may emit LEGAL — both mean "documents page", and the
    // suitable-images guard keeps text-only legal pages as richText.
    const isDocsPage = pc?.type !== 'REVIEWS_INDEX' && pc?.type !== 'REVIEW_DETAIL'
      && (pc?.type === 'LEGAL' || ['CERTIFICATES', 'DOCUMENTS', 'LEGAL'].includes(pc?.subType || ''));
    if (isDocsPage && suitableImgs.length) {
      // Certificate/legal-document pages get a typed block with explicit
      // media linkage — never a generic decorative gallery.
      for (const i of suitableImgs) addMedia(i);
      blocks.push({
        type: 'certificates',
        heading: title,
        items: suitableImgs.map((i) => ({
          mediaId: i.src,
          caption: i.alt || '',
          docType: /\.pdf($|\?)/i.test(i.src) ? 'pdf' : 'image',
          sourceUrl: doc.url,
          enabled: true,
        })),
      });
    } else if (suitableImgs.length > 1 && !isIndexPage) {
      // Index pages skip the generic gallery: their main-region images are
      // collection-item covers, already rendered inside the listing. A
      // detached gallery duplicates them without context.
      for (const i of suitableImgs) addMedia(i);
      blocks.push({ type: 'gallery', imageIds: suitableImgs.map((i) => i.src) });
    }
    // Reviews index: real review entries surface as a typed reviews block —
    // reviews are content, not first-class entities. Nav-link collections
    // (no description text) are ignored.
    if (pc?.type === 'REVIEWS_INDEX') {
      const reviews = (doc.collections || [])
        .flatMap((c) => c.items)
        .filter((it) => (it.description || '').trim().length >= 40)
        .map((it) => ({
          author: (it.title || '').replace(/^отзыв\s*\d+\s*/i, '').trim() || undefined,
          text: (it.description || '').replace(/^отзыв\s*\d+\s*/i, '').trim(),
        }));
      if (reviews.length) blocks.push({ type: 'reviews', heading: title, reviews });
    }
    // Index pages: a section that merely re-states the page's own collection
    // teasers is a layout echo of the listing the template already renders —
    // drop blocks whose text is ≥70% teaser-title lines.
    if (isIndexPage && doc.collections?.length) {
      const teaserTokens = new Set<string>();
      for (const c of doc.collections) for (const it of c.items || []) {
        for (const t of [it.title, it.description]) {
          const n = normTxt(t).toLowerCase();
          if (n.length >= 12) teaserTokens.add(n);
        }
      }
      const TEASER_TAIL_RE = /(подробнее|читать далее|читать|подробней|далее|смотреть все|read more|learn more|→|»)\s*$/i;
      const wordSet = (s: string) => new Set(s.split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 2));
      const jaccard = (a: Set<string>, b: Set<string>) => {
        if (!a.size || !b.size) return 0;
        let inter = 0;
        for (const w of a) if (b.has(w)) inter++;
        return inter / (a.size + b.size - inter);
      };
      const teaserList = [...teaserTokens].map((t) => ({ n: t, w: wordSet(t) }));
      const isTeaserLine = (l: string) =>
        teaserList.some((t) => l === t.n || (l.length >= 12 && t.n.includes(l)) || jaccard(wordSet(l), t.w) >= 0.6);
      const kept = blocks.filter((b) => {
        if (b.type !== 'richText') return true;
        const lines = [b.heading, b.content, ...(b.items || [])].filter(Boolean)
          .join('\n').split(/\n+/)
          .map((x) => normTxt(x.replace(TEASER_TAIL_RE, '')).toLowerCase())
          .filter((x) => x.length >= 8);
        if (!lines.length) return true;
        const hits = lines.filter(isTeaserLine).length;
        if (hits / lines.length >= 0.7) {
          teaserEchoes.push({ pageSlug: slug, rule: 'index-teaser-echo', sample: lines[0].slice(0, 120) });
          return false;
        }
        return true;
      });
      blocks.length = 0;
      blocks.push(...kept);
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
    const body = docBodyText(doc, pageTokens, boilerplateLines);
    const cover = pickCover(entityImages(graph, e, docsById), 'cover', mediaDecisions, `service:${e.title}`, mediaSlots);
    services.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      shortDescription: [excerptFromDoc(doc, doc?.h1?.trim() || e.title, pageTokens, boilerplateLines),
        isGluedDescription(e.description || '', doc) ? undefined : firstSentences(dropLeadingTitle(e.description || body, doc?.h1 || e.title), 2, 300)]
        .find((t) => t && !isCtaText(t)) || undefined,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
      seoTitle: doc?.title || undefined,
      seoDescription: doc?.metaDescription || undefined,
      image: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      blocks: sectionsToBlocks(doc, { pageH1: doc?.h1?.trim() || e.title, chromeTokens: doc ? chromeTokens(doc, pageTokens) : [], boilerplateLines, technicalDrops, internalHref }),
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
    const body = docBodyText(doc, pageTokens, boilerplateLines);
    const imgs = entityImages(graph, e, docsById);
    const cover = pickCover(imgs, 'cover', mediaDecisions, `project:${e.title}`, mediaSlots);
    const galleryImgs = imgs
      .filter((i) => i.src !== cover?.src && scoreMediaSuitability(i, 'gallery').suitable);
    const gallery = galleryImgs.map((i) => (addMedia(i), toContentMedia(i)));
    // 'Company' is not a real category — only evidence-backed values survive.
    const category = e.category && !isGenericTitle(e.category) ? e.category : undefined;
    projects.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      excerpt: [excerptFromDoc(doc, doc?.h1?.trim() || e.title, pageTokens, boilerplateLines),
        isGluedDescription(e.description || '', doc) ? undefined : firstSentences(dropLeadingTitle(e.description || body, doc?.h1 || e.title), 2, 280)]
        .find((t) => t && !isCtaText(t)) || undefined,
      category,
      location: e.location,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
      seoTitle: doc?.title || undefined,
      seoDescription: doc?.metaDescription || undefined,
      coverImage: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      gallery,
      blocks: sectionsToBlocks(doc, { pageH1: doc?.h1?.trim() || e.title, chromeTokens: doc ? chromeTokens(doc, pageTokens) : [], boilerplateLines, technicalDrops, internalHref }),
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
    const body = docBodyText(doc, pageTokens, boilerplateLines);
    const cover = pickCover(entityImages(graph, e, docsById), 'cover', mediaDecisions, `news:${e.title}`, mediaSlots);
    news.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      excerpt: [excerptFromDoc(doc, doc?.h1?.trim() || e.title, pageTokens, boilerplateLines),
        e.description && !isGluedDescription(e.description, doc) ? firstSentences(e.description, 2, 280) : undefined]
        .find((t) => t && !isCtaText(t)) || undefined,
      publishedAt: e.date || undefined,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
      coverImage: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      blocks: sectionsToBlocks(doc, { pageH1: doc?.h1?.trim() || e.title, chromeTokens: doc ? chromeTokens(doc, pageTokens) : [], boilerplateLines, technicalDrops, internalHref }),
    });
  }
  const vacancies: ExtractedContent['vacancies'] = [];
  for (const e of graph.vacancies) {
    const doc = docsById.get(e.sourceDocumentIds[0]);
    const pc = doc ? classByDoc.get(doc.id) : undefined;
    if (pc?.type !== 'VACANCY_DETAIL' || isGenericTitle(e.title)) continue;
    const body = docBodyText(doc, pageTokens, boilerplateLines);
    vacancies.push({
      title: doc?.h1?.trim() || e.title,
      slug: slugFromDocPath(doc?.path || `/${toSlug(e.title)}`),
      location: e.location,
      description: firstSentences(body || e.description || '', 4, 600) || undefined,
      sourceUrl: doc?.url,
      sourceType: 'IMPORTED',
    });
  }

  // ---- products ---------------------------------------------------------------
  // Products come from PRODUCT_DETAIL pages (full body + blocks) or from
  // PRODUCTS_INDEX collection cards (title/description/image evidence only —
  // Tilda popup stores often have no navigable detail URL). The collection
  // page URL is the provenance, never a synthetic '#popup' link.
  const products: ExtractedContent['products'] = [];
  const usedProductSlugs = new Set<string>();
  for (const e of graph.products) {
    const doc = docsById.get(e.sourceDocumentIds[0]);
    const pc = doc ? classByDoc.get(doc.id) : undefined;
    const fromDetail = pc?.type === 'PRODUCT_DETAIL';
    const fromIndex = pc?.type === 'PRODUCTS_INDEX';
    if (!fromDetail && !fromIndex) {
      dropped.push({ title: e.title, reason: `not-from-product-page:${pc?.type || 'unknown'}`, sourceDocumentId: e.sourceDocumentIds[0] });
      continue;
    }
    if (isGenericTitle(e.title)) {
      dropped.push({ title: e.title, reason: 'generic-title', sourceDocumentId: e.sourceDocumentIds[0] });
      continue;
    }
    const body = docBodyText(doc, pageTokens, boilerplateLines);
    const imgs = entityImages(graph, e, docsById);
    const cover = pickCover(imgs, 'cover', mediaDecisions, `product:${e.title}`, mediaSlots);
    const gallery = imgs
      .filter((i) => i.src !== cover?.src && scoreMediaSuitability(i, 'gallery').suitable)
      .map((i) => (addMedia(i), toContentMedia(i)));
    const baseSlug = fromDetail && doc ? slugFromDocPath(doc.path) : toSlug(e.title);
    let slug = baseSlug;
    for (let n = 2; usedProductSlugs.has(slug); n++) slug = `${baseSlug}-${n}`;
    usedProductSlugs.add(slug);
    const attributes: Record<string, string> = {};
    for (const ev of e.evidence || []) {
      if (/^(sku|артикул|price|цена|стоимость)$/i.test(ev.type)) attributes[ev.type] = ev.value;
    }
    const title = (fromDetail && doc?.h1?.trim()) || e.title;
    // Many products share one index-page URL (Tilda popup stores have no
    // detail URLs). Item-scoped provenance keeps each row's identity stable
    // for findOwned/upsert instead of collapsing all siblings into one.
    const sourceUrl = doc?.url && !fromDetail ? `${doc.url}#item-${slug}` : doc?.url;
    products.push({
      title,
      slug,
      summary: firstSentences(dropLeadingTitle(e.description || body, doc?.h1 || e.title), 2, 300) || undefined,
      attributes,
      blocks: fromDetail && doc
        ? sectionsToBlocks(doc, { pageH1: title, chromeTokens: chromeTokens(doc, pageTokens), boilerplateLines, technicalDrops, internalHref })
        : paragraphsToBlocks(e.description || ''),
      sourceUrl,
      sourceType: 'IMPORTED',
      seoTitle: fromDetail ? doc?.title || undefined : undefined,
      seoDescription: fromDetail ? doc?.metaDescription || undefined : undefined,
      coverImage: cover ? (addMedia(cover), toContentMedia(cover)) : undefined,
      gallery,
    });
    provenance.products.push({
      title, slug, sourceUrl, sourceDocumentId: doc?.id,
      pageType: pc?.type, confidence: e.confidence, status: e.status,
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
  if (products.length) {
    const idx = sourceDocuments.find((d) => classByDoc.get(d.id)?.type === 'PRODUCTS_INDEX');
    homepageSections.push({ type: 'products', enabled: true, sortOrder: order++, title: idx?.h1?.trim() || undefined });
  }
  if (news.length) homepageSections.push({ type: 'news', enabled: true, sortOrder: order++ });
  // Composition invariant: the finale (CTA + real footer) must close the page —
  // contacts before CTA, never content after the footer.
  if (phone || email || address) homepageSections.push({ type: 'contacts', enabled: true, sortOrder: order++ });
  if (cta.title) homepageSections.push({ type: 'cta', enabled: true, sortOrder: order++ });

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
    products,
    reviews: [],
    dynamicSections: [],
    media: [...referencedMedia.values()],
    contacts: { phone, email, address, workingHours, socialLinks },
  };

  return { content, provenance };
}
