// Explicit HUMAN action: transition a generated showcase to DEMO_READY.
// Usage: node scripts/approve-showcase.mjs <siteKey|siteId>
// This is the only path to DEMO_READY — generation scripts never set it.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const arg = process.argv[2];
if (!arg) { console.error('usage: node scripts/approve-showcase.mjs <siteKey|siteId>'); process.exit(1); }
const site = await prisma.site.findFirst({
  where: { OR: [{ id: arg }, { domain: { contains: arg } }, { name: { contains: arg } }] },
  include: { demoVariants: { orderBy: { createdAt: 'desc' }, take: 1 } },
});
if (!site) { console.error('site not found:', arg); process.exit(1); }
const prev = (site.settings || {}).reviewStatus || 'unknown';
await prisma.site.update({ where: { id: site.id }, data: { status: 'ACTIVE', settings: { ...(site.settings || {}), reviewStatus: 'DEMO_READY', approvedAt: new Date().toISOString() } } });
console.log(`${site.name} (${site.id}): reviewStatus ${prev} → DEMO_READY (human approval recorded)`);
await prisma.$disconnect();
