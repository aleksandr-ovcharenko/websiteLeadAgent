// V3.0 — AI Art-Directed Generative Frontend: vertical slice.
// Produces ContentTruthGraph, source screenshots, source visual diagnosis,
// and 3 CreativeDirection artifacts for each benchmark client.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildSiteContentPlanV2, verifyPlanHashV2 } from '../packages/redesign-engine/dist/plan/siteContentPlanV2.js';
import { buildCustomerProblemBrief } from '../packages/redesign-engine/dist/plan/customerProblemBrief.js';
import { buildContentTruthGraph } from '../packages/redesign-engine/dist/plan/contentTruthGraph.js';
import { generateCreativeDirections } from '../packages/redesign-engine/dist/plan/creativeDirector.js';

const CLIENTS = ['lishen', 'puzzlehouse', 'sdke'];
const PILOT = 'data/redesign/pilot-2b';
const OUT = 'data/redesign/v30';

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function captureSource(baseUrl, outDir) {
  const browser = await chromium.launch();
  const shots = [];
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1500);
      } catch (e) {
        // some sites may fail; capture what is rendered
      }
      const outPath = path.join(outDir, `source-${name}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      shots.push({ name, path: outPath });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return shots;
}

async function main() {
  mkdirp(OUT);
  const manifest = [];
  for (const client of CLIENTS) {
    const planPath = path.resolve(PILOT, client, 'site-content-plan-v2.json');
    const plan = JSON.parse(await fsp.readFile(planPath, 'utf8'));
    if (!verifyPlanHashV2(plan)) {
      console.warn(`  ${client}: plan hash mismatch — skipping`);
      continue;
    }

    const clientDir = path.join(OUT, client);
    mkdirp(clientDir);

    const brief = buildCustomerProblemBrief(plan);
    await fsp.writeFile(path.join(clientDir, 'customer-problem-brief.json'), JSON.stringify(brief, null, 2));

    const truthGraph = buildContentTruthGraph(plan);
    await fsp.writeFile(path.join(clientDir, 'content-truth-graph.json'), JSON.stringify(truthGraph, null, 2));

    const sourceShots = await captureSource(plan.baseUrl, clientDir);
    const diagnosis = {
      version: '1.0',
      sourceUrl: plan.baseUrl,
      capturedScreenshots: sourceShots.map((s) => ({ viewport: s.name, path: s.path })),
      visionModel: null,
      status: 'BLOCKED',
      blockedReason: 'No vision-capable model configured for source visual diagnosis.',
      deterministicObservations: {
        archetype: plan.experience?.archetype,
        sectionCount: plan.homepage.plannedSections.length,
        entityCounts: { services: truthGraph.entities.filter((e) => e.type === 'service').length, projects: truthGraph.entities.filter((e) => e.type === 'project').length, products: truthGraph.entities.filter((e) => e.type === 'product').length, articles: truthGraph.entities.filter((e) => e.type === 'article').length },
        hasProcess: truthGraph.dynamicSections.some((d) => d.kind === 'PROCESS'),
        hasPricing: truthGraph.dynamicSections.some((d) => d.kind === 'PRICING'),
        hasReviews: truthGraph.dynamicSections.some((d) => d.kind === 'REVIEWS'),
      },
    };
    await fsp.writeFile(path.join(clientDir, 'source-diagnosis.json'), JSON.stringify(diagnosis, null, 2));

    const { directions, references } = generateCreativeDirections(brief, truthGraph);
    await fsp.writeFile(path.join(clientDir, 'creative-directions.json'), JSON.stringify({ directions, references }, null, 2));

    manifest.push({ client, clientDir, truthHash: truthGraph.contentHash, directions: directions.map((d) => d.id), referencesBlocked: references.every((r) => r.status === 'BLOCKED') });
    console.log(`${client}: truth=${truthGraph.contentHash.slice(0, 12)}; directions=${directions.map((d) => d.id).join(', ')}; references BLOCKED`);
  }
  await fsp.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nV3.0 concept artifacts written to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
