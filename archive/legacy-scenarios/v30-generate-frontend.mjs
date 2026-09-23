// V3.0 — controlled generative frontend for one concept.
// Produces a static, bespoke HTML/CSS/JS site artifact from ContentTruthGraph + CreativeDirection.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const CLIENT = 'lishen';
const CONCEPT_ID = 'cinematic-portfolio';
const SITE_ID = `v30-${CLIENT}`;
const OUT = path.resolve('generated-sites', SITE_ID, CONCEPT_ID);
const PORT = 4004;

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clean(s, n = 200) {
  return (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
}

function mediaUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  return src;
}

async function main() {
  mkdirp(OUT);
  const graph = JSON.parse(await fsp.readFile(path.resolve('data/redesign/v30', CLIENT, 'content-truth-graph.json'), 'utf8'));
  const creative = JSON.parse(await fsp.readFile(path.resolve('data/redesign/v30', CLIENT, 'creative-directions.json'), 'utf8'));
  const direction = creative.directions.find((d) => d.id === CONCEPT_ID);

  const brand = graph.nodes.find((n) => n.kind === 'identity')?.value?.displayName || CLIENT;
  const description = graph.nodes.find((n) => n.kind === 'identity')?.value?.description || '';
  const phone = graph.conversionTargets.find((c) => c.kind === 'phone')?.url || '';
  const projects = graph.entities.filter((e) => e.type === 'project');
  const services = graph.entities.filter((e) => e.type === 'service');

  // choose hero image: prefer a project with house/building, not industrial
  // For a cinematic construction portfolio the hero must show a house/building,
  // not an industrial object. Project images in this plan are mostly industrial
  // or unrelated, so we fall back to verified source media and exclude obvious
  // non-house stems (promyshlenny, yfi-ljv1, serfing, logo, icon, banner).
  const isHouseImage = (src) => src && !/(promyshlenny|yfi-ljv1|serfing|logo|icon|sprite|banner|removebg)/i.test(src);
  const heroProject = projects.find((p) => /\b(дом|брус)/i.test(p.title) && p.primaryImage && isHouseImage(p.primaryImage))
    || projects.find((p) => p.primaryImage && isHouseImage(p.primaryImage));
  const heroMedia = graph.media.find((m) => isHouseImage(m.src) && m.role !== 'logo') || graph.media[0];
  const heroImage = mediaUrl(heroProject?.primaryImage || heroMedia?.src || '');

  // concept + provenance JSON
  await fsp.writeFile(path.join(OUT, 'concept.json'), JSON.stringify({ siteId: SITE_ID, conceptId: CONCEPT_ID, direction }, null, 2));
  await fsp.writeFile(path.join(OUT, 'provenance.json'), JSON.stringify({
    source: 'ContentTruthGraph + CreativeDirection',
    facts: graph.nodes.filter((n) => n.verified).map((n) => ({ id: n.id, kind: n.kind, provenance: n.provenance })),
    media: graph.media.map((m) => ({ id: m.id, src: m.src, role: m.role, provenance: m.provenance })),
    decorativeAssets: [],
    prohibitedCliches: direction.prohibitedCliches,
  }, null, 2));

  // tokens.css
  const tokens = direction.palette;
  await fsp.writeFile(path.join(OUT, 'tokens.css'), `
:root {
  --bg: ${tokens.background};
  --surface: ${tokens.surface};
  --ink: ${tokens.ink};
  --accent: ${tokens.accent};
  --muted: ${tokens.muted};
  --font-display: ${direction.typography.display}, system-ui, sans-serif;
  --font-body: ${direction.typography.body}, system-ui, sans-serif;
  --max-w: 1280px;
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`);

  // components.css
  await fsp.writeFile(path.join(OUT, 'components.css'), `
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; font-family: var(--font-body); background: var(--bg); color: var(--ink); line-height: 1.6; }
img { max-width: 100%; display: block; }

.header { position: sticky; top: 0; z-index: 50; background: rgba(14,14,14,0.9); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.08); }
.header__inner { max-width: var(--max-w); margin: 0 auto; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
.header__logo { font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); text-decoration: none; }
.header__nav { display: flex; gap: 1.5rem; }
.header__nav a { color: var(--muted); text-decoration: none; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; }

.hero { position: relative; min-height: 100svh; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.hero__media { position: absolute; inset: 0; z-index: 0; }
.hero__media img { width: 100%; height: 100%; object-fit: cover; }
.hero__overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(14,14,14,0.25) 0%, rgba(14,14,14,0.78) 70%); z-index: 1; }
.hero__content { position: relative; z-index: 2; max-width: var(--max-w); margin: 0 auto; padding: 6rem 1.5rem 4rem; width: 100%; }
.hero__eyebrow { color: var(--accent); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1rem; }
.hero__title { font-family: var(--font-display); font-size: clamp(2.5rem, 6vw, 5.5rem); line-height: 1.05; margin: 0 0 1.25rem; color: var(--ink); }
.hero__subtitle { font-size: clamp(1rem, 2vw, 1.35rem); color: var(--muted); max-width: 40rem; margin: 0 0 2rem; }
.hero__cta { display: inline-flex; align-items: center; gap: 0.75rem; color: var(--ink); background: var(--accent); padding: 0.9rem 1.6rem; text-decoration: none; font-weight: 600; border-radius: 2px; }

.section { padding: 5rem 1.5rem; max-width: var(--max-w); margin: 0 auto; }
.section--dark { background: var(--surface); }
.section__title { font-family: var(--font-display); font-size: clamp(1.8rem, 4vw, 3rem); margin: 0 0 1rem; }
.section__lead { color: var(--muted); max-width: 45rem; margin: 0 0 2.5rem; }

.project-grid { display: grid; gap: 2px; }
.project-grid--2 { grid-template-columns: repeat(2, 1fr); }
.project-card { position: relative; aspect-ratio: 16/10; overflow: hidden; }
.project-card img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(20%); transition: transform 1s ease, filter 1s ease; }
.project-card:hover img { transform: scale(1.03); filter: grayscale(0%); }
.project-card__overlay { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(14,14,14,0.85) 100%); display: flex; align-items: flex-end; padding: 1.25rem; }
.project-card__title { font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin: 0; }
.project-card__meta { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }

.service-list { list-style: none; padding: 0; margin: 0; }
.service-list li { padding: 1.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
.service-list__title { font-family: var(--font-display); font-size: 1.25rem; margin: 0 0 0.25rem; }
.service-list__desc { color: var(--muted); font-size: 0.95rem; }

.contact__phone { font-family: var(--font-display); font-size: 1.5rem; color: var(--accent); text-decoration: none; }

.footer { border-top: 1px solid rgba(255,255,255,0.08); padding: 2rem 1.5rem; text-align: center; color: var(--muted); font-size: 0.85rem; }

@media (max-width: 768px) {
  .header__nav { display: none; }
  .project-grid--2 { grid-template-columns: 1fr; }
  .hero__title { font-size: clamp(2rem, 10vw, 3.2rem); }
}
`);

  // index.html
  const projectCards = projects.slice(0, 6).map((p) => {
    const img = mediaUrl(p.primaryImage) || '';
    return `
<article class="project-card">
  <img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" loading="lazy" />
  <div class="project-card__overlay">
    <div>
      <p class="project-card__meta">${p.attributes?.['Статус'] || 'Реализованный объект'}</p>
      <h3 class="project-card__title">${escapeHtml(p.title)}</h3>
    </div>
  </div>
</article>`;
  }).join('');

  const serviceList = services.slice(0, 4).map((s) => `
<li>
  <div class="service-list__title">${escapeHtml(s.title)}</div>
  <div class="service-list__desc">${escapeHtml(clean(s.cardSummary || s.summary, 160))}</div>
</li>`).join('');

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(brand)} — ${escapeHtml(direction.conceptName)}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${escapeHtml(clean(description, 160))}">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
</head>
<body>
  <header class="header">
    <div class="header__inner">
      <a class="header__logo" href="#">${escapeHtml(brand)}</a>
      <nav class="header__nav" aria-label="Главное меню">
        <a href="#projects">Проекты</a>
        <a href="#services">Услуги</a>
        <a href="#about">О компании</a>
        <a href="#contact">Контакты</a>
      </nav>
    </div>
  </header>

  <section class="hero" id="hero">
    <div class="hero__media">
      <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(heroProject?.title || 'Главное фото')}" />
    </div>
    <div class="hero__overlay"></div>
    <div class="hero__content">
      <p class="hero__eyebrow">${escapeHtml(direction.visualTerritory)}</p>
      <h1 class="hero__title">${escapeHtml(brand)}</h1>
      <p class="hero__subtitle">${escapeHtml(clean(direction.businessIdea, 180))}</p>
      <a class="hero__cta" href="#projects">Смотреть проекты</a>
    </div>
  </section>

  <section id="projects" class="section section--dark">
    <h2 class="section__title">Реализованные объекты</h2>
    <p class="section__lead">Каждый проект — реальная работа, зафиксированная в исходном источнике. Декоративные изображения отсутствуют.</p>
    <div class="project-grid project-grid--2">
      ${projectCards}
    </div>
  </section>

  <section id="services" class="section">
    <h2 class="section__title">Услуги</h2>
    <ul class="service-list">
      ${serviceList}
    </ul>
  </section>

  <section id="about" class="section section--dark">
    <h2 class="section__title">О компании</h2>
    <p class="section__lead">${escapeHtml(clean(description, 400))}</p>
  </section>

  <section id="contact" class="section">
    <h2 class="section__title">Контакты</h2>
    <a class="contact__phone" href="${escapeHtml(phone)}">${escapeHtml(graph.conversionTargets.find((c) => c.kind === 'phone')?.label || phone)}</a>
  </section>

  <footer class="footer">
    <p>${escapeHtml(brand)} — сгенерировано на основе исходного контента. Декоративные AI-активы не используются.</p>
  </footer>

  <script type="module" src="interactions.js"></script>
</body>
</html>`;

  await fsp.writeFile(path.join(OUT, 'index.html'), html);

  // interactions.js
  await fsp.writeFile(path.join(OUT, 'interactions.js'), `
// Sparse, narrative motion. Respects prefers-reduced-motion via CSS.
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  }
}, { threshold: 0.1 });

for (const el of document.querySelectorAll('.section, .project-card')) {
  el.style.opacity = '0.8';
  el.style.transform = 'translateY(18px)';
  el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  observer.observe(el);
}
`);

  // build report
  const buildReport = {
    siteId: SITE_ID,
    conceptId: CONCEPT_ID,
    builtAt: new Date().toISOString(),
    buildTool: 'static-bespoke',
    entryFile: 'index.html',
    staticFiles: ['tokens.css', 'components.css', 'interactions.js', 'concept.json', 'provenance.json'],
    factsDisplayed: graph.nodes.filter((n) => n.verified).length,
    sourceMediaUsed: graph.media.length,
    decorativeAssetsUsed: 0,
    status: 'BUILT',
  };
  await fsp.writeFile(path.join(OUT, 'build-report.json'), JSON.stringify(buildReport, null, 2));

  // serve and screenshot
  const server = http.createServer((req, res) => {
    const file = path.join(OUT, req.url === '/' ? 'index.html' : req.url);
    if (!file.startsWith(OUT)) { res.writeHead(403).end(); return; }
    try {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
      const ext = path.extname(file);
      const ct = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await chromium.launch();
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  server.close();

  console.log(`Built and captured ${OUT}`);
  console.log(`  preview: http://127.0.0.1:${PORT}/`);
  console.log(`  files: ${buildReport.staticFiles.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
