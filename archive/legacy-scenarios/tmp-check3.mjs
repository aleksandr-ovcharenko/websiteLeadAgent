import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const home = await p.page.findFirst({ where: { siteId: 'cmuazd8v900011kiu4bp2hsnf', isHomepage: true } });
console.log(JSON.stringify(home.blocks, null, 1).slice(0, 3000));
await p.$disconnect();
