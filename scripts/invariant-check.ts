import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isReadyForReview(lead: any) {
  return (
    lead.websiteStatus === 'FOUND' &&
    lead.auditStatus === 'SUCCESS' &&
    lead.lighthouseReport &&
    lead.visualAnalysis?.status === 'SUCCESS' &&
    lead.scoreStatus === 'SUCCESS'
  );
}

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      websiteStatus: true,
      auditStatus: true,
      scoreStatus: true,
      manualReviewStatus: true,
      lighthouseReport: { select: { id: true } },
      visualAnalysis: { select: { status: true } },
    },
  });

  const reviewedButNotReady = leads.filter(
    (l) => l.manualReviewStatus !== 'UNREVIEWED' && !isReadyForReview(l)
  );

  console.log(`Checked ${leads.length} leads`);
  console.log(`reviewedButNotReady: ${reviewedButNotReady.length}`);

  if (reviewedButNotReady.length > 0) {
    console.error('FAIL: manual review set for leads not ready for review', reviewedButNotReady.map((l) => l.id));
    await prisma.$disconnect();
    process.exit(1);
  }

  const ready = leads.filter(isReadyForReview);
  console.log(`readyForReview: ${ready.length}`);
  console.log('PASS: all reviewed leads are READY_FOR_REVIEW');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
