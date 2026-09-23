// V3.5 evidence artifacts: crawler-coverage.json, media-integrity.json,
// variant-inventory-after.json. Read-only — compares crawl artifacts with CMS state.
//
//   node scripts/v35-artifacts.mjs

import { PrismaClient } from '@prisma/client';
import { readFile, writeFile, access, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SITE_ID = 'cmuazd8v900011kiu4bp2hsnf';
const LEAD_ID = 'cmtprwtq20000141vosxgf0hv';
const OUT = join(process.cwd(), 'data/redesign/v35');
const prisma = new PrismaClient();

const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json', 'utf8'));
const pages = crawl.pages || crawl.crawledPages || [];

// ---------- crawler coverage ----------
const cmsPages = await prisma.page.findMany({ where: { siteId: SITE_ID }, select: { slug: true, sourceUrl: true, title: true } });
const crawledUrls = pages.map((p) => p.url).filter(Boolean);
const norm = (u) => { try { const x = new URL(u); return x.pathname.replace(/\/+$/, '') || '/'; } catch { return u; } };
const crawledPaths = new Set(crawledUrls.map(norm));
const cmsPaths = new Set(cmsPages.map((p) => p.sourceUrl ? norm(p.sourceUrl) : null).filter(Boolean));
const cmsSlugs = new Set(cmsPages.map((p) => `/${p.slug}`));
const covered = [...crawledPaths].filter((p) => cmsPaths.has(p) || cmsSlugs.has(p));
const uncovered = [...crawledPaths].filter((p) => !covered.includes(p));
const navCount = (crawl.navigation || crawl.nav || []).length;

const coverage = {
  at: new Date().toISOString(),
  crawlArtifact: 'data/redesign/pilot-2b/lishen/crawl-full.json',
  crawledPages: crawledUrls.length,
  crawledNavItems: navCount,
  cmsPages: cmsPages.length,
  crawledPathsImported: covered.length,
  crawledPathsNotImported: uncovered,
  cmsMenuItems: await prisma.menuItem.count({ where: { siteId: SITE_ID } }),
  cmsServices: await prisma.service.count({ where: { siteId: SITE_ID } }),
  cmsProjects: await prisma.project.count({ where: { siteId: SITE_ID } }),
  cmsMedia: await prisma.media.count({ where: { siteId: SITE_ID } }),
};
await writeFile(join(OUT, 'crawler-coverage.json'), JSON.stringify(coverage, null, 2));
console.log('coverage:', JSON.stringify(coverage));

// ---------- media integrity ----------
const media = await prisma.media.findMany({ where: { siteId: SITE_ID } });
const checks = [];
for (const m of media) {
  const entry = { id: m.id, filename: m.filename, mimeType: m.mimeType, size: m.size };
  try {
    const p = join(process.cwd(), 'data/generated/sites', SITE_ID, 'media', m.filename);
    await access(p);
    const st = await stat(p);
    entry.fileExists = true;
    entry.bytesOnDisk = st.size;
    entry.sizeMatches = !m.size || m.size === st.size;
  } catch {
    entry.fileExists = false;
  }
  const url = `http://localhost:3336/site-media/${SITE_ID}/${m.filename}`;
  try {
    const r = await fetch(url);
    entry.rendererUrl = url;
    entry.rendererStatus = r.status;
    entry.ok = entry.fileExists && r.status === 200;
  } catch (e) {
    entry.rendererUrl = url;
    entry.rendererStatus = null;
    entry.ok = false;
  }
  checks.push(entry);
}
const integrity = {
  at: new Date().toISOString(),
  siteId: SITE_ID,
  total: checks.length,
  ok: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok),
  checks,
};
await writeFile(join(OUT, 'media-integrity.json'), JSON.stringify(integrity, null, 2));
console.log(`media: ${integrity.ok}/${integrity.total} ok`);

// ---------- variant inventory after ----------
const sitesForLead = await prisma.site.findMany({ where: { leadId: LEAD_ID } });
const siteIds = sitesForLead.map((s) => s.id);
const variants = await prisma.demoVariant.findMany({ where: { siteId: { in: siteIds } } });
const editorial = variants.filter((v) => v.templateId === 'editorial-architecture-v1' && v.status === 'ACTIVE');
const preferred = variants.filter((v) => v.isPreferred);
// Count canonical entry points: one preferred-variant Showcase URL per the
// contract. Site-token aliases are validated separately in browser-assertions.
let working = 0, broken = 0;
for (const v of preferred.length ? preferred : variants) {
  try {
    const r = await fetch(`http://localhost:3336/showcase/${v.previewToken}`);
    if (r.ok) working++; else broken++;
  } catch { broken++; }
}
const after = {
  at: new Date().toISOString(),
  leadId: LEAD_ID,
  siteCountForLead: sitesForLead.length,
  activeEditorialVariants: editorial.length,
  preferredVariants: preferred.length,
  workingShowcaseUrls: working,
  brokenShowcaseUrls: broken,
};
await writeFile(join(OUT, 'variant-inventory-after.json'), JSON.stringify(after, null, 2));
console.log('inventory:', JSON.stringify(after));

await prisma.$disconnect();
