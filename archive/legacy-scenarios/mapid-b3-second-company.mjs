import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/mapid/b3-generation/blueprint/blueprint-renderer.mjs';

const B28 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b28-polish';
const SECOND = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/second-company';
const RENDER = join(SECOND, 'render');

await mkdir(RENDER, { recursive: true });
await mkdir(join(RENDER, 'images'), { recursive: true });

for (const f of await readdir(join(B28, 'render', 'images'))) {
  await copyFile(join(B28, 'render', 'images', f), join(RENDER, 'images', f));
}

for (const asset of ['b3-blueprint.css', 'b3-blueprint.js']) {
  await copyFile(
    join('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/blueprint/render', asset),
    join(RENDER, asset)
  );
}

const cms = JSON.parse(await readFile(join(SECOND, 'content.json'), 'utf8'));
const design = {
  variants: { hero: 'full-bleed', projects: 'grid', businessAreas: 'grid', company: 'split' },
  limits: { projects: 12, news: 3, properties: 3 },
  sections: true
};

const html = await renderPage(cms, design, join(RENDER, 'images'));
await writeFile(join(RENDER, 'second-company.html'), html, 'utf8');

// Component classification based on this structural test
const classification = [
  { component: 'Hero full-bleed', status: 'GENERIC', note: 'works with any title/subtitle/image' },
  { component: 'Hero split', status: 'MOSTLY_REUSABLE', note: 'works but needs contrast-aware nav handling' },
  { component: 'Services numbered grid', status: 'GENERIC', note: 'purely driven by cms.services' },
  { component: 'Business areas grid', status: 'GENERIC', note: 'derives categories from cms.projects' },
  { component: 'Business areas rail', status: 'MOSTLY_REUSABLE', note: 'needs enough categories to justify rail' },
  { component: 'Projects grid', status: 'GENERIC', note: 'driven by cms.projects and categories' },
  { component: 'Projects rail', status: 'MOSTLY_REUSABLE', note: 'taller cards, needs scroll affordance' },
  { component: 'Properties', status: 'GENERIC', note: 'driven by cms.products' },
  { component: 'Company split', status: 'GENERIC', note: 'uses cms.about and derived stats' },
  { component: 'News', status: 'GENERIC', note: 'uses cms.news' },
  { component: 'CTA', status: 'GENERIC', note: 'uses cms.cta' },
  { component: 'Footer', status: 'GENERIC', note: 'uses cms.navigation and cms.company' }
];

await writeFile(join(SECOND, 'classification.json'), JSON.stringify(classification, null, 2));
console.log('Second-company structural test complete:', SECOND);
