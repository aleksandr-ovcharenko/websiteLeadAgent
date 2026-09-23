// Radar hygiene — backup, dry-run report, safe cleanup.
//
//   node scripts/radar-hygiene.mjs backup   → data/redesign/v37/radar/backup/
//   node scripts/radar-hygiene.mjs report   → read-only before/after analysis
//   node scripts/radar-hygiene.mjs apply    → transactional merges + ineligibility
//
// Nothing is hard-deleted: merged leads keep mergeStatus/mergedIntoLeadId,
// aggregators keep their lead row with the website marked ineligible.
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/redesign/v37/radar');
const MODE = process.argv[2] || 'report';

// The classifier/dedupe modules are TS in app workspaces — bundle them on the
// fly with the repo's existing esbuild so this script stays plain node.
const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundle = (entry) => {
  const f = path.join(ROOT, `node_modules/.cache/v37-${path.basename(entry, '.ts')}.mjs`);
  buildSync({ entryPoints: [path.join(ROOT, entry)], bundle: true, format: 'esm', outfile: f, platform: 'node', external: ['@prisma/client', 'tldts'] });
  return f;
};
const { canonicalizeWebsite } = await import(bundle('apps/collector/src/utils/canonicalizeWebsite.ts'));
const { classifyWebsiteOwnership } = await import(bundle('apps/collector/src/utils/websiteOwnershipClassifier.ts'));
const { evaluateWebsiteEligibility } = await import(bundle('apps/collector/src/utils/evaluateWebsiteEligibility.ts'));
const { groupDuplicates, planMerge, applyMerge } = await import(bundle('apps/dashboard/src/discovery/dedupe.ts'));

const prisma = new PrismaClient();
const now = new Date().toISOString();

async function loadLeads() {
  const rows = await prisma.lead.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      site: { select: { id: true } },
      redesignRuns: { select: { id: true, stage: true, updatedAt: true } },
      queries: { select: { query: true } },
      candidates: { select: { id: true, decision: true, websiteDomain: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    hasSite: !!r.site,
    // A run is "active" while its stage is mid-pipeline and it was touched
    // recently — terminal stages (DEMO_*, FAILED, NOT_SELECTED) don't block.
    hasActiveRuns: r.redesignRuns.some((x) =>
      !['NOT_SELECTED', 'DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT', 'CRAWL_FAILED'].includes(String(x.stage))
      && Date.now() - new Date(x.updatedAt).getTime() < 24 * 3600 * 1000),
  }));
}

async function backup(leads) {
  const dir = path.join(OUT, 'backup');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `radar-backup-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify({ exportedAt: now, leadCount: leads.length, leads }, null, 2));
  console.log('backup →', file, `(${leads.length} leads)`);
  return file;
}

function hygieneReport(leads) {
  const actionable = leads.filter((l) => l.mergeStatus === 'NONE' && !l.archivedAt);
  const noWebsite = actionable.filter((l) => !l.website || l.websiteStatus !== 'FOUND');

  // Aggregator/directory classification for every lead with a website.
  const aggregators = [];
  for (const l of actionable) {
    if (!l.website) continue;
    const cls = classifyWebsiteOwnership({ url: l.website, companyName: l.companyName });
    const elig = evaluateWebsiteEligibility(l.website);
    if (!elig.eligible && ['AGGREGATOR', 'DIRECTORY', 'MARKETPLACE', 'MAP_PROVIDER', 'SEARCH_ENGINE', 'SOCIAL_NETWORK', 'GOVERNMENT'].includes(elig.reason)) {
      aggregators.push({ leadId: l.id, companyName: l.companyName, website: l.website, reason: elig.reason, matchedRule: elig.matchedRule, layer: 'eligibility-policy' });
    } else if (!['DIRECT_COMPANY_SITE', 'UNCERTAIN'].includes(cls.decision)) {
      aggregators.push({ leadId: l.id, companyName: l.companyName, website: l.website, reason: cls.decision, matchedSignals: cls.matchedSignals, layer: 'ownership-classifier' });
    }
  }

  // Duplicate groups.
  const lite = actionable.map((l) => ({
    id: l.id, companyName: l.companyName, website: l.website, websiteDomain: l.websiteDomain,
    phone: l.phone, address: l.address, source: l.source, sourceId: l.sourceId,
    categories: l.categories, redesignStage: l.redesignStage, manualReviewStatus: l.manualReviewStatus,
    mergeStatus: l.mergeStatus, createdAt: l.createdAt, hasSite: l.hasSite, hasActiveRuns: l.hasActiveRuns,
  }));
  const groups = groupDuplicates(lite).map((g) => planMerge(g, lite.filter((l) => g.members.some((m) => m.leadId === l.id))));

  return { actionable, noWebsite, aggregators, groups, lite };
}

const leads = await loadLeads();
const backupFile = await backup(leads);
const { actionable, noWebsite, aggregators, groups, lite } = hygieneReport(leads);

await mkdir(OUT, { recursive: true });
const report = {
  generatedAt: now,
  mode: MODE,
  totals: {
    leads: leads.length,
    actionable: actionable.length,
    mergedOrBlocked: leads.length - actionable.length,
    withoutValidWebsite: noWebsite.length,
    aggregatorLeads: aggregators.length,
    duplicateGroups: groups.length,
    safeMergeGroups: groups.filter((g) => !g.blocked).length,
    blockedGroups: groups.filter((g) => g.blocked).length,
    groupsWithDownstreamArtifacts: groups.filter((g) => g.members.some((m) => leads.find((l) => l.id === m.leadId)?.hasSite)).length,
  },
  aggregators,
  groups: groups.map((g) => ({
    key: g.key, kind: g.kind, blocked: g.blocked, blockReason: g.blockReason,
    survivorId: g.survivorId, mergeIds: g.mergeIds,
    members: g.members.map((m) => {
      const l = leads.find((x) => x.id === m.leadId);
      return { ...m, website: l?.website, hasSite: l?.hasSite, redesignStage: l?.redesignStage, manualReviewStatus: l?.manualReviewStatus };
    }),
  })),
  backupFile,
};
await writeFile(path.join(OUT, 'radar-hygiene-before.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(OUT, 'duplicate-groups-dry-run.json'), JSON.stringify({ generatedAt: now, groups: report.groups }, null, 2));
await writeFile(path.join(OUT, 'aggregator-classification.json'), JSON.stringify({ generatedAt: now, aggregators }, null, 2));
await writeFile(path.join(OUT, 'blocked-merge-groups.json'), JSON.stringify({ generatedAt: now, blocked: report.groups.filter((g) => g.blocked) }, null, 2));

console.log('REPORT', JSON.stringify(report.totals, null, 1));
for (const g of report.groups) {
  console.log(`  ${g.blocked ? 'BLOCKED' : 'MERGE'} [${g.kind}] ${g.key} → survivor ${g.survivorId} ← ${g.mergeIds.join(',')} ${g.blockReason || ''}`);
}
for (const a of aggregators) console.log(`  AGGREGATOR ${a.website} (${a.reason}) lead ${a.leadId}`);

if (MODE === 'apply') {
  const results = { merged: [], blocked: [], aggregators: [], errors: [] };

  // 1. Aggregator leads — mark website ineligible, keep the lead + evidence.
  for (const a of aggregators) {
    try {
      await prisma.lead.update({
        where: { id: a.leadId },
        data: {
          websiteStatus: 'NOT_FOUND',
          websiteIneligibilityReason: a.reason,
          redesignStage: 'NOT_SELECTED',
          archivedAt: new Date(),
        },
      });
      results.aggregators.push({ leadId: a.leadId, website: a.website, reason: a.reason });
    } catch (e) { results.errors.push({ leadId: a.leadId, error: String(e) }); }
  }

  // 2. Duplicate groups — transactional merge or block.
  for (const g of groups) {
    if (!g.mergeIds.length) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await applyMerge(tx, g, { blocked: g.blocked });
      });
      (g.blocked ? results.blocked : results.merged).push({ key: g.key, survivor: g.survivorId, merged: g.mergeIds, reason: g.blockReason });
    } catch (e) { results.errors.push({ key: g.key, error: String(e) }); }
  }

  // After-state.
  const after = await loadLeads();
  const afterReport = hygieneReport(after);
  const afterSummary = {
    generatedAt: new Date().toISOString(),
    totals: {
      leads: after.length,
      actionable: afterReport.actionable.length,
      aggregatorLeads: afterReport.aggregators.length,
      duplicateGroups: afterReport.groups.filter((g) => !g.blocked).length,
      blockedGroups: afterReport.groups.filter((g) => g.blocked).length,
    },
    results,
  };
  await writeFile(path.join(OUT, 'radar-hygiene-after.json'), JSON.stringify(afterSummary, null, 2));
  await writeFile(path.join(OUT, 'duplicate-merge-results.json'), JSON.stringify(results, null, 2));
  console.log('APPLIED', JSON.stringify(afterSummary.totals));
}

await prisma.$disconnect();
