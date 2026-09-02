import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const l = await p.lead.findFirst({
  where: { websiteDomain: 'mrs.by' },
  include: { site: true, _count: { select: { redesignRuns: true } } }
});
console.log(JSON.stringify(l, null, 2));
await p.$disconnect();
