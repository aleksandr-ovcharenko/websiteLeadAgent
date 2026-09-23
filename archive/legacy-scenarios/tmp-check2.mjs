import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const SITE='cmuazd8v900011kiu4bp2hsnf';
// any service named exactly Услуги?
const s = await p.service.findMany({ where: { siteId: SITE }, select: { title: true, slug: true } });
console.log('services:', s.map(x=>x.title).join(' | '));
// pages
const pages = await p.page.findMany({ where: { siteId: SITE }, select: { title: true, slug: true, isHomepage: true } });
for (const pg of pages) console.log('PAGE', pg.slug, '|', pg.title, pg.isHomepage?'[HOME]':'');
await p.$disconnect();
