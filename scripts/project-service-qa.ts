import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'screenshots', 'project-service-qa');

const SITE_ID = 'cmtdkqiu50004crwd529otns8';
const PREVIEW_TOKEN = '8e25ix7c';

const PROJECT_ORIGINAL = 'Производственное здание';
const PROJECT_SLUG = 'производственное-здание-0';
const PROJECT_TEST = 'QA TEST Project';

const SERVICE_ORIGINAL = 'Земляные работы';
const SERVICE_SLUG = 'земляные-работы';
const SERVICE_TEST = 'QA TEST Service';

async function login(page: any) {
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@minsk.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('h1:has-text("WebsiteLeadAgent")', { timeout: 10000 });
}

async function shot(page: any, name: string) {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function shotLocator(page: any, selector: string, name: string) {
  const p = join(OUT, `${name}.png`);
  await page.locator(selector).screenshot({ path: p });
  return p;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs: string[] = [];
  page.on('console', (msg: any) => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err: any) => { logs.push(`PAGEERROR: ${err.message}`); });
  page.on('response', (r: any) => { if (r.status() >= 400) logs.push(`HTTP ${r.status()} ${r.url()}`); });

  await login(page);

  // --- Showcase home project / service links ---
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}`);
  await page.waitForSelector('#projects', { timeout: 10000 });
  await shotLocator(page, '#projects', '07-showcase-home-project-links');
  await shotLocator(page, '#services', '08-showcase-home-service-links');

  // --- Projects collection & detail before edit ---
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}/projects`);
  await page.waitForSelector('h2:has-text("Реализованные")', { timeout: 10000 });
  await shot(page, '01-showcase-projects-list');

  await page.click(`#projects a:has-text("${PROJECT_ORIGINAL}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/projects/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  const projectDetailBefore = await page.textContent('h1');
  await shot(page, '02-showcase-project-detail');

  // --- Studio Projects editor ---
  await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
  await page.waitForSelector('button:has-text("Projects")', { timeout: 10000 });
  await page.click('button:has-text("Projects")');
  await page.waitForSelector(`button:has-text("${PROJECT_ORIGINAL}")`, { timeout: 10000 });
  await page.click(`button:has-text("${PROJECT_ORIGINAL}")`);
  await page.waitForSelector('input[placeholder="Project title"]', { timeout: 10000 });
  await page.fill('input[placeholder="Project title"]', PROJECT_TEST);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('text=Saved', { timeout: 10000 });
  await shot(page, '03-studio-project-editor');

  // --- Projects collection & detail after edit ---
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}/projects`);
  await page.waitForSelector(`#projects a:has-text("${PROJECT_TEST}")`, { timeout: 10000 });
  await shot(page, '01-showcase-projects-list');

  await page.click(`#projects a:has-text("${PROJECT_TEST}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/projects/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  const projectDetailAfter = await page.textContent('h1');
  await shot(page, '02-showcase-project-detail');

  // --- Restore project ---
  await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
  await page.click('button:has-text("Projects")');
  await page.waitForSelector(`button:has-text("${PROJECT_TEST}")`, { timeout: 10000 });
  await page.click(`button:has-text("${PROJECT_TEST}")`);
  await page.waitForSelector('input[placeholder="Project title"]', { timeout: 10000 });
  await page.fill('input[placeholder="Project title"]', PROJECT_ORIGINAL);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('text=Saved', { timeout: 10000 });

  // --- Services collection & detail before edit ---
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}/services`);
  await page.waitForSelector('h2:has-text("Услуги")', { timeout: 10000 });
  await shot(page, '04-showcase-services-list');

  await page.click(`#services a:has-text("${SERVICE_ORIGINAL}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/services/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  const serviceDetailBefore = await page.textContent('h1');
  await shot(page, '05-showcase-service-detail');

  // --- Studio Services editor ---
  await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
  await page.click('button:has-text("Services")');
  await page.waitForSelector(`button:has-text("${SERVICE_ORIGINAL}")`, { timeout: 10000 });
  await page.click(`button:has-text("${SERVICE_ORIGINAL}")`);
  await page.waitForSelector('input[placeholder="Service title"]', { timeout: 10000 });
  await page.fill('input[placeholder="Service title"]', SERVICE_TEST);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('text=Saved', { timeout: 10000 });
  await shot(page, '06-studio-service-editor');

  // --- Services collection & detail after edit ---
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}/services`);
  await page.waitForSelector(`#services a:has-text("${SERVICE_TEST}")`, { timeout: 10000 });
  await shot(page, '04-showcase-services-list');

  await page.click(`#services a:has-text("${SERVICE_TEST}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/services/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  const serviceDetailAfter = await page.textContent('h1');
  await shot(page, '05-showcase-service-detail');

  // --- Restore service ---
  await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
  await page.click('button:has-text("Services")');
  await page.waitForSelector(`button:has-text("${SERVICE_TEST}")`, { timeout: 10000 });
  await page.click(`button:has-text("${SERVICE_TEST}")`);
  await page.waitForSelector('input[placeholder="Service title"]', { timeout: 10000 });
  await page.fill('input[placeholder="Service title"]', SERVICE_ORIGINAL);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('text=Saved', { timeout: 10000 });

  // --- Mobile sanity check ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}/projects`);
  await page.waitForSelector('#projects', { timeout: 10000 });
  await page.click(`#projects a:has-text("${PROJECT_ORIGINAL}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/projects/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  await shot(page, '09-showcase-mobile-project-detail');

  await browser.close();

  const result = {
    ok: true,
    projectDetailBefore,
    projectDetailAfter,
    serviceDetailBefore,
    serviceDetailAfter,
    projectUrl: `http://localhost:3000/showcase/${PREVIEW_TOKEN}/projects/${PROJECT_SLUG}`,
    serviceUrl: `http://localhost:3000/showcase/${PREVIEW_TOKEN}/services/${SERVICE_SLUG}`,
    logs
  };

  const resultPath = join(OUT, 'project-service-qa-results.json');
  await writeFile(resultPath, JSON.stringify(result, null, 2));
  console.log('Project/Service QA results:', resultPath);
  console.log('project detail before:', projectDetailBefore);
  console.log('project detail after:', projectDetailAfter);
  console.log('service detail before:', serviceDetailBefore);
  console.log('service detail after:', serviceDetailAfter);
}

run().catch((e) => { console.error(e); process.exit(1); });
