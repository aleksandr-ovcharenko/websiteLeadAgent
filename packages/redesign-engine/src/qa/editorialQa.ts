// editorialQa.ts — provider-neutral Editorial QA boundary (V3.6.2).
//
// AI may review language ONLY after deterministic extraction and semantic
// normalization. This module defines the contract; the default provider is a
// deterministic no-AI implementation. External providers (YandexGPT,
// GigaChat, …) plug in behind the same interface without changing the
// pipeline contract — and are never invoked implicitly.

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface QaEntityRef {
  entityId: string;
  blockId?: string;
  field?: string;
}

export interface LintIssue {
  kind:
    | 'duplication'
    | 'grammar'
    | 'awkward-wording'
    | 'tone-inconsistency'
    | 'unsupported-claim'
    | 'contradiction'
    | 'suspicious-numeric-claim'
    | 'legal-reference'
    | 'informal-wording'
    | 'malformed-question';
  severity: 'info' | 'warning' | 'conflict';
  message: string;
  text: string;
  where: QaEntityRef;
  evidenceIds: string[];
}

export interface SuggestPatch {
  entityId: string;
  blockId?: string;
  before: string;
  after: string;
  reason: string;
  evidenceIds: string[];
  risk: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface QaInput {
  /** Stable entity identifier (page/service/project id or slug). */
  entityId: string;
  /** Block identifier when the text belongs to one block. */
  blockId?: string;
  /** The canonical text under review. */
  text: string;
  /** Source evidence references carried through the pipeline. */
  evidenceIds?: string[];
}

export interface EditorialQaProvider {
  readonly name: string;
  readonly model: string;
  readonly version: string;
  lint(input: QaInput[]): Promise<LintIssue[]>;
  suggest(input: QaInput[]): Promise<SuggestPatch[]>;
}

export interface EditorialQaReport {
  generatedAt: string;
  provider: { name: string; model: string; version: string };
  mode: 'deterministic' | 'external';
  inputCount: number;
  issues: LintIssue[];
  suggestions: SuggestPatch[];
  conflicts: LintIssue[];
  cacheStats: { hits: number; misses: number };
}

// ---------------------------------------------------------------------------
// Deterministic rules — facts are never rewritten, only flagged.
// ---------------------------------------------------------------------------

const NUMERIC_CLAIM_RE = /(?:до\s+)?\d+\s*%|процент|эконом\w*\s+до|более\s+\d+|свыше\s+\d+|тысяч\w*|миллион\w*/i;
const LEGAL_RE = /стб|снип|снб|законодательств|гарантийн\w*\s+обязательств|декрет|указ|постановлени/i;
const WARRANTY_RE = /гаранти\w*/i;
const INFORMAL_RE = /доски с мусорки|на глаз|авось|как-нибудь|впритык|тупить|косяк/i;
const MALFORMED_Q_RE = /сколько\s+стоит\s+[а-яё]+(ые|ых|ие)\s+(работы|услуги|объекты)|сколько\s+стоит\s+монолитн/i;

interface WarrantyClaim { n: number; unit: string; text: string; where: QaEntityRef; }

function warrantyClaims(input: QaInput[]): WarrantyClaim[] {
  const out: WarrantyClaim[] = [];
  const re = /гаранти\w*[^.\n]{0,40}?(\d+)\s*(лет|года|год|months?|месяц\w*)/gi;
  for (const item of input) {
    let m: RegExpExecArray | null;
    const local = new RegExp(re.source, re.flags);
    while ((m = local.exec(item.text))) {
      out.push({
        n: parseInt(m[1], 10),
        unit: m[2].toLowerCase(),
        text: m[0].trim(),
        where: { entityId: item.entityId, blockId: item.blockId },
      });
    }
    const upTo = /гаранти\w*\s+до\s+(\d+)\s*(лет|года|год)/gi;
    while ((m = upTo.exec(item.text))) {
      out.push({ n: parseInt(m[1], 10), unit: m[2].toLowerCase(), text: m[0].trim(), where: { entityId: item.entityId, blockId: item.blockId } });
    }
  }
  return out;
}

function normalized(t: string): string {
  return t.replace(/\s+/g, ' ').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Deterministic provider (no external calls, fully offline).
// ---------------------------------------------------------------------------

export class DeterministicEditorialQa implements EditorialQaProvider {
  readonly name = 'deterministic-editorial-qa';
  readonly model = 'rules-v1';
  readonly version = '1.0.0';
  private cache = new Map<string, LintIssue[]>();
  private hits = 0;
  private misses = 0;

  get cacheStats() { return { hits: this.hits, misses: this.misses }; }

  private key(input: QaInput[]): string {
    return createHash('sha256').update(JSON.stringify(input.map((i) => [i.entityId, i.blockId, i.text]))).digest('hex');
  }

  async lint(input: QaInput[]): Promise<LintIssue[]> {
    const k = this.key(input);
    const cached = this.cache.get(k);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    const issues: LintIssue[] = [];

    // Duplication: immediately-adjacent normalized duplicates inside one text.
    for (const item of input) {
      const paras = item.text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
      for (let i = 1; i < paras.length; i++) {
        if (normalized(paras[i]) === normalized(paras[i - 1])) {
          issues.push({
            kind: 'duplication', severity: 'warning',
            message: 'Immediately-adjacent duplicated text survived normalization',
            text: paras[i].slice(0, 160),
            where: { entityId: item.entityId, blockId: item.blockId },
            evidenceIds: item.evidenceIds || [],
          });
        }
      }
      if (NUMERIC_CLAIM_RE.test(item.text)) {
        for (const m of item.text.match(new RegExp(NUMERIC_CLAIM_RE.source, 'gi')) || []) {
          issues.push({
            kind: 'suspicious-numeric-claim', severity: 'warning',
            message: 'Numeric claim requires human verification — never auto-rewrite',
            text: m, where: { entityId: item.entityId, blockId: item.blockId }, evidenceIds: item.evidenceIds || [],
          });
        }
      }
      if (LEGAL_RE.test(item.text)) {
        const m = item.text.match(new RegExp(LEGAL_RE.source, 'i'))!;
        issues.push({
          kind: 'legal-reference', severity: 'warning',
          message: 'Legal/standards reference — no automatic rewriting of legal or warranty claims',
          text: m[0], where: { entityId: item.entityId, blockId: item.blockId }, evidenceIds: item.evidenceIds || [],
        });
      }
      if (INFORMAL_RE.test(item.text)) {
        const m = item.text.match(new RegExp(INFORMAL_RE.source, 'i'))!;
        issues.push({
          kind: 'informal-wording', severity: 'warning',
          message: 'Informal/colloquial wording detected — flag for editorial review',
          text: m[0], where: { entityId: item.entityId, blockId: item.blockId }, evidenceIds: item.evidenceIds || [],
        });
      }
      if (MALFORMED_Q_RE.test(item.text)) {
        const m = item.text.match(new RegExp(MALFORMED_Q_RE.source, 'i'))!;
        issues.push({
          kind: 'malformed-question', severity: 'warning',
          message: 'Malformed question (e.g. "Сколько стоит монолитные работы?") — grammar flagged, not auto-fixed',
          text: m[0], where: { entityId: item.entityId, blockId: item.blockId }, evidenceIds: item.evidenceIds || [],
        });
      }
    }

    // Warranty contradictions: different durations across the corpus.
    const claims = warrantyClaims(input);
    const byDuration = new Map<number, WarrantyClaim[]>();
    for (const c of claims) {
      const arr = byDuration.get(c.n) || [];
      arr.push(c);
      byDuration.set(c.n, arr);
    }
    if (byDuration.size > 1) {
      const groups = [...byDuration.entries()].sort((a, b) => a[0] - b[0]);
      issues.push({
        kind: 'contradiction', severity: 'conflict',
        message: `Conflicting warranty durations: ${groups.map(([n, g]) => `${n} (${g.length}×)`).join(' vs ')} — requires human resolution`,
        text: groups.map(([n, g]) => `«${g[0].text}» @ ${g[0].where.entityId}`).join(' | '),
        where: groups[0][1][0].where,
        evidenceIds: groups.flatMap(([, g]) => g.map((c) => c.where.entityId)),
      });
    }

    this.cache.set(k, issues);
    return issues;
  }

  /** Suggestions are JSON patches ONLY — deterministic mode suggests nothing
   *  that touches numbers, legal text, or claims. Adjacent-duplicate removal
   *  is the sole safe suggestion. */
  async suggest(input: QaInput[]): Promise<SuggestPatch[]> {
    const patches: SuggestPatch[] = [];
    for (const item of input) {
      const paras = item.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const seen = new Set<number>();
      const out: string[] = [];
      paras.forEach((p, i) => {
        if (i > 0 && normalized(p) === normalized(paras[i - 1])) { seen.add(i); return; }
        out.push(p);
      });
      if (seen.size) {
        patches.push({
          entityId: item.entityId,
          blockId: item.blockId,
          before: item.text,
          after: out.join('\n\n'),
          reason: 'Remove immediately-adjacent exact duplicates (deterministic — no facts touched)',
          evidenceIds: item.evidenceIds || [],
          risk: 'low',
          confidence: 0.98,
        });
      }
    }
    return patches;
  }
}

// ---------------------------------------------------------------------------
// Provider resolution — deterministic by default; external providers register
// explicitly and are only used when configured AND approved.
// ---------------------------------------------------------------------------

const registry = new Map<string, () => EditorialQaProvider>();

export function registerEditorialQaProvider(id: string, factory: () => EditorialQaProvider): void {
  registry.set(id, factory);
}

export function getEditorialQaProvider(id?: string): EditorialQaProvider {
  const selected = id || process.env.EDITORIAL_QA_PROVIDER || 'deterministic';
  const factory = registry.get(selected);
  if (factory) return factory();
  if (selected !== 'deterministic') {
    // Unknown external provider — refuse to fall back silently to a network
    // call; deterministic is the only built-in implementation.
    console.warn(`[editorial-qa] provider "${selected}" not registered — using deterministic no-AI fallback`);
  }
  return new DeterministicEditorialQa();
}

export async function runEditorialQa(input: QaInput[], provider?: EditorialQaProvider): Promise<EditorialQaReport> {
  const p = provider || getEditorialQaProvider();
  const issues = await p.lint(input);
  const suggestions = await p.suggest(input);
  const conflicts = issues.filter((i) => i.severity === 'conflict');
  return {
    generatedAt: new Date().toISOString(),
    provider: { name: p.name, model: p.model, version: p.version },
    mode: p instanceof DeterministicEditorialQa ? 'deterministic' : 'external',
    inputCount: input.length,
    issues,
    suggestions,
    conflicts,
    cacheStats: p instanceof DeterministicEditorialQa ? p.cacheStats : { hits: 0, misses: 0 },
  };
}
