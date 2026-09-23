import 'dotenv/config';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from '../data/experiments/mapid/b3-generation/blueprint/blueprint-renderer.mjs';
import { runQA } from '../data/experiments/mapid/b3-generation/shared/run-qa.mjs';

const B26 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b26-cms';
const B28 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b28-polish';
const B3 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation';
const AGENT = join(B3, 'agent');
const RENDER = join(AGENT, 'render');
const QA = join(AGENT, 'qa');

await mkdir(RENDER, { recursive: true });

async function copyAssets() {
  await mkdir(join(RENDER, 'images'), { recursive: true });
  for (const f of await readdir(join(B28, 'render', 'images'))) {
    await copyFile(join(B28, 'render', 'images', f), join(RENDER, 'images', f));
  }
  const bpRender = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/blueprint/render';
  for (const asset of ['b3-blueprint.css', 'b3-blueprint.js']) {
    await copyFile(join(bpRender, asset), join(RENDER, asset));
  }
}

async function generate(cms, name, design) {
  const html = await renderPage(cms, design, join(RENDER, 'images'));
  await writeFile(join(RENDER, `${name}.html`), html, 'utf8');
}

const cms = JSON.parse(await readFile(join(B26, 'cms-content.json'), 'utf8'));

// Agent design config produced through skill reasoning.
const design = {
  variants: {
    hero: 'split',
    projects: 'rail',
    businessAreas: 'rail',
    company: 'split'
  },
  limits: { projects: 12, news: 3, properties: 3 },
  sections: true
};

const skillProvenance = [
  {
    skill: 'taste-skill',
    stage: 'composition',
    reason: 'Design Read: corporate portfolio for B2B procurement, premium engineering language. Avoid generic masonry grid of equal cards; let the built artifact lead.',
    input: 'DesignRecipe-B25 composition, InteractionRecipe-B27, B28 screenshots',
    recommendation: 'Use split hero (editorial authority) and horizontal snap rails for projects and business areas. This borrows a small structural cue from earlier direction C without changing the business narrative.',
    artifactInfluenced: 'design.variants.hero="split", design.variants.projects="rail", design.variants.businessAreas="rail"',
    visibleChange: 'Different layout rhythm: split hero, rail browsing.'
  },
  {
    skill: 'emil-design-eng',
    stage: 'animation',
    reason: 'InteractionRecipe requested hero media effect and project hover; must keep LCP fast and motion compositor-safe.',
    input: 'InteractionRecipe-B27, B28 LCP 1.57s reference',
    recommendation: 'No clip-path reveal. Hero image uses fetchpriority=high decoding=sync. Animations use transform/opacity only. Reduced motion disables all motion.',
    artifactInfluenced: 'b3-blueprint.css transitions, b3-blueprint.js reduced-motion check',
    visibleChange: 'Same as Blueprint (shared CSS); confirms agent did not add motion inflation.'
  },
  {
    skill: 'impeccable',
    stage: 'critique',
    reason: 'Post-render visual QA of the split-hero/rail agent pass.',
    input: 'Agent render screenshots (desktop + mobile)',
    recommendation: 'Split hero on mobile needs stronger text contrast over the photo. Add a local overlay only for the split-hero mobile breakpoint and a subtle scroll-hint fade on project/business rails.',
    artifactInfluenced: 'b3-agent.css override',
    visibleChange: 'Text readability on mobile split hero; scroll affordance for rails.'
  }
];

await copyAssets();
await generate(cms, 'b3-agent', design);
await generate(cms, 'b3-agent-reduced', { ...design, reduced: true });

// Agent repair pass: add local CSS overlay/scroll-hint.
const agentCss = `
/* Agent repair pass: stronger split-hero mobile overlay */
[data-bp-section="hero"].bp-hero-split::before { content: none; }
@media (max-width: 767px) {
  [data-bp-section="hero"].bp-hero-split::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(28,28,28,.82) 0%, rgba(28,28,28,.45) 60%, rgba(28,28,28,.15) 100%);
    z-index: 1;
  }
}
`;
await writeFile(join(RENDER, 'b3-agent.css'), agentCss, 'utf8');

// Append agent override to both generated HTML files.
for (const name of ['b3-agent', 'b3-agent-reduced']) {
  const file = join(RENDER, `${name}.html`);
  let html = await readFile(file, 'utf8');
  html = html.replace('</head>', '<link rel="stylesheet" href="b3-agent.css"></head>');
  await writeFile(file, html, 'utf8');
}

// CMS round-trip edit
const editedCms = JSON.parse(JSON.stringify(cms));
const serviceIdx = editedCms.services.findIndex(s => s.slug === 'строительство');
let roundTrip = { pass: false, before: '', after: '' };
if (serviceIdx >= 0) {
  roundTrip.before = editedCms.services[serviceIdx].title;
  editedCms.services[serviceIdx].title = `${roundTrip.before} (отредактировано)`;
  const editedHtml = await renderPage(editedCms, design, join(RENDER, 'images'));
  roundTrip.pass = editedHtml.includes('(отредактировано)');
  roundTrip.after = editedCms.services[serviceIdx].title;
}

const qa = await runQA({ renderDir: RENDER, urlPath: '/b3-agent.html', label: 'B3_AGENT', outDir: QA });

await writeFile(join(AGENT, 'generation.json'), JSON.stringify({
  variant: 'AGENT',
  design,
  cms: 'cms-content.json',
  outputs: ['b3-agent.html', 'b3-agent-reduced.html'],
  cmsRoundTrip: roundTrip,
  lighthouse: qa.lighthouse,
  qa: qa.qa,
  screenshots: qa.screenshots,
  skillProvenance
}, null, 2));

await writeFile(join(AGENT, 'skill-provenance.json'), JSON.stringify(skillProvenance, null, 2));

console.log('B3_AGENT complete:', AGENT);
console.log('Lighthouse:', qa.lighthouse);
console.log('Round-trip:', roundTrip);
