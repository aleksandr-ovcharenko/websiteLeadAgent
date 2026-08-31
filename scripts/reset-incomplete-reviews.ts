import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Mark scored leads as scoreStatus=SUCCESS if they are otherwise complete
  const scored = await prisma.lead.findMany({
    where: {
      leadScoreV2: { not: null },
      scoreStatus: 'PENDING',
    },
    select: { id: true },
  });
  for (const lead of scored) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { scoreStatus: 'SUCCESS' },
    });
  }
  console.log(`Updated ${scored.length} scored leads to scoreStatus=SUCCESS`);

  // Reset manual review for leads that are not READY_FOR_REVIEW
  const incomplete = await prisma.lead.findMany({
    where: {
      OR: [
        { websiteStatus: { not: 'FOUND' } },
        { auditStatus: { not: 'SUCCESS' } },
        { scoreStatus: { not: 'SUCCESS' } },
      ],
      manualReviewStatus: { not: 'UNREVIEWED' },
    },
    select: { id: true, manualReviewStatus: true },
  });
  for (const lead of incomplete) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        manualReviewStatus: 'UNREVIEWED',
        manualReviewNote: null,
        reviewedAt: null,
        redesignStage: 'NOT_SELECTED',
      },
    });
  }
  console.log(`Reset ${incomplete.length} incomplete leads from manual review`);

  // Show stats
  const [total, ready, pending, good, failed] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({
      where: {
        websiteStatus: 'FOUND',
        auditStatus: 'SUCCESS',
        lighthouseReport: { isNot: null },
        visualAnalysis: { status: 'SUCCESS' },
        scoreStatus: 'SUCCESS',
      },
    }),
    prisma.lead.count({
      where: {
        websiteStatus: 'FOUND',
        NOT: {
          websiteStatus: 'FOUND',
          auditStatus: 'SUCCESS',
          lighthouseReport: { isNot: null },
          visualAnalysis: { status: 'SUCCESS' },
          scoreStatus: 'SUCCESS',
        },
      },
    }),
    prisma.lead.count({ where: { manualReviewStatus: 'GOOD' } }),
    prisma.lead.count({ where: { OR: [{ auditStatus: 'FAILED' }, { scoreStatus: 'FAILED' }, { visualAnalysis: { status: 'FAILED' } }] } }),
  ]);
  console.log({ total, readyForReview: ready, qualificationPending: pending, good, qualificationFailed: failed });
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
