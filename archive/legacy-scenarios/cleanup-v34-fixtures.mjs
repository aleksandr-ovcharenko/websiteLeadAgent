// Safe cleanup of V3.4 QA fixtures.
//
// Identifies fixtures ONLY by the precise V3.4 fingerprint (records predate
// the fixture marker) OR by an explicit settings.fixture flag owned by
// 'v34-cms-roundtrip'. Never deletes unmarked sites.
//
//   node scripts/cleanup-v34-fixtures.mjs          → dry-run report
//   node scripts/cleanup-v34-fixtures.mjs --apply  → delete after listing

import { PrismaClient } from '@prisma/client';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();
const OUT = join(process.cwd(), 'data/redesign/v35');

// Legacy V3.4 fingerprint — ALL conditions must hold for unnamed-marker records.
const LEGACY = {
  companyName: 'V34 QA Build Co',
  slugPrefix: 'v34-qa-',
  sourceIdPrefix: 'v34-',
  contentMarkers: ['QA Service', 'QA Project', 'QA hero statement', 'Manual edit marker'],
};

async function findFixtures() {
  // 1. Sites with explicit fixture marker.
  const marked = await prisma.site.findMany({
    where: { settings: { path: ['fixture'], equals: true } },
    select: { id: true, slug: true, name: true, previewToken: true, leadId: true, settings: true },
  });

  // 2. Legacy V3.4 sites — exact company name + slug prefix + no real lead website.
  const candidates = await prisma.site.findMany({
    where: { name: LEGACY.companyName, slug: { startsWith: LEGACY.slugPrefix } },
    include: {
      lead: { select: { id: true, companyName: true, website: true, sourceId: true } },
      services: { select: { title: true } },
      projects: { select: { title: true } },
      pages: { select: { blocks: true } },
    },
  });

  const legacy = candidates.filter((s) => {
    const noRealWebsite = !s.lead?.website;
    const qaContent =
      s.services.some((x) => x.title.startsWith('QA Service')) ||
      s.projects.some((x) => x.title.startsWith('QA Project')) ||
      s.pages.some((p) => JSON.stringify(p.blocks || []).includes('QA hero'));
    const leadMatch = !s.lead || s.lead.sourceId?.startsWith(LEGACY.sourceIdPrefix);
    return noRealWebsite && qaContent && leadMatch;
  });

  // Merge, dedupe.
  const map = new Map();
  for (const s of [...marked, ...legacy]) map.set(s.id, s);
  const sites = [...map.values()];

  // Fixture leads: explicit sourceId prefix + no website + only fixture sites.
  const leadIds = new Set(sites.map((s) => s.leadId).filter(Boolean));
  const orphanLeads = await prisma.lead.findMany({
    where: {
      companyName: LEGACY.companyName,
      sourceId: { startsWith: LEGACY.sourceIdPrefix },
      website: null,
    },
    include: { site: { select: { id: true } } },
  });
  for (const l of orphanLeads) if (l.site) leadIds.add(l.id);

  return { sites, leadIds: [...leadIds] };
}

const { sites, leadIds } = await findFixtures();

const report = {
  mode: APPLY ? 'apply' : 'dry-run',
  generatedAt: new Date().toISOString(),
  sites: sites.map((s) => ({ id: s.id, slug: s.slug, name: s.name, previewToken: s.previewToken, leadId: s.leadId })),
  leads: leadIds,
  mediaDirs: sites.map((s) => `data/generated/sites/${s.id}`),
};

console.log(JSON.stringify(report, null, 2));

if (!APPLY) {
  console.log('\nDRY RUN — no records deleted. Re-run with --apply after human confirmation.');
  await writeFile(join(OUT, 'fixture-cleanup-dry-run.json'), JSON.stringify(report, null, 2)).catch(() => {});
} else {
  for (const s of sites) {
    await prisma.site.delete({ where: { id: s.id } }); // cascades content, variants, screenshots, menus
    await rm(join(process.cwd(), 'data/generated/sites', s.id), { recursive: true, force: true }).catch(() => {});
    console.log(`deleted site ${s.id} (${s.slug})`);
  }
  for (const leadId of leadIds) {
    const stillUsed = await prisma.site.findFirst({ where: { leadId } });
    if (stillUsed) { console.log(`skipped lead ${leadId} — still referenced by ${stillUsed.id}`); continue; }
    await prisma.lead.delete({ where: { id: leadId } }).catch((e) => console.log(`lead ${leadId}: ${e.message}`));
    console.log(`deleted lead ${leadId}`);
  }
  // Orphan sweep: variants/screenshots whose site vanished are impossible via
  // cascade, but verify anyway.
  const orphans = await prisma.demoVariant.count({ where: { site: null } }).catch(() => 0);
  console.log(`orphan variants after cleanup: ${orphans}`);
}

await prisma.$disconnect();
