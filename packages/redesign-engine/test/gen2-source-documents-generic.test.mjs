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

function docFor(html, overrides = {}) {
  const [doc] = buildSourceDocuments(makeCrawlResult(html, overrides));
  return doc;
}

describe('Source document extraction — generic structural invariants', () => {
  it('separates header/footer chrome from main content', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Acme Corp</title></head>
<body>
  <header><a href="/"><img src="/logo.png" alt="Acme"></a><nav><a href="/about">About</a></nav></header>
  <main>
    <h1>Welcome</h1>
    <p>Main content paragraph.</p>
  </main>
  <footer><p>Footer contact info 1-800-555-5555</p></footer>
</body></html>`;
    const doc = docFor(html);
    assert.ok(doc.chrome.header.text.includes('Acme') || doc.chrome.header.links.some(l => l.text === 'About'), 'header links captured');
    assert.ok(doc.chrome.footer.text.includes('Footer'), 'footer text captured');
    const mainText = doc.mainText || doc.sections.map(s => s.paragraphs.join(' ')).join(' ');
    assert.ok(!mainText.includes('Footer'), 'footer text did not leak into main');
    assert.ok(!mainText.includes('Acme') || mainText === 'Welcome Main content paragraph.', 'header chrome separated from main');
    assert.ok(doc.sections.length > 0, 'main sections produced');
  });

  it('preserves heading-to-paragraph associations in nested sections', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Nested</title></head>
<body>
  <main>
    <h1>Top level</h1>
    <p>Top paragraph.</p>
    <section>
      <h2>Section A</h2>
      <p>Section A paragraph.</p>
      <h3>Subsection A1</h3>
      <p>A1 paragraph.</p>
    </section>
    <section>
      <h2>Section B</h2>
      <p>Section B paragraph.</p>
    </section>
  </main>
</body></html>`;
    const doc = docFor(html);
    const headings = doc.sections.map(s => s.heading).filter(Boolean);
    assert.ok(headings.includes('Section A'));
    assert.ok(headings.includes('Subsection A1'));
    assert.ok(headings.includes('Section B'));
    const a = doc.sections.find(s => s.heading === 'Section A');
    assert.ok(a.paragraphs.some(p => p.includes('Section A paragraph.')));
    const a1 = doc.sections.find(s => s.heading === 'Subsection A1');
    assert.ok(a1.paragraphs.some(p => p.includes('A1 paragraph.')));
  });

  it('detects repeated card collections by structure, not language classes', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Cards</title></head>
<body>
  <main>
    <section>
      <article><h3>Service One</h3><p>First service.</p><a href="/s1">Details</a></article>
      <article><h3>Service Two</h3><p>Second service.</p><a href="/s2">Details</a></article>
      <article><h3>Service Three</h3><p>Third service.</p><a href="/s3">Details</a></article>
    </section>
  </main>
</body></html>`;
    const doc = docFor(html);
    assert.ok(doc.collections.length >= 1, 'collection detected');
    const col = doc.collections.find(c => c.items.length >= 3);
    assert.ok(col, 'collection has at least 3 items');
    const titles = col.items.map(i => i.title);
    assert.ok(titles.includes('Service One'));
    assert.ok(titles.includes('Service Two'));
    assert.ok(titles.includes('Service Three'));
  });

  it('preserves list-based news collections with dates and URLs', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>News</title></head>
<body>
  <main>
    <h1>Latest news</h1>
    <ul>
      <li><a href="/news/alpha">Alpha update</a><time datetime="2025-01-15">Jan 15</time><p>Alpha description.</p></li>
      <li><a href="/news/beta">Beta release</a><time datetime="2025-02-10">Feb 10</time><p>Beta description.</p></li>
    </ul>
  </main>
</body></html>`;
    const doc = docFor(html);
    assert.ok(doc.collections.length >= 1, 'news list detected');
    const col = doc.collections.find(c => c.items.length >= 2);
    assert.ok(col, 'collection has two items');
    const titles = col.items.map(i => i.title);
    assert.ok(titles.includes('Alpha update'));
    assert.ok(titles.includes('Beta release'));
    const alpha = col.items.find(i => i.title === 'Alpha update');
    assert.strictEqual(alpha.url, 'https://example.com/news/alpha');
  });

  it('retains JSON-LD structured data and extracts date evidence', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Article</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Deep Dive","datePublished":"2025-03-20"}</script>
</head>
<body>
  <main>
    <article>
      <h1>Deep Dive</h1>
      <p>Article body.</p>
    </article>
  </main>
</body></html>`;
    const doc = docFor(html);
    assert.strictEqual(doc.structuredData.length, 1);
    assert.strictEqual(doc.structuredData[0].headline, 'Deep Dive');
    const date = doc.evidence.dates.find(d => d.text === '2025-03-20');
    assert.ok(date, 'JSON-LD date extracted');
  });

  it('captures nested navigation hierarchy from nav lists', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Nav</title></head>
<body>
  <header>
    <nav>
      <ul>
        <li><a href="/products">Products</a>
          <ul>
            <li><a href="/products/a">Product A</a></li>
            <li><a href="/products/b">Product B</a></li>
          </ul>
        </li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>
  <main><h1>Home</h1></main>
</body></html>`;
    const doc = docFor(html);
    const primary = doc.chrome.nav.primary;
    assert.ok(primary.length >= 1, 'primary nav captured');
    const products = primary.find(n => n.label === 'Products');
    assert.ok(products, 'products top-level nav found');
    assert.ok(products.children && products.children.some(c => c.label === 'Product A'), 'nested children preserved');
  });

  it('preserves image provenance and distinguishes main from chrome images', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Images</title></head>
<body>
  <header><img src="/logo.png" alt="Logo"></header>
  <main>
    <h1>Gallery</h1>
    <img src="/hero.jpg" alt="Hero">
    <p>Description.</p>
  </main>
</body></html>`;
    const doc = docFor(html);
    const logo = doc.images.find(i => i.src === 'https://example.com/logo.png');
    assert.ok(logo, 'logo image found');
    assert.ok(['header', 'nav'].includes(logo.region), 'logo assigned to chrome region');
    const hero = doc.images.find(i => i.src === 'https://example.com/hero.jpg');
    assert.ok(hero, 'hero image found');
    assert.strictEqual(hero.region, 'main');
    assert.strictEqual(hero.provenance.sourcePageUrl, 'https://example.com/');
  });

  it('ignores cookie/consent banners and modal dialogs in main content', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Consent</title></head>
<body>
  <div class="cookie-banner">Accept cookies</div>
  <main><h1>Home</h1><p>Real content.</p></main>
  <div role="dialog" class="modal">Subscribe</div>
</body></html>`;
    const doc = docFor(html);
    const mainText = doc.mainText || doc.sections.map(s => s.paragraphs.join(' ')).join(' ');
    assert.ok(!mainText.includes('cookie') && !mainText.includes('Subscribe'), 'noise removed');
    assert.ok(mainText.includes('Real content'));
  });
});
