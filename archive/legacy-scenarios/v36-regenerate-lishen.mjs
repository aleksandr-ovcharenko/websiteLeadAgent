// V3.6: regenerate the canonical Lishen site through the graph-canonical
// pipeline. Reuses the stored crawl — no new site/variant created.
import { generateSite } from '../packages/redesign-engine/dist/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEAD_ID = 'cmtprwtq20000141vosxgf0hv';
const CRAWL_RUN_ID = 'cmtrhy68l0002kl3ah2sx20ri';
const SITE_ID = 'cmuazd8v900011kiu4bp2hsnf';
const VARIANT_ID = 'cmuazd8vl00031kiuhyxlhbxt';

const before = {
  sites: await prisma.site.count({ where: { leadId: LEAD_ID } }),
  variants: await prisma.demoVariant.count({ where: { siteId: SITE_ID } }),
};

const result = await generateSite({
  leadId: LEAD_ID,
  crawlRunId: CRAWL_RUN_ID,
  templateId: 'editorial-architecture-v1',
  mode: 'regenerate',
  force: true,
  prisma,
  onActivity: (e) => console.log(`[${e.level}] ${e.eventType} ${e.message}`),
});

const after = {
  sites: await prisma.site.count({ where: { leadId: LEAD_ID } }),
  variants: await prisma.demoVariant.count({ where: { siteId: SITE_ID } }),
  services: await prisma.service.count({ where: { siteId: SITE_ID } }),
  projects: await prisma.project.count({ where: { siteId: SITE_ID } }),
  pages: await prisma.page.count({ where: { siteId: SITE_ID } }),
  media: await prisma.media.count({ where: { siteId: SITE_ID } }),
  menuItems: await prisma.menuItem.count({ where: { siteId: SITE_ID } }),
};
console.log('RESULT', JSON.stringify({ siteId: result.siteId, demoVariantId: result.demoVariantId, before, after }, null, 2));
console.log('identity-preserved:', result.siteId === SITE_ID, result.demoVariantId === VARIANT_ID, before.sites === after.sites, before.variants === after.variants);
await prisma.$disconnect();
