// Phase 2B-B: regenerate SiteContentPlan V2 from SAVED pilot artifacts.
// No recrawl, no semantic re-run — pure plan-level adjudication.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSiteContentPlanV2 } from '../packages/redesign-engine/dist/plan/siteContentPlanV2.js';
import { buildPlanReportV2 } from '../packages/redesign-engine/dist/plan/planReportV2.js';

const PILOT = 'data/redesign/pilot-2b';
const sha256 = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

const sites = fs.readdirSync(PILOT).filter((d) => fs.existsSync(path.join(PILOT, d, 'source-content-graph.json')));
const rows = [];
for (const key of sites) {
  const dir = path.join(PILOT, key);
  const graphPath = path.join(dir, 'source-content-graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const docs = JSON.parse(fs.readFileSync(path.join(dir, 'source-documents.json'), 'utf8'));
  const crawl = JSON.parse(fs.readFileSync(path.join(dir, 'crawl.json'), 'utf8'));
  const plan = buildSiteContentPlanV2({ siteKey: key, baseUrl: crawl.baseUrl || graph.baseUrl, graph, documents: docs, sourceGraphHash: sha256(fs.readFileSync(graphPath)) });
  fs.writeFileSync(path.join(dir, 'site-content-plan-v2.json'), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(dir, 'site-content-plan-v2-report.md'), buildPlanReportV2(plan));
  const cnt = (t) => plan.entities.filter((e) => e.type === t).length;
  console.log(`${key}: S:${cnt('service')} P:${cnt('project')} Pr:${cnt('product')} A:${cnt('article')} N:${cnt('news')} | dyn:${plan.dynamicSections.length} | ${plan.readiness} | ${plan.warnings.length}w`);
  rows.push({ key, plan });
}
console.log(`\n${rows.length} V2 plans regenerated`);
