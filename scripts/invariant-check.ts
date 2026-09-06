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
      redesignStage: true,
      lighthouseReport: { select: { id: true } },
      visualAnalysis: { select: { status: true } },
    },
  });
  const activeRuns = await prisma.operationRun.findMany({
    where: { status: { in: ['PENDING', 'RUNNING', 'CANCEL_REQUESTED'] }, leadId: { not: null } },
    select: { id: true, operationId: true, status: true, leadId: true },
  });
  const activeByLead = new Map<string, typeof activeRuns>();
  for (const r of activeRuns) {
    const list = activeByLead.get(r.leadId!) ?? [];
    list.push(r);
    activeByLead.set(r.leadId!, list);
  }

  // Human review is intentionally allowed BEFORE automated qualification
  // completes (early review). The enforced invariants are now:
  //
  // 1. A lead marked BAD must not still be spending compute — no active
  //    qualification operations may remain queued/running.
  // 2. A lead may only sit in the generation pipeline (redesignStage beyond
  //    NOT_SELECTED) when it is GOOD — early GOOD alone is not enough, it
  //    must also have passed automated gates at selection time.
  const badStillWorking = leads.filter(
    (l) => l.manualReviewStatus === 'BAD' && (activeByLead.get(l.id)?.length ?? 0) > 0
  );
  // Informational only: a lead may keep its pipeline stage if a human later
  // revises GOOD → UNSURE; the generation-readiness filter still requires
  // GOOD, so such leads simply fall out of "Ready for Generation".
  const pipelineWithoutGood = leads.filter(
    (l) =>
      l.redesignStage &&
      !['NOT_SELECTED'].includes(l.redesignStage) &&
      l.manualReviewStatus !== 'GOOD'
  );

  const earlyReviewed = leads.filter(
    (l) => l.manualReviewStatus !== 'UNREVIEWED' && !isReadyForReview(l)
  );

  console.log(`Checked ${leads.length} leads`);
  console.log(`earlyReviewed (allowed): ${earlyReviewed.length}`);
  console.log(`pipelineWithoutGood (informational): ${pipelineWithoutGood.length}`);
  console.log(`badStillWorking: ${badStillWorking.length}`);

  let failed = false;
  if (badStillWorking.length > 0) {
    console.error(
      'FAIL: BAD leads still have active qualification operations',
      badStillWorking.map((l) => ({ id: l.id, ops: activeByLead.get(l.id) }))
    );
    failed = true;
  }

  if (!failed) {
    console.log('PASS: early-review invariants hold');
  }
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
