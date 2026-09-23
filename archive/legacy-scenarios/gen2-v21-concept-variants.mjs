// V2.1 vertical slice — produce 3 source-grounded concepts per benchmark client.
// Writes artifacts under data/redesign/v21 and renders them via construction-modern-v1.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

// Built engine + template outputs
import { buildCustomerProblemBrief } from '../packages/redesign-engine/dist/plan/customerProblemBrief.js';
import { generateConcepts, validateConceptDiversity } from '../packages/redesign-engine/dist/plan/conceptSpec.js';
import { planToContentForConcept } from '../packages/redesign-engine/dist/plan/planToContentForConcept.js';
import { constructionModernV1 } from '../packages/templates/dist/index.js';

const CLIENTS = ['lishen', 'puzzlehouse', 'sdke'];
const OUT = 'data/redesign/v21';
const PORT = 4003;

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function startStaticServer() {
  const staticRoot = path.resolve(OUT);
  const templateRoot = path.resolve('packages/templates/dist/construction-modern-v1/public');
  const server = http.createServer((req, res) => {
    let filePath = '';
    if (req.url.startsWith('/template-assets/construction-modern-v1/')) {
      filePath = path.join(templateRoot, req.url.replace('/template-assets/construction-modern-v1/', ''));
    } else {
      filePath = path.join(staticRoot, req.url.replace(/^\/+/, ''));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    }
    if (!filePath.startsWith(staticRoot) && !filePath.startsWith(templateRoot)) {
      res.writeHead(403).end(); return;
    }
    try {
      if (!fs.existsSync(filePath)) { res.writeHead(404).end(); return; }
      const ext = path.extname(filePath);
      const ct = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      fs.createReadStream(filePath).pipe(res);
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  return server;
}

async function renderHtml(plan, concept, client) {
  const content = planToContentForConcept(plan, concept);
  const mediaMap = new Map();
  for (const m of content.media || []) {
    const item = { ...m, id: m.sourceUrl || m.filename };
    if (m.sourceUrl) mediaMap.set(m.sourceUrl, item);
    mediaMap.set(item.id, item);
  }

  const site = { id: `v21-${client}-${concept.id}`, previewToken: '', name: content.company?.name || client, domain: new URL(plan.baseUrl).hostname };

  const ctx = {
    site,
    settings: { ...content.company, companyName: content.company?.name },
    theme: content.theme,
    hero: content.hero,
    about: content.about,
    cta: content.cta,
    logo: content.branding?.logo,
    favicon: undefined,
    homepageSections: content.homepageSections,
    pages: content.pages || [],
    services: (content.services || []).map((s) => ({ ...s, imageId: s.image?.sourceUrl })),
    projects: (content.projects || []).map((p) => ({ ...p, coverImageId: p.coverImage?.sourceUrl, projectMedia: (p.gallery || []).map((g, i) => ({ sortOrder: i, media: { id: g?.sourceUrl, sourceUrl: g?.sourceUrl, filename: g?.filename } })) })),
    products: (content.products || []).map((p) => ({ ...p, coverImageId: p.coverImage?.sourceUrl, productMedia: (p.gallery || []).map((g, i) => ({ sortOrder: i, media: { id: g?.sourceUrl, sourceUrl: g?.sourceUrl, filename: g?.filename } })) })),
    news: content.news || [],
    vacancies: content.vacancies || [],
    menu: [],
    mediaMap,
    route: '',
    subRoute: '',
    stylePreset: concept.visual.stylePreset,
  };

  const html = constructionModernV1(ctx);
  return { html, content };
}

async function screenshot(browser, url, outPath, viewport) {
  const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: outPath, fullPage: true });
  } catch (e) {
    console.error(`  screenshot failed for ${url}: ${e.message}`);
    // still write a placeholder
    await page.screenshot({ path: outPath, fullPage: false }).catch(() => {});
  } finally { await page.close(); }
}

async function main() {
  const results = [];
  mkdirp(OUT);
  const server = await startStaticServer();
  const browser = await chromium.launch();

  try {
    for (const client of CLIENTS) {
      const planPath = `data/redesign/pilot-2b/${client}/site-content-plan-v2.json`;
      const plan = JSON.parse(await fsp.readFile(planPath, 'utf8'));
      const brief = buildCustomerProblemBrief(plan);
      const concepts = generateConcepts(plan, brief);
      const { ok, fails } = validateConceptDiversity(concepts);

      const clientDir = path.join(OUT, client);
      mkdirp(clientDir);
      await fsp.writeFile(path.join(clientDir, 'customer-problem-brief.json'), JSON.stringify(brief, null, 2));
      await fsp.writeFile(path.join(clientDir, 'concepts.json'), JSON.stringify({ concepts, diversity: { ok, fails } }, null, 2));

      for (const concept of concepts) {
        const conceptDir = path.join(clientDir, concept.id);
        mkdirp(conceptDir);
        const { html } = await renderHtml(plan, concept, client);
        await fsp.writeFile(path.join(conceptDir, 'index.html'), html);

        const url = `http://127.0.0.1:${PORT}/${client}/${concept.id}/`;
        await screenshot(browser, url, path.join(conceptDir, 'desktop.png'), { width: 1440, height: 900 });
        await screenshot(browser, url, path.join(conceptDir, 'mobile.png'), { width: 390, height: 844 });
        results.push({ client, concept: concept.id, url });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  await fsp.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(results, null, 2));
  console.log(`V2.1 generated ${results.length} variants in ${OUT}`);
  for (const r of results) console.log(`  ${r.client} / ${r.concept}: ${r.url}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
