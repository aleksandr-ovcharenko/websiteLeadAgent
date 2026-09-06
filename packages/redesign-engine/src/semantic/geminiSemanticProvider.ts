import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type {
  SourceDocument,
  SourceDocumentCollection,
  SourceDocumentSection,
  SourceDocumentImage,
} from '../types.js';
import type {
  PageClassificationContext,
  CollectionClassificationContext,
  SectionClassificationContext,
  MediaClassificationContext,
  EntityExtractionContext,
  GenerationSemanticProvider,
  ProviderOptions,
} from './provider.js';
import { RuleBasedSemanticProvider, pageCategoryAndSubType } from './ruleBasedProvider.js';
import {
  geminiCollectionDecisionSchema,
  geminiPageDecisionSchema,
  type PageClassification,
  type CollectionClassification,
  type SectionClassification,
  type ImageCandidate,
  type CompanyEntity,
  type ContactsEntity,
  type ServiceEntity,
  type ProjectEntity,
  type NewsEntity,
  type VacancyEntity,
  type ProductEntity,
  type FactEntity,
  type Relationship,
  type Evidence,
  type AiCallMetadata,
} from './schema.js';

const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.4,
};

const PAGE_TYPES: PageClassification['type'][] = [
  'HOME', 'ABOUT', 'SERVICES_INDEX', 'SERVICE_DETAIL', 'PROJECTS_INDEX', 'PROJECT_DETAIL',
  'NEWS_INDEX', 'NEWS_DETAIL', 'VACANCIES_INDEX', 'VACANCY_DETAIL', 'PRODUCTS_INDEX',
  'PRODUCT_DETAIL', 'CONTACTS', 'LEGAL', 'OTHER',
];

const AI_COLLECTION_CLASSIFICATIONS = [
  'PROJECTS', 'PRODUCTS', 'SERVICES', 'NEWS', 'VACANCIES', 'CORPORATE',
  'NAVIGATION', 'PARTNER_LINKS', 'SOCIAL_LINKS', 'UTILITY', 'UNKNOWN',
] as const;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

function hashInput(input: unknown): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex').slice(0, 32);
}

function norm(s?: string): string {
  return (s || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
}

function parentSection(doc: SourceDocument, collectionId: string): SourceDocumentSection | undefined {
  return doc.sections.find((sec) => (sec.collections || []).some((c) => c.id === collectionId));
}

function navAncestry(url: string, doc: SourceDocument): string[] {
  const walk = (nodes: any[], path: string[] = []): string[][] => {
    for (const n of nodes) {
      const p = [...path, n.label];
      if (n.url && sameUrl(url, n.url)) return [p];
      if (n.children) {
        const child = walk(n.children, p);
        if (child.length) return child;
      }
    }
    return [];
  };
  const primary = doc.chrome.nav?.primary || [];
  const secondary = doc.chrome.nav?.secondary || [];
  const found = walk(primary).length ? walk(primary) : walk(secondary);
  return found[0] || [];
}

function sameUrl(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  try { return new URL(a).pathname === new URL(b).pathname; } catch { return a === b; }
}

function breadcrumbs(doc: SourceDocument): string[] {
  return (doc.chrome.nav?.breadcrumbs || []).map((b) => b.label).filter(Boolean);
}

function hasMeaningfulEvidence(doc: SourceDocument | SourceDocumentCollection): boolean {
  if ('collections' in doc) {
    // SourceDocument
    return Boolean(
      doc.title || doc.h1 || doc.metaDescription ||
      (doc.sections && doc.sections.length > 0) ||
      (doc.collections && doc.collections.length > 0) ||
      (doc.mainText && doc.mainText.length > 200)
    );
  }
  // SourceDocumentCollection
  return Boolean(
    doc.heading ||
    (doc.items && doc.items.some((i) => i.title || i.description || i.url || i.image))
  );
}

function pageTextForValidation(doc: SourceDocument): string {
  const parts: string[] = [doc.title, doc.h1 || '', doc.metaDescription || ''];
  for (const sec of doc.sections || []) {
    parts.push(sec.heading || '', ...sec.paragraphs);
    for (const coll of sec.collections || []) {
      parts.push(coll.heading || '');
      for (const item of coll.items || []) {
        parts.push(item.title || '', item.description || '');
      }
    }
  }
  for (const coll of doc.collections || []) {
    parts.push(coll.heading || '');
    for (const item of coll.items || []) {
      parts.push(item.title || '', item.description || '');
    }
  }
  return parts.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Cache & observability abstractions
// ---------------------------------------------------------------------------

export interface SemanticDecisionCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export class LocalSemanticCache implements SemanticDecisionCache {
  constructor(private dir = join(tmpdir(), 'redesign-gemini-cache')) {}
  private filePath(key: string) {
    return join(this.dir, `${key}.json`);
  }
  async get(key: string): Promise<string | undefined> {
    try {
      return await readFile(this.filePath(key), 'utf-8');
    } catch {
      return undefined;
    }
  }
  async set(key: string, value: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.filePath(key), value, 'utf-8');
  }
}

export class InMemorySemanticCache implements SemanticDecisionCache {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | undefined> {
    return this.store.get(key);
  }
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

export interface AiDecisionObserver {
  log(metadata: AiCallMetadata): Promise<void>;
}

export class LocalAiDecisionObserver implements AiDecisionObserver {
  constructor(private path = join(tmpdir(), 'redesign-ai-decisions.jsonl')) {}
  async log(metadata: AiCallMetadata): Promise<void> {
    try {
      await appendFile(this.path, JSON.stringify(metadata) + '\n', 'utf-8');
    } catch {
      // Observability failure must not break the pipeline
    }
  }
}

export class InMemoryAiDecisionObserver implements AiDecisionObserver {
  public records: AiCallMetadata[] = [];
  async log(metadata: AiCallMetadata): Promise<void> {
    this.records.push(metadata);
  }
}

// ---------------------------------------------------------------------------
// Gemini HTTP client
// ---------------------------------------------------------------------------

interface GeminiGenerateRequest {
  contents: { role: 'user'; parts: { text: string }[] }[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
    responseSchema?: object;
  };
}

interface GeminiGenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiClient {
  private apiKey: string;
  private model: string;
  private apiUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(opts: {
    apiKey: string;
    model: string;
    apiUrl?: string;
    timeoutMs?: number;
    maxRetries?: number;
  }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.apiUrl = (opts.apiUrl || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.maxRetries = opts.maxRetries ?? 1;
  }

  async generate(
    prompt: string,
    responseSchema?: object,
    maxOutputTokens = 800
  ): Promise<{ text: string; usage?: GeminiGenerateResponse['usageMetadata'] }> {
    const body: GeminiGenerateRequest = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema,
      },
    };

    const url = `${this.apiUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!resp.ok) {
          const status = resp.status;
          const text = await resp.text().catch(() => '');
          if (status === 429 || status >= 500) {
            lastError = new Error(`Gemini HTTP ${status}: ${text.slice(0, 200)}`);
            continue;
          }
          throw new Error(`Gemini HTTP ${status}: ${text.slice(0, 200)}`);
        }

        const json = (await resp.json()) as GeminiGenerateResponse;
        const text = json.candidates?.[0]?.content?.parts
          ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
          .join('') ?? '';
        if (!text) {
          lastError = new Error('Gemini returned empty text');
          continue;
        }
        return { text, usage: json.usageMetadata };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof Error && /AbortError|timeout/i.test(err.message)) {
          lastError = err;
        }
      }
    }
    throw lastError || new Error('Gemini request failed');
  }
}

// ---------------------------------------------------------------------------
// Hybrid provider
// ---------------------------------------------------------------------------

export class HybridGeminiProvider implements GenerationSemanticProvider {
  readonly name = 'gemini-hybrid';
  readonly model: string;
  readonly promptVersion: string;
  readonly temperature = 0;
  readonly confidenceThresholds = CONFIDENCE_THRESHOLDS;

  private rule = new RuleBasedSemanticProvider();
  private apiKey: string;
  private apiUrl: string;
  private client: GeminiClient | undefined;
  private cache: SemanticDecisionCache;
  private observer: AiDecisionObserver;
  private concurrency: number;
  private semaphore: { count: number; queue: (() => void)[] } = { count: 0, queue: [] };
  private enabled: boolean;
  private geminiResponseOverride?: (promptText: string, callType: string, inputHash: string) => Promise<string> | string;
  // Circuit breaker: after this many consecutive quota/429 failures, stop
  // calling the API for the rest of the run — deterministic fallback instead.
  private consecutiveQuotaFailures = 0;
  private static readonly QUOTA_CIRCUIT_LIMIT = 3;

  constructor(options?: ProviderOptions) {
    this.apiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.model = options?.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.apiUrl = (options?.geminiApiUrl || process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '');
    this.promptVersion = options?.geminiPromptVersion || '1.0';
    this.cache = new LocalSemanticCache(options?.geminiCachePath || process.env.GEMINI_SEMANTIC_CACHE);
    const logPath = options?.geminiLogPath || process.env.GEMINI_SEMANTIC_LOG;
    this.observer = logPath ? new LocalAiDecisionObserver(logPath) : new LocalAiDecisionObserver();
    this.concurrency = Math.max(1, Number(process.env.GEMINI_SEMANTIC_CONCURRENCY ?? options?.geminiConcurrency ?? 2));
    this.enabled = Boolean(this.apiKey);
    if (this.enabled) {
      this.client = new GeminiClient({ apiKey: this.apiKey, model: this.model, apiUrl: this.apiUrl });
    }
  }

  setGeminiResponseOverride(fn: (promptText: string, callType: string, inputHash: string) => Promise<string> | string): void {
    this.geminiResponseOverride = fn;
  }

  setCache(cache: SemanticDecisionCache): void {
    this.cache = cache;
  }

  setObserver(observer: AiDecisionObserver): void {
    this.observer = observer;
  }

  async classifyPage(ctx: PageClassificationContext): Promise<PageClassification> {
    const ruleResult = await this.rule.classifyPage(ctx);
    const level = confidenceLevel(ruleResult.confidence);
    if (level === 'HIGH') return ruleResult;
    if (level === 'UNKNOWN' && !hasMeaningfulEvidence(ctx.sourceDocument)) return ruleResult;
    return this.adjudicatePage(ctx, ruleResult);
  }

  async classifyCollections(ctxs: CollectionClassificationContext[]): Promise<CollectionClassification[]> {
    if (!ctxs.length) return [];
    const results: CollectionClassification[] = new Array(ctxs.length);
    const ambiguous: { ctx: CollectionClassificationContext; ruleResult: CollectionClassification; index: number }[] = [];

    for (let i = 0; i < ctxs.length; i++) {
      const ruleResult = await this.rule.classifyCollection(ctxs[i]);
      const level = confidenceLevel(ruleResult.confidence);
      if (level === 'HIGH') {
        results[i] = ruleResult;
      } else if (level === 'UNKNOWN' && !hasMeaningfulEvidence(ctxs[i].collection)) {
        results[i] = ruleResult;
      } else {
        ambiguous.push({ ctx: ctxs[i], ruleResult, index: i });
      }
    }

    if (!ambiguous.length) return results;

    const batchDecision = await this.adjudicateCollectionsBatch(ambiguous);
    for (const { index } of ambiguous) {
      const item = batchDecision.get(index);
      results[index] = item || results[index];
    }
    return results;
  }

  async classifyCollection(ctx: CollectionClassificationContext): Promise<CollectionClassification> {
    const [result] = await this.classifyCollections([ctx]);
    return result;
  }

  async classifySection(ctx: SectionClassificationContext): Promise<SectionClassification> {
    return this.rule.classifySection(ctx);
  }

  async classifyMedia(ctx: MediaClassificationContext): Promise<ImageCandidate> {
    return this.rule.classifyMedia(ctx);
  }

  async extractCompany(ctx: EntityExtractionContext): Promise<CompanyEntity | undefined> {
    return this.rule.extractCompany(ctx);
  }
  async extractContacts(ctx: EntityExtractionContext): Promise<ContactsEntity | undefined> {
    return this.rule.extractContacts(ctx);
  }
  async extractServices(ctx: EntityExtractionContext): Promise<ServiceEntity[]> {
    return this.rule.extractServices(ctx);
  }
  async extractProjects(ctx: EntityExtractionContext): Promise<ProjectEntity[]> {
    return this.rule.extractProjects(ctx);
  }
  async extractNews(ctx: EntityExtractionContext): Promise<NewsEntity[]> {
    return this.rule.extractNews(ctx);
  }
  async extractVacancies(ctx: EntityExtractionContext): Promise<VacancyEntity[]> {
    return this.rule.extractVacancies(ctx);
  }
  async extractProducts(ctx: EntityExtractionContext): Promise<ProductEntity[]> {
    return this.rule.extractProducts(ctx);
  }
  async extractFacts(ctx: EntityExtractionContext): Promise<FactEntity[]> {
    return this.rule.extractFacts(ctx);
  }
  async extractRelationships(ctx: EntityExtractionContext): Promise<Relationship[]> {
    return this.rule.extractRelationships(ctx);
  }

  drainFactRejections() {
    return this.rule.drainFactRejections();
  }

  private async adjudicatePage(ctx: PageClassificationContext, ruleResult: PageClassification): Promise<PageClassification> {
    if (!this.enabled || !this.client) {
      return { ...ruleResult, reason: this.appendReason(ruleResult.reason, 'Gemini not configured; keeping rule result') };
    }

    const { text, validIds, input } = this.buildPagePrompt(ctx, ruleResult);
    const inputHash = this.inputHash('page', input);
    const cached = await this.cache.get(inputHash);
    let raw: string | undefined;
    let error: string | undefined;
    let durationMs: number | undefined;
    let finalResult: PageClassification = ruleResult;

    try {
      const start = Date.now();
      if (cached) {
        raw = cached;
      } else {
        raw = await this.callGemini(text, 'page', inputHash);
        durationMs = Date.now() - start;
        if (raw) await this.cache.set(inputHash, raw).catch(() => {});
      }

      const decision = this.parsePageDecision(raw, validIds);
      if (!decision) {
        error = 'Gemini page decision invalid or failed';
        finalResult = { ...ruleResult, reason: this.appendReason(ruleResult.reason, error) };
        return finalResult;
      }

      const aiConfidence = clamp(decision.confidence, 0, 1);
      if (aiConfidence < ruleResult.confidence) {
        finalResult = {
          ...ruleResult,
          aiConfidence,
          reason: this.appendReason(ruleResult.reason, `Gemini considered ${decision.type} (${(aiConfidence * 100).toFixed(0)}%) but lower confidence`),
        };
        return finalResult;
      }

      const { category, subType } = pageCategoryAndSubType(decision.type, ctx.sourceDocument);
      const evidence: Evidence[] = decision.evidenceIds.map((id) => ({
        type: 'gemini-evidence',
        value: id,
        confidence: aiConfidence,
        sourceDocumentId: ctx.sourceDocument.id,
      }));

      finalResult = {
        sourceDocumentId: ctx.sourceDocument.id,
        type: decision.type,
        category,
        subType,
        confidence: aiConfidence,
        evidence: [...ruleResult.evidence, ...evidence],
        reason: `Gemini: ${decision.type} (${(aiConfidence * 100).toFixed(0)}%). ${decision.reason}`.slice(0, 500),
        aiConfidence,
      };
      return finalResult;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      finalResult = { ...ruleResult, reason: this.appendReason(ruleResult.reason, `Gemini error: ${error}; keeping rule result`) };
      return finalResult;
    } finally {
      await this.log({
        provider: 'gemini',
        model: this.model,
        promptVersion: this.promptVersion,
        inputHash,
        callType: 'page',
        ruleDecision: ruleResult.type,
        ruleConfidence: ruleResult.confidence,
        aiDecision: raw ? tryGetDecision(raw, 'type') : undefined,
        aiConfidence: raw ? tryGetConfidence(raw) : undefined,
        finalDecision: finalResult.type,
        finalConfidence: finalResult.confidence,
        evidenceIds: raw ? tryGetEvidenceIds(raw) : undefined,
        cached: Boolean(cached),
        durationMs,
        error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async adjudicateCollectionsBatch(
    ambiguous: { ctx: CollectionClassificationContext; ruleResult: CollectionClassification; index: number }[]
  ): Promise<Map<number, CollectionClassification>> {
    const result = new Map<number, CollectionClassification>();
    if (!this.enabled || !this.client) {
      for (const { ruleResult, index } of ambiguous) {
        result.set(index, {
          ...ruleResult,
          reason: this.appendReason(ruleResult.reason, 'Gemini not configured; keeping rule result'),
        });
      }
      return result;
    }

    const { text, validIds, input } = this.buildCollectionsBatchPrompt(ambiguous);
    const inputHash = this.inputHash('collections-batch', input);
    const cached = await this.cache.get(inputHash);
    let raw: string | undefined;
    let error: string | undefined;
    let durationMs: number | undefined;

    try {
      const start = Date.now();
      if (cached) {
        raw = cached;
      } else {
        raw = await this.callGemini(text, 'collections-batch', inputHash);
        durationMs = Date.now() - start;
        if (raw) await this.cache.set(inputHash, raw).catch(() => {});
      }

      const decisions = this.parseCollectionsBatch(raw, validIds);
      if (!decisions) {
        error = 'Gemini batch decision invalid or failed';
        for (const { ruleResult, index } of ambiguous) {
          result.set(index, {
            ...ruleResult,
            reason: this.appendReason(ruleResult.reason, error),
          });
        }
        return result;
      }

      for (const { ctx, ruleResult, index } of ambiguous) {
        const decision = decisions.find((d) => d.collectionId === ctx.collection.id);
        if (!decision) {
          result.set(index, {
            ...ruleResult,
            reason: this.appendReason(ruleResult.reason, 'Gemini did not return a decision for this collection'),
          });
          continue;
        }

        const mapped = mapAiCollectionDecision(decision, ruleResult, validIds.get(ctx.collection.id) || new Set());
        result.set(index, mapped || {
          ...ruleResult,
          reason: this.appendReason(ruleResult.reason, 'Gemini collection classification not mappable; keeping rule result'),
        });
      }

      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      for (const { ruleResult, index } of ambiguous) {
        result.set(index, {
          ...ruleResult,
          reason: this.appendReason(ruleResult.reason, `Gemini error: ${error}; keeping rule result`),
        });
      }
      return result;
    } finally {
      const finalDecisions = ambiguous.map(({ index }) => result.get(index)?.contentSubtype || result.get(index)?.type).filter(Boolean).join(',');
      const finalConfidences = ambiguous.map(({ index }) => result.get(index)?.confidence).filter((c): c is number => c !== undefined);
      const finalConfidence = finalConfidences.length ? finalConfidences.reduce((a, b) => a + b, 0) / finalConfidences.length : undefined;

      await this.log({
        provider: 'gemini',
        model: this.model,
        promptVersion: this.promptVersion,
        inputHash,
        callType: 'collection',
        ruleDecision: ambiguous.map((a) => a.ruleResult.contentSubtype || a.ruleResult.type).join(','),
        ruleConfidence: ambiguous.map((a) => a.ruleResult.confidence).reduce((a, b) => a + b, 0) / ambiguous.length,
        aiDecision: raw ? tryGetDecision(raw, 'classification') : undefined,
        aiConfidence: raw ? tryGetConfidence(raw) : undefined,
        finalDecision: finalDecisions || undefined,
        finalConfidence,
        evidenceIds: raw ? tryGetEvidenceIds(raw) : undefined,
        cached: Boolean(cached),
        durationMs,
        error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private buildPagePrompt(ctx: PageClassificationContext, ruleResult: PageClassification) {
    const doc = ctx.sourceDocument;
    const textParts: string[] = [];
    const validIds = new Set<string>();

    const add = (id: string, label: string, value?: string) => {
      if (!value) return;
      textParts.push(`[${id}] ${label}: ${value.slice(0, 400)}`);
      validIds.add(id);
    };

    add('url', 'Page URL', doc.url);
    add('title', 'Page title', doc.title);
    add('h1', 'Page h1', doc.h1);
    add('meta', 'Meta description', doc.metaDescription);
    add('breadcrumb', 'Breadcrumb labels', breadcrumbs(doc).join(' > '));
    add('nav', 'Navigation ancestry', navAncestry(doc.url, doc).join(' > '));
    add('structuredData', 'Structured data types', (doc.structuredData || []).map((sd) => sd?.['@type']).filter(Boolean).join(', '));

    const pageText = pageTextForValidation(doc).slice(0, 2000);
    if (pageText) {
      textParts.push(`[pageText] Visible text:\n${pageText}`);
      validIds.add('pageText');
    }

    const input = {
      sourceDocumentId: doc.id,
      pageType: ruleResult.type,
      ruleConfidence: ruleResult.confidence,
      url: doc.url,
      title: doc.title,
      h1: doc.h1,
      breadcrumb: breadcrumbs(doc),
      navAncestry: navAncestry(doc.url, doc),
    };

    const prompt = `You are a strict website semantic page classifier. You are given structured evidence extracted from a single web page.
Rule-based classifier suggested: ${ruleResult.type} (confidence ${(ruleResult.confidence * 100).toFixed(0)}%).

Choose the single most appropriate page type from this exact list:
${PAGE_TYPES.join(', ')}

Use the evidence IDs provided in brackets. Every evidenceIds value you return MUST be one of the bracket IDs in the input. Unknown IDs will be rejected.

Definitions:
- HOME: root / landing page
- ABOUT: company information, history, mission, team
- SERVICES_INDEX / SERVICE_DETAIL: list of services / single service
- PROJECTS_INDEX / PROJECT_DETAIL: list of completed works / single project
- NEWS_INDEX / NEWS_DETAIL: list of articles / single article
- VACANCIES_INDEX / VACANCY_DETAIL: careers / single job
- PRODUCTS_INDEX / PRODUCT_DETAIL: catalog / single product
- CONTACTS: phone, email, address, map
- LEGAL: privacy, terms, cookies, agreements
- OTHER: none of the above

${textParts.join('\n\n')}

Return ONLY a valid JSON object with no markdown, no commentary:
{
  "sourceDocumentId": "${doc.id}",
  "type": "ONE_OF_THE_LIST",
  "confidence": 0.0-1.0,
  "evidenceIds": ["url", "title", "h1", "meta", "breadcrumb", "nav", "structuredData", "pageText"],
  "reason": "one sentence explaining the decision"
}`;

    return { text: prompt, validIds, input };
  }

  private buildCollectionsBatchPrompt(
    ambiguous: { ctx: CollectionClassificationContext; ruleResult: CollectionClassification; index: number }[]
  ) {
    const collections: {
      collectionId: string;
      ruleClassification: string;
      ruleConfidence: number;
      sectionId: string;
      sectionHeading?: string;
      sectionParagraphs: string[];
      collectionHeading?: string;
      collectionSelector: string;
      items: { id: string; title?: string; description?: string; href?: string; imageAlt?: string; group?: string; isGroup?: boolean }[];
    }[] = [];
    const validIds = new Map<string, Set<string>>();

    for (const { ctx, ruleResult } of ambiguous) {
      const { collection, sourceDocument: doc } = ctx;
      const sec = parentSection(doc, collection.id);
      const sectionId = sec?.id || 'none';

      const items = (collection.items || []).slice(0, 8).map((item, i) => {
        const id = `${collection.id}-item-${i}`;
        return {
          id,
          title: item.title,
          description: item.description ? item.description.slice(0, 240) : undefined,
          href: item.url,
          imageAlt: item.image?.alt,
          group: item.group,
          isGroup: item.isGroup,
        };
      });

      const ids = new Set([collection.id, sectionId, ...items.map((i) => i.id)]);
      validIds.set(collection.id, ids);

      collections.push({
        collectionId: collection.id,
        ruleClassification: ruleResult.contentSubtype || ruleResult.type,
        ruleConfidence: ruleResult.confidence,
        sectionId,
        sectionHeading: sec?.heading,
        sectionParagraphs: sec?.paragraphs?.slice(0, 2) || [],
        collectionHeading: collection.heading,
        collectionSelector: collection.selector,
        items,
      });
    }

    const firstDoc = ambiguous[0].ctx.sourceDocument;
    const firstPage = ambiguous[0].ctx.pageClassification;

    const input = {
      pageUrl: firstDoc.url,
      pageType: firstPage.type,
      pageCategory: firstPage.category,
      breadcrumb: breadcrumbs(firstDoc),
      navAncestry: navAncestry(firstDoc.url, firstDoc),
      collections,
    };

    const prompt = `You are a semantic interpreter for website content. You receive several structured collections extracted from a single web page.
For each collection, the rule-based classifier gave a medium-confidence guess. Decide what each collection represents.

Classify using one of these exact values:
${AI_COLLECTION_CLASSIFICATIONS.join(', ')}

Definitions:
- PROJECTS: concrete completed, ongoing or referenced business objects/cases/works
- PRODUCTS: repeatable/catalog offerings that can be selected, configured or purchased
- SERVICES: activities/work the company performs for customers
- NEWS: publications/updates/articles/events
- VACANCIES: job openings/careers
- CORPORATE: company information (values, history, team, documents)
- NAVIGATION: menu links to other pages
- PARTNER_LINKS: logos/links to partner companies
- SOCIAL_LINKS: social media links
- UTILITY: search, language switcher, cart, login, etc.
- UNKNOWN: not enough evidence

CRITICAL:
1. Do not invent entities. Base your decision ONLY on the provided items and context.
2. Every evidenceIds value must be an ID present in the input (collection id, section id, or item id). Unknown IDs will be rejected.
3. A "PROJECT" is a concrete object/address/case, not a category or status label. A "PRODUCT" is a repeatable catalog item with price/model/selection signals.

Input:
${JSON.stringify(input, null, 2)}

Return ONLY a valid JSON object with no markdown, no commentary. It must contain a "decisions" array with one object per collection:
{
  "decisions": [
    {
      "collectionId": "col-id",
      "classification": "PROJECTS",
      "confidence": 0.0-1.0,
      "evidenceIds": ["col-id", "section-id", "col-id-item-0"],
      "reason": "one sentence explaining the decision and which evidence supports it"
    }
  ]
}`;

    return { text: prompt, validIds, input };
  }

  private isQuotaError(err: unknown): boolean {
    const msg = String((err as Error)?.message || err);
    return /429|quota|resource_exhausted|rate.?limit/i.test(msg);
  }

  private async callGemini(promptText: string, callType: string, inputHash: string): Promise<string> {
    if (this.consecutiveQuotaFailures >= HybridGeminiProvider.QUOTA_CIRCUIT_LIMIT) {
      throw new Error(`Gemini quota circuit open after ${this.consecutiveQuotaFailures} consecutive quota failures; using deterministic fallback`);
    }
    // The concurrency bound applies to every adjudication call — including
    // the test override — so the cap is real, not just a client detail.
    await this.acquireSemaphore();
    try {
      let text: string;
      if (this.geminiResponseOverride) {
        text = String(await this.geminiResponseOverride(promptText, callType, inputHash));
      } else {
        if (!this.client) throw new Error('Gemini client not configured');
        const responseSchema = callType === 'page' ? pageResponseSchema() : collectionBatchResponseSchema();
        text = (await this.client.generate(promptText, responseSchema, 1200)).text;
      }
      this.consecutiveQuotaFailures = 0;
      return text;
    } catch (err) {
      if (this.isQuotaError(err)) this.consecutiveQuotaFailures++;
      else this.consecutiveQuotaFailures = 0;
      throw err;
    } finally {
      this.releaseSemaphore();
    }
  }

  private async acquireSemaphore(): Promise<void> {
    if (this.semaphore.count < this.concurrency) {
      this.semaphore.count++;
      return;
    }
    await new Promise<void>((resolve) => this.semaphore.queue.push(resolve));
    this.semaphore.count++;
  }

  private releaseSemaphore(): void {
    this.semaphore.count--;
    const next = this.semaphore.queue.shift();
    if (next) next();
  }

  private inputHash(callType: string, input: unknown): string {
    return hashInput({ provider: this.name, model: this.model, promptVersion: this.promptVersion, callType, input });
  }

  private parsePageDecision(raw: string, validIds: Set<string>): z.infer<typeof geminiPageDecisionSchema> | undefined {
    const parsed = parseGeminiResponse(raw);
    if (!parsed) return undefined;
    const validated = geminiPageDecisionSchema.safeParse(parsed);
    if (!validated.success) return undefined;
    const decision = validated.data;
    if (decision.evidenceIds.length === 0) return undefined;
    if (decision.evidenceIds.some((id) => !validIds.has(id))) return undefined;
    return decision;
  }

  private parseCollectionsBatch(raw: string, validIds: Map<string, Set<string>>): z.infer<typeof geminiCollectionDecisionSchema>[] | undefined {
    const parsed = parseGeminiResponse(raw);
    if (!parsed || typeof parsed !== 'object' || !('decisions' in parsed)) return undefined;
    const decisions = (parsed as { decisions?: unknown }).decisions;
    if (!Array.isArray(decisions)) return undefined;
    const out: z.infer<typeof geminiCollectionDecisionSchema>[] = [];
    for (const d of decisions) {
      const validated = geminiCollectionDecisionSchema.safeParse(d);
      if (!validated.success) continue;
      const decision = validated.data;
      const valid = validIds.get(decision.collectionId);
      if (!valid) continue; // ignore decisions for collections we did not send
      if (decision.evidenceIds.length === 0) continue;
      if (decision.evidenceIds.some((id) => !valid.has(id))) continue;
      out.push(decision);
    }
    return out;
  }

  private async log(metadata: AiCallMetadata): Promise<void> {
    try {
      await this.observer.log(metadata);
    } catch {
      // Observability failure must not break the pipeline
    }
  }

  private appendReason(existing: string | undefined, suffix: string): string {
    return existing ? `${existing} | ${suffix}` : suffix;
  }
}

function confidenceLevel(confidence: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'HIGH';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'MEDIUM';
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'LOW';
  return 'UNKNOWN';
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseGeminiResponse(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { return JSON.parse(trimmed); } catch {}
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
  }
  return undefined;
}

function tryGetDecision(raw: string, ...keys: string[]): string | undefined {
  try {
    const parsed = parseGeminiResponse(raw) as any;
    for (const k of keys) if (parsed?.[k]) return String(parsed[k]);
  } catch {}
  return undefined;
}

function tryGetConfidence(raw: string): number | undefined {
  try {
    const parsed = parseGeminiResponse(raw) as any;
    if (typeof parsed?.confidence === 'number') return parsed.confidence;
  } catch {}
  return undefined;
}

function tryGetEvidenceIds(raw: string): string[] | undefined {
  try {
    const parsed = parseGeminiResponse(raw) as any;
    if (Array.isArray(parsed?.evidenceIds)) return parsed.evidenceIds;
  } catch {}
  return undefined;
}

function pageResponseSchema(): object {
  return {
    type: 'OBJECT',
    properties: {
      sourceDocumentId: { type: 'STRING' },
      type: { type: 'STRING', enum: PAGE_TYPES },
      confidence: { type: 'NUMBER' },
      evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
      reason: { type: 'STRING' },
    },
    required: ['sourceDocumentId', 'type', 'confidence', 'evidenceIds', 'reason'],
  };
}

function collectionBatchResponseSchema(): object {
  return {
    type: 'OBJECT',
    properties: {
      decisions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            collectionId: { type: 'STRING' },
            classification: { type: 'STRING', enum: AI_COLLECTION_CLASSIFICATIONS },
            confidence: { type: 'NUMBER' },
            evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
            reason: { type: 'STRING' },
          },
          required: ['collectionId', 'classification', 'confidence', 'evidenceIds', 'reason'],
        },
      },
    },
    required: ['decisions'],
  };
}

function mapAiCollectionDecision(
  decision: z.infer<typeof geminiCollectionDecisionSchema>,
  ruleResult: CollectionClassification,
  validIds: Set<string>
): CollectionClassification | undefined {
  if (decision.confidence < 0 || decision.confidence > 1) return undefined;
  if (decision.evidenceIds.length === 0) return undefined;
  if (decision.evidenceIds.some((id) => !validIds.has(id))) return undefined;

  const contentSubtypeMap: Record<string, CollectionClassification['contentSubtype']> = {
    PROJECTS: 'PROJECTS',
    PRODUCTS: 'PRODUCTS',
    SERVICES: 'SERVICES',
    NEWS: 'NEWS',
    VACANCIES: 'VACANCIES',
    CORPORATE: 'OTHER',
  };

  const typeMap: Record<string, CollectionClassification['type']> = {
    NAVIGATION: 'NAVIGATION',
    PARTNER_LINKS: 'PARTNER_LINKS',
    SOCIAL_LINKS: 'SOCIAL_LINKS',
    UTILITY: 'UTILITY',
    UNKNOWN: 'UNKNOWN',
  };

  let type: CollectionClassification['type'];
  let contentSubtype: CollectionClassification['contentSubtype'] | undefined;

  if (contentSubtypeMap[decision.classification]) {
    type = 'CONTENT_COLLECTION';
    contentSubtype = contentSubtypeMap[decision.classification];
  } else if (typeMap[decision.classification]) {
    type = typeMap[decision.classification];
  } else {
    return undefined;
  }

  const confidence = clamp(decision.confidence, 0, 1);
  const ruleLabel = ruleResult.contentSubtype || ruleResult.type;

  if (confidence < ruleResult.confidence) {
    return {
      ...ruleResult,
      aiClassification: decision.classification,
      aiConfidence: confidence,
      reason: `${ruleResult.reason} | Gemini: ${decision.classification} (${(confidence * 100).toFixed(0)}%) lower than rule confidence; kept ${ruleLabel}`,
    };
  }

  const evidence: Evidence[] = decision.evidenceIds.map((id) => ({
    type: 'gemini-evidence',
    value: id,
    confidence,
    sourceCollectionId: decision.collectionId,
  }));

  return {
    collectionId: ruleResult.collectionId,
    type,
    contentSubtype,
    confidence,
    reason: `Gemini: ${decision.classification} (${(confidence * 100).toFixed(0)}%). ${decision.reason}`.slice(0, 500),
    evidence,
    ruleClassification: ruleLabel,
    aiClassification: decision.classification,
    aiConfidence: confidence,
  };
}
