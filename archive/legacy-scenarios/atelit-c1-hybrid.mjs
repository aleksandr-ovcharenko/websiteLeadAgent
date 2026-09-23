import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/atelit/c1-generalization/hybrid/c1-hybrid-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';
const SRC = join(C1, 'source');
const HYBRID = join(C1, 'hybrid');
const RENDER = join(HYBRID, 'render');

await mkdir(join(RENDER, 'images'), { recursive: true });

const cms = JSON.parse(await readFile(join(SRC, 'cms-content.json'), 'utf8'));

for (const f of await readdir(join(SRC, 'images'))) {
  await copyFile(join(SRC, 'images', f), join(RENDER, 'images', f));
}

const design = {
  variants: { hero: 'split', projects: 'grid', company: 'split' },
  limits: { projects: 12, services: 8, properties: 3, team: 4 },
  sections: true
};

const html = await renderPage(cms, design, join(RENDER, 'images'));
await writeFile(join(RENDER, 'c1-hybrid.html'), html, 'utf8');

const reducedHtml = await renderPage(cms, { ...design, reduced: true }, join(RENDER, 'images'));
await writeFile(join(RENDER, 'c1-hybrid-reduced.html'), reducedHtml, 'utf8');

// CMS round-trip: edit a service title and re-render
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

const qa = await runQA({ renderDir: RENDER, urlPath: '/c1-hybrid.html', label: 'C1_HYBRID', outDir: join(HYBRID, 'qa') });

await writeFile(join(HYBRID, 'generation.json'), JSON.stringify({
  variant: 'C1_HYBRID_FINAL',
  design,
  cms: 'source/cms-content.json',
  outputs: ['c1-hybrid.html', 'c1-hybrid-reduced.html'],
  cmsRoundTrip: roundTrip,
  lighthouse: qa.lighthouse,
  qa: qa.qa,
  screenshots: qa.screenshots
}, null, 2));

console.log('C1_HYBRID complete:', HYBRID);
console.log('Lighthouse:', qa.lighthouse);
console.log('Round-trip:', roundTrip);
