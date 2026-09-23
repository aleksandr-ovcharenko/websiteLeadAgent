import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/proekt-m/c2-transformation/blueprint/blueprint-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const C2 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation';
const SRC = join(C2, 'source');
const BP = join(C2, 'blueprint');
const RENDER = join(BP, 'render');

await mkdir(join(RENDER, 'images'), { recursive: true });

const cms = JSON.parse(await readFile(join(SRC, 'cms-content.json'), 'utf8'));
for (const f of await readdir(join(SRC, 'images'))) {
  await copyFile(join(SRC, 'images', f), join(RENDER, 'images', f));
}

const design = { variants: { hero: 'full', projects: 'grid' }, limits: { projects: 12, services: 3 } };
const html = await renderPage(cms, design, join(RENDER, 'images'));
await writeFile(join(RENDER, 'c2-blueprint.html'), html, 'utf8');

// round-trip
const roundTripCms = JSON.parse(JSON.stringify(cms));
const idx = roundTripCms.services.findIndex(s => s.slug === 'arhitektura');
const before = roundTripCms.services[idx].title;
roundTripCms.services[idx].title = `${before} (отредактировано)`;
const edited = await renderPage(roundTripCms, design, join(RENDER, 'images'));
const roundTrip = { pass: edited.includes('(отредактировано)'), before, after: roundTripCms.services[idx].title };

const qa = await runQA({ renderDir: RENDER, urlPath: '/c2-blueprint.html', label: 'C2_BLUEPRINT', outDir: join(BP, 'qa') });
await writeFile(join(BP, 'generation.json'), JSON.stringify({ variant: 'C2_BLUEPRINT_BASE', cms, design, roundTrip, lighthouse: qa.lighthouse, qa: qa.qa }, null, 2), 'utf8');
console.log('C2 Blueprint complete:', qa.lighthouse);
