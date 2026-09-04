import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSourceDocuments } from '../dist/extract/buildSourceDocuments.js';
import { buildSourceContentGraph } from '../dist/semantic/graph.js';
import { createSemanticProvider } from '../dist/semantic/provider.js';
import { sourceContentGraphSchema } from '../dist/semantic/schema.js';

function makeCrawlResult(pages) {
  const baseUrl = pages[0]?.url ? new URL(pages[0].url).origin + '/' : 'https://example.com/';
  const home = pages.find((p) => p.depth === 0 && new URL(p.url).pathname.replace(/\/$/, '') === '');
  return {
    pages,
    navigation: [],
    homepage: home ? { url: home.url, confidence: 1, reason: 'root', pageIndex: 0 } : { url: baseUrl, confidence: 1, reason: 'first', pageIndex: 0 },
    warnings: [],
    skipped: []
  };
}

const homeHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <title>ООО "Ромашка" — производство мебели</title>
  <meta name="description" content="Мебельная компания Ромашка">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Ромашка","legalName":"ООО Ромашка","telephone":"+375 17 000-00-00","address":{"streetAddress":"ул. Примерная, 1","addressLocality":"Минск"},"foundingDate":"2010"}</script>
</head>
<body>
  <header><a href="/"><img src="/logo.png" alt="Ромашка"></a></header>
  <main>
    <h1>Ромашка</h1>
    <section><p>Мы производим качественную мебель с 2010 года.</p><p>Более 200 сотрудников.</p></section>
  </main>
  <footer><a href="/contacts">Контакты</a><p>г. Минск, ул. Примерная, 1</p></footer>
</body></html>`;

const servicesHtml = `<!DOCTYPE html>
<html lang="ru">
<head><title>Услуги — Ромашка</title></head>
<body>
  <main>
    <h1>Наши услуги</h1>
    <section>
      <h2><a href="/uslugi/mebel">Мебель на заказ</a></h2>
      <p>Изготовление мебели по индивидуальным размерам.</p>
    </section>
    <section>
      <h2><a href="/uslugi/dostavka">Доставка</a></h2>
      <p>Быстрая доставка по всей Беларуси.</p>
    </section>
  </main>
</body></html>`;

const serviceDetailHtml = `<!DOCTYPE html>
<html lang="ru">
<head><title>Мебель на заказ — Ромашка</title></head>
<body>
  <main>
    <h1>Мебель на заказ</h1>
    <section><p>Индивидуальный подход к каждому клиенту. Проект от чертежа до монтажа.</p></section>
  </main>
</body></html>`;

const newsHtml = `<!DOCTYPE html>
<html lang="ru">
<head><title>Новости — Ромашка</title></head>
<body>
  <main>
    <h1>Новости компании</h1>
    <article>
      <h2><a href="/novosti/2024/otkrytie">Открытие нового цеха</a></h2>
      <p>Сегодня мы открыли новый производственный цех в Минске.</p>
    </article>
    <article>
      <h2><a href="/novosti/2024/novaya-liniya">Запуск новой линии</a></h2>
      <p>Мы запустили новую производственную линию.</p>
    </article>
  </main>
</body></html>`;

const newsDetailHtml = `<!DOCTYPE html>
<html lang="ru">
<head><title>Открытие нового цеха — Ромашка</title></head>
<body>
  <main>
    <article>
      <h1>Открытие нового цеха</h1>
      <p>Сегодня мы открыли новый производственный цех в Минске.</p>
    </article>
  </main>
</body></html>`;

const contactHtml = `<!DOCTYPE html>
<html lang="ru">
<head><title>Контакты — Ромашка</title></head>
<body>
  <main>
    <h1>Контакты</h1>
    <section>
      <p>Телефон: +375 17 000-00-00</p>
      <p>Email: info@romashka.example</p>
      <p>Адрес: ул. Примерная, 1, Минск</p>
      <p>Пн-Пт: 09:00 - 18:00</p>
    </section>
  </main>
</body></html>`;

function page(url, html, depth = 0, overrides = {}) {
  return {
    url,
    title: '',
    metaDescription: '',
    h1: '',
    canonicalUrl: url,
    text: '',
    html,
    links: [],
    images: [],
    path: new URL(url).pathname.replace(/^\//, '') || 'index',
    depth,
    priority: 0,
    navItem: false,
    ...overrides
  };
}

const sampleCrawl = makeCrawlResult([
  page('https://example.com/', homeHtml, 0),
  page('https://example.com/uslugi/', servicesHtml, 1, { title: 'Услуги — Ромашка' }),
  page('https://example.com/uslugi/mebel', serviceDetailHtml, 2, { title: 'Мебель на заказ — Ромашка' }),
  page('https://example.com/novosti/', newsHtml, 1),
  page('https://example.com/novosti/2024/otkrytie', newsDetailHtml, 2, { title: 'Открытие нового цеха — Ромашка' }),
  page('https://example.com/contacts/', contactHtml, 1, { title: 'Контакты — Ромашка' }),
]);

describe('Source content graph (Phase 2A)', () => {
  it('builds a valid source-content-graph.json via Zod schema', () => {
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const parsed = sourceContentGraphSchema.safeParse(graph);
    assert.equal(parsed.success, true, `graph invalid: ${parsed.error?.message || ''}`);
  });

  it('classifies the home page and extracts company name', () => {
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const homePage = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(homePage, 'home page classified');
    assert.ok(graph.company, 'company entity extracted');
    assert.equal(graph.company.displayName, 'Ромашка', 'company display name');
    assert.equal(graph.company.legalName, 'ООО Ромашка', 'company legal name');
    assert.equal(graph.company.founded, '2010', 'founding year');
    assert.equal(graph.company.employees, '200 сотрудников', 'employee count');
  });

  it('classifies service index and detail pages', () => {
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const svcIndex = graph.pages.find((p) => p.classification.type === 'SERVICES_INDEX');
    const svcDetail = graph.pages.find((p) => p.classification.type === 'SERVICE_DETAIL');
    assert.ok(svcIndex, 'services index classified');
    assert.ok(svcDetail, 'service detail classified');
    assert.ok(graph.services.some((s) => s.title === 'Мебель на заказ'), 'service extracted');
  });

  it('classifies news index and extracts article', () => {
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const newsIndex = graph.pages.find((p) => p.classification.type === 'NEWS_INDEX');
    assert.ok(newsIndex, 'news index classified');
    assert.ok(graph.news.some((n) => n.title.includes('Открытие')), 'news article extracted');
  });

  it('classifies contacts page and extracts contact values', () => {
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const contactsPage = graph.pages.find((p) => p.classification.type === 'CONTACTS');
    assert.ok(contactsPage, 'contacts page classified');
    assert.ok(graph.contacts, 'contacts entity extracted');
    assert.ok(graph.contacts.phones.some((p) => p.value.includes('000')), 'phone extracted');
    assert.ok(graph.contacts.emails.some((e) => e.value.includes('info@romashka.example')), 'email extracted');
    assert.ok(graph.contacts.addresses.some((a) => a.value.includes('Примерная')), 'address extracted');
  });

  it('rejects language switchers, theme widgets and ads', () => {
    const html = `<!DOCTYPE html>
<html><body>
  <ul class="language-list"><li><a href="/ru">Рус</a></li><li><a href="/en">Eng</a></li></ul>
  <ul class="theme-list"><li><a href="#">Черным по белому</a></li><li><a href="#">Синим</a></li></ul>
  <ul class="ads"><li><a href="https://ads.example/promo" target="_blank">Реклама</a></li><li><a href="https://ads.example/promo" target="_blank">Реклама</a></li></ul>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0)]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const collClassifications = graph.pages.flatMap((p) => p.collections);
    assert.ok(collClassifications.some((c) => c.type === 'LANGUAGE_SWITCHER'), 'language switcher classified');
    assert.ok(collClassifications.some((c) => c.type === 'THEME_WIDGET'), 'theme widget classified');
    assert.ok(collClassifications.some((c) => c.type === 'ADVERTISEMENT'), 'advertisement classified');
  });

  it('classifies navigation and utility collections and avoids mixing them as content', () => {
    const html = `<!DOCTYPE html>
<html><body>
  <main>
    <h1>Welcome</h1>
    <ul class="primary-nav"><li><a href="/">Home</a></li><li><a href="/about">About</a></li><li><a href="/services">Services</a></li></ul>
    <ul class="utility"><li><a href="#" class="search">Search</a></li><li><a href="#" class="cart">Cart</a></li></ul>
    <p>Real content paragraph.</p>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0)]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const home = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(home, 'home page classified');
    const navCollection = home.collections.find((s) => s.type === 'NAVIGATION');
    const utilityCollection = home.collections.find((s) => s.type === 'UTILITY');
    assert.ok(navCollection, 'navigation collection classified');
    assert.ok(utilityCollection, 'utility collection classified');
    assert.ok(!home.collections.some((s) => s.type === 'CONTENT_COLLECTION'), 'navigation not treated as service');
  });

  it('uses provider abstraction with rule-based default', () => {
    const provider = createSemanticProvider();
    assert.equal(provider.name, 'rule-based', 'rule-based provider returned by default');
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/', provider });
    assert.ok(graph.company, 'graph built with explicit provider');
  });

  it('extracts projects from a homepage project collection without requiring a dedicated project index page', () => {
    const html = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Главная</h1>
    <section>
      <h2>Реализованные проекты</h2>
      <article>
        <h3><a href="/projects/jk-marmelad">ЖК "Мармелад"</a></h3>
        <p>Жилой комплекс в Минске.</p>
      </article>
      <article>
        <h3><a href="/projects/kvartal-magistr">Квартал «Магистр»</a></h3>
        <p>Жилой квартал.</p>
      </article>
    </section>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0)]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const home = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(home, 'home page classified');
    const projCol = home.collections.find((c) => c.type === 'CONTENT_COLLECTION' && c.contentSubtype === 'PROJECTS');
    assert.ok(projCol, 'homepage collection classified as PROJECTS');
    assert.ok(graph.projects.some((e) => e.title.includes('Мармелад')), 'project from homepage extracted');
    assert.ok(graph.projects.some((e) => e.title.includes('Магистр')), 'second project extracted');
  });

  it('distinguishes a product catalog from a project portfolio', () => {
    const catalogHtml = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Проекты домов</h1>
    <ul class="catalog">
      <li><a href="/catalog/proekt-100"><h3>Проект 100 м2</h3><p>Цена: от 5 000 руб.</p></a></li>
      <li><a href="/catalog/proekt-120"><h3>Проект 120 м2</h3><p>Купить за 6 000 $</p></a></li>
    </ul>
  </main>
</body></html>`;
    const portfolioHtml = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Наши объекты</h1>
    <ul class="portfolio">
      <li><a href="/objects/zhk-zelenyj-bor"><h3>ЖК «Зеленый Бор»</h3><p>Жилой комплекс в Минске</p></a></li>
      <li><a href="/objects/kvartal-pirs"><h3>Жилой квартал «Пирс»</h3><p>У моря</p></a></li>
    </ul>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([
      page('https://example.com/catalog/proekty-domov/', catalogHtml, 1),
      page('https://example.com/proekty/', portfolioHtml, 1),
    ]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.ok(graph.products.some((e) => e.title.includes('м2')), 'product catalog yields product entities');
    assert.ok(graph.projects.some((e) => e.title.includes('Зеленый Бор')), 'portfolio yields project entities');
    assert.ok(!graph.projects.some((e) => e.title.includes('м2')), 'product items not extracted as projects');
  });

  it('accepts external project links as valid project evidence', () => {
    const html = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Наши проекты</h1>
    <ul>
      <li><a href="https://partner.example/zhk-svetly">ЖК «Светлый»</a></li>
      <li><a href="https://external.example/kvartal-yasny">Жилой квартал «Ясный»</a></li>
    </ul>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/projects/', html, 1, { title: 'Наши проекты', h1: 'Наши проекты' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.ok(graph.projects.some((e) => e.title.includes('Светлый')), 'external-link project extracted');
    assert.ok(graph.projects.some((e) => e.title.includes('Ясный')), 'second external-link project extracted');
  });

  it('extracts projects from a project index without long descriptions when URLs or images are present', () => {
    const html = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Объекты</h1>
    <div class="object-grid">
      <a href="/objects/zhk-mayak" class="card"><img src="/img/mayak.jpg" alt=""><h3>ЖК «Маяк»</h3></a>
      <a href="/objects/zhk-vesna" class="card"><img src="/img/vesna.jpg" alt=""><h3>ЖК «Весна»</h3></a>
    </div>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/objects/', html, 1, { title: 'Наши объекты', h1: 'Объекты' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.equal(graph.projects.length, 2, 'two image-only project cards extracted');
  });

  it('merges detail page and index card pointing to the same canonical project URL', () => {
    const detailHtml = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>ЖК «Маяк»</h1>
    <section><p>Современный жилой комплекс в центре Минска.</p></section>
  </main>
</body></html>`;
    const indexHtml = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Наши объекты</h1>
    <ul>
      <li><a href="/projects/zhk-mayak/">ЖК «Маяк»</a></li>
    </ul>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([
      page('https://example.com/projects/zhk-mayak/', detailHtml, 2, { title: 'ЖК «Маяк» — проект', h1: 'ЖК «Маяк»' }),
      page('https://example.com/projects/', indexHtml, 1, { title: 'Наши проекты', h1: 'Наши проекты' }),
    ]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.equal(graph.projects.length, 1, 'detail and index card merged into one project');
    const project = graph.projects[0];
    assert.ok(project.sourceDocumentIds.length >= 1, 'project has source documents');
    assert.ok(project.title.includes('Маяк'), 'project title retained');
    assert.ok(project.description?.includes('Минск'), 'project description retained from detail page');
  });

  it('does not classify a generic page wrapper as a project or service collection', () => {
    const html = `<!DOCTYPE html>
<html lang="ru"><body>
  <header><nav><a href="/">Главная</a><a href="/about">О нас</a><a href="/services">Услуги</a></nav></header>
  <main id="content">
    <section><h2>О компании</h2><p>Мы строим...</p></section>
    <section><h2>Последние новости</h2><p>Открытие...</p></section>
  </main>
  <footer><p>Контакты</p></footer>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0)]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const home = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(home, 'home page classified');
    const badProject = home.collections.find((c) => c.type === 'CONTENT_COLLECTION' && c.contentSubtype === 'PROJECTS');
    const badService = home.collections.find((c) => c.type === 'CONTENT_COLLECTION' && c.contentSubtype === 'SERVICES');
    assert.ok(!badProject, 'generic wrapper not classified as PROJECTS');
    assert.ok(!badService, 'generic wrapper not classified as SERVICES');
  });

  it('extracts a neutral English homepage portfolio section as concrete projects', () => {
    const html = `<!DOCTYPE html>
<html lang="en"><body>
  <main>
    <h1>Home</h1>
    <section>
      <h2>Completed works</h2>
      <p>A selection of our latest projects.</p>
      <div class="portfolio">
        <article class="card">
          <a href="/projects/riverside-condos">
            <h3>Riverside Condos</h3>
            <p>12-story residential building.</p>
          </a>
        </article>
        <article class="card">
          <a href="/projects/central-plaza">
            <h3>Central Plaza</h3>
            <p>Mixed-use office and retail.</p>
          </a>
        </article>
      </div>
    </section>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0, { title: 'Example Construction', h1: 'Home' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const home = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(home, 'home page classified');
    const projCol = home.collections.find((c) => c.type === 'CONTENT_COLLECTION' && c.contentSubtype === 'PROJECTS');
    assert.ok(projCol, 'homepage portfolio classified as PROJECTS');
    assert.equal(graph.projects.length, 2, 'two concrete projects extracted');
    assert.ok(!graph.projects.some((e) => /Completed works/i.test(e.title)), 'collection heading is not a project');
  });

  it('extracts a neutral German homepage portfolio section as concrete projects', () => {
    const html = `<!DOCTYPE html>
<html lang="de"><body>
  <main>
    <h1>Startseite</h1>
    <section>
      <h2>Abgeschlossene Projekte</h2>
      <p>Eine Auswahl unserer Referenzen.</p>
      <div class="portfolio">
        <article class="card">
          <a href="/projekte/gewerbehalle-nord">
            <h3>Gewerbehalle Nord</h3>
            <p>Industriebau in Hamburg.</p>
          </a>
        </article>
        <article class="card">
          <a href="/projekte/einfamilienhaus-sued">
            <h3>Einfamilienhaus Süd</h3>
            <p>Neubau in München.</p>
          </a>
        </article>
      </div>
    </section>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0, { title: 'Beispiel Bau GmbH', h1: 'Startseite' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const home = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(home, 'home page classified');
    const projCol = home.collections.find((c) => c.type === 'CONTENT_COLLECTION' && c.contentSubtype === 'PROJECTS');
    assert.ok(projCol, 'German homepage portfolio classified as PROJECTS');
    assert.equal(graph.projects.length, 2, 'two German concrete projects extracted');
    assert.ok(!graph.projects.some((e) => /Abgeschlossene Projekte/i.test(e.title)), 'German collection heading is not a project');
  });

  it('extracts nested project groups without counting categories as projects', () => {
    const html = `<!DOCTYPE html>
<html lang="en"><body>
  <main>
    <h1>Our Projects</h1>
    <div class="project-grid">
      <h2>Residential</h2>
      <article class="card"><a href="/projects/object-a"><h3>Object A</h3></a></article>
      <article class="card"><a href="/projects/object-b"><h3>Object B</h3></a></article>
      <h2>Commercial</h2>
      <article class="card"><a href="/projects/object-c"><h3>Object C</h3></a></article>
    </div>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/projects/', html, 1, { title: 'Our Projects', h1: 'Our Projects' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.equal(graph.projects.length, 3, 'three concrete projects extracted');
    assert.ok(!graph.projects.some((e) => e.title.toLowerCase() === 'residential' || e.title.toLowerCase() === 'commercial'), 'category labels are not projects');
    const objA = graph.projects.find((e) => e.title.includes('Object A'));
    assert.ok(objA, 'Object A extracted');
    assert.equal(objA.category, 'Residential', 'Residential category assigned to Object A');
  });

  it('does not extract project category or status labels as concrete projects', () => {
    const html = `<!DOCTYPE html>
<html lang="ru"><body>
  <main>
    <h1>Проекты</h1>
    <div class="project-list">
      <div class="project"><h3>В процессе строительства</h3><p>Проекты, которые уже обретают форму.</p></div>
      <div class="project"><a href="/projects/zhk-green"><h3>ЖК «Зеленый»</h3></a></div>
      <div class="project"><a href="/projects/zhk-blue"><h3>ЖК «Синий»</h3></a></div>
    </div>
  </main>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/projects/', html, 1, { title: 'Проекты', h1: 'Проекты' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.equal(graph.projects.length, 2, 'two concrete projects extracted');
    assert.ok(!graph.projects.some((e) => e.title.includes('В процессе строительства')), 'status group label is not a project');
    const green = graph.projects.find((e) => e.title.includes('Зеленый'));
    assert.ok(green, 'ЖК Зеленый extracted');
    assert.ok(green.projectStatus?.includes('В процессе'), 'project has status group assigned');
  });

  it('extracts projects from a WPBakery-style portfolio grid on the homepage', () => {
    const html = `<!DOCTYPE html>
<html lang="ru"><body>
  <div id="fw_c" class="clearfix tf_single_page">
    <div class="vc_row wpb_row vc_row-fluid">
      <div class="vc_span12 wpb_column vc_column_container">
        <div class="wpb_wrapper">
          <h2>Примеры готовых работ</h2>
          <div class="wpb_text_column"><div class="wpb_wrapper"><p>Сделано с душой и навека</p></div></div>
          <div class="portfolio">
            <div class="portfolio_block image-grid columns4" id="list">
              <div class="element">
                <div class="port_thumb_ctn">
                  <a href="/project/esenina-19b"><img src="/img/esenina.jpg" alt=""></a>
                </div>
                <figcaption><div><h2>Ул. Есенина, д.19Б</h2></div></figcaption>
              </div>
              <div class="element">
                <div class="port_thumb_ctn">
                  <a href="/project/syrokomli-20"><img src="/img/syrokomli.jpg" alt=""></a>
                </div>
                <figcaption><div><h2>Ул. Владислава Сырокомли, д.20</h2></div></figcaption>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/', html, 0, { title: 'Example Construction', h1: '' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const home = graph.pages.find((p) => p.classification.type === 'HOME');
    assert.ok(home, 'home page classified');
    const projCol = home.collections.find((c) => c.type === 'CONTENT_COLLECTION' && c.contentSubtype === 'PROJECTS');
    assert.ok(projCol, 'WPBakery portfolio block classified as PROJECTS');
    assert.ok(graph.projects.length >= 2, 'at least two concrete address projects extracted');
    assert.ok(graph.projects.some((e) => e.title.includes('Есенина')), 'project by address extracted');
    assert.ok(graph.projects.some((e) => e.title.includes('Сырокомли')), 'project by address extracted');
  });

  it('merges NEWS_INDEX cards with NEWS_DETAIL pages by canonical URL', () => {
    const detailHtml = `<!DOCTYPE html><html lang="ru"><head><title>Открытие филиала</title></head><body><main>
      <h1>Открытие филиала</h1>
      <article><p>Мы открыли новый филиал в Гродно.</p></article>
    </main></body></html>`;
    const indexHtml = `<!DOCTYPE html><html lang="ru"><head><title>Новости</title></head><body><main>
      <h1>Новости компании</h1>
      <article><h2><a href="/novosti/otkrytie">Открытие филиала</a></h2></article>
    </main></body></html>`;
    const crawl = makeCrawlResult([
      page('https://example.com/', indexHtml, 0, { title: 'Новости' }),
      page('https://example.com/novosti/otkrytie', detailHtml, 1, { title: 'Открытие филиала', h1: 'Открытие филиала' }),
    ]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    const news = graph.news.filter((n) => n.title.includes('Открытие'));
    assert.equal(news.length, 1, 'index card and detail page are merged into one news entity');
    assert.ok(news[0].description, 'merged entity has a description from detail page');
  });

  it('does not extract investor/shareholder content as news', () => {
    const investorHtml = `<!DOCTYPE html><html lang="ru"><head><title>Годовое общее собрание акционеров</title></head><body><main>
      <h1>Годовое общее собрание акционеров ОАО «Пример»</h1>
      <p>Повестка и результаты голосования.</p>
    </main></body></html>`;
    const indexHtml = `<!DOCTYPE html><html lang="ru"><head><title>Новости</title></head><body><main>
      <h1>Новости</h1>
      <article><h2><a href="/novosti/sobranie">Годовое общее собрание акционеров</a></h2></article>
    </main></body></html>`;
    const crawl = makeCrawlResult([
      page('https://example.com/', indexHtml, 0, { title: 'Новости' }),
      page('https://example.com/novosti/sobranie', investorHtml, 1, { title: 'Годовое общее собрание акционеров', h1: 'Годовое общее собрание акционеров' }),
    ]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.equal(graph.news.length, 0, 'investor/shareholder page is not extracted as news');
  });

  it('keeps news dates unknown when no date evidence exists', () => {
    const detailHtml = `<!DOCTYPE html><html lang="ru"><head><title>Новое событие</title></head><body><main>
      <h1>Новое событие</h1>
      <article><p>Событие произошло.</p></article>
    </main></body></html>`;
    const crawl = makeCrawlResult([
      page('https://example.com/novosti/sobytie', detailHtml, 0, { title: 'Новое событие', h1: 'Новое событие' }),
    ]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.equal(graph.news.length, 1);
    assert.equal(graph.news[0].date, null, 'date stays null when no evidence exists');
    assert.ok(graph.news[0].evidence.some((e) => e.type === 'no-date'), 'provenance explains missing date');
  });

  it('uses LLM fallback provider with evidence when no API key is configured', () => {
    const provider = createSemanticProvider({ type: 'llm-fallback', llmFallbackThreshold: 1.0 });
    assert.equal(provider.name, 'llm-fallback');
    const homeHtml = `<!DOCTYPE html><html lang="ru"><head><title>О компании</title></head><body><main><h1>О компании</h1><p>Мы строим дома.</p></main></body></html>`;
    const crawl = makeCrawlResult([page('https://example.com/o-kompanii', homeHtml, 0, { title: 'О компании', h1: 'О компании' })]);
    const sourceDocuments = buildSourceDocuments(crawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/', provider });
    const about = graph.pages.find((p) => p.classification.type === 'ABOUT');
    assert.ok(about, 'page classified using rule-based fallback');
    assert.ok(about.classification.evidence.some((e) => e.type === 'llm-fallback' || e.type === 'llm-evidence'), 'LLM evidence recorded');
  });

  it('extracts facts sanity fields from structured data', () => {
    const sourceDocuments = buildSourceDocuments(sampleCrawl);
    const graph = buildSourceContentGraph({ sourceDocuments, baseUrl: 'https://example.com/' });
    assert.ok(graph.company, 'company extracted');
    assert.ok(graph.company.title, 'company title extracted');
    assert.ok(graph.company.legalName || graph.company.title, 'legal name or title present');
    assert.ok(graph.facts.some((f) => f.type === 'FOUNDING_DATE' && f.value.includes('2010')), 'founded year extracted');
    assert.ok(graph.facts.some((f) => f.type === 'EMPLOYEE_COUNT' && /200|201/.test(f.value)), 'employee count extracted');
    assert.ok(graph.contacts, 'contacts entity extracted');
    assert.ok(graph.contacts.phones.some((p) => p.value.includes('+375')), 'phone extracted');
    assert.ok(graph.contacts.emails.some((e) => e.value.includes('@')), 'email extracted');
    assert.ok(graph.contacts.addresses.some((a) => a.value.includes('Минск')), 'address extracted');
  });
});
