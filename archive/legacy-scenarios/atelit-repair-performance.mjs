import { readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { renderPage } from '../data/experiments/atelit/c1-generalization/hybrid/c1-hybrid-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';
const SRC = join(C1, 'source');
const HYBRID = join(C1, 'hybrid');
const RENDER = join(HYBRID, 'render');

const cms = JSON.parse(await readFile(join(SRC, 'cms-content.json'), 'utf8'));
const oldFile = cms.hero.imageId;
const oldPath = join(SRC, 'images', oldFile);
const newName = oldFile.replace(/\.jpg$/i, '.webp');
const newPath = join(SRC, 'images', newName);

// Convert to WebP
execSync(`cwebp -q 80 "${oldPath}" -o "${newPath}"`);
console.log('created', newName);

// Update cms
const oldMedia = cms.media.find(m => m.filename === oldFile);
if (oldMedia) oldMedia.filename = newName;
cms.hero.imageId = newName;
await writeFile(join(SRC, 'cms-content.json'), JSON.stringify(cms, null, 2), 'utf8');

// Re-copy images to render and render hybrid
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

const qa = await runQA({ renderDir: RENDER, urlPath: '/c1-hybrid.html', label: 'C1_HYBRID', outDir: join(HYBRID, 'qa') });
console.log('Repaired Lighthouse:', qa.lighthouse);

await writeFile(join(HYBRID, 'repair-pass.json'), JSON.stringify({
  pass: 1,
  problem: 'LCP above 4s caused by a 189 KB hero JPEG under mobile throttling.',
  decision: 'Convert hero background to WebP (quality 80), update CMS imageId, and re-render.',
  filesChanged: ['source/cms-content.json', `source/images/${newName}`, 'hybrid/render/c1-hybrid.html', 'hybrid/render/images/*'],
  result: qa.lighthouse,
  autonomous: true
}, null, 2), 'utf8');
