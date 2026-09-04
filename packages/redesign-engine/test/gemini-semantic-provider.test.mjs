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
    collectionId: 'col-1',
    classification,
    confidence,
    evidenceIds,
    reason: 'test decision',
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

describe('HybridGeminiProvider', () => {
  it('is created when type is gemini', () => {
    const p = createSemanticProvider({ type: 'gemini', geminiApiKey: 'fake' });
    assert.equal(p.name, 'gemini-hybrid');
  });

  it('skips Gemini when rule confidence is HIGH', () => {
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
    const result = provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'SERVICES_INDEX', confidence: 0.9, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'SERVICES');
    assert.equal(called, false, 'Gemini should not be called for high-confidence rule result');
  });

  it('calls Gemini for medium-confidence collections and accepts a higher-confidence AI decision', () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    let called = false;
    provider.setGeminiResponseOverride(() => {
      called = true;
      return geminiCollectionResponse('NEWS', 0.94, ['col-1', 'col-1-item-0', 'col-1-item-1']);
    });

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = provider.classifyCollection({
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

  it('rejects AI decisions with unknown evidence IDs and falls back to rule result', () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    provider.setGeminiResponseOverride(() => geminiCollectionResponse('NEWS', 0.99, ['made-up-id']));

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'OTHER');
    assert.ok(result.reason.includes('invalid') || result.reason.includes('failed'));
  });

  it('keeps the rule result when AI confidence is lower', () => {
    const provider = new HybridGeminiProvider({ geminiApiKey: 'fake', geminiCachePath: makeCacheDir() });
    provider.setGeminiResponseOverride(() => geminiCollectionResponse('PROJECTS', 0.4, ['col-1']));

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(result.type, 'CONTENT_COLLECTION');
    assert.equal(result.contentSubtype, 'OTHER');
    assert.ok(result.reason.includes('lower') || result.reason.includes('Gemini'));
  });

  it('does not call Gemini when no API key is configured', () => {
    const provider = new HybridGeminiProvider({ geminiCachePath: makeCacheDir() });
    let called = false;
    provider.setGeminiResponseOverride(() => { called = true; return geminiCollectionResponse('NEWS', 0.99, ['col-1']); });

    const collection = makeCollection();
    const doc = makeSourceDocument({ title: 'Updates' });
    const result = provider.classifyCollection({
      collection,
      sourceDocument: doc,
      pageClassification: { sourceDocumentId: doc.id, type: 'ABOUT', confidence: 0.5, evidence: [] },
      baseUrl: 'https://example.com/',
    });

    assert.equal(called, false);
    assert.ok(result.reason.includes('not configured'));
  });

  it('adjudicates ambiguous page classifications with Gemini', () => {
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
    const result = provider.classifyPage({
      sourceDocument: doc,
      allDocuments: [doc],
      baseUrl: 'https://example.com/',
    });

    assert.equal(called, true);
    assert.equal(result.type, 'PROJECTS_INDEX');
    assert.equal(result.category, 'CONTENT');
    assert.ok(result.reason.includes('Gemini'));
  });
});
