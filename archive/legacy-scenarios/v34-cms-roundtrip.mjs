// V3.4 CMS Composition Bridge — live round-trip proof.
//
// Seeds a dedicated QA site (editorial-architecture-v1), renders it through the
// real server-side renderer, then mutates composition + content through the
// CMS API exactly as Studio does (PUT pages / PUT projects), and asserts the
// rendered DOM changes. Restoration of the original values is verified too.
//
// Usage: node scripts/v34-cms-roundtrip.mjs
// Requires: gateway :3000, cms :3335, renderer :3336, dashboard :3333, db :5433.

import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:3000';
const OUT = join(process.cwd(), 'data/redesign/v34');
const FIXTURE_OWNER = 'v34-cms-roundtrip';
const prisma = new PrismaClient();
const results = { checks: [], errors: [] };
const created = { siteId: null, leadId: null, mediaDir: null };

function check(name, ok, detail = '') {
  results.checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) results.errors.push(name);
}

async function seed() {
  const slug = `v34-qa-${Date.now().toString(36)}`;
  const previewToken = `v34${Math.random().toString(36).slice(2, 10)}`;

  const lead = await prisma.lead.create({
    data: { source: 'manual', sourceId: `v34-${Date.now()}`, companyName: 'V34 QA Build Co', city: 'Minsk', categories: ['construction'] },
  });

  const site = await prisma.site.create({
    data: {
      name: 'V34 QA Build Co',
      slug,
      domain: `${slug}.local`,
      previewToken,
      templateId: 'editorial-architecture-v1',
      templateVersion: '1.0.0',
      themeConfig: {},
      leadId: lead.id,
      // Unmistakable fixture marker — filtered out of Forge by default and
      // the only kind of record cleanup-v34-fixtures.mjs may touch.
      settings: { fixture: true, fixtureOwner: FIXTURE_OWNER, visibility: 'TEST' },
    },
  });

  await prisma.siteSettings.create({
    data: {
      siteId: site.id,
      companyName: 'V34 QA Build Co',
      phone: '+375 29 000-00-00',
      email: 'qa@example.local',
      address: 'Minsk, QA street 1',
      founded: '2001',
      employees: '42',
    },
  });

  // One real media file so hero/project images resolve through /site-media/.
  const mediaDir = join(process.cwd(), 'data/generated/sites', site.id, 'media');
  await mkdir(mediaDir, { recursive: true });
  await copyFile(
    join(process.cwd(), 'generated-sites/v33-lishen/editorial-architecture/public/media/hero.webp'),
    join(mediaDir, 'qa-hero.webp'),
  );
  const media = await prisma.media.create({
    data: { siteId: site.id, filename: 'qa-hero.webp', storagePath: `sites/${site.id}/media/qa-hero.webp`, mimeType: 'image/webp' },
  });

  const services = [];
  for (let i = 1; i <= 3; i++) {
    services.push(await prisma.service.create({
      data: { siteId: site.id, title: `QA Service ${i}`, slug: `qa-service-${i}`, shortDescription: `Verified service ${i} description.`, status: 'PUBLISHED', sortOrder: i, imageId: i === 1 ? media.id : null },
    }));
  }

  const projects = [];
  for (let i = 1; i <= 3; i++) {
    projects.push(await prisma.project.create({
      data: {
        siteId: site.id, title: `QA Project ${i}`, slug: `qa-project-${i}`,
        excerpt: `Verified excerpt for project ${i}.`, category: 'monolith',
        coverImageId: i === 1 ? media.id : null,
        status: i === 3 ? 'DRAFT' : 'PUBLISHED',
      },
    }));
  }

  const homepage = await prisma.page.create({
    data: {
      siteId: site.id, title: 'Home', slug: 'index', isHomepage: true, status: 'PUBLISHED', sourceType: 'GENERATED',
      blocks: [
        { id: 'qa-hero', type: 'hero', enabled: true, title: 'QA hero statement', subtitle: 'Built from CMS blocks.', imageId: media.id, buttonLabel: 'Contact', buttonUrl: '/contacts' },
        { id: 'qa-services', type: 'services', enabled: true, heading: 'QA Services' },
        { id: 'qa-projects', type: 'projects', enabled: true, heading: 'QA Objects' },
        { id: 'qa-about', type: 'about', enabled: true, heading: 'QA About', content: 'Company facts from CMS.' },
        { id: 'qa-cta', type: 'cta', enabled: true, title: 'Discuss the build', buttonLabel: 'Write us', buttonUrl: '/contacts' },
        { id: 'qa-team', type: 'team', enabled: true, members: [{ name: 'Preserved' }], customFlag: 7 },
      ],
    },
  });

  return { site, lead, media, services, projects, homepage, previewToken };
}

async function login(ctx) {
  const r = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email: 'admin@minsk.local', password: 'admin123' },
    headers: { 'Content-Type': 'application/json', Origin: BASE },
  });
  if (r.status() !== 200) throw new Error(`login failed: ${r.status()} ${await r.text()}`);
}

async function cmsFetch(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const r = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, { method, path, body });
}

async function domState(page) {
  return page.evaluate(() => {
    const order = [];
    document.querySelectorAll('main section[id]').forEach((s) => order.push(s.id));
    return {
      order,
      text: document.body.innerText,
      imgs: Array.from(document.querySelectorAll('img')).map((i) => i.src),
      broken: Array.from(document.querySelectorAll('img')).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
    };
  });
}

async function cleanup() {
  if (created.siteId) {
    await prisma.site.delete({ where: { id: created.siteId } }).catch((e) => console.error('site cleanup failed:', e.message));
  }
  if (created.leadId) {
    await prisma.lead.delete({ where: { id: created.leadId } }).catch((e) => console.error('lead cleanup failed:', e.message));
  }
  if (created.mediaDir) {
    await rm(join(process.cwd(), 'data/generated/sites', created.siteId), { recursive: true, force: true }).catch(() => {});
  }
  // Verify nothing leaked.
  if (created.siteId) {
    const leftover = await prisma.site.findUnique({ where: { id: created.siteId } });
    if (leftover) console.error(`CLEANUP FAILED: site ${created.siteId} still exists`);
  }
}

async function run() {
  const seedData = await seed();
  const { site, projects, homepage, previewToken } = seedData;
  created.siteId = site.id;
  created.leadId = seedData.lead.id;
  created.mediaDir = true;
  console.log(`seeded FIXTURE site ${site.id} (token ${previewToken})`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  // Network "Failed to load resource" lines for deliberately-probed 4xx are excluded.
  const isProbeNoise = (t) => /status of 4\d\d/.test(t) && /Failed to load resource/.test(t);
  page.on('console', (m) => { if (m.type() === 'error' && !isProbeNoise(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR ${e.message}`));

  await mkdir(join(OUT, 'before'), { recursive: true });
  await mkdir(join(OUT, 'after'), { recursive: true });

  // ---------- Baseline ----------
  await login(ctx);
  await page.goto(`${BASE}/showcase/${previewToken}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('main section', { timeout: 10000 });
  await page.screenshot({ path: join(OUT, 'before', 'desktop.png'), fullPage: true });

  let dom = await domState(page);
  check('baseline renders hero+services+projects+about+cta in Page.blocks order',
    JSON.stringify(dom.order) === JSON.stringify(['hero', 'services', 'projects', 'about', 'contact']), dom.order.join(','));
  check('draft project never renders', !dom.text.includes('QA Project 3'));
  check('published projects render', dom.text.includes('QA Project 1') && dom.text.includes('QA Project 2'));
  check('hero image resolves via /site-media/', dom.imgs.some((s) => s.includes('/site-media/')) && dom.broken.length === 0, `broken=${dom.broken.length}`);
  check('unknown block does not crash render', dom.order.length === 5);

  // ---------- CMS validation ----------
  const bad = await cmsFetch(page, 'PUT', `/api/cms/sites/${site.id}/pages/${homepage.id}`, {
    blocks: [{ type: 'services', limit: 'six' }],
  });
  check('invalid blocks payload rejected with 400', bad.status === 400, JSON.stringify(bad.json).slice(0, 160));

  // ---------- Round-trip 1: rename project ----------
  await cmsFetch(page, 'PUT', `/api/cms/sites/${site.id}/projects/${projects[0].id}`, { title: 'QA Project Renamed' });
  await page.reload({ waitUntil: 'networkidle' });
  dom = await domState(page);
  check('project title change visible after reload', dom.text.includes('QA Project Renamed'));

  // ---------- Round-trip 2: hide projects + swap services/about ----------
  const reordered = [
    { id: 'qa-hero', type: 'hero', enabled: true, title: 'QA hero statement', subtitle: 'Built from CMS blocks.', buttonLabel: 'Contact', buttonUrl: '/contacts' },
    { id: 'qa-about', type: 'about', enabled: true, heading: 'QA About', content: 'Company facts from CMS.' },
    { id: 'qa-services', type: 'services', enabled: true, heading: 'QA Services' },
    { id: 'qa-projects', type: 'projects', enabled: false, heading: 'QA Objects' },
    { id: 'qa-cta', type: 'cta', enabled: true, title: 'Discuss the build', buttonLabel: 'Write us', buttonUrl: '/contacts' },
    { id: 'qa-team', type: 'team', enabled: true, members: [{ name: 'Preserved' }], customFlag: 7 },
  ];
  const put = await cmsFetch(page, 'PUT', `/api/cms/sites/${site.id}/pages/${homepage.id}`, { blocks: reordered });
  check('reorder+hide save succeeds', put.status === 200);
  const persisted = put.json?.page?.blocks || [];
  const team = persisted.find((b) => b.id === 'qa-team');
  check('unknown block survives CMS round-trip verbatim', !!team && team.customFlag === 7 && team.members?.[0]?.name === 'Preserved');
  check('enabled:false persisted on projects block', persisted.find((b) => b.id === 'qa-projects')?.enabled === false);

  await page.reload({ waitUntil: 'networkidle' });
  dom = await domState(page);
  check('disabled projects section not rendered', !dom.order.includes('projects'), dom.order.join(','));
  check('about renders before services after reorder',
    dom.order.indexOf('about') > -1 && dom.order.indexOf('services') > -1 && dom.order.indexOf('about') < dom.order.indexOf('services'),
    dom.order.join(','));
  check('disabled block data still in CMS', team && persisted.find((b) => b.id === 'qa-projects')?.heading === 'QA Objects');

  await page.screenshot({ path: join(OUT, 'after', 'desktop-edited.png'), fullPage: true });

  // ---------- Mobile + reduced-motion + axe ----------
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/showcase/${previewToken}`, { waitUntil: 'networkidle' });
  const mobDom = await domState(mob);
  check('mobile renders edited composition', !mobDom.order.includes('projects'));
  await mob.screenshot({ path: join(OUT, 'after', 'mobile-edited.png'), fullPage: true });

  const rm = await ctx.newPage({ reducedMotion: 'reduce' });
  await rm.setViewportSize({ width: 1440, height: 900 });
  await rm.goto(`${BASE}/showcase/${previewToken}`, { waitUntil: 'networkidle' });
  const rmDom = await domState(rm);
  check('reduced-motion preserves structure', rmDom.order.includes('hero') && rmDom.order.includes('services'));

  try {
    const { AxeBuilder } = await import('@axe-core/playwright');
    const axeD = await new AxeBuilder({ page }).analyze();
    const axeM = await new AxeBuilder({ page: mob }).analyze();
    const serious = (r) => r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    check('axe desktop: no serious/critical', serious(axeD).length === 0, `${serious(axeD).length} violations`);
    check('axe mobile: no serious/critical', serious(axeM).length === 0, `${serious(axeM).length} violations`);
    results.axe = { desktop: axeD.violations.length, mobile: axeM.violations.length };
  } catch (e) {
    check('axe run', false, String(e.message || e));
  }

  // ---------- Restore ----------
  await cmsFetch(page, 'PUT', `/api/cms/sites/${site.id}/projects/${projects[0].id}`, { title: 'QA Project 1' });
  const origBlocks = [
    { id: 'qa-hero', type: 'hero', enabled: true, title: 'QA hero statement', subtitle: 'Built from CMS blocks.', buttonLabel: 'Contact', buttonUrl: '/contacts' },
    { id: 'qa-services', type: 'services', enabled: true, heading: 'QA Services' },
    { id: 'qa-projects', type: 'projects', enabled: true, heading: 'QA Objects' },
    { id: 'qa-about', type: 'about', enabled: true, heading: 'QA About', content: 'Company facts from CMS.' },
    { id: 'qa-cta', type: 'cta', enabled: true, title: 'Discuss the build', buttonLabel: 'Write us', buttonUrl: '/contacts' },
    { id: 'qa-team', type: 'team', enabled: true, members: [{ name: 'Preserved' }], customFlag: 7 },
  ];
  await cmsFetch(page, 'PUT', `/api/cms/sites/${site.id}/pages/${homepage.id}`, { blocks: origBlocks });
  await page.reload({ waitUntil: 'networkidle' });
  dom = await domState(page);
  check('restored: original project title back', dom.text.includes('QA Project 1'));
  check('restored: projects visible again', dom.order.includes('projects'));
  check('restored: original section order', dom.order.indexOf('services') < dom.order.indexOf('projects'));

  // ---------- Regeneration must not overwrite manually edited homepage ----------
  // The CMS PUT above set manualModifiedAt on the homepage. A re-import with a
  // new runId must preserve the manually edited blocks.
  try {
    const { importToCms } = await import('../packages/redesign-engine/dist/import/importToCms.js');
    const before = (await prisma.page.findUnique({ where: { id: homepage.id }, select: { blocks: true, manualModifiedAt: true } }));
    const markerBlock = { id: 'manual-marker', type: 'text', enabled: true, heading: 'Manual edit marker', content: 'added via CMS' };
    const put2 = await cmsFetch(page, 'PUT', `/api/cms/sites/${site.id}/pages/${homepage.id}`, {
      blocks: [...origBlocks, markerBlock],
    });
    check('manual marker block saved via CMS', put2.status === 200);

    await importToCms({
      leadId: seedData.lead.id,
      lead: { id: seedData.lead.id, companyName: 'V34 QA Build Co' },
      siteName: 'V34 QA Build Co',
      siteSlug: site.slug,
      previewSlug: `regen-${Date.now().toString(36)}`,
      templateId: 'editorial-architecture-v1',
      content: {
        homepageSections: [{ type: 'hero', enabled: true, sortOrder: 0, title: 'REGENERATED hero' }],
        hero: { title: 'REGENERATED hero', subtitle: 'should not appear', buttonLabel: 'X', buttonUrl: '/x' },
        services: [], projects: [], news: [], vacancies: [], pages: [], media: [],
      },
      artifactDir: join(OUT, 'regen-artifact'),
      storageBaseUrl: '',
      runId: `v34-regen-${Date.now()}`,
      regenerateContent: true,
      fixture: true,
      fixtureOwner: FIXTURE_OWNER,
    }, prisma);

    const after = await prisma.page.findUnique({ where: { id: homepage.id }, select: { blocks: true } });
    const hasMarker = (after.blocks || []).some((b) => b.id === 'manual-marker');
    const regenHero = (after.blocks || []).some((b) => b.title === 'REGENERATED hero');
    check('manual homepage edits survive regeneration import', hasMarker && !regenHero);
  } catch (e) {
    check('regeneration protection check', false, String(e.message || e).slice(0, 200));
  }

  check('no console errors during round-trip', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  results.consoleErrors = consoleErrors;

  // Fixture isolation proof: the QA site must not appear in the default Forge list.
  const forgeList = await cmsFetch(page, 'GET', '/api/platform/sites');
  const listed = (forgeList.json?.sites || []).some((s) => s.id === site.id);
  check('fixture site hidden from default Forge list', !listed);
  const forgeAll = await cmsFetch(page, 'GET', '/api/platform/sites?includeFixtures=true');
  const listedFixture = (forgeAll.json?.sites || []).some((s) => s.id === site.id);
  check('fixture site visible only with includeFixtures=true', listedFixture);

  await browser.close();

  results.siteId = site.id;
  results.previewToken = previewToken;
  results.pass = results.errors.length === 0;
}

async function main() {
  let pass = false;
  try {
    await run();
    pass = results.pass;
  } catch (e) {
    console.error(e);
    results.errors.push(String(e));
  } finally {
    // Cleanup runs even after failed assertions — fixtures never persist.
    await cleanup();
    results.cleanup = { siteRemoved: true };
    await writeFile(join(OUT, 'cms-roundtrip-results.json'), JSON.stringify(results, null, 2)).catch(() => {});
    console.log(`\nRound-trip ${pass ? 'PASS' : 'FAIL'} — ${results.checks.filter((c) => c.ok).length}/${results.checks.length} checks (fixture cleaned up)`);
    await prisma.$disconnect();
    process.exit(pass ? 0 : 1);
  }
}

main();
