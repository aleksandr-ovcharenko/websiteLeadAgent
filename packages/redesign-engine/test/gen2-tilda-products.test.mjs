import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSourceDocuments } from '../dist/extract/buildSourceDocuments.js';
import { graphToImportContent } from '../dist/import/graphToImportContent.js';

function makeCrawlResult(html, url = 'https://example.com/') {
  return {
    pages: [{
      url,
      title: 'Example',
      metaDescription: 'Example description',
      h1: 'Catalog',
      canonicalUrl: url,
      text: '',
      html,
      links: [],
      images: [],
      path: 'index',
      depth: 0,
      priority: 0,
      navItem: false
    }],
    navigation: [],
    homepage: { url, confidence: 1, reason: 'origin root', pageIndex: 0 },
    warnings: [],
    skipped: []
  };
}

const tildaCard = (lid, title, descr, img) => `
  <div class="t776__col t-col t-item t776__col_mobile-grid js-product" data-product-lid="${lid}">
    <div class="t776__content">
      <a class="js-product-link" href="#prodpopup">
        <div class="t776__bgimg t-bgimg js-product-img" data-original="${img}"></div>
        <div class="t776__textwrapper">
          <div class="t776__title js-product-name">${title}</div>
          <div class="t776__descr">${descr}</div>
        </div>
      </a>
    </div>
  </div>`;

describe('Tilda product-card collections (#prodpopup)', () => {
  const imgA = 'https://static.tildacdn.biz/tild0000-0000-0000-0000-000000000001/a.jpg';
  const imgB = 'https://static.tildacdn.biz/tild0000-0000-0000-0000-000000000002/b.jpg';
  const html = `<!DOCTYPE html><html><body><main id="main">
    <div id="rec1" class="t-rec">
      <div class="t776">
        <div class="t776__parent t776__container_mobile-grid">
          ${tildaCard('111', 'Стеллаж пристенный', 'ВхШхГ: 2082х1000х500мм', imgA)}
          ${tildaCard('222', 'Стеллаж хлебный', 'ВхШхГ: 2082х700х500мм', imgB)}
          ${tildaCard('333', 'Стеллаж дисконтный', 'ВхШхГ: 2082х1250х500мм', imgA)}
        </div>
      </div>
    </div>
  </main></body></html>`;

  it('does not resolve #prodpopup card links to page URLs', () => {
    const docs = buildSourceDocuments(makeCrawlResult(html));
    const col = docs[0].collections.find((c) => c.items.some((i) => i.title === 'Стеллаж пристенный'));
    assert.ok(col, 'product collection detected');
    assert.ok(col.items.length >= 3, 'all product cards captured');
    for (const item of col.items) {
      assert.ok(!item.url, `'${item.title}' must not carry a #popup url`);
    }
  });

  it('extracts title, description and image from js-product cards', () => {
    const docs = buildSourceDocuments(makeCrawlResult(html));
    const col = docs[0].collections.find((c) => c.items.some((i) => i.title === 'Стеллаж пристенный'));
    const item = col.items.find((i) => i.title === 'Стеллаж пристенный');
    assert.equal(item.description, 'ВхШхГ: 2082х1000х500мм');
    assert.ok(item.image?.src?.includes('static.tildacdn.biz'), 'canonical image resolved');
  });

  it('drops a titleless image-only collection subsumed by a titled collection', () => {
    const html2 = `<!DOCTYPE html><html><body><main id="main">
      <div id="rec1" class="t-rec"><div class="t776"><div class="t776__parent">
        ${tildaCard('111', 'Стеллаж пристенный', 'ВхШхГ: 2082х1000х500мм', imgA)}
        ${tildaCard('222', 'Стеллаж хлебный', 'ВхШхГ: 2082х700х500мм', imgB)}
        ${tildaCard('333', 'Стеллаж дисконтный', 'ВхШхГ: 2082х1250х500мм', imgA)}
      </div></div></div>
      <div id="rec2" class="t-rec"><div class="t776"><div class="t776__parent">
        <div class="t776__col t-col t-item"><div class="t776__bgimg t-bgimg" data-original="${imgA}"></div></div>
        <div class="t776__col t-col t-item"><div class="t776__bgimg t-bgimg" data-original="${imgB}"></div></div>
      </div></div></div>
    </main></body></html>`;
    const docs = buildSourceDocuments(makeCrawlResult(html2));
    const titled = docs[0].collections.filter((c) => c.items.some((i) => i.title));
    const imageOnly = docs[0].collections.filter((c) => c.items.length && c.items.every((i) => !i.title));
    assert.equal(imageOnly.length, 0, 'image-only echo collection dropped');
    assert.ok(titled.length >= 1, 'titled collection retained');
  });
});

describe('graphToImportContent products mapping', () => {
  const baseGraph = (products) => ({
    id: 'g1', confidenceLevel: 'HIGH', sourceDocumentIds: [], baseUrl: 'https://example.com',
    pages: [], services: [], projects: [], news: [], vacancies: [], products,
    facts: [], media: [], relationships: [], rejectedCollections: []
  });
  const ent = (over) => ({
    id: `p-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Product',
    description: 'Описание товара из карточки.',
    confidence: 0.7, status: 'OK',
    sourceDocumentIds: ['sd-1'],
    evidence: [],
    ...over
  });
  const detailDoc = {
    id: 'sd-1', url: 'https://example.com/catalog', path: 'catalog', title: 'Catalog',
    h1: 'Catalog', isHomepage: false, sections: [], collections: [], images: [],
    chrome: {}, structuredData: [], openGraph: {}, evidence: {}
  };

  it('maps PRODUCTS_INDEX collection entities with index-page provenance', () => {
    const graph = baseGraph([ent({ title: 'Стеллаж А' }), ent({ title: 'Стеллаж Б' })]);
    graph.pages = [{ sourceDocumentId: 'sd-1', classification: { type: 'PRODUCTS_INDEX', confidence: 0.9 }, sections: [], collections: [], quality: {} }];
    const { content, provenance } = graphToImportContent({ graph, sourceDocuments: [detailDoc], baseUrl: 'https://example.com' });
    assert.equal(content.products.length, 2);
    assert.ok(content.products.every((p) => p.sourceUrl.startsWith('https://example.com/catalog#item-')),
      'collection products carry item-scoped provenance, not the bare index URL');
    assert.ok(content.products.every((p) => p.summary));
    assert.equal(new Set(content.products.map((p) => p.slug)).size, 2, 'slugs unique');
    assert.equal(provenance.products.length, 2);
  });

  it('keeps same-title variants as separate products with unique slugs', () => {
    const graph = baseGraph([
      ent({ title: 'Стеллаж', description: 'ВхШхГ: 1000мм' }),
      ent({ title: 'Стеллаж', description: 'ВхШхГ: 2000мм' }),
    ]);
    graph.pages = [{ sourceDocumentId: 'sd-1', classification: { type: 'PRODUCTS_INDEX', confidence: 0.9 }, sections: [], collections: [], quality: {} }];
    const { content } = graphToImportContent({ graph, sourceDocuments: [detailDoc], baseUrl: 'https://example.com' });
    assert.equal(content.products.length, 2);
    assert.notEqual(content.products[0].slug, content.products[1].slug);
  });

  it('drops product entities without product-page provenance or generic titles', () => {
    const graph = baseGraph([ent({ title: 'Услуги' }), ent({ title: 'Real Product' })]);
    graph.pages = [{ sourceDocumentId: 'sd-1', classification: { type: 'OTHER', confidence: 0.3 }, sections: [], collections: [], quality: {} }];
    const { content, provenance } = graphToImportContent({ graph, sourceDocuments: [detailDoc], baseUrl: 'https://example.com' });
    assert.equal(content.products.length, 0);
    assert.ok(provenance.droppedEntities.some((d) => d.reason.startsWith('not-from-product-page')));
  });
});
