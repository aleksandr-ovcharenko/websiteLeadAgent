// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECTION_BY_SLUG: Record<string, string> = {
  about: 'ABOUT',
  services: 'SERVICES',
  objects: 'PROJECTS',
  projects: 'PROJECTS',
  news: 'NEWS',
  vacancies: 'VACANCIES',
  contacts: 'CONTACTS',
};

async function run() {
  const items = await prisma.menuItem.findMany({ include: { page: true } });
  for (const item of items) {
    let targetType: string | null = null;
    let target: string | null = null;
    let pageId: string | null = item.pageId;

    const pageSlug = item.page?.slug || '';
    const url = (item.url || '').trim();

    if (url && /^https?:\/\//.test(url)) {
      targetType = 'EXTERNAL_URL';
      target = url;
      pageId = null;
    } else if (pageSlug === 'index') {
      targetType = 'HOME';
      target = '';
      pageId = null;
    } else if (SECTION_BY_SLUG[pageSlug]) {
      targetType = 'HOME_SECTION';
      target = SECTION_BY_SLUG[pageSlug];
      pageId = null;
    } else if (pageId) {
      targetType = 'PAGE';
      target = pageSlug;
    } else if (url) {
      const cleanUrl = url.replace(/^#/, '');
      if (SECTION_BY_SLUG[cleanUrl]) {
        targetType = 'HOME_SECTION';
        target = SECTION_BY_SLUG[cleanUrl];
        pageId = null;
      } else {
        targetType = 'CUSTOM_URL';
        target = url;
        pageId = null;
      }
    }

    if (targetType) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { targetType, target, pageId }
      });
      console.log(`Updated ${item.id} ${item.label || ''} -> ${targetType} ${target}`);
    }
  }
  await prisma.$disconnect();
  console.log('Backfill done');
}

run().catch((e) => { console.error(e); process.exit(1); });
