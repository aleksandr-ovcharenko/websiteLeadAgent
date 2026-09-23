// V3.6 Phase 8 — CMS single-source proof: change values via the CMS API (the
// exact endpoints Studio calls), reload showcase, assert render, revert.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const GATEWAY = 'http://localhost:3000';
const SITE = 'cmuazd8v900011kiu4bp2hsnf';
const TOKEN = 'muazd8vjzv4j';
const M = 'V36EDIT';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? ' PASS' : ' FAIL', name, '|', detail); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${GATEWAY}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' }, headers: { Origin: GATEWAY } });
const api = (m, path, body) => page.request.fetch(`${GATEWAY}${path}`, { method: m, data: body, headers: { 'Content-Type': 'application/json', Origin: GATEWAY, Referer: `${GATEWAY}/studio/${SITE}` } });

const bundle = () => api('GET', `/api/cms/sites/${SITE}`).then((r) => r.json());
const showcaseText = async () => {
  await page.goto(`${GATEWAY}/showcase/${TOKEN}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return page.locator('body').innerText();
};

const before = await bundle();
const home = before.pages.find((p) => p.isHomepage);
const svc = before.services[0];
const proj = before.projects[0];
// A top-level item with no children — always rendered as a plain nav link.
const childIds = new Set(before.menu.map((m) => m.parentId).filter(Boolean));
const menuItem = before.menu.find((m) => !m.parentId && m.label === 'Портфолио')
  || before.menu.find((m) => !m.parentId && !childIds.has(m.id))
  || before.menu.find((m) => !m.parentId);
const orig = {
  homeBlocks: JSON.parse(JSON.stringify(home.blocks)),
  svcTitle: svc.title,
  projExcerpt: proj.excerpt,
  phone: before.site.siteSettings.phone,
  menuLabel: menuItem.label,
};

// ---- apply edits -----------------------------------------------------------
const blocks = JSON.parse(JSON.stringify(home.blocks));
const bHero = blocks.find((b) => b.type === 'hero');
const bSvc = blocks.find((b) => b.type === 'services');
const bCta = blocks.find((b) => b.type === 'cta');
const bAbout = blocks.find((b) => b.type === 'about');
bHero.title = `${M} главная`;                    // 1. homepage heading
bSvc.heading = `${M} услуги`;                    // 2. services heading
bCta.title = `${M} стройка?`;                    // 3. CTA heading
bAbout.enabled = false;                          // 8. hide a block
await api('PUT', `/api/cms/sites/${SITE}/pages/${home.id}`, { blocks });

await api('PUT', `/api/cms/sites/${SITE}/services/${svc.id}`, { title: `${M} ${svc.title}` });           // 4. service title
await api('PUT', `/api/cms/sites/${SITE}/projects/${proj.id}`, { excerpt: `${M} описание проекта` });      // 5. project description
await api('POST', `/api/cms/sites/${SITE}/settings`, { phone: `+375 00 ${M}` });                            // 6. contact value

// 7. nav label — PUT /menu replaces the item list. The endpoint expects a
// NESTED tree (children under parents); rebuild it from flat rows so the
// hierarchy survives the round-trip.
const toTree = (rows, markerId) => {
  const node = (m) => ({
    id: m.id, label: m.id === markerId ? `${M} ${m.label}` : m.label,
    url: m.url, pageId: m.pageId, sortOrder: m.sortOrder,
    targetType: m.targetType, target: m.target, external: m.external, visible: m.visible,
    children: rows.filter((c) => c.parentId === m.id).sort((a, b) => a.sortOrder - b.sortOrder).map(node),
  });
  return rows.filter((m) => !m.parentId).sort((a, b) => a.sortOrder - b.sortOrder).map(node);
};
const menuPayload = toTree(before.menu, menuItem.id);
const mres = await api('PUT', `/api/cms/sites/${SITE}/menu`, { items: menuPayload });
check('menu PUT accepted', mres.ok(), `HTTP ${mres.status()}`);

// ---- verify on showcase ----------------------------------------------------
const text = await showcaseText();
check('homepage heading', text.includes(`${M} главная`), 'hero title edited');
check('services heading', text.includes(`${M} услуги`), 'services section heading edited');
check('cta heading', text.includes(`${M} стройка?`), 'cta title edited');
check('service title', text.includes(`${M} ${svc.title}`), 'service card renamed');
check('project excerpt', text.includes(`${M} описание проекта`), 'project description edited');
check('contact phone', text.includes(`+375 00 ${M}`), 'settings phone rendered');
check('nav label', text.toLowerCase().includes(`${M} ${menuItem.label}`.toLowerCase()), 'menu label edited');
const aboutBefore = orig.homeBlocks.find((b) => b.type === 'about');
const squash = (s) => (s || '').replace(/\s+/g, ' ').trim();
const aboutText = squash(aboutBefore?.content || aboutBefore?.heading || '').slice(0, 30);
check('block hidden', aboutText ? !squash(text).includes(aboutText) : true, `about "${aboutText}" absent`);

// ---- revert ----------------------------------------------------------------
await api('PUT', `/api/cms/sites/${SITE}/pages/${home.id}`, { blocks: orig.homeBlocks });
await api('PUT', `/api/cms/sites/${SITE}/services/${svc.id}`, { title: orig.svcTitle });
await api('PUT', `/api/cms/sites/${SITE}/projects/${proj.id}`, { excerpt: orig.projExcerpt });
await api('POST', `/api/cms/sites/${SITE}/settings`, { phone: orig.phone });
await api('PUT', `/api/cms/sites/${SITE}/menu`, { items: toTree(before.menu, null) });

const restored = await showcaseText();
const origHeroTitle = orig.homeBlocks.find((b) => b.type === 'hero')?.title || '';
check('revert: no markers', !restored.includes(M), 'all markers gone after revert');
check('revert: original hero', restored.includes(origHeroTitle), `hero title restored: "${origHeroTitle}"`);
check('revert: about visible', aboutText ? squash(restored).includes(aboutText) : true, 'about section back');

await browser.close();
const pass = results.filter((r) => r.ok).length;
await writeFile('data/redesign/v36/cms-editability.json', JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, results }, null, 2));
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
