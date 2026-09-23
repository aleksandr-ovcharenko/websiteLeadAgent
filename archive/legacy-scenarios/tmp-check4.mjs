import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const home = await p.page.findFirst({ where: { siteId: 'cmuazd8v900011kiu4bp2hsnf', isHomepage: true } });
for (const b of home.blocks) console.log(b.type, '|', JSON.stringify({t:b.title||b.heading, btn:(b.buttonLabel||'')+'→'+(b.buttonUrl||''), img:b.imageId}).slice(0,160));
const prj = await p.project.findFirst({ where: { siteId: 'cmuazd8v900011kiu4bp2hsnf' } });
const cover = prj.coverImageId ? await p.media.findUnique({ where: { id: prj.coverImageId } }) : null;
console.log('PRJ', prj.title, '| cover:', cover?.sourceUrl?.split('/').pop(), '| galleryIds:', JSON.stringify(prj.galleryMediaIds||prj.gallery||'').slice(0,120));
await p.$disconnect();
