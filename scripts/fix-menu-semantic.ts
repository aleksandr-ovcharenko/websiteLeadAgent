// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const targets = ['SERVICES', 'PROJECTS', 'NEWS', 'VACANCIES'];

async function run() {
  const site = await prisma.site.findUnique({ where: { previewToken: '8e25ix7c' }, select: { id: true } });
  if (!site) { console.log('site not found'); process.exit(1); }

  for (const t of targets) {
    const item = await prisma.menuItem.findFirst({ where: { siteId: site.id, target: t } });
    if (item) {
      const data: any = { targetType: 'COLLECTION' };
      if (t === 'VACANCIES') data.showInHeader = false;
      await prisma.menuItem.update({ where: { id: item.id }, data });
      console.log('updated', t, data);
    } else {
      console.log('not found', t);
    }
  }

  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
