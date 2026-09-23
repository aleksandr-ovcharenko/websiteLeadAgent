import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/proekt-m/c2-transformation/hybrid/c2-hybrid-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const C2 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation';
const SRC = join(C2, 'source');
const HYBRID = join(C2, 'hybrid');
const RENDER = join(HYBRID, 'render');

await mkdir(join(RENDER, 'images'), { recursive: true });

const cms = JSON.parse(await readFile(join(SRC, 'cms-content.json'), 'utf8'));
for (const f of await readdir(join(SRC, 'images'))) {
  await copyFile(join(SRC, 'images', f), join(RENDER, 'images', f));
}

// Copy css/js to render
await copyFile(join(HYBRID, 'c2-hybrid.css'), join(RENDER, 'c2-hybrid.css'));
await copyFile(join(HYBRID, 'c2-hybrid.js'), join(RENDER, 'c2-hybrid.js'));

const design = { variant: 'proekt-m-steel' };
const html = await renderPage(cms, design, join(RENDER, 'images'));
await writeFile(join(RENDER, 'c2-hybrid.html'), html, 'utf8');

const roundTripCms = JSON.parse(JSON.stringify(cms));
const idx = roundTripCms.services.findIndex(s => s.slug === 'arhitektura');
const before = roundTripCms.services[idx].title;
roundTripCms.services[idx].title = `${before} (отредактировано)`;
const edited = await renderPage(roundTripCms, design, join(RENDER, 'images'));
const roundTrip = { pass: edited.includes('(отредактировано)'), before, after: roundTripCms.services[idx].title };

const qa = await runQA({ renderDir: RENDER, urlPath: '/c2-hybrid.html', label: 'C2_HYBRID', outDir: join(HYBRID, 'qa') });
await writeFile(join(HYBRID, 'generation.json'), JSON.stringify({ variant: 'C2_HYBRID_FINAL', cms, design, roundTrip, lighthouse: qa.lighthouse, qa: qa.qa }, null, 2), 'utf8');
console.log('C2 Hybrid complete:', qa.lighthouse);
