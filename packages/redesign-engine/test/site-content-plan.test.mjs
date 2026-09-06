import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSiteContentPlan, computePlanHash, verifyPlanHash } from '../dist/plan/siteContentPlan.js';
import { buildPlanReport } from '../dist/plan/planReport.js';

function doc(id, url, opts = {}) {
  return {
    id, url, title: opts.title || id, isHomepage: !!opts.home, path: id,
    sections: opts.sections || [], collections: opts.collections || [],
    chrome: opts.chrome || { nav: { primary: [] }, contacts: {} },
    images: [], links: [], mainText: 'text', depth: 0, evidence: {},
  };
}

const ev = (v) => [{ type: 'TEXT', value: v, confidence: 0.8 }];
const ent = (id, title, docIds = ['d1']) => ({ id, title, confidence: 0.8, status: 'OK', sourceDocumentIds: docIds, evidence: ev(title) });
const coll = (id, type, subtype, reason = 'test') => ({ collectionId: id, type, contentSubtype: subtype, confidence: 0.8, reason, evidence: [] });

function graph(over = {}) {
  return {
    version: '1', generatedAt: '', provider: { name: 'test' }, sourceDocumentIds: ['home'],
    baseUrl: 'https://x/', pages: [], services: [], projects: [], news: [], vacancies: [], products: [],
    facts: [], media: [], relationships: [], rejectedCollections: [], warnings: [], ...over,
  };
}

describe('SiteContentPlan', () => {
  const home = doc('home', 'https://x/', { home: true, chrome: { nav: { primary: [{ label: 'Services', url: 'https://x/uslugi' }] }, contacts: {} } });
  const docs = [home, doc('d1', 'https://x/uslugi')];

  it('T1: catalogue house model stays PRODUCT, not PROJECT', () => {
    const g = graph({ products: [ent('p1', 'Проект дома MG37')], projects: [] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.products.length, 1);
    assert.equal(plan.projects.length, 0);
  });

  it('T2: concrete completed object is a PROJECT', () => {
    const g = graph({ projects: [ent('j1', 'Квартира 79м², ЖК Новая Боровая')] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.projects[0].title, 'Квартира 79м², ЖК Новая Боровая');
    assert.equal(plan.projects[0].origin, 'SOURCE_CONTENT');
  });

  it('T3: category/filter collections never become Projects', () => {
    const g = graph({ pages: [{ sourceDocumentId: 'd1', classification: { sourceDocumentId: 'd1', type: 'PROJECTS_INDEX', confidence: 0.9, evidence: [] }, sections: [], collections: [coll('c1', 'NAVIGATION', undefined, 'filter row')], quality: {} }] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.projects.length, 0);
    const ds = plan.dynamicSections.find((d) => d.collectionId === 'c1');
    assert.equal(ds.kind, 'IGNORED');
  });

  it('T4: homepage teaser + detail entity → one canonical entity', () => {
    const g = graph({ projects: [ent('a', 'Дом 120м²', ['home']), ent('b', 'дом 120м²', ['d1'])] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.projects.length, 1);
  });

  it('T5: no news source → empty News is valid', () => {
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: graph(), documents: docs });
    assert.deepEqual(plan.news, []);
    assert.match(buildPlanReport(plan, graph(), docs), /NEWS: NONE FOUND/);
  });

  it('T6: date alone does not create News (no news entities → no news section)', () => {
    const g = graph({ pages: [{ sourceDocumentId: 'home', classification: { sourceDocumentId: 'home', type: 'HOME', confidence: 1, evidence: [] }, sections: [], collections: [coll('cal', 'CONTENT_COLLECTION', 'OTHER', 'dated items')], quality: {} }] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.news.length, 0);
    assert.equal(plan.dynamicSections[0].kind, 'OTHER');
  });

  it('T7: unknown dynamic section → preserved as OTHER, not deleted', () => {
    const g = graph({ pages: [{ sourceDocumentId: 'd1', classification: { sourceDocumentId: 'd1', type: 'OTHER', confidence: 0.5, evidence: [] }, sections: [], collections: [coll('mystery', 'UNKNOWN', undefined, 'unclassified')], quality: {} }] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.dynamicSections[0].kind, 'OTHER');
    assert.ok(plan.dynamicSections[0].collectionId);
  });

  it('T8: large project collection → full list preserved, homepage gets subset', () => {
    const projs = Array.from({ length: 20 }, (_, i) => ent(`j${i}`, `Object ${i}`, ['d1']));
    const g = graph({ projects: projs });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.projects.length, 20);
    const homeProjects = plan.homepage.plannedSections.find((s) => s.type === 'projects');
    assert.ok(homeProjects.entityIds.length <= 6);
  });

  it('T9: factual values carry evidence/source refs', () => {
    const g = graph({
      company: { ...ent('co', 'ACME'), displayName: 'ACME', unp: '123' },
      contacts: { id: 'c', confidence: 0.9, sourceDocumentIds: ['home'], evidence: ev('c'), phones: [{ value: '+375 17 1', evidence: { type: 'PHONE', value: '+375 17 1', confidence: 0.9, sourceUrl: 'https://x/kontakty' } }] },
    });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.contacts.phones[0].sourceUrl, 'https://x/kontakty');
    assert.ok(plan.siteIdentity.evidenceDocIds.length > 0);
    assert.equal(plan.siteIdentity.unp, '123');
  });

  it('T10: missing factual evidence → omitted, never invented', () => {
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: graph(), documents: docs });
    assert.equal(plan.siteIdentity.displayName, undefined);
    assert.equal(plan.contacts.phones.length, 0);
    assert.ok(plan.warnings.some((w) => /identity|contacts/i.test(w)));
  });

  it('T11: products and projects coexist', () => {
    const g = graph({ products: [ent('p', 'Проект дома MG37')], projects: [ent('j', 'ЖК Пример, кв. 45')] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.products.length, 1);
    assert.equal(plan.projects.length, 1);
  });

  it('T12: repeated homepage service teasers do not duplicate Services', () => {
    const g = graph({ services: [ent('s1', 'Ремонт квартир', ['home']), ent('s2', 'Ремонт квартир', ['d1']), ent('s3', 'ремонт квартир ', ['d1'])] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.services.length, 1);
  });

  it('T13: reviews are not Projects or News', () => {
    const g = graph({ pages: [{ sourceDocumentId: 'd1', classification: { sourceDocumentId: 'd1', type: 'OTHER', confidence: 0.5, evidence: [] }, sections: [], collections: [coll('rev', 'CONTENT_COLLECTION', 'OTHER', 'review cards')], quality: {} }] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.projects.length, 0);
    assert.equal(plan.news.length, 0);
    assert.equal(plan.dynamicSections[0].kind, 'OTHER');
  });

  it('T14: FAQ is not News', () => {
    const g = graph({ pages: [{ sourceDocumentId: 'd1', classification: { sourceDocumentId: 'd1', type: 'OTHER', confidence: 0.5, evidence: [] }, sections: [], collections: [coll('faq', 'CONTENT_COLLECTION', 'OTHER', 'Q&A list')], quality: {} }] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.equal(plan.news.length, 0);
  });

  it('T15: planHash is stable and verifies — the generator contract', () => {
    const g = graph({ services: [ent('s', 'X')] });
    const plan = buildSiteContentPlan({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });
    assert.ok(plan.planHash);
    assert.equal(verifyPlanHash(plan), true);
    const copy = JSON.parse(JSON.stringify(plan));
    assert.equal(copy.planHash, plan.planHash, 'serialized+parsed plan keeps the same hash');
    copy.services[0].title = 'tampered';
    assert.equal(verifyPlanHash(copy), false, 'tampering is detected');
  });
});
