import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      websiteStatus: 'FOUND',
      auditStatus: 'SUCCESS',
      lighthouseReport: { isNot: null },
      visualAnalysis: { status: 'SUCCESS' },
      scoreStatus: 'SUCCESS',
    },
    orderBy: { leadScoreV2: 'desc' },
    take: 5,
    select: {
      id: true,
      companyName: true,
      website: true,
      leadScoreV2: true,
      auditStatus: true,
      scoreStatus: true,
      visualAnalysis: { select: { status: true, summary: true } },
      lighthouseReport: { select: { performance: true, accessibility: true, seo: true, bestPractices: true } },
    },
  });
  console.log(JSON.stringify(leads, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
