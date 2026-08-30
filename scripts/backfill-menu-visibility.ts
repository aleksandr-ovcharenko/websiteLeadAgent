// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  await prisma.menuItem.updateMany({
    data: { showInHeader: true, showInFooter: true, showOnHomepage: true }
  });
  console.log('MenuItem visibility flags backfilled');
  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
