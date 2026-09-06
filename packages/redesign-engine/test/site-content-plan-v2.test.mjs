import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSiteContentPlanV2, verifyPlanHashV2, computePlanHashV2 } from '../dist/plan/siteContentPlanV2.js';
import { planToContent } from '../dist/plan/planToContent.js';

const ev = (v) => [{ type: 'TEXT', value: v, confidence: 0.8 }];
const ent = (id, title, docIds = ['d1'], collIds = []) => ({ id, title, confidence: 0.8, status: 'OK', sourceDocumentIds: docIds, sourceCollectionIds: collIds, evidence: ev(title) });
const collCls = (id, type, subtype, conf = 0.9) => ({ collectionId: id, type, contentSubtype: subtype, confidence: conf, reason: 'test', evidence: [] });

function doc(id, url, o = {}) {
  return {
    id, url, title: o.title || id, h1: o.h1, isHomepage: !!o.home, path: id, language: 'ru',
    metaDescription: o.meta, sections: o.sections || [], collections: o.collections || [],
    chrome: o.chrome || { nav: { primary: [] }, contacts: {} }, images: o.images || [],
    structuredData: [], openGraph: o.og || {}, evidence: { dates: [], companyNameCandidates: o.nameCand || [], addressCandidates: [] },
    mainText: 'x', rawText: 'x', html: '',
  };
}
const page = (docId, type, collections = [], conf = 0.9) => ({ sourceDocumentId: docId, classification: { sourceDocumentId: docId, type, confidence: conf, evidence: [] }, sections: [], collections, quality: {} });
const item = (title, url, extra = {}) => ({ title, url, ...extra });

function graph(over = {}) {
  return {
    version: '1', generatedAt: '', provider: { name: 'test' }, sourceDocumentIds: ['home'], baseUrl: 'https://x/',
    pages: [], services: [], projects: [], products: [], news: [], vacancies: [], facts: [], media: [],
    relationships: [], rejectedCollections: [], warnings: [], ...over,
  };
}
const HOME = doc('home', 'https://x/', { home: true });
const build = (g, docs = [HOME]) => buildSiteContentPlanV2({ siteKey: 't', baseUrl: 'https://x/', graph: g, documents: docs });

describe('SiteContentPlan V2', () => {
  it('T1: homogeneous house-model catalogue → all PRODUCTS, no split', () => {
    const models = ['Гамвик', 'Люмборг', 'Норхельм', 'Хайлунд', 'Йёрке', 'Тидберг'];
    const g = graph({
      products: models.slice(0, 4).map((m, i) => ent(`p${i}`, `${m} - Пазл Хаус`, ['d1'], ['catalog'])),
      projects: models.slice(4).map((m, i) => ent(`j${i}`, `${m} - Пазл Хаус`, ['d1'], ['catalog'])),
    });
    const plan = build(g);
    const all = plan.entities.filter((e) => models.some((m) => e.title.includes(m)));
    assert.equal(all.length, 6);
    assert.ok(all.every((e) => e.type === 'product'), `split: ${all.map((e) => e.type)}`);
  });

  it('T2: catalogue house model → PRODUCT', () => {
    const plan = build(graph({ products: [ent('p', 'Проект дома MG37 — 120м²')] }));
    assert.equal(plan.entities[0].type, 'product');
  });

  it('T3: concrete built object → PROJECT', () => {
    const plan = build(graph({ projects: [ent('j', 'Дом 79м², ЖК Новая Боровая — построен')] }));
    assert.equal(plan.entities[0].type, 'project');
  });

  it('T4: catalogue and portfolio coexist', () => {
    const plan = build(graph({ products: [ent('p', 'Модель А1')], projects: [ent('j', 'Объект Б2')] }));
    assert.ok(plan.entities.some((e) => e.type === 'product') && plan.entities.some((e) => e.type === 'project'));
  });

  it('T5: CTA button → not an entity', () => {
    const plan = build(graph({ products: [ent('p', 'Посмотреть проекты')], services: [ent('s', 'Узнать стоимость строительства')] }));
    assert.equal(plan.entities.length, 0);
    assert.ok(plan.omittedContent.some((o) => /CTA/.test(o.reason)));
  });

  it('T6: category/filter label → not a concrete entity', () => {
    const plan = build(graph({ projects: [ent('a', 'Квартиры'), ent('b', 'Портфолио'), ent('c', 'Все')] }));
    assert.equal(plan.entities.length, 0);
  });

  it('T7: pricing section → PRICING, not Product', () => {
    const d = doc('d1', 'https://x/prices', { collections: [{ id: 'c1', heading: 'Цены на ремонт', items: [item('Стандарт'), item('Премиум')] }] });
    const g = graph({ pages: [page('d1', 'OTHER', [collCls('c1', 'CONTENT_COLLECTION', 'OTHER')])] });
    const plan = build(g, [HOME, d]);
    assert.equal(plan.dynamicSections[0].kind, 'PRICING');
    assert.equal(plan.entities.filter((e) => e.type === 'product').length, 0);
  });

  it('T8: FAQ → FAQ, not News', () => {
    const d = doc('d1', 'https://x/faq', { collections: [{ id: 'f', heading: 'Часто задаваемые вопросы', items: [item('Сколько стоит?'), item('Как заказать?')] }] });
    const plan = build(graph({ pages: [page('d1', 'OTHER', [collCls('f', 'CONTENT_COLLECTION', 'OTHER')])] }), [HOME, d]);
    assert.equal(plan.dynamicSections[0].kind, 'FAQ');
    assert.equal(plan.entities.filter((e) => e.type === 'news').length, 0);
  });

  it('T9: reviews → REVIEWS, not News/Project', () => {
    const d = doc('d1', 'https://x/rev', { collections: [{ id: 'r', heading: 'Отзывы клиентов', items: [item('Иван', undefined, { description: 'Отличная работа' })] }] });
    const plan = build(graph({ pages: [page('d1', 'OTHER', [collCls('r', 'CONTENT_COLLECTION', 'OTHER')])] }), [HOME, d]);
    assert.equal(plan.dynamicSections[0].kind, 'REVIEWS');
    assert.equal(plan.entities.length, 0);
  });

  it('T10: blog editorial → ARTICLE, not forced to News', () => {
    const d = doc('d1', 'https://x/blog/kak-vybrat', { title: 'Как выбрать проект дома' });
    const g = graph({ news: [ent('n', 'Как выбрать проект дома', ['d1'])] });
    const plan = build(g, [HOME, d]);
    assert.equal(plan.entities[0].type, 'article');
    assert.ok(plan.plannedPages.some((p) => p.route === '/articles'));
  });

  it('T11: PROJECTS_INDEX + hasProject + detail docs → planned Projects', () => {
    const idx = doc('idx', 'https://x/portfolio/', { title: 'Наши работы' });
    const d1 = doc('pd1', 'https://x/portfolio/obj-1/', { title: 'Объект 1' });
    const d2 = doc('pd2', 'https://x/portfolio/obj-2/', { title: 'Объект 2' });
    const g = graph({
      pages: [page('idx', 'PROJECTS_INDEX', [], 0.95)],
      relationships: [
        { fromId: 'pd1', fromType: 'OTHER', toId: 'idx', toType: 'PROJECTS_INDEX', relation: 'hasProject', evidence: [] },
        { fromId: 'pd2', fromType: 'OTHER', toId: 'idx', toType: 'PROJECTS_INDEX', relation: 'hasProject', evidence: [] },
      ],
    });
    const plan = build(g, [HOME, idx, d1, d2]);
    const projs = plan.entities.filter((e) => e.type === 'project');
    assert.equal(projs.length, 2);
    assert.ok(projs.some((p) => p.title === 'Объект 1'));
  });

  it('T12: index teaser + canonical detail → one entity', () => {
    const d = doc('d1', 'https://x/projects/a/', { title: 'Объект А' });
    const g = graph({ projects: [ent('a', 'Объект А', ['home']), ent('b', 'Объект А', ['d1'])] });
    const plan = build(g, [HOME, d]);
    assert.equal(plan.entities.filter((e) => e.type === 'project').length, 1);
    assert.equal(plan.entities[0].detailUrl, 'https://x/projects/a/');
  });

  it('T13: equivalent phones → one contact', () => {
    const g = graph({ contacts: { id: 'c', confidence: 0.9, sourceDocumentIds: ['home'], evidence: ev('c'), phones: [{ value: '+375 44 566 22 68', evidence: { type: 'PHONE', value: 'x', confidence: 0.9 } }, { value: '+375 44 566-22-68', evidence: { type: 'PHONE', value: 'x', confidence: 0.9 } }] } });
    const plan = build(g);
    assert.equal(plan.contacts.phones.length, 1);
  });

  it('T14: svg data placeholder cannot be primary image', () => {
    const g = graph({ services: [{ ...ent('s', 'Ремонт'), imageIds: ['m1'] }], media: [{ id: 'm1', src: 'data:image/svg+xml;base64,x', role: 'SERVICE_IMAGE', confidence: 0.9, provenance: { sourceDocumentIds: ['d1'] } }] });
    const plan = build(g, [HOME, doc('d1', 'https://x/uslugi')]);
    assert.equal(plan.entities[0].primaryImage, undefined);
  });

  it('T15: planned navigation uses internal routes, not source URLs', () => {
    const plan = build(graph({ services: [ent('s', 'Ремонт квартир')] }));
    assert.ok(plan.plannedNavigation.every((n) => n.route.startsWith('/')));
    assert.ok(!plan.plannedNavigation.some((n) => (n.route || '').includes('://')));
    assert.ok(plan.plannedNavigation.some((n) => n.route === '/services'));
  });

  it('T16: plan is generation-sufficient — entities carry summary+media+evidence', () => {
    const d = doc('d1', 'https://x/p/1', { meta: 'A real project', sections: [{ id: 's1', level: 2, region: 'main', paragraphs: ['Body text'], lists: [], tables: [], images: [], links: [], collections: [], order: 0 }] });
    const plan = build(graph({ projects: [ent('j', 'Объект', ['d1'])] }), [HOME, d]);
    const p = plan.entities[0];
    assert.ok(p.summary || p.detailUrl);
    assert.ok(p.sourceUrls.length && p.evidence.length && p.slug && p.origin === 'SOURCE_CONTENT');
    const content = planToContent(plan);
    assert.ok(content.projects.length === 1 && content.projects[0].blocks.length > 0, 'detail page has content blocks');
  });

  it('T17: generator verifies planHash — tampered plan is refused', () => {
    const plan = build(graph());
    assert.equal(verifyPlanHashV2(plan), true);
    const copy = JSON.parse(JSON.stringify(plan));
    copy.entities.push({ id: 'x', type: 'project', title: 'fake', slug: 'fake', attributes: {}, media: [], sourceUrls: [], evidence: [], origin: 'SOURCE_CONTENT', confidence: 1, onHomepage: false });
    assert.equal(verifyPlanHashV2(copy), false);
  });

  it('T18: repeated dynamic section across pages → one canonical section', () => {
    const mk = (id, url) => doc(id, url, { collections: [{ id: `${id}-faq`, heading: 'Часто задаваемые вопросы', items: [item('Вопрос 1?'), item('Вопрос 2?')] }] });
    const pages = [page('d1', 'OTHER', [collCls('d1-faq', 'CONTENT_COLLECTION', 'OTHER')]), page('d2', 'OTHER', [collCls('d2-faq', 'CONTENT_COLLECTION', 'OTHER')]), page('d3', 'OTHER', [collCls('d3-faq', 'CONTENT_COLLECTION', 'OTHER')])];
    const plan = build(graph({ pages }), [HOME, mk('d1', 'https://x/a'), mk('d2', 'https://x/b'), mk('d3', 'https://x/c')]);
    const faqs = plan.dynamicSections.filter((d) => d.kind === 'FAQ');
    assert.equal(faqs.length, 1);
    assert.equal(faqs[0].sourcePages.length, 3);
  });
});
