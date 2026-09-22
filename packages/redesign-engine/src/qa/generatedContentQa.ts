// generatedContentQa.ts — deterministic structural QA over the generated
// import contract (V3.7.1, Phase 4).
//
// Runs after typed content generation (graphToImportContent) and BEFORE CMS
// import. Every finding is stage-classified so the post-generation QA loop can
// rerun only the owning stage — findings here never trigger a recrawl.
//
// AI/editorial suggestions travel ONLY through the SuggestPatch schema from
// editorialQa.ts; this module emits no patches and never calls a provider.

import { detectTechnicalPayload } from '../extract/technicalPayload.js';
import { isCtaText } from '../import/graphToImportContent.js';
import type { SourceDocument } from '../types.js';

export type QaSeverity = 'info' | 'warning' | 'error';

export interface GeneratedContentFinding {
  /** Owning pipeline stage for the post-generation QA loop. */
  stage: 'extraction' | 'semantic' | 'generation' | 'import';
  kind:
    | 'technical-payload'
    | 'duplicate-heading-body'
    | 'duplicate-adjacent-paragraph'
    | 'duplicate-responsive-section'
    | 'glued-description'
    | 'placeholder-contact'
    | 'empty-heading'
    | 'empty-title'
    | 'orphan-list'
    | 'excessive-fragmentation'
    | 'suspicious-date'
    | 'fabricated-date'
    | 'whitespace'
    | 'oversized-content'
    | 'cta-as-lede'
    | 'invalid-hero-media'
    | 'duplicate-entity'
    | 'dropped-entity'
    | 'missing-date';
  entityId: string;
  route?: string;
  severity: QaSeverity;
  message: string;
  evidence: string;
  suggestedOwner: string;
  requiresRecrawl: boolean;
}

export interface GeneratedContentQaReport {
  generatedAt: string;
  checksRun: string[];
  scannedEntities: number;
  scannedBlocks: number;
  findings: GeneratedContentFinding[];
  countsBySeverity: Record<QaSeverity, number>;
}

const PLACEHOLDER_RE = /mail@example\.|example\.(com|org|ru|by|net)|\+375\s*\(99\)\s*999-99-99|999-99-99|xxx+/i;
const WS_RE = /  |\t| $|^ /m;
const MAX_BLOCK_CHARS = 12000;
const MAX_PARA_CHARS = 3000;

/** Missing sentence boundary inside one paragraph: lowercase word followed by
 *  space + Capital. Cyrillic-aware (no \b). A single-paragraph run of ≥3 such
 *  transitions means glued label text like "Проблемы Решения Мы превращаем…" —
 *  newline-separated lines (lists, rosters) are legitimate and don't count. */
function gluedTransitions(t: string): number {
  let worst = 0;
  for (const para of t.split(/\n/)) {
    const hits = (para.match(/[а-яёa-z][ ]+[А-ЯЁA-Z][а-яёa-z]/g) || []).length;
    if (hits > worst) worst = hits;
  }
  return worst;
}

function looksGlued(t: string): boolean {
  return t.length >= 60 && gluedTransitions(t) >= 3;
}

interface EntityBag {
  kind: string;
  slug?: string;
  title?: string;
  summary?: string;
  blocks?: any[];
  [k: string]: any;
}

function norm(t: string): string {
  return t.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function runGeneratedContentQa(
  content: Record<string, any>,
  opts: { sourceDocuments?: SourceDocument[]; generatedAt?: string; provenance?: { media?: { src: string; suitable: boolean }[]; droppedEntities?: { title: string; reason: string }[] } } = {},
): GeneratedContentQaReport {
  const findings: GeneratedContentFinding[] = [];
  let scannedBlocks = 0;
  let scannedEntities = 0;

  const push = (f: Omit<GeneratedContentFinding, 'requiresRecrawl'> & { requiresRecrawl?: boolean }) =>
    findings.push({ requiresRecrawl: false, ...f });

  const lintText = (
    t: string | undefined,
    where: { entityId: string; route?: string; field: string },
    stage: GeneratedContentFinding['stage'] = 'semantic',
  ) => {
    if (!t || !t.trim()) return;
    const tech = detectTechnicalPayload(t);
    if (tech.technical) {
      push({
        stage: 'extraction', kind: 'technical-payload', entityId: where.entityId, route: where.route,
        severity: 'error',
        message: `Technical payload in ${where.field} (${tech.rule || 'detector'})`,
        evidence: t.slice(0, 140),
        suggestedOwner: 'extraction',
      });
    }
    if (PLACEHOLDER_RE.test(t)) {
      push({
        stage: 'extraction', kind: 'placeholder-contact', entityId: where.entityId, route: where.route,
        severity: 'error', message: `Placeholder contact value in ${where.field}`,
        evidence: t.match(PLACEHOLDER_RE)![0], suggestedOwner: 'extraction',
      });
    }
    if (looksGlued(t)) {
      push({
        stage: 'semantic', kind: 'glued-description', entityId: where.entityId, route: where.route,
        severity: 'warning',
        message: `Possible glued section-label text in ${where.field} (${gluedTransitions(t)} missing sentence boundaries in one paragraph)`,
        evidence: t.slice(0, 160), suggestedOwner: 'semantic',
      });
    }
    if (WS_RE.test(t)) {
      push({
        stage: 'generation', kind: 'whitespace', entityId: where.entityId, route: where.route,
        severity: 'info', message: `Whitespace defect in ${where.field} (double space / tab / edge space)`,
        evidence: t.slice(0, 80), suggestedOwner: 'generation',
      });
    }
    if (t.length > MAX_PARA_CHARS) {
      push({
        stage: 'generation', kind: 'oversized-content', entityId: where.entityId, route: where.route,
        severity: 'warning', message: `${where.field} exceeds ${MAX_PARA_CHARS} chars (${t.length})`,
        evidence: `${t.length} chars`, suggestedOwner: 'generation',
      });
    }
    const paras = t.split(/\n{2,}|\n/).map((p) => norm(p)).filter(Boolean);
    for (let i = 1; i < paras.length; i++) {
      if (paras[i] === paras[i - 1]) {
        push({
          stage: 'generation', kind: 'duplicate-adjacent-paragraph', entityId: where.entityId, route: where.route,
          severity: 'warning', message: `Adjacent duplicated paragraph in ${where.field}`,
          evidence: paras[i].slice(0, 100), suggestedOwner: 'generation',
        });
      }
    }
  };

  const lintBlocks = (blocks: any[] | undefined, entityId: string, route?: string) => {
    if (!blocks?.length) return;
    let anonRun = 0;
    let prevNorm = '';
    for (const [i, b] of blocks.entries()) {
      scannedBlocks++;
      const heading = (b.heading || b.title || '').trim();
      const body = (b.content || b.description || '').trim();
      const items: string[] = (b.items || []).map((i: any) => (typeof i === 'string' ? i : i?.title || i?.text || '')).filter(Boolean);

      lintText(heading, { entityId, route, field: `block.${b.type}.heading` });
      lintText(body, { entityId, route, field: `block.${b.type}.content` });
      for (const it of items) lintText(it, { entityId, route, field: `block.${b.type}.items[]` });

      if (heading && body && norm(heading) === norm(body)) {
        push({
          stage: 'generation', kind: 'duplicate-heading-body', entityId, route, severity: 'warning',
          message: 'Block heading duplicates its body', evidence: heading.slice(0, 100),
          suggestedOwner: 'generation',
        });
      }
      if (heading && !body && !items.length && b.type === 'richText') {
        push({
          stage: 'semantic', kind: 'empty-heading', entityId, route, severity: 'warning',
          message: 'Heading-only richText block (orphan heading)', evidence: heading.slice(0, 100),
          suggestedOwner: 'semantic',
        });
      }
      if (items.length && !heading && b.type !== 'gallery') {
        push({
          stage: 'semantic', kind: 'orphan-list', entityId, route, severity: 'info',
          message: `List block without heading (${items.length} items)`, evidence: items[0]?.slice(0, 80),
          suggestedOwner: 'semantic',
        });
      }
      const blockNorm = norm([heading, body, ...items].join(' '));
      if (blockNorm && blockNorm === prevNorm) {
        // Same-type identical neighbours are the responsive/slider-duplication
        // signature (desktop + mobile copies) — a blocking error, not prose noise.
        const sameType = blocks[i - 1]?.type === b.type;
        push({
          stage: 'generation', kind: sameType ? 'duplicate-responsive-section' : 'duplicate-adjacent-paragraph',
          entityId, route, severity: sameType ? 'error' : 'warning',
          message: sameType ? 'Duplicate responsive section (identical adjacent block of same type)' : 'Adjacent block duplicates previous block',
          evidence: heading.slice(0, 100) || body.slice(0, 100),
          suggestedOwner: 'generation',
        });
      }
      if (blockNorm) prevNorm = blockNorm;
      anonRun = (b.type === 'richText' && !heading) ? anonRun + 1 : 0;
      if (anonRun === 4) {
        push({
          stage: 'semantic', kind: 'excessive-fragmentation', entityId, route, severity: 'warning',
          message: '≥4 consecutive anonymous richText blocks — semantic grouping incomplete',
          evidence: `run of ${anonRun} anonymous blocks`, suggestedOwner: 'semantic',
        });
      }
      if (body.length > MAX_BLOCK_CHARS) {
        push({
          stage: 'generation', kind: 'oversized-content', entityId, route, severity: 'warning',
          message: `Block content exceeds ${MAX_BLOCK_CHARS} chars (${body.length})`,
          evidence: `${body.length} chars`, suggestedOwner: 'generation',
        });
      }
    }
  };

  const generatedAtMs = opts.generatedAt ? new Date(opts.generatedAt).getTime() : Date.now();

  const lintEntity = (e: EntityBag, kind: string) => {
    scannedEntities++;
    const entityId = e.slug || e.title || kind;
    const route = e.slug ? `/${e.slug}` : undefined;
    // Empty required entity title is a blocking error — a routable entity
    // must carry human-readable identity.
    if (!(e.title || '').trim() && !(e.heading || '').trim()) {
      push({
        stage: 'generation', kind: 'empty-title', entityId, route, severity: 'error',
        message: `${kind} has no title`, evidence: entityId, suggestedOwner: 'generation',
      });
    }
    const summary = e.shortDescription || e.excerpt || e.summary;
    lintText(summary, { entityId, route, field: `${kind}.summary` });
    if (summary && isCtaText(summary)) {
      push({
        stage: 'semantic', kind: 'cta-as-lede', entityId, route, severity: 'error',
        message: `CTA imperative used as ${kind} summary`, evidence: summary.slice(0, 120),
        suggestedOwner: 'semantic',
      });
    }
    // Suspicious/fabricated dates: any date field on the generated contract.
    let hasDate = false;
    for (const key of ['publishedAt', 'date', 'createdAt', 'updatedAt']) {
      const v = (e as any)[key];
      if (!v) continue;
      const d = new Date(v);
      if (isNaN(d.getTime())) continue;
      hasDate = true;
      if (d.getTime() > Date.now()) {
        push({
          stage: 'import', kind: 'suspicious-date', entityId, route, severity: 'error',
          message: `Future date in ${kind}.${key}`, evidence: String(v),
          suggestedOwner: 'import',
        });
      } else if (kind === 'news' && Math.abs(d.getTime() - generatedAtMs) < 10 * 60 * 1000) {
        // A publication timestamp ≈ generation time is the fabrication
        // signature of an import-time `new Date()` fallback, not evidence.
        push({
          stage: 'import', kind: 'fabricated-date', entityId, route, severity: 'error',
          message: `Publication date within minutes of generation time — fabricated, not source-verified`,
          evidence: String(v), suggestedOwner: 'import',
        });
      }
    }
    // Phase 5 contract: news without source-verified publication date must be
    // recorded, not silently fabricated.
    if (kind === 'news' && !hasDate) {
      push({
        stage: 'import', kind: 'missing-date', entityId, route, severity: 'info',
        message: 'MISSING_PUBLICATION_DATE — no source-verified date; renderer must hide it',
        evidence: entityId, suggestedOwner: 'extraction',
      });
    }
    lintBlocks(e.blocks, entityId, route);
  };

  for (const p of content.pages || []) lintEntity({ ...p, blocks: p.blocks }, 'page');
  const SINGULAR: Record<string, string> = {
    services: 'service', projects: 'project', news: 'news',
    products: 'product', vacancies: 'vacancy', reviews: 'review',
  };
  for (const kind of Object.keys(SINGULAR)) {
    for (const e of content[kind] || []) lintEntity(e, SINGULAR[kind]);
  }
  for (const s of content.homepageSections || []) {
    lintBlocks(s.items ? [{ type: 'collection', heading: s.heading, items: s.items.map((i: any) => i.title || i) }] : [], `section:${s.kind || s.heading}`, '/');
  }

  // Duplicate active entity identity: same slug or same source URL claimed
  // twice inside one collection is a blocking defect.
  for (const kind of Object.keys(SINGULAR)) {
    const seenSlug = new Map<string, string>();
    const seenSrc = new Map<string, string>();
    for (const e of content[kind] || []) {
      const id = e.slug || e.title || kind;
      for (const [map, val, label] of [
        [seenSlug, e.slug, 'slug'],
        [seenSrc, e.sourceUrl, 'sourceUrl'],
      ] as const) {
        if (!val) continue;
        const prior = map.get(val);
        if (prior) {
          push({
            stage: 'generation', kind: 'duplicate-entity', entityId: id, severity: 'error',
            message: `Duplicate ${SINGULAR[kind]} identity — ${label} "${val}" claimed by "${prior}" and "${id}"`,
            evidence: String(val).slice(0, 140), suggestedOwner: 'generation',
          });
        } else map.set(val, id);
      }
    }
  }

  // Invalid hero media: a hero image that the suitability gate rejected must
  // never reach the contract (TEXT_ONLY fallback is the valid alternative).
  const heroSrc = content.hero?.image?.sourceUrl || content.hero?.image || content.hero?.imageUrl;
  if (heroSrc && opts.provenance?.media) {
    const dec = opts.provenance.media.find((m) => m.src === heroSrc);
    if (dec && dec.suitable === false) {
      push({
        stage: 'generation', kind: 'invalid-hero-media', entityId: 'home', route: '/', severity: 'error',
        message: 'Hero image was rejected by the media suitability gate but still reached the contract',
        evidence: String(heroSrc).slice(0, 140), suggestedOwner: 'generation',
      });
    }
  }

  // Dropped entities are recorded provenance — surfaced as warnings so the
  // drop is inspectable, never silent.
  for (const d of opts.provenance?.droppedEntities || []) {
    push({
      stage: 'semantic', kind: 'dropped-entity', entityId: d.title || 'unknown', severity: 'warning',
      message: `Source entity dropped: ${d.reason}`, evidence: (d.title || '').slice(0, 120),
      suggestedOwner: 'semantic',
    });
  }

  const countsBySeverity: Record<QaSeverity, number> = { info: 0, warning: 0, error: 0 };
  for (const f of findings) countsBySeverity[f.severity]++;

  return {
    generatedAt: opts.generatedAt || new Date().toISOString(),
    checksRun: [
      'technical-payload', 'duplicate-heading-body', 'duplicate-adjacent-paragraph',
      'duplicate-responsive-section', 'glued-description', 'placeholder-contact',
      'empty-heading', 'empty-title', 'orphan-list', 'excessive-fragmentation',
      'suspicious-date', 'fabricated-date', 'whitespace', 'oversized-content',
      'cta-as-lede', 'invalid-hero-media', 'duplicate-entity', 'dropped-entity',
      'missing-date',
    ],
    scannedEntities,
    scannedBlocks,
    findings,
    countsBySeverity,
  };
}
