import 'dotenv/config';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { crawlSite } from '../packages/redesign-engine/dist/index.js';
import { extractFromCrawl } from '../packages/redesign-engine/dist/index.js';
import { importToCms } from '../packages/redesign-engine/dist/index.js';
import { buildSiteContentPlan } from '../packages/redesign-engine/dist/index.js';
import { captureScreenshots } from '../packages/redesign-engine/experiments/screenshots.mjs';
import { createSourceSnapshot } from '../packages/redesign-engine/experiments/sourceSnapshot.mjs';
import { runLighthouseOnce } from '../apps/auditor/src/lighthouse/runLighthouse.ts';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';
const SOURCE = join(C1, 'source');
const SCREEN = join(SOURCE, 'screenshots');
const URL = 'https://atelit.by/';

async function main() {
  await mkdir(SOURCE, { recursive: true });
  await mkdir(SCREEN, { recursive: true });

  console.log('C1: crawling', URL);
  const started = Date.now();
  const crawl = await crawlSite({ baseUrl: URL, maxPages: 40, maxDepth: 4, timeoutMs: 30000, rootTimeoutMs: 60000 });
  await writeFile(join(SOURCE, 'crawl.json'), JSON.stringify(crawl, null, 2), 'utf8');
  console.log('C1: crawled', crawl.pages?.length ?? 0, 'pages in', Math.round((Date.now() - started) / 1000), 's');

  // Extract source documents / content graph
  const extraction = await extractFromCrawl(crawl);
  await writeFile(join(SOURCE, 'extraction.json'), JSON.stringify(extraction, null, 2), 'utf8');

  // Import to CMS model
  const cms = await importToCms(extraction);
  await writeFile(join(SOURCE, 'cms-content.json'), JSON.stringify(cms, null, 2), 'utf8');

  // Content plan
  const plan = await buildSiteContentPlan(cms);
  await writeFile(join(SOURCE, 'site-content-plan.json'), JSON.stringify(plan, null, 2), 'utf8');

  // Source screenshots
  const screenshotArtifacts = await captureScreenshots({
    targets: [{ name: 'atelit-source', url: URL, type: 'SCREENSHOT_SOURCE_DESKTOP' }],
    outDir: SCREEN,
    viewports: { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }
  });

  // Lighthouse on source
  let lh;
  try {
    lh = await runLighthouseOnce({ url: URL, leadId: 'atelit-source', attempt: 1 });
  } catch (e) {
    lh = { error: e.message };
  }

  // Snapshot manifest
  const snapshot = await createSourceSnapshot({
    root: SOURCE,
    sourceUrl: URL,
    crawler: 'WLA-redesign-engine-crawlSite',
    crawledAt: new Date().toISOString()
  });

  const summary = {
    url: URL,
    crawledAt: new Date().toISOString(),
    pageCount: crawl.pages?.length ?? 0,
    homepageStatus: crawl.root?.homepageStatus,
    finalUrl: crawl.root?.finalUrl,
    screenshotArtifacts,
    lighthouse: lh,
    snapshotId: snapshot.id
  };
  await writeFile(join(C1, 'SOURCE-ANALYSIS.md'), buildSourceAnalysis(summary, crawl, cms), 'utf8');
  await writeFile(join(SOURCE, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('C1 source snapshot complete:', SOURCE);
}

function buildSourceAnalysis(summary, crawl, cms) {
  return `# C1 Source Snapshot — Atelit

- URL: ${summary.url}
- Crawled at: ${summary.crawledAt}
- Pages: ${summary.pageCount}
- Homepage status: ${summary.homepageStatus || 'unknown'}
- Final URL: ${summary.finalUrl || summary.url}
- Snapshot ID: ${summary.snapshotId}

## Lighthouse
\`\`\`json
${JSON.stringify(summary.lighthouse, null, 2)}
\`\`\`

## CMS coverage (raw counts)
- Services: ${(cms.services || []).length}
- Projects: ${(cms.projects || []).length}
- Products: ${(cms.products || []).length}
- News: ${(cms.news || []).length}
- Team: ${(cms.team || []).length}
- Pricing entries: ${(cms.pricing || []).length}
- Promotions: ${(cms.promotions || []).length}
- Media: ${(cms.media || []).length}

## Top-level navigation
${(crawl.navigation?.headerNav || []).map(n => `- ${n.label} (${n.url})`).join('\n') || '_not extracted_'}

## Notes
Source complexity is higher than a simple landing page: portfolio, services, pricing/packages, promotions, team and process content are present. Duplicated blocks and noisy promotional HTML were not pre-filtered at this stage; that work belongs to the TransformationBrief.
`;
}

main().catch(err => { console.error(err); process.exit(1); });
