import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { HybridGeminiProvider } from '../dist/semantic/geminiSemanticProvider.js';
import { createSemanticProvider } from '../dist/semantic/provider.js';

function makeCacheDir() {
  return mkdtempSync(join(tmpdir(), 'gemini-test-'));
}

function makeSourceDocument(overrides = {}) {
  return {
    id: 'doc-1',
    url: 'https://example.com/',
    path: '',
    title: 'Example',
    metaDescription: '',
    h1: '',
    isHomepage: true,
    depth: 0,
    language: 'en',
    chrome: {
      nav: { primary: [], secondary: [], breadcrumbs: [] },
      contacts: {},
      logo: {},
    },
    sections: [],
    collections: [],
    structuredData: [],
    openGraph: {},
    evidence: { dates: [], companyNameCandidates: [], addressCandidates: [] },
    images: [],
    mainText: '',
    rawText: '',
    html: '',
    ...overrides,
  };
}

function makeCollection(overrides = {}) {
  return {
    id: 'col-1',
    selector: 'section.cards',
    heading: 'Recent updates',
    items: [
      { title: 'We opened a new office', description: 'Our team moved to a new location downtown.', url: '/news/office' },
      { title: 'Product launch', description: 'New product line announced today.', url: '/news/product' },
    ],
    ...overrides,
  };
}

function geminiCollectionResponse(classification, confidence, evidenceIds) {
  return JSON.stringify({
    decisions: [
      {
        collectionId: 'col-1',
        classification,
        confidence,
        evidenceIds,
        reason: 'test decision',
      },
    ],
  });
}

function geminiPageResponse(type, confidence, evidenceIds) {
  return JSON.stringify({
    sourceDocumentId: 'doc-1',
    type,
    confidence,
    evidenceIds,
    reason: 'test decision',
  });
}

function makeCollection2(overrides = {}) {
  return {
    id: 'col-2',
    selector: 'section.grid',
    heading: 'Latest work',
    items: [
      { title: 'Office complex built', description: 'A new office complex for a logistics company.', url: '/work/office' },
      { title: 'Bridge renovation', description: 'Renovation of a pedestrian bridge.', url: '/work/bridge' },
    ],
    ...overrides,
  };
}

function geminiBatchResponse(decisions) {
  return JSON.stringify({ decisions });
}

describe('HybridGeminiProvider', () => {
  it('is created when type is gemini', async () => {
    const p = createSemanticProvider({ type: 'gemini', geminiApiKey: 'fake' });
    assert.equal(p.name, 'gemini-hybrid');
  });

  it('skips Gemini when rule confidence is HIGH', async () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    let called = false;
    provider.setGeminiResponseOverride(() => {
      called = true;
      return geminiCollectionResponse('SERVICES', 0.95, ['col-1']);
    });

    const collection = makeCollection({ heading: 'Our services', items: [
      { title: 'Web design', description: 'Professional design services', url: '/services/design' },
      { title: 'Development', description: 'Build apps', url: '/services/dev' },
    ]});

    const doc = makeSourceDocument({ title: 'Services' });
    const result = await provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'SERVICES_INDEX', confidence: 0.9, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'SERVICES');
    assert.equal(called, false, 'Gemini should not be called for high-confidence rule result');
  });

  it('calls Gemini for medium-confidence collections and accepts a higher-confidence AI decision', async () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    let called = false;
    provider.setGeminiResponseOverride(() => {
      called = true;
      return geminiCollectionResponse('NEWS', 0.94, ['col-1', 'col-1-item-0', 'col-1-item-1']);
    });

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = await provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(called, true);
    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'NEWS');
    assert.equal(result.aiClassification, 'NEWS');
    assert.ok(result.confidence >= 0.9);
    assert.ok(result.reason.includes('Gemini'));
  });

  it('rejects AI decisions with unknown evidence IDs and falls back to rule result', async () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    provider.setGeminiResponseOverride(() => geminiCollectionResponse('NEWS', 0.99, ['made-up-id']));

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = await provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'OTHER');
    assert.ok(
      result.reason.includes('invalid') ||
      result.reason.includes('failed') ||
      result.reason.includes('did not return a decision')
    );
  });

  it('keeps the rule result when AI confidence is lower', async () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    provider.setGeminiResponseOverride(() => geminiCollectionResponse('PROJECTS', 0.4, ['col-1']));

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = await provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'OTHER');
    assert.ok(result.reason.includes('lower') || result.reason.includes('Gemini'));
  });

  it('does not call Gemini when no API key is configured', async () => {
    const provider = new HybridGeminiProvider({ geminiCachePath: makeCacheDir() });
    let called = false;
    provider.setGeminiResponseOverride(() => { called = true; return geminiCollectionResponse('NEWS', 0.99, ['col-1']); });

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = await provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(called, false);
    assert.ok(result.reason.includes('not configured'));
  });

  it('adjudicates ambiguous page classifications with Gemini', async () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    let called = false;
    provider.setGeminiResponseOverride(() => {
      called = true;
      return geminiPageResponse('PROJECTS_INDEX', 0.92, ['title', 'url']);
    });

    const doc = makeSourceDocument({
      url: 'https://example.com/business/',
      path: 'business',
      title: 'Our services',
      h1: 'Our services',
      metaDescription: 'Services we offer',
      isHomepage: false,
    });
    const result = await provider.classifyPage({
      sourceDocument: doc,
      allDocuments: [doc],
      baseUrl: 'https://example.com/',
    });

    assert.equal(called, true);
    assert.equal(result.type, 'PROJECTS_INDEX');
    assert.equal(result.category, 'CONTENT');
    assert.ok(result.reason.includes('Gemini'));
  });

  it('batches multiple ambiguous collections on one page into a single Gemini call', async () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    let calls = 0;
    provider.setGeminiResponseOverride(() => {
      calls++;
      return geminiBatchResponse([
        { collectionId: 'col-1', classification: 'NEWS', confidence: 0.9, evidenceIds: ['col-1', 'col-1-item-0'], reason: 'news items' },
        { collectionId: 'col-2', classification: 'PROJECTS', confidence: 0.9, evidenceIds: ['col-2', 'col-2-item-0'], reason: 'completed works' },
      ]);
    });

    const doc = makeSourceDocument({ title: 'Updates' });
    const ctxs = [
      { collection: makeCollection(), sourceDocument: doc, pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] }, baseUrl: 'https://example.com/' },
      { collection: makeCollection2(), sourceDocument: doc, pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] }, baseUrl: 'https://example.com/' },
    ];
    const results = await provider.classifyCollections(ctxs);

    assert.equal(calls, 1, 'all ambiguous collections batched into one call');
    assert.equal(results[0].contentSubtype, 'NEWS');
    assert.equal(results[1].contentSubtype, 'PROJECTS');
  });
});
