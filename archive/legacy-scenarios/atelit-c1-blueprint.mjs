import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/atelit/c1-generalization/blueprint/blueprint-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';
const SRC = join(C1, 'source');
const BP = join(C1, 'blueprint');
const RENDER = join(BP, 'render');

await mkdir(join(RENDER, 'images'), { recursive: true });

const cms = JSON.parse(await readFile(join(SRC, 'cms-content.json'), 'utf8'));

for (const f of await readdir(join(SRC, 'images'))) {
  await copyFile(join(SRC, 'images', f), join(RENDER, 'images', f));
}

const design = {
  variants: { hero: 'full-bleed', projects: 'grid', businessAreas: 'grid', company: 'split' },
  limits: { projects: 12, news: 0, properties: 3 },
  sections: true
};

const html = await renderPage(cms, design, join(RENDER, 'images'));
await writeFile(join(RENDER, 'c1-blueprint.html'), html, 'utf8');

const reducedHtml = await renderPage(cms, { ...design, reduced: true }, join(RENDER, 'images'));
await writeFile(join(RENDER, 'c1-blueprint-reduced.html'), reducedHtml, 'utf8');

const roundTripCms = JSON.parse(JSON.stringify(cms));
const serviceIdx = roundTripCms.services.findIndex(s => s.slug === 'дизайн-проектирования');
let roundTrip = { pass: false, before: '', after: '' };
if (serviceIdx >= 0) {
  roundTrip.before = roundTripCms.services[serviceIdx].title;
  roundTripCms.services[serviceIdx].title = `${roundTrip.before} (отредактировано)`;
  const edited = await renderPage(roundTripCms, design, join(RENDER, 'images'));
  roundTrip.pass = edited.includes('(отредактировано)');
  roundTrip.after = roundTripCms.services[serviceIdx].title;
}

const qa = await runQA({ renderDir: RENDER, urlPath: '/c1-blueprint.html', label: 'C1_BLUEPRINT', outDir: join(BP, 'qa') });

await writeFile(join(BP, 'generation.json'), JSON.stringify({
  variant: 'C1_BLUEPRINT_BASE',
  design,
  cms: 'source/cms-content.json',
  outputs: ['c1-blueprint.html', 'c1-blueprint-reduced.html'],
  cmsRoundTrip: roundTrip,
  lighthouse: qa.lighthouse,
  qa: qa.qa,
  screenshots: qa.screenshots
}, null, 2));

console.log('C1_BLUEPRINT complete:', BP);
console.log('Lighthouse:', qa.lighthouse);
console.log('Round-trip:', roundTrip);
