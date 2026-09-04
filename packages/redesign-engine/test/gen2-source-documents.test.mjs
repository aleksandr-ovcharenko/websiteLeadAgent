import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSourceDocuments, sourceDocumentToCrawledPage } from '../dist/extract/buildSourceDocuments.js';

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
      images: [{ src: '/logo.png', alt: 'Logo', width: 120, height: 60, likelyLogo: true, likelyHero: false }],
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

const sampleHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <title>Example</title>
  <meta name="description" content="Example description">
  <link rel="canonical" href="https://example.com/">
  <meta property="og:title" content="Open Graph Title">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Example Co","telephone":"+375 17 000 00 00","address":{"streetAddress":"ул. Примерная, 1","addressLocality":"Минск"},"foundingDate":"2010"}</script>
</head>
<body>
  <header>
    <a href="/"><img src="/logo.png" alt="Logo"></a>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
    <span class="phone">+375 17 000 00 00</span>
  </header>
  <main>
    <h1>Welcome</h1>
    <p>First paragraph of main content.</p>
    <section class="services">
      <h2>Our services</h2>
      <ul class="service-list">
        <li>
          <a href="/service-a">Service A</a>
          <p>Description for service A.</p>
        </li>
        <li>
          <a href="/service-b">Service B</a>
          <p>Description for service B.</p>
        </li>
      </ul>
    </section>
  </main>
  <footer>
    <a href="/contacts">Contacts</a>
    <p>г. Минск, ул. Примерная, 1</p>
  </footer>
</body>
</html>`;

describe('Source document extraction', () => {
  it('separates chrome from main content and captures provenance', () => {
    const docs = buildSourceDocuments(makeCrawlResult(sampleHtml));
    assert.equal(docs.length, 1);
    const doc = docs[0];

    assert.equal(doc.url, 'https://example.com/');
    assert.equal(doc.language, 'ru');
    assert.equal(doc.chrome.logo?.src, 'https://example.com/logo.png');
    assert.ok(doc.chrome.header, 'header chrome extracted');
    assert.ok(doc.chrome.footer, 'footer chrome extracted');
    assert.ok(doc.chrome.nav?.primary?.length >= 2, 'primary nav extracted');
    assert.ok(doc.chrome.contacts?.phones?.includes('+375 17 000 00 00'), 'phone extracted from chrome');

    const main = doc.sections.find((s) => s.heading === 'Welcome');
    assert.ok(main, 'main heading section captured');
    assert.ok(main.paragraphs.some((p) => p.includes('First paragraph')), 'main paragraph captured');

    const servicesSection = doc.sections.find((s) => s.heading === 'Our services');
    assert.ok(servicesSection, 'services heading captured');

    const images = doc.images;
    const logo = images.find((i) => i.src === 'https://example.com/logo.png');
    assert.ok(logo, 'logo image captured');
    assert.equal(logo.region, 'header');
    assert.equal(logo.provenance.isLogo, true);
    assert.equal(logo.provenance.sourcePageUrl, 'https://example.com/');
  });

  it('detects repeated card-like collections generically', () => {
    const docs = buildSourceDocuments(makeCrawlResult(sampleHtml));
    const doc = docs[0];
    const services = doc.collections.find((c) => c.typeCandidate === 'services');
    assert.ok(services, 'services collection detected');
    assert.equal(services.items.length, 2, 'two service cards detected');
    const titles = services.items.map((i) => i.title).sort();
    assert.deepEqual(titles, ['Service A', 'Service B']);
    assert.ok(services.items.every((i) => i.url && i.description), 'cards have url and description');
  });

  it('preserves structured data and date/company evidence candidates', () => {
    const docs = buildSourceDocuments(makeCrawlResult(sampleHtml));
    const doc = docs[0];

    assert.equal(doc.structuredData.length, 1);
    assert.equal(doc.structuredData[0]['@type'], 'LocalBusiness');
    assert.equal(doc.structuredData[0].name, 'Example Co');

    assert.ok(doc.openGraph['og:title'], 'OpenGraph preserved');

    const company = doc.evidence.companyNameCandidates.find((c) => c.text === 'Example Co');
    assert.ok(company, 'company name candidate from JSON-LD');
    assert.ok(doc.evidence.addressCandidates.some((a) => a.includes('Минск')), 'address candidate found');
    const founding = doc.evidence.dates.find((d) => d.text === '2010');
    assert.ok(founding, 'date candidate from JSON-LD foundingDate');
  });

  it('converts source documents back into crawl-compatible pages', () => {
    const docs = buildSourceDocuments(makeCrawlResult(sampleHtml));
    const page = sourceDocumentToCrawledPage(docs[0]);
    assert.equal(page.url, 'https://example.com/');
    assert.equal(page.title, 'Example');
    assert.equal(page.h1, 'Welcome');
    assert.ok(page.text.includes('First paragraph'), 'mainText becomes crawl text');
    assert.ok(page.links.some((l) => l.href === 'https://example.com/about'), 'links normalized');
    assert.ok(page.images.some((i) => i.src === 'https://example.com/logo.png' && i.likelyLogo), 'image provenance preserved');
    assert.ok(page.headerNav && page.headerNav.length >= 2, 'header nav preserved');
  });
});
