import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuleBasedSemanticProvider, pageCategoryAndSubType } from './ruleBasedProvider.js';
import { geminiCollectionDecisionSchema, geminiPageDecisionSchema, } from './schema.js';
const CONFIDENCE_THRESHOLDS = {
    high: 0.85,
    medium: 0.65,
    low: 0.4,
};
const PAGE_TYPES = [
    'HOME', 'ABOUT', 'SERVICES_INDEX', 'SERVICE_DETAIL', 'PROJECTS_INDEX', 'PROJECT_DETAIL',
    'NEWS_INDEX', 'NEWS_DETAIL', 'VACANCIES_INDEX', 'VACANCY_DETAIL', 'PRODUCTS_INDEX',
    'PRODUCT_DETAIL', 'CONTACTS', 'LEGAL', 'OTHER',
];
const AI_COLLECTION_CLASSIFICATIONS = [
    'PROJECTS', 'PRODUCTS', 'SERVICES', 'NEWS', 'VACANCIES', 'CORPORATE',
    'NAVIGATION', 'PARTNER_LINKS', 'SOCIAL_LINKS', 'UTILITY', 'UNKNOWN',
];
function canonicalJson(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return '[' + value.map(canonicalJson).join(',') + ']';
    const obj = value;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return '{' + pairs.join(',') + '}';
}
function hashInput(input) {
    return createHash('sha256').update(canonicalJson(input)).digest('hex').slice(0, 32);
}
function norm(s) {
    return (s || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
}
function parentSection(doc, collectionId) {
    return doc.sections.find((sec) => (sec.collections || []).some((c) => c.id === collectionId));
}
function navAncestry(url, doc) {
    const walk = (nodes, path = []) => {
        for (const n of nodes) {
            const p = [...path, n.label];
            if (n.url && sameUrl(url, n.url))
                return [p];
            if (n.children) {
                const child = walk(n.children, p);
                if (child.length)
                    return child;
            }
        }
        return [];
    };
    const primary = doc.chrome.nav?.primary || [];
    const secondary = doc.chrome.nav?.secondary || [];
    const found = walk(primary).length ? walk(primary) : walk(secondary);
    return found[0] || [];
}
function sameUrl(a, b) {
    if (!a || !b)
        return false;
    try {
        return new URL(a).pathname === new URL(b).pathname;
    }
    catch {
        return a === b;
    }
}
function breadcrumbs(doc) {
    return (doc.chrome.nav?.breadcrumbs || []).map((b) => b.label).filter(Boolean);
}
export class HybridGeminiProvider {
    name = 'gemini-hybrid';
    model;
    promptVersion;
    temperature = 0;
    confidenceThresholds = CONFIDENCE_THRESHOLDS;
    rule = new RuleBasedSemanticProvider();
    apiKey;
    apiUrl;
    cacheDir;
    logPath;
    enabled;
    geminiResponseOverride;
    constructor(options) {
        this.apiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY || '';
        this.model = options?.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        this.apiUrl = (options?.geminiApiUrl || process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '');
        this.promptVersion = options?.geminiPromptVersion || '1.0';
        this.cacheDir = options?.geminiCachePath || join(tmpdir(), 'redesign-gemini-cache');
        this.logPath = options?.geminiLogPath || process.env.GEMINI_SEMANTIC_LOG || undefined;
        this.enabled = Boolean(this.apiKey);
        if (!existsSync(this.cacheDir))
            mkdirSync(this.cacheDir, { recursive: true });
    }
    /** Test hook: override the raw Gemini response for a given call. */
    setGeminiResponseOverride(fn) {
        this.geminiResponseOverride = fn;
    }
    classifyPage(ctx) {
        const ruleResult = this.rule.classifyPage(ctx);
        const level = confidenceLevel(ruleResult.confidence);
        if (level === 'HIGH' || level === 'UNKNOWN')
            return ruleResult;
        return this.adjudicatePage(ctx, ruleResult);
    }
    classifyCollection(ctx) {
        const ruleResult = this.rule.classifyCollection(ctx);
        const level = confidenceLevel(ruleResult.confidence);
        if (level === 'HIGH' || level === 'UNKNOWN')
            return ruleResult;
        return this.adjudicateCollection(ctx, ruleResult);
    }
    classifySection(ctx) {
        return this.rule.classifySection(ctx);
    }
    classifyMedia(ctx) {
        return this.rule.classifyMedia(ctx);
    }
    extractCompany(ctx) {
        return this.rule.extractCompany(ctx);
    }
    extractContacts(ctx) {
        return this.rule.extractContacts(ctx);
    }
    extractServices(ctx) {
        return this.rule.extractServices(ctx);
    }
    extractProjects(ctx) {
        return this.rule.extractProjects(ctx);
    }
    extractNews(ctx) {
        return this.rule.extractNews(ctx);
    }
    extractVacancies(ctx) {
        return this.rule.extractVacancies(ctx);
    }
    extractProducts(ctx) {
        return this.rule.extractProducts(ctx);
    }
    extractFacts(ctx) {
        return this.rule.extractFacts(ctx);
    }
    extractRelationships(ctx) {
        return this.rule.extractRelationships(ctx);
    }
    adjudicatePage(ctx, ruleResult) {
        if (!this.enabled)
            return this.withReason(ruleResult, 'Gemini not configured; keeping rule result');
        const { text, validIds, input } = this.buildPagePrompt(ctx, ruleResult);
        const decision = this.callGeminiDecision('page', input, text, validIds, geminiPageDecisionSchema);
        if (!decision)
            return this.withReason(ruleResult, 'Gemini page decision invalid or failed; keeping rule result');
        const aiType = decision.type;
        if (!PAGE_TYPES.includes(aiType)) {
            return this.withReason(ruleResult, `Gemini returned invalid page type ${aiType}; keeping rule result`);
        }
        const aiConfidence = clamp(decision.confidence, 0, 1);
        if (aiConfidence < ruleResult.confidence) {
            return {
                ...ruleResult,
                aiConfidence,
                reason: `${ruleResult.reason} | Gemini considered ${aiType} (${(aiConfidence * 100).toFixed(0)}%) but lower confidence`,
            };
        }
        const evidence = decision.evidenceIds
            .filter((id) => validIds.has(id))
            .map((id) => ({ type: 'gemini-evidence', value: id, confidence: aiConfidence, sourceDocumentId: ctx.sourceDocument.id }));
        const { category, subType } = pageCategoryAndSubType(aiType, ctx.sourceDocument);
        return {
            sourceDocumentId: ctx.sourceDocument.id,
            type: aiType,
            category,
            subType,
            confidence: aiConfidence,
            evidence: [...ruleResult.evidence, ...evidence],
            reason: `Gemini: ${aiType} (${(aiConfidence * 100).toFixed(0)}%). ${decision.reason}`.slice(0, 500),
            aiConfidence,
        };
    }
    adjudicateCollection(ctx, ruleResult) {
        if (!this.enabled)
            return this.withReasonCollection(ruleResult, 'Gemini not configured; keeping rule result');
        const { text, validIds, input } = this.buildCollectionPrompt(ctx, ruleResult);
        const decision = this.callGeminiDecision('collection', input, text, validIds, geminiCollectionDecisionSchema);
        if (!decision)
            return this.withReasonCollection(ruleResult, 'Gemini collection decision invalid or failed; keeping rule result');
        const mapped = mapAiCollectionDecision(decision, ruleResult, validIds);
        if (!mapped)
            return this.withReasonCollection(ruleResult, 'Gemini collection classification not mappable; keeping rule result');
        return mapped;
    }
    buildPagePrompt(ctx, ruleResult) {
        const doc = ctx.sourceDocument;
        const textParts = [];
        const validIds = new Set();
        function add(id, label, value) {
            if (!value)
                return;
            textParts.push(`[${id}] ${label}: ${value.slice(0, 400)}`);
            validIds.add(id);
        }
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
    buildCollectionPrompt(ctx, ruleResult) {
        const { collection, sourceDocument: doc, pageClassification, baseUrl } = ctx;
        const sec = parentSection(doc, collection.id);
        const sectionId = sec?.id || 'none';
        const itemInputs = (collection.items || []).slice(0, 8).map((item, i) => {
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
        const validIds = new Set([collection.id, sectionId, ...itemInputs.map((i) => i.id)]);
        const input = {
            collectionId: collection.id,
            ruleClassification: ruleResult.contentSubtype || ruleResult.type,
            ruleConfidence: ruleResult.confidence,
            pageUrl: doc.url,
            pageType: pageClassification.type,
            pageCategory: pageClassification.category,
            breadcrumb: breadcrumbs(doc),
            navAncestry: navAncestry(doc.url, doc),
            sectionHeading: sec?.heading,
            sectionParagraphs: sec?.paragraphs?.slice(0, 2),
            collectionHeading: collection.heading,
            collectionSelector: collection.selector,
            items: itemInputs,
        };
        const prompt = `You are a semantic interpreter for website content. You receive a structured collection of items extracted from a web page.
The rule-based classifier suggested this collection is: ${ruleResult.contentSubtype || ruleResult.type} (confidence ${(ruleResult.confidence * 100).toFixed(0)}%).

Classify what this repeated collection represents using one of these exact values:
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

Return ONLY a valid JSON object with no markdown, no commentary:
{
  "collectionId": "${collection.id}",
  "classification": "PROJECTS",
  "confidence": 0.0-1.0,
  "evidenceIds": ["${collection.id}", "${sectionId}", "${collection.id}-item-0"],
  "reason": "one sentence explaining the decision and which evidence supports it"
}`;
        return { text: prompt, validIds, input };
    }
    callGeminiDecision(callType, input, promptText, validIds, schema) {
        const inputHash = hashInput({ provider: this.name, model: this.model, promptVersion: this.promptVersion, callType, input });
        const cachePath = join(this.cacheDir, `${inputHash}.json`);
        const start = Date.now();
        let cached = false;
        let raw;
        let error;
        try {
            if (existsSync(cachePath)) {
                raw = readFileSync(cachePath, 'utf-8');
                cached = true;
            }
            else {
                raw = this.makeGeminiRequest(promptText, callType, inputHash);
                writeFileSync(cachePath, raw, 'utf-8');
            }
            const parsed = parseGeminiResponse(raw);
            if (!parsed) {
                error = 'Could not parse JSON from Gemini response';
                return undefined;
            }
            const validated = schema.safeParse(parsed);
            if (!validated.success) {
                error = `Schema validation failed: ${validated.error.message.slice(0, 200)}`;
                return undefined;
            }
            // Evidence ID validation: reject unknown IDs
            const decision = validated.data;
            const evidenceIds = ('evidenceIds' in decision && Array.isArray(decision.evidenceIds)) ? decision.evidenceIds : [];
            if (evidenceIds.length === 0) {
                error = 'No evidenceIds returned';
                return undefined;
            }
            const unknown = evidenceIds.filter((id) => !validIds.has(id));
            if (unknown.length > 0) {
                error = `Unknown evidence IDs: ${unknown.join(', ')}`;
                return undefined;
            }
            return decision;
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
            return undefined;
        }
        finally {
            this.log({
                provider: 'gemini',
                model: this.model,
                promptVersion: this.promptVersion,
                inputHash,
                callType,
                ruleDecision: callType === 'collection' ? input.ruleClassification : input.pageType,
                ruleConfidence: input.ruleConfidence,
                aiDecision: raw ? tryGetDecision(raw, 'classification', 'type') : undefined,
                aiConfidence: raw ? tryGetConfidence(raw) : undefined,
                finalDecision: undefined,
                finalConfidence: undefined,
                evidenceIds: raw ? tryGetEvidenceIds(raw) : undefined,
                cached,
                durationMs: Date.now() - start,
                error,
                timestamp: new Date().toISOString(),
            });
        }
    }
    makeGeminiRequest(promptText, callType, inputHash) {
        if (this.geminiResponseOverride) {
            return this.geminiResponseOverride(promptText, callType, inputHash);
        }
        if (!this.apiKey)
            throw new Error('Gemini API key not configured');
        const body = {
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 800, responseMimeType: 'application/json' },
        };
        const tmp = join(tmpdir(), `gemini-req-${inputHash}-${randomUUID().slice(0, 8)}.json`);
        writeFileSync(tmp, JSON.stringify(body), 'utf-8');
        const url = `${this.apiUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const result = spawnSync('curl', [
            '-sS', '-m', '60',
            '-H', 'Content-Type: application/json',
            '-d', `@${tmp}`,
            url,
        ], { encoding: 'utf8', timeout: 65000 });
        if (result.error || result.status !== 0) {
            throw new Error(`curl failed: ${result.error?.message || result.stderr || result.status}`);
        }
        const json = JSON.parse(result.stdout || '{}');
        const text = String(json.candidates?.[0]?.content?.parts
            ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
            .join('') ?? '');
        if (!text)
            throw new Error('Gemini returned no text');
        return text;
    }
    log(metadata) {
        if (!this.logPath)
            return;
        try {
            appendFileSync(this.logPath, JSON.stringify(metadata) + '\n', 'utf-8');
        }
        catch {
            // Observability failure must not break the pipeline
        }
    }
    withReason(result, suffix) {
        return { ...result, reason: result.reason ? `${result.reason} | ${suffix}` : suffix };
    }
    withReasonCollection(result, suffix) {
        return { ...result, reason: `${result.reason} | ${suffix}` };
    }
}
function confidenceLevel(confidence) {
    if (confidence >= CONFIDENCE_THRESHOLDS.high)
        return 'HIGH';
    if (confidence >= CONFIDENCE_THRESHOLDS.medium)
        return 'MEDIUM';
    if (confidence >= CONFIDENCE_THRESHOLDS.low)
        return 'LOW';
    return 'UNKNOWN';
}
function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}
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
function parseGeminiResponse(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            return JSON.parse(trimmed);
        }
        catch { }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        try {
            return JSON.parse(trimmed.slice(start, end + 1));
        }
        catch { }
    }
    return undefined;
}
function tryGetDecision(raw, ...keys) {
    try {
        const parsed = parseGeminiResponse(raw);
        for (const k of keys)
            if (parsed?.[k])
                return String(parsed[k]);
    }
    catch { }
    return undefined;
}
function tryGetConfidence(raw) {
    try {
        const parsed = parseGeminiResponse(raw);
        if (typeof parsed?.confidence === 'number')
            return parsed.confidence;
    }
    catch { }
    return undefined;
}
function tryGetEvidenceIds(raw) {
    try {
        const parsed = parseGeminiResponse(raw);
        if (Array.isArray(parsed?.evidenceIds))
            return parsed.evidenceIds;
    }
    catch { }
    return undefined;
}
function mapAiCollectionDecision(decision, ruleResult, validIds) {
    if (decision.confidence < 0 || decision.confidence > 1)
        return undefined;
    if (decision.evidenceIds.length === 0)
        return undefined;
    if (decision.evidenceIds.some((id) => !validIds.has(id)))
        return undefined;
    const contentSubtypeMap = {
        PROJECTS: 'PROJECTS',
        PRODUCTS: 'PRODUCTS',
        SERVICES: 'SERVICES',
        NEWS: 'NEWS',
        VACANCIES: 'VACANCIES',
        CORPORATE: 'OTHER',
    };
    const typeMap = {
        NAVIGATION: 'NAVIGATION',
        PARTNER_LINKS: 'PARTNER_LINKS',
        SOCIAL_LINKS: 'SOCIAL_LINKS',
        UTILITY: 'UTILITY',
        UNKNOWN: 'UNKNOWN',
    };
    let type;
    let contentSubtype;
    if (contentSubtypeMap[decision.classification]) {
        type = 'CONTENT_COLLECTION';
        contentSubtype = contentSubtypeMap[decision.classification];
    }
    else if (typeMap[decision.classification]) {
        type = typeMap[decision.classification];
    }
    else {
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
    const evidence = decision.evidenceIds.map((id) => ({
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
