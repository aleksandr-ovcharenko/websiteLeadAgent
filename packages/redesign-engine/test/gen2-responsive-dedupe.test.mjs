import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSourceDocuments } from '../dist/extract/buildSourceDocuments.js';

function makeCrawlResult(html, overrides = {}) {
  return {
    pages: [{
      url: 'https://example.com/',
      title: 'Example',
      metaDescription: 'Example description',
      h1: 'Welcome',
      canonicalUrl: 'https://example.com/',
      text: '',
      html,
      links: [],
      images: [],
      path: 'index',
      depth: 0,
      priority: 0,
      navItem: false,
      ...overrides
    }],
    navigation: [],
    homepage: { url: 'https://example.com/', confidence: 1, reason: 'origin root', pageIndex: 0 },
    warnings: [],
    skipped: []
  };
}

const tildaHtml = (body) => `<!DOCTYPE html>
<html><head><title>T</title></head><body><main id="main">${body}</main></body></html>`;

describe('responsive breakpoint dedupe (Tilda t-screenmin/max recs)', () => {
  it('collapses a min/max rec pair into one section, retaining the min copy', () => {
    const html = tildaHtml(`
      <div id="rec100" class="t-rec t-screenmin-480px">
        <h2>Наши услуги</h2><p>Проектирование магазинов.</p><p>Поставка оборудования.</p>
      </div>
      <div id="rec200" class="t-rec t-screenmax-480px">
        <h2>Наши услуги</h2><p>Проектирование магазинов.</p><p>Поставка оборудования.</p>
      </div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    const content = doc.sections.filter((s) => s.heading === 'Наши услуги');
    assert.equal(content.length, 1);
    assert.equal(content[0].responsiveScope?.kind, 'min');
    const dupes = doc.diagnostics.responsiveDuplicates;
    assert.equal(dupes.length, 1);
    assert.equal(dupes[0].retainedSectionId, content[0].id);
    assert.equal(dupes[0].removedScope, 'max480');
    assert.equal((doc.mainText.match(/Наши услуги/g) || []).length, 1);
  });

  it('collapses near-identical breakpoint copies that differ by one atom', () => {
    const html = tildaHtml(`
      <div id="rec1" class="t-rec t-screenmin-480px">
        <p>Раз</p><p>Два</p><p>Три</p><p>Четыре</p><p>Пять</p><p>Шесть</p><p>Семь</p><p>Восемь</p><p>Девять</p><p>Новая услуга</p>
      </div>
      <div id="rec2" class="t-rec t-screenmax-480px">
        <p>Раз</p><p>Два</p><p>Три</p><p>Четыре</p><p>Пять</p><p>Шесть</p><p>Семь</p><p>Восемь</p><p>Девять</p><p>Новая</p><p>услуга</p>
      </div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.sections.length, 1);
    assert.equal(doc.sections[0].responsiveScope?.kind, 'min');
  });

  it('preserves identical sections with no responsive evidence and reports them', () => {
    const html = tildaHtml(`
      <section><h2>О компании</h2><p>Мы работаем с 2010 года.</p></section>
      <section><h2>О компании</h2><p>Мы работаем с 2010 года.</p></section>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.diagnostics.repeatedContent?.length, 1);
    assert.equal(doc.diagnostics.repeatedContent[0].sectionIds.length, 2);
  });

  it('preserves identical sections sharing the SAME responsive scope', () => {
    const html = tildaHtml(`
      <div id="rec1" class="t-rec t-screenmin-480px"><p>Услуга один</p><p>Услуга два</p></div>
      <div id="rec2" class="t-rec t-screenmin-480px"><p>Услуга один</p><p>Услуга два</p></div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.diagnostics.repeatedContent?.length, 1);
  });

  it('does not collapse differently-scoped sections with unrelated content', () => {
    const html = tildaHtml(`
      <div id="rec1" class="t-rec t-screenmin-480px"><p>О компании и её истории</p></div>
      <div id="rec2" class="t-rec t-screenmax-480px"><p>Каталог продукции сезона</p></div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.diagnostics.responsiveDuplicates?.length ?? 0, 0);
  });

  it('drops slick-cloned containers entirely', () => {
    const html = tildaHtml(`
      <div class="slider">
        <div class="slide"><p>Оригинальный слайд</p></div>
        <div class="slide slick-cloned"><p>Клонированный слайд</p></div>
      </div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    const all = doc.sections.flatMap((s) => s.paragraphs).join(' ');
    assert.match(all, /Оригинальный слайд/);
    assert.doesNotMatch(all, /Клонированный слайд/);
    assert.equal(doc.diagnostics.droppedClones, 1);
  });

  it('drops zero-content shell sections', () => {
    const html = tildaHtml(`
      <div id="rec1" class="t-rec"><div class="spacer"></div></div>
      <div id="rec2" class="t-rec"><p>Реальный контент</p></div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.sections.length, 1);
    assert.ok((doc.diagnostics.droppedEmptySections ?? 0) >= 1);
  });

  it('keeps FAQ pairs typed inside a breakpoint pair once', () => {
    const faqBlock = `
      <div class="faq-item">
        <div class="faq-q">Сколько стоит проект?</div>
        <div class="faq-a">От 100 рублей за метр.</div>
      </div>`;
    const html = tildaHtml(`
      <div id="rec1" class="t-rec t-screenmin-480px">${faqBlock}<p>Контактный текст</p></div>
      <div id="rec2" class="t-rec t-screenmax-480px">${faqBlock}<p>Контактный текст</p></div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    const faqs = doc.sections.flatMap((s) => s.faqs);
    assert.ok(faqs.length <= 1, `expected ≤1 faq after dedupe, got ${faqs.length}`);
    if (faqs.length) {
      assert.equal(faqs[0].question, 'Сколько стоит проект?');
      assert.match(faqs[0].answer, /100 рублей/);
    }
  });
});

describe('media normalization', () => {
  it('prefers data-original over the lazy src thumb', () => {
    const html = tildaHtml(`
      <img src="https://thb.tildacdn.biz/tild3265-3662-4262-b937-646131623737/-/resize/20x/photo.jpg"
           data-original="https://static.tildacdn.biz/tild3265-3662-4262-b937-646131623737/photo.jpg">`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.ok(doc.images.some((i) => i.src === 'https://static.tildacdn.biz/tild3265-3662-4262-b937-646131623737/photo.jpg'));
    assert.ok(!doc.images.some((i) => i.src.includes('thb.tildacdn')));
  });

  it('canonicalizes optim/-/resize/-/format derivatives to the original', () => {
    const html = tildaHtml(`
      <img src="https://optim.tildacdn.biz/tild3331-3331-4736-b163-363364366461/-/resize/456x/-/format/webp/noroot.png.webp">`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.images.length, 1);
    assert.equal(doc.images[0].src, 'https://static.tildacdn.biz/tild3331-3331-4736-b163-363364366461/noroot.png');
  });

  it('dedupes a thumb and its data-original to one inventory entry', () => {
    const html = tildaHtml(`
      <img src="https://thb.tildacdn.biz/tild3265-3662-4262-b937-646131623737/-/resize/20x/photo.jpg">
      <img data-original="https://static.tildacdn.biz/tild3265-3662-4262-b937-646131623737/photo.jpg">`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    const hits = doc.images.filter((i) => i.src === 'https://static.tildacdn.biz/tild3265-3662-4262-b937-646131623737/photo.jpg');
    assert.equal(hits.length, 1);
  });

  it('drops analytics pixels and data: blobs', () => {
    const html = tildaHtml(`
      <img src="https://mc.yandex.ru/watch/12345">
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
      <img src="https://static.tildacdn.biz/tild3265-3662-4262-b937-646131623737/real.jpg">`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    assert.equal(doc.images.length, 1);
    assert.match(doc.images[0].src, /real\.jpg$/);
  });

  it('resolves card images from div[data-original] backgrounds', () => {
    const html = tildaHtml(`
      <div class="t-card__container">
        <div class="t-card__col t-item">
          <div class="t-bgimg" data-original="https://static.tildacdn.biz/tild6536-3665-4566-a435-616131666262/noroot.png" style="background: url(&quot;https://optim.tildacdn.biz/tild6536-3665-4566-a435-616131666262/-/cover/432x285/center/center/-/format/webp/noroot.png.webp&quot;) center center / cover no-repeat;"></div>
          <div class="t-card__title"><a href="/p1">Проект один</a></div>
        </div>
        <div class="t-card__col t-item">
          <div class="t-bgimg" data-original="https://static.tildacdn.biz/tild3265-3662-4262-b937-646131623737/photo.jpg" style="background: url(&quot;https://optim.tildacdn.biz/tild3265-3662-4262-b937-646131623737/-/cover/432x285/center/center/-/format/webp/photo.jpg.webp&quot;) center center / cover no-repeat;"></div>
          <div class="t-card__title"><a href="/p2">Проект два</a></div>
        </div>
      </div>`);
    const [doc] = buildSourceDocuments(makeCrawlResult(html));
    const col = doc.collections.find((c) => c.items.length >= 2);
    assert.ok(col, 'collection detected');
    const withImg = col.items.filter((i) => i.image?.src);
    assert.equal(withImg.length, 2);
    assert.equal(withImg[0].image.src, 'https://static.tildacdn.biz/tild6536-3665-4566-a435-616131666262/noroot.png');
  });
});
