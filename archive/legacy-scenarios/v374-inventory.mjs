#!/usr/bin/env node
// V3.7.4 Phase 0 — inventory every Site / variant / run / lead associated
// with a canonical source domain. Read-only; writes the inventory artifact.
//
//   node scripts/v374-inventory.mjs --out=data/redesign/v374/site-inventory.json

import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const OUT = args.out || 'data/redesign/v374/site-inventory.json';
const DOMAINS = (args.domains || 'nexttrade.by,100m3.by').split(',');

const prisma = new PrismaClient();

const isCleanRoom = (s) => /clean-room/i.test(s.slug || '') || /clean.?room/i.test(s.name || '');

async function main() {
  const groups = {};
  for (const domain of DOMAINS) {
    const allSites = await prisma.site.findMany({
      where: { domain },
      include: {
        lead: { select: { id: true, companyName: true, websiteDomain: true, redesignStage: true } },
        demoVariants: { select: { id: true, previewToken: true, templateId: true, isPreferred: true, status: true } },
        siteSettings: { select: { companyName: true, internalName: true, brandSource: true, manualModifiedAt: true } },
        _count: { select: { pages: true, services: true, projects: true, products: true, newsPosts: true, vacancies: true, media: true, menuItems: true, redesignRuns: true, builds: true } },
      },
    });
    const siteMap = new Map();
    for (const s of allSites) siteMap.set(s.id, s);
    const leadIds = [...new Set([...siteMap.values()].map((s) => s.lead?.id).filter(Boolean))];
    const domainLeads = await prisma.lead.findMany({
      where: { OR: [{ websiteDomain: domain }, { website: { contains: domain } }, { id: { in: leadIds } }] },
      select: { id: true, companyName: true, website: true, websiteDomain: true, redesignStage: true, createdAt: true },
    });
    const leads = domainLeads;

    const sites = [];
    for (const s of siteMap.values()) {
      const runs = await prisma.redesignRun.findMany({
        where: { siteId: s.id },
        select: { id: true, stage: true, errorMessage: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const editorOwned = await countEditorOwned(s.id);
      sites.push({
        siteId: s.id,
        slug: s.slug,
        domain: s.domain,
        previewToken: s.previewToken,
        status: s.status,
        cleanRoomFixture: isCleanRoom(s),
        lead: s.lead,
        settings: s.siteSettings,
        entities: s._count,
        editorOwnedFields: editorOwned,
        variants: s.demoVariants,
        runs: runs.map((r) => ({ id: r.id, stage: r.stage, error: r.errorMessage, createdAt: r.createdAt })),
      });
    }
    groups[domain] = {
      leads: leads.filter((l) => l.websiteDomain === domain || !l.websiteDomain),
      sites,
      siteCount: sites.length,
      cleanRoomCount: sites.filter((s) => s.cleanRoomFixture).length,
    };
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), groups }, null, 2));
  for (const [d, g] of Object.entries(groups)) {
    console.log(`${d}: ${g.siteCount} sites (${g.cleanRoomCount} clean-room), ${g.leads.length} leads`);
    for (const s of g.sites) console.log(`  ${s.siteId} ${s.previewToken} ${s.slug} editorOwned=${s.editorOwnedFields} runs=${s.runs.length}`);
  }
}

async function countEditorOwned(siteId) {
  let n = 0;
  for (const model of ['page', 'service', 'project', 'product', 'newsPost', 'vacancy']) {
    n += await prisma[model].count({ where: { siteId, manualModifiedAt: { not: null } } }).catch(() => 0);
  }
  const st = await prisma.siteSettings.findFirst({ where: { siteId, manualModifiedAt: { not: null } }, select: { id: true } }).catch(() => null);
  if (st) n += 1;
  return n;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
