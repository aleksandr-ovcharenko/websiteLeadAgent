#!/usr/bin/env node
// V3.7.2 Phase 13 — failure-fixture generation run.
//
// Builds an in-memory-style crawl artifact containing every defect class the
// gates must catch, runs the REAL pipeline (generateSite) against it, and
// records expected vs actual gate outcomes.
//
// Fixture defects:
//   1. visible-looking serialized form JSON on the homepage
//   2. responsive duplicate sections (desktop/mobile twins)
//   3. one very long Russian H1
//   4. decorative SVG hero candidate + one real photograph
//   5. news without publication dates
//   6. one homepage news teaser
//   7. one orphan list (no heading)
//   8. a deliberately broken entity route: news detail at /news/konflikt whose
//      slug collides with the service at /uslugi/konflikt → route conflict
//
// Expected: the run must NOT reach HUMAN_REVIEW_READY.

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { generateSite } from '../packages/redesign-engine/dist/pipeline/index.js';

const BASE = 'data/redesign/v372/failure-fixture';
const DOM = 'https://fixture-v372.example';
const PHOTO = 'http://localhost:3336/site-media/cmubaafs8005p3zwyndu5yps2/21ae35263c54ea4f-karkasniy-dom-st-veragi-4.jpg';
const SVG = `${DOM}/img/logo-circle.svg`;
const LONG_H1 = 'Компания «Фикстура» выполняет полный комплекс строительных и отделочных работ любой сложности для частных и коммерческих заказчиков по всей территории региона с гарантией качества';

const page = (url, path, h1, html, extra = {}) => ({
  url, requestedUrl: url, finalUrl: url,
  title: h1, metaDescription: '', h1, canonicalUrl: url,
  text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  html,
  links: [], images: [], path, depth: 0, ...extra,
});

const nav = [{ label: 'Главная', url: '/' }, { label: 'Новости', url: '/news' }, { label: 'Контакты', url: '/kontakty' }];

const crawl = {
  meta: { runId: 'fixture', leadId: 'fixture', startUrl: DOM + '/', startedAt: new Date().toISOString(), maxPages: 10, maxDepth: 3, timeoutMs: 30000 },
  homepage: { url: DOM + '/', score: 1, reasons: ['fixture'] },
  warnings: [],
  skipped: [],
  navigation: nav,
  pages: [
    page(DOM + '/', '/', LONG_H1, `
      <html><body>
      <header><nav><a href="/">Главная</a><a href="/news">Новости</a><a href="/kontakty">Контакты</a></nav></header>
      <main>
        <section class="hero">
          <h1>${LONG_H1}</h1>
          <img src="${SVG}" alt="logo decorative circle" width="48" height="48">
          <img src="${PHOTO}" alt="Строительство каркасного дома" width="1600" height="1000">
          <p>Строим надёжные дома и коммерческие объекты.</p>
        </section>
        <section class="desktop-only"><h2>Наши преимущества</h2><ul><li>Опыт 15 лет</li><li>Собственное производство</li></ul></section>
        <section class="mobile-only"><h2>Наши преимущества</h2><ul><li>Опыт 15 лет</li><li>Собственное производство</li></ul></section>
        <section><h2>Новости</h2><article><a href="/news/konflikt">Конфликтная новость</a><p>Тизер первой новости.</p></article></section>
        <section><ul><li>Качество материалов</li><li>Сроки по договору</li><li>Фиксированная смета</li></ul></section>
        <div class="t-form js-form-proccess">{"fields":[{"name":"phone","label":"Телефон","type":"phone"},{"name":"name","label":"Имя"}],"successPage":"","formId":"form123","title":"Заявка"}</div>
      </main></body></html>`,
      { isHomepage: true }),
    page(DOM + '/news', '/news', 'Новости', `
      <html><body><main>
        <h1>Новости</h1>
        <article><a href="/news/konflikt">Конфликтная новость</a><p>Тизер первой новости.</p></article>
        <article><a href="/news/vtoraya">Вторая новость без даты</a><p>Тизер второй новости.</p></article>
      </main></body></html>`),
    page(DOM + '/news/konflikt', '/news/konflikt', 'Конфликтная новость', `
      <html><body><main><article>
        <h1>Конфликтная новость</h1>
        <p>Компания завершила очередной этап работ на объекте. Подробности в материале статьи с достаточным количеством текста.</p>
      </article></main></body></html>`),
    page(DOM + '/news/vtoraya', '/news/vtoraya', 'Вторая новость без даты', `
      <html><body><main><article>
        <h1>Вторая новость без даты</h1>
        <p>Ещё одна публикация компании, в которой нет даты и не должно появиться сфабрикованной.</p>
      </article></main></body></html>`),
    // Same slug as the news above → route conflict when the service imports.
    page(DOM + '/uslugi/konflikt', '/uslugi/konflikt', 'Услуга конфликт', `
      <html><body><main>
        <h1>Услуга конфликт</h1>
        <p>Профессиональная услуга с детальным описанием работ и достаточным объёмом текста для классификации как услуга.</p>
      </main></body></html>`),
    page(DOM + '/uslugi', '/uslugi', 'Услуги', `
      <html><body><main>
        <h1>Услуги</h1>
        <article><a href="/uslugi/konflikt">Услуга конфликт</a><p>Описание услуги.</p></article>
      </main></body></html>`),
    page(DOM + '/kontakty', '/kontakty', 'Контакты', `
      <html><body><main>
        <h1>Контакты</h1>
        <p>Минск, ул. Примерная, 1. Телефон: +375 29 000-00-00.</p>
      </main></body></html>`),
  ],
};

await mkdir(BASE, { recursive: true });
await writeFile(`${BASE}/crawl.json`, JSON.stringify(crawl, null, 2));

const prisma = new PrismaClient();
const lead = await prisma.lead.create({
  data: {
    source: 'manual', sourceId: `v372-failure-${Date.now()}`,
    companyName: 'V372 Failure Fixture', city: 'Минск', categories: [],
    website: DOM, manualReviewStatus: 'GOOD', reviewedAt: new Date(),
  },
});
const crawlRun = await prisma.redesignRun.create({
  data: { leadId: lead.id, stage: 'CRAWL_READY', crawlJsonPath: `${BASE}/crawl.json` },
});
console.log(`[setup] lead=${lead.id} run=${crawlRun.id}`);

let result;
try {
  result = await generateSite({
    leadId: lead.id, crawlRunId: crawlRun.id,
    templateId: 'editorial-architecture-v1',
    mode: 'regenerate', force: true,
    fixture: true, fixtureOwner: 'v372-failure-fixture',
    renderQaBaseUrl: 'http://localhost:3336', renderQaBrowser: false,
  });
} catch (e) {
  console.log(`[run] generation stopped: ${e.message}`);
}

const run = await prisma.redesignRun.findUnique({ where: { id: crawlRun.id } });
const stageResults = run?.stageResults || [];
const readJson = async (p) => import('node:fs/promises').then((m) => m.readFile(p, 'utf8').then(JSON.parse).catch(() => null));
const qa = await readJson(`${BASE}/generated-content-qa.json`);
const ri = await readJson(`${BASE}/route-integrity.json`);
const prov = await readJson(`${BASE}/graph-import-provenance.json`);

const actual = {
  finalStage: run?.stage,
  errorMessage: run?.errorMessage,
  reachedHumanReview: run?.stage === 'HUMAN_REVIEW_READY',
  gates: stageResults.map((g) => ({ stage: g.stage, status: g.status, errors: g.errors?.length || 0, warnings: g.warnings?.length || 0 })),
  qaFindings: qa ? { errors: qa.countsBySeverity.error, warnings: qa.countsBySeverity.warning, kinds: [...new Set(qa.findings.map((f) => f.kind))] } : null,
  routeConflicts: ri ? ri.records.filter((r) => r.routeStatus !== 'ok').map((r) => `${r.entityType}:${r.entityId} → ${r.routeStatus}`) : null,
  mediaSlots: prov?.mediaSlots?.map((s) => ({ slot: s.slot, selected: s.selectedMediaId || s.selectedSrc || null, fallbackMode: s.fallbackMode })) ?? null,
  technicalDrops: prov?.technicalPayloads?.map((d) => `${d.rule}: ${d.sample.slice(0, 60)}`) ?? null,
  scannedBlocks: qa?.scannedBlocks ?? null,
  jsonLeakedToBlocks: qa ? qa.findings.filter((f) => f.kind === 'technical-payload' || f.kind === 'placeholder-contact').length : null,
};

const expected = {
  technicalJsonRemoved: 'EXTRACTED/CMS_IMPORT_READY report technicalPayloadsRemoved > 0',
  duplicatesCollapsed: 'graph/import merges the responsive twin sections',
  brokenRouteBlocks: 'CMS_IMPORT_READY FAIL (route conflict) — no HUMAN_REVIEW_READY',
  noFabricatedDates: 'news publishedAt stays null',
  decorativeHeroRejected: 'media decisions reject the SVG candidate',
};

await writeFile(`${BASE}/expected.json`, JSON.stringify(expected, null, 2));
await writeFile(`${BASE}/actual.json`, JSON.stringify(actual, null, 2));
console.log(JSON.stringify(actual, null, 1));
await prisma.$disconnect();
process.exit(actual.reachedHumanReview ? 1 : 0);
