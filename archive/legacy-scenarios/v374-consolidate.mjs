#!/usr/bin/env node
// V3.7.4 Phase 1 — canonical site consolidation.
//
// ONE canonical source domain → ONE active Site → ONE shared CMS.
//
// For each duplicate group:
//   1. pick the canonical Site (explicit per domain below — the recovery
//      target for nexttrade, the original for 100m3);
//   2. migrate editor-owned CMS entities that exist only on a duplicate
//      (MANUAL sourceType or manualModifiedAt set) — never overwriting
//      canonical rows with the same slug;
//   3. attach the duplicate's redesign runs to the canonical site so the
//      version history survives;
//   4. archive the duplicate (status=ARCHIVED, mergedIntoSiteId=canonical)
//      and record a reversible mapping in canonical.consolidationLog.
//
// Nothing is hard-deleted. Duplicates keep their variants/entities for
// audit; they just leave the normal Sites/Factory/CMS lists.
//
// Usage: node scripts/v374-consolidate.mjs [--apply]
//   default is a dry-run that prints the plan + writes the mapping artifact.

import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const CANONICAL = {
  'nexttrade.by': 'cmuctw9vr0004iejw4nd89vbt', // preview 1dooxfp9 — recovery target
  '100m3.by': 'cmubtwrze0001st9q0eps7yua',    // original site (ohdq5cir)
};

const EDITOR_OWNED = { OR: [{ sourceType: 'MANUAL' }, { manualModifiedAt: { not: null } }] };
const ENTITY_MODELS = ['page', 'service', 'project', 'product', 'newsPost', 'vacancy'];

async function editorOwned(siteId) {
  const out = {};
  for (const m of ENTITY_MODELS) {
    out[m] = await prisma[m].findMany({ where: { siteId, ...EDITOR_OWNED } });
  }
  return out;
}

async function migrateEditorOwned(dupSiteId, canonicalId, log) {
  const owned = await editorOwned(dupSiteId);
  for (const [model, rows] of Object.entries(owned)) {
    for (const row of rows) {
      const clash = row.slug
        ? await prisma[model].findFirst({ where: { siteId: canonicalId, slug: row.slug } })
        : null;
      if (clash) {
        // Canonical already has this entity — keep canonical content and
        // preserve the duplicate's editor-owned fields in the log so the
        // merge stays reversible and nothing is silently lost.
        const diff = {};
        for (const [k, v] of Object.entries(row)) {
          if (['id', 'siteId', 'createdAt', 'updatedAt'].includes(k)) continue;
          const cv = clash[k];
          if (JSON.stringify(v) !== JSON.stringify(cv)) diff[k] = { duplicate: v, canonical: cv };
        }
        log.notMigrated.push({ model, id: row.id, slug: row.slug, reason: 'slug exists on canonical — editor edits preserved in log', editorDiff: diff });
        continue;
      }
      if (APPLY) {
        const { id, siteId, ...data } = row;
        await prisma[model].create({ data: { ...data, siteId: canonicalId } });
      }
      log.migrated.push({ model, fromId: row.id, slug: row.slug ?? null, toSiteId: canonicalId });
    }
  }
}

async function consolidateDomain(domain, canonicalId) {
  const canonical = await prisma.site.findUniqueOrThrow({ where: { id: canonicalId } });
  const dups = await prisma.site.findMany({ where: { domain, id: { not: canonicalId }, mergedIntoSiteId: null } });
  const log = { domain, canonicalSiteId: canonicalId, canonicalPreviewToken: canonical.previewToken, consolidatedAt: new Date().toISOString(), duplicates: [] };

  for (const dup of dups) {
    const entry = { duplicateSiteId: dup.id, duplicatePreviewToken: dup.previewToken, migrated: [], notMigrated: [], runsMoved: 0 };

    await migrateEditorOwned(dup.id, canonicalId, entry);

    // Move redesign runs so version history consolidates onto the canonical site.
    const runs = APPLY
      ? await prisma.redesignRun.updateMany({ where: { siteId: dup.id }, data: { siteId: canonicalId } })
      : await prisma.redesignRun.count({ where: { siteId: dup.id } });
    entry.runsMoved = runs.count ?? runs;

    if (APPLY) {
      await prisma.site.update({
        where: { id: dup.id },
        data: { status: 'ARCHIVED', mergedIntoSiteId: canonicalId },
      });
      // Archived sites' variants leave the preferred/active pools too.
      await prisma.demoVariant.updateMany({ where: { siteId: dup.id }, data: { status: 'ARCHIVED' } });
    }
    log.duplicates.push(entry);
  }

  if (APPLY) {
    const prev = (canonical.consolidationLog || []);
    await prisma.site.update({
      where: { id: canonicalId },
      data: { canonicalDomain: domain, consolidationLog: [...(Array.isArray(prev) ? prev : [prev]), log].filter(Boolean) },
    });
  }
  return log;
}

const logs = [];
for (const [domain, canonicalId] of Object.entries(CANONICAL)) {
  logs.push(await consolidateDomain(domain, canonicalId));
}

const dir = 'data/redesign/v374';
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/consolidation-map.json`, JSON.stringify({ applied: APPLY, logs }, null, 2));
console.log(JSON.stringify({ applied: APPLY, domains: logs.map(l => ({ domain: l.domain, canonical: l.canonicalSiteId, duplicates: l.duplicates.length, migrated: l.duplicates.reduce((n, d) => n + d.migrated.length, 0), runsMoved: l.duplicates.reduce((n, d) => n + d.runsMoved, 0) })) }, null, 2));
await prisma.$disconnect();
