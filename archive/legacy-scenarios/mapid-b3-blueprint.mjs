import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/mapid/b3-generation/blueprint/blueprint-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const B26 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b26-cms';
const B28 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b28-polish';
const B3 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation';
const BLUEPRINT = join(B3, 'blueprint');
const RENDER = join(BLUEPRINT, 'render');
const QA = join(BLUEPRINT, 'qa');

await mkdir(RENDER, { recursive: true });

async function copyImages() {
  await mkdir(join(RENDER, 'images'), { recursive: true });
  for (const f of await readdir(join(B28, 'render', 'images'))) {
    await copyFile(join(B28, 'render', 'images', f), join(RENDER, 'images', f));
  }
}

async function generate(cms, name, design) {
  const html = await renderPage(cms, design, join(RENDER, 'images'));
  await writeFile(join(RENDER, `${name}.html`), html, 'utf8');
}

const cms = JSON.parse(await readFile(join(B26, 'cms-content.json'), 'utf8'));

// Blueprint design config
const design = {
  variants: {
    hero: 'full-bleed',
    projects: 'grid',
    businessAreas: 'grid',
    company: 'split'
  },
  limits: { projects: 12, news: 3, properties: 3 },
  sections: true
};

await copyImages();
await generate(cms, 'b3-blueprint', design);
await generate(cms, 'b3-blueprint-reduced', { ...design, reduced: true });

// CMS round-trip edit: temporarily modify Service title, render, verify, restore
const editedCms = JSON.parse(JSON.stringify(cms));
const serviceIdx = editedCms.services.findIndex(s => s.slug === 'строительство');
let roundTrip = { pass: false, before: '', after: '' };
if (serviceIdx >= 0) {
  roundTrip.before = editedCms.services[serviceIdx].title;
  editedCms.services[serviceIdx].title = `${roundTrip.before} (отредактировано)`;
  const editedHtml = await renderPage(editedCms, design, RENDER);
  roundTrip.pass = editedHtml.includes('(отредактировано)');
  roundTrip.after = editedCms.services[serviceIdx].title;
}

const qa = await runQA({ renderDir: RENDER, urlPath: '/b3-blueprint.html', label: 'B3_BLUEPRINT', outDir: QA });

await writeFile(join(BLUEPRINT, 'generation.json'), JSON.stringify({
  variant: 'BLUEPRINT',
  design,
  cms: 'cms-content.json',
  outputs: ['b3-blueprint.html', 'b3-blueprint-reduced.html'],
  cmsRoundTrip: roundTrip,
  lighthouse: qa.lighthouse,
  qa: qa.qa,
  screenshots: qa.screenshots
}, null, 2));

console.log('B3_BLUEPRINT complete:', BLUEPRINT);
console.log('Lighthouse:', qa.lighthouse);
console.log('Round-trip:', roundTrip);
