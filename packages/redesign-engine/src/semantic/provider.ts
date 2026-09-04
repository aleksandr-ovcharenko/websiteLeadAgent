import type { SourceDocument, SourceDocumentCollection, SourceDocumentSection, SourceDocumentImage } from '../types.js';
import { RuleBasedSemanticProvider, pageCategoryAndSubType } from './ruleBasedProvider.js';
import { HybridGeminiProvider } from './geminiSemanticProvider.js';
import type {
  PageClassification,
  CollectionClassification,
  SectionClassification,
  ImageCandidate,
  CompanyEntity,
  ContactsEntity,
  ServiceEntity,
  ProjectEntity,
  NewsEntity,
  VacancyEntity,
  ProductEntity,
  FactEntity,
  Relationship,
} from './schema.js';

export interface PageClassificationContext {
  sourceDocument: SourceDocument;
  allDocuments: SourceDocument[];
  baseUrl: string;
}

export interface CollectionClassificationContext {
  collection: SourceDocumentCollection;
  sourceDocument: SourceDocument;
  pageClassification: PageClassification;
  baseUrl: string;
}

export interface SectionClassificationContext {
  section: SourceDocumentSection;
  sourceDocument: SourceDocument;
  pageClassification: PageClassification;
  collectionClassifications: CollectionClassification[];
}

export interface MediaClassificationContext {
  image: SourceDocumentImage;
  sourceDocument: SourceDocument;
  section?: SourceDocumentSection;
  collection?: SourceDocumentCollection;
  baseUrl: string;
}

export interface EntityExtractionContext {
  sourceDocuments: SourceDocument[];
  pageClassifications: Map<string, PageClassification>;
  sectionClassifications: Map<string, SectionClassification[]>;
  collectionClassifications: Map<string, CollectionClassification[]>;
  mediaCandidates: ImageCandidate[];
  baseUrl: string;
}

export interface GenerationSemanticProvider {
  readonly name: string;
  readonly model?: string;
  readonly promptVersion?: string;
  readonly temperature?: number;

  classifyPage(ctx: PageClassificationContext): Promise<PageClassification>;
  classifyCollection(ctx: CollectionClassificationContext): Promise<CollectionClassification>;
  /** Batch classification of all collections on a single page. Optional; falls back to per-collection calls when absent. */
  classifyCollections?(ctxs: CollectionClassificationContext[]): Promise<CollectionClassification[]>;
  classifySection(ctx: SectionClassificationContext): Promise<SectionClassification>;
  classifyMedia(ctx: MediaClassificationContext): Promise<ImageCandidate>;

  extractCompany(ctx: EntityExtractionContext): Promise<CompanyEntity | undefined>;
  extractContacts(ctx: EntityExtractionContext): Promise<ContactsEntity | undefined>;
  extractServices(ctx: EntityExtractionContext): Promise<ServiceEntity[]>;
  extractProjects(ctx: EntityExtractionContext): Promise<ProjectEntity[]>;
  extractNews(ctx: EntityExtractionContext): Promise<NewsEntity[]>;
  extractVacancies(ctx: EntityExtractionContext): Promise<VacancyEntity[]>;
  extractProducts(ctx: EntityExtractionContext): Promise<ProductEntity[]>;
  extractFacts(ctx: EntityExtractionContext): Promise<FactEntity[]>;
  extractRelationships(ctx: EntityExtractionContext): Promise<Relationship[]>;
}

export interface ProviderOptions {
  type?: 'rule-based' | 'openai' | 'llm-fallback' | 'gemini' | 'auto';
  openaiApiKey?: string;
  openaiModel?: string;
  temperature?: number;
  llmApiUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmFallbackThreshold?: number;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiApiUrl?: string;
  geminiCachePath?: string;
  geminiLogPath?: string;
  geminiPromptVersion?: string;
  geminiConcurrency?: number;
}

// Confidence levels used to flag HIGH / MEDIUM / LOW / UNKNOWN quality.
export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.4,
};

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'HIGH';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'MEDIUM';
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'LOW';
  return 'UNKNOWN';
}

const PAGE_TYPES: PageClassification['type'][] = [
  'HOME', 'ABOUT', 'SERVICES_INDEX', 'SERVICE_DETAIL', 'PROJECTS_INDEX', 'PROJECT_DETAIL',
  'NEWS_INDEX', 'NEWS_DETAIL', 'VACANCIES_INDEX', 'VACANCY_DETAIL', 'PRODUCTS_INDEX',
  'PRODUCT_DETAIL', 'CONTACTS', 'LEGAL', 'OTHER',
];

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

function lowerIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export class LlmFallbackProvider implements GenerationSemanticProvider {
  readonly name = 'llm-fallback';
  readonly model: string;
  readonly promptVersion = '0.2';
  readonly temperature = 0;
  readonly confidenceThresholds = {
    high: 0.85,
    medium: 0.65,
    low: 0.4,
  };

  private rule = new RuleBasedSemanticProvider();
  private enabled: boolean;
  private apiUrl: string;
  private apiKey: string;
  private fallbackThreshold: number;

  constructor(options?: ProviderOptions) {
    this.apiKey = options?.llmApiKey || options?.openaiApiKey || '';
    this.apiUrl = options?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
    this.model = options?.llmModel || options?.openaiModel || 'gpt-4o-mini';
    this.fallbackThreshold = options?.llmFallbackThreshold ?? 0.6;
    this.enabled = Boolean(this.apiKey);
  }

  async classifyPage(ctx: PageClassificationContext): Promise<PageClassification> {
    const ruleResult = await this.rule.classifyPage(ctx);
    if (ruleResult.confidence >= this.fallbackThreshold) return ruleResult;
    if (!this.enabled) {
      return {
        ...ruleResult,
        evidence: [
          ...ruleResult.evidence,
          { type: 'llm-fallback', value: 'LLM fallback disabled: no API key configured', confidence: 0.5, sourceDocumentId: ctx.sourceDocument.id },
        ],
      };
    }

    const doc = ctx.sourceDocument;
    const text = pageTextForValidation(doc);
    const prompt =
`You are a strict website semantic page classifier. Choose the single most appropriate page type from this exact list:
${PAGE_TYPES.join(', ')}.

Page URL: ${doc.url}
Page title: ${doc.title || ''}
Page h1: ${doc.h1 || ''}
Meta description: ${doc.metaDescription || ''}
Visible text:
---
${text.slice(0, 4000)}
---

Return a JSON object only, with no markdown, no commentary. Fields:
- type: one of the allowed page types
- confidence: number between 0 and 1
- evidence: array of exact short substrings (1-4 words) from the visible text above that support your choice
- reason: one sentence explaining why`;

    const result = await this.callLlm(prompt);
    if (!result) return this.fallback(ruleResult, ctx, 'LLM call failed');

    const type = typeof result.type === 'string' ? result.type : undefined;
    const confidence = typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1 ? result.confidence : 0;
    const evidence = Array.isArray(result.evidence) ? result.evidence.filter((e: unknown) => typeof e === 'string') : [];

    if (!type || !PAGE_TYPES.includes(type as PageClassification['type'])) {
      return this.fallback(ruleResult, ctx, 'LLM returned invalid page type');
    }
    if (evidence.length === 0 || !evidence.every((e: string) => lowerIncludes(text, e))) {
      return this.fallback(ruleResult, ctx, 'LLM evidence not found in page text');
    }
    if (confidence < ruleResult.confidence) {
      return this.fallback(ruleResult, ctx, 'LLM confidence lower than rule-based confidence');
    }

    const { category, subType } = pageCategoryAndSubType(type as PageClassification['type'], doc);
    return {
      sourceDocumentId: doc.id,
      type: type as PageClassification['type'],
      category,
      subType,
      confidence: Math.min(0.95, confidence),
      evidence: [
        ...ruleResult.evidence,
        ...evidence.map((value: string) => ({ type: 'llm-evidence', value, confidence, sourceDocumentId: doc.id })),
        { type: 'llm-reason', value: String(result.reason || 'LLM classification'), confidence, sourceDocumentId: doc.id },
      ],
    };
  }

  async classifyCollection(ctx: CollectionClassificationContext): Promise<CollectionClassification> {
    return this.rule.classifyCollection(ctx);
  }

  async classifySection(ctx: SectionClassificationContext): Promise<SectionClassification> {
    return this.rule.classifySection(ctx);
  }

  async classifyMedia(ctx: MediaClassificationContext): Promise<ImageCandidate> {
    return this.rule.classifyMedia(ctx);
  }

  async extractCompany(ctx: EntityExtractionContext): Promise<CompanyEntity | undefined> { return this.rule.extractCompany(ctx); }
  async extractContacts(ctx: EntityExtractionContext): Promise<ContactsEntity | undefined> { return this.rule.extractContacts(ctx); }
  async extractServices(ctx: EntityExtractionContext): Promise<ServiceEntity[]> { return this.rule.extractServices(ctx); }
  async extractProjects(ctx: EntityExtractionContext): Promise<ProjectEntity[]> { return this.rule.extractProjects(ctx); }
  async extractNews(ctx: EntityExtractionContext): Promise<NewsEntity[]> { return this.rule.extractNews(ctx); }
  async extractVacancies(ctx: EntityExtractionContext): Promise<VacancyEntity[]> { return this.rule.extractVacancies(ctx); }
  async extractProducts(ctx: EntityExtractionContext): Promise<ProductEntity[]> { return this.rule.extractProducts(ctx); }
  async extractFacts(ctx: EntityExtractionContext): Promise<FactEntity[]> { return this.rule.extractFacts(ctx); }
  async extractRelationships(ctx: EntityExtractionContext): Promise<Relationship[]> { return this.rule.extractRelationships(ctx); }

  private fallback(ruleResult: PageClassification, ctx: PageClassificationContext, reason: string): PageClassification {
    return {
      ...ruleResult,
      evidence: [
        ...ruleResult.evidence,
        { type: 'llm-fallback', value: reason, confidence: 0.4, sourceDocumentId: ctx.sourceDocument.id },
      ],
    };
  }

  private async callLlm(prompt: string): Promise<{ type?: unknown; confidence?: unknown; evidence?: unknown; reason?: unknown } | null> {
    const body = {
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
    };
    try {
      const resp = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) return null;
      const raw = await resp.json() as any;
      const content = raw.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return null;
      // Strip markdown fences
      const jsonText = content.replace(/^```json\s*/i, '').replace(/\s*```$/m, '').trim();
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }
}

export function createSemanticProvider(options?: ProviderOptions): GenerationSemanticProvider {
  const opts = options || {};
  const providerType = opts.type || (process.env.SEMANTIC_PROVIDER as ProviderOptions['type']);
  const geminiApiKey = opts.geminiApiKey || process.env.GEMINI_API_KEY;
  const llmApiKey = opts.llmApiKey || opts.openaiApiKey || process.env.OPENAI_API_KEY;

  if (providerType === 'gemini' || providerType === 'hybrid-gemini' || geminiApiKey) {
    return new HybridGeminiProvider({ ...opts, type: 'gemini', geminiApiKey });
  }
  if (providerType === 'openai' || providerType === 'llm-fallback' || llmApiKey) {
    return new LlmFallbackProvider({ ...opts, type: 'llm-fallback', llmApiKey, openaiApiKey: llmApiKey });
  }
  return new RuleBasedSemanticProvider();
}
