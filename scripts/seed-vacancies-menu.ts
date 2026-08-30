// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const site = await prisma.site.findUnique({ where: { previewToken: '8e25ix7c' }, select: { id: true } });
  if (!site) { console.log('site not found'); process.exit(1); }
  let menu = await prisma.menu.findFirst({ where: { siteId: site.id, name: 'Main' } });
  if (!menu) menu = await prisma.menu.create({ data: { siteId: site.id, name: 'Main', isMain: true } });
  const exists = await prisma.menuItem.findFirst({
    where: { siteId: site.id, menuId: menu.id, targetType: 'HOME_SECTION', target: 'VACANCIES' }
  });
  if (exists) {
    console.log('vacancies menu item already exists');
  } else {
    await prisma.menuItem.create({
      data: {
        siteId: site.id,
        menuId: menu.id,
        label: 'Вакансии',
        targetType: 'HOME_SECTION',
        target: 'VACANCIES',
        sortOrder: 100,
        visible: true
      }
    });
    console.log('vacancies menu item created');
  }
  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
