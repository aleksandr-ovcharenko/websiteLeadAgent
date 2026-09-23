import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { id: 'cmtg73c2s000i7eb54ck6jsci' },
    include: { visualAnalysis: true, lighthouseReport: true },
  });
  console.log(JSON.stringify(lead, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
