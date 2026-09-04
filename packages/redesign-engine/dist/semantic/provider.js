import { RuleBasedSemanticProvider, pageCategoryAndSubType } from './ruleBasedProvider.js';
import { HybridGeminiProvider } from './geminiSemanticProvider.js';
// Confidence levels used to flag HIGH / MEDIUM / LOW / UNKNOWN quality.
export const CONFIDENCE_THRESHOLDS = {
    high: 0.85,
    medium: 0.65,
    low: 0.4,
};
export function confidenceLevel(confidence) {
    if (confidence >= CONFIDENCE_THRESHOLDS.high)
        return 'HIGH';
    if (confidence >= CONFIDENCE_THRESHOLDS.medium)
        return 'MEDIUM';
    if (confidence >= CONFIDENCE_THRESHOLDS.low)
        return 'LOW';
    return 'UNKNOWN';
}
const PAGE_TYPES = [
    'HOME', 'ABOUT', 'SERVICES_INDEX', 'SERVICE_DETAIL', 'PROJECTS_INDEX', 'PROJECT_DETAIL',
    'NEWS_INDEX', 'NEWS_DETAIL', 'VACANCIES_INDEX', 'VACANCY_DETAIL', 'PRODUCTS_INDEX',
    'PRODUCT_DETAIL', 'CONTACTS', 'LEGAL', 'OTHER',
];
function pageTextForValidation(doc) {
    const parts = [doc.title, doc.h1 || '', doc.metaDescription || ''];
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
function lowerIncludes(haystack, needle) {
    return haystack.toLowerCase().includes(needle.toLowerCase());
}
export class LlmFallbackProvider {
    name = 'llm-fallback';
    model;
    promptVersion = '0.2';
    temperature = 0;
    confidenceThresholds = {
        high: 0.85,
        medium: 0.65,
        low: 0.4,
    };
    rule = new RuleBasedSemanticProvider();
    enabled;
    apiUrl;
    apiKey;
    fallbackThreshold;
    constructor(options) {
        this.apiKey = options?.llmApiKey || options?.openaiApiKey || '';
        this.apiUrl = options?.llmApiUrl || 'https://api.openai.com/v1/chat/completions';
        this.model = options?.llmModel || options?.openaiModel || 'gpt-4o-mini';
        this.fallbackThreshold = options?.llmFallbackThreshold ?? 0.6;
        this.enabled = Boolean(this.apiKey);
    }
    async classifyPage(ctx) {
        const ruleResult = await this.rule.classifyPage(ctx);
        if (ruleResult.confidence >= this.fallbackThreshold)
            return ruleResult;
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
        const prompt = `You are a strict website semantic page classifier. Choose the single most appropriate page type from this exact list:
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
        if (!result)
            return this.fallback(ruleResult, ctx, 'LLM call failed');
        const type = typeof result.type === 'string' ? result.type : undefined;
        const confidence = typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1 ? result.confidence : 0;
        const evidence = Array.isArray(result.evidence) ? result.evidence.filter((e) => typeof e === 'string') : [];
        if (!type || !PAGE_TYPES.includes(type)) {
            return this.fallback(ruleResult, ctx, 'LLM returned invalid page type');
        }
        if (evidence.length === 0 || !evidence.every((e) => lowerIncludes(text, e))) {
            return this.fallback(ruleResult, ctx, 'LLM evidence not found in page text');
        }
        if (confidence < ruleResult.confidence) {
            return this.fallback(ruleResult, ctx, 'LLM confidence lower than rule-based confidence');
        }
        const { category, subType } = pageCategoryAndSubType(type, doc);
        return {
            sourceDocumentId: doc.id,
            type: type,
            category,
            subType,
            confidence: Math.min(0.95, confidence),
            evidence: [
                ...ruleResult.evidence,
                ...evidence.map((value) => ({ type: 'llm-evidence', value, confidence, sourceDocumentId: doc.id })),
                { type: 'llm-reason', value: String(result.reason || 'LLM classification'), confidence, sourceDocumentId: doc.id },
            ],
        };
    }
    async classifyCollection(ctx) {
        return this.rule.classifyCollection(ctx);
    }
    async classifySection(ctx) {
        return this.rule.classifySection(ctx);
    }
    async classifyMedia(ctx) {
        return this.rule.classifyMedia(ctx);
    }
    async extractCompany(ctx) { return this.rule.extractCompany(ctx); }
    async extractContacts(ctx) { return this.rule.extractContacts(ctx); }
    async extractServices(ctx) { return this.rule.extractServices(ctx); }
    async extractProjects(ctx) { return this.rule.extractProjects(ctx); }
    async extractNews(ctx) { return this.rule.extractNews(ctx); }
    async extractVacancies(ctx) { return this.rule.extractVacancies(ctx); }
    async extractProducts(ctx) { return this.rule.extractProducts(ctx); }
    async extractFacts(ctx) { return this.rule.extractFacts(ctx); }
    async extractRelationships(ctx) { return this.rule.extractRelationships(ctx); }
    fallback(ruleResult, ctx, reason) {
        return {
            ...ruleResult,
            evidence: [
                ...ruleResult.evidence,
                { type: 'llm-fallback', value: reason, confidence: 0.4, sourceDocumentId: ctx.sourceDocument.id },
            ],
        };
    }
    async callLlm(prompt) {
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
            if (!resp.ok)
                return null;
            const raw = await resp.json();
            const content = raw.choices?.[0]?.message?.content;
            if (typeof content !== 'string')
                return null;
            // Strip markdown fences
            const jsonText = content.replace(/^```json\s*/i, '').replace(/\s*```$/m, '').trim();
            return JSON.parse(jsonText);
        }
        catch {
            return null;
        }
    }
}
export function createSemanticProvider(options) {
    const opts = options || {};
    const providerType = opts.type || process.env.SEMANTIC_PROVIDER;
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
