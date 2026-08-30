import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const [target] = process.argv.slice(2);
  const where: any = { provider: 'dgis', query: 'строительная фирма' };
  if (target) where.id = target;

  const run = await prisma.discoveryRun.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (!run) {
    console.log('Run not found');
    return;
  }

  const leads = await prisma.lead.findMany({
    where: { id: { in: run.leadIds ?? [] } },
    select: {
      id: true,
      sourceId: true,
      companyName: true,
      website: true,
      websiteDomain: true,
      websiteStatus: true,
      websiteIneligibilityReason: true,
      createdAt: true,
      updatedAt: true,
      source: true,
      sourceUrl: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const newIds = run.leadIds ?? [];
  const byStatus: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  for (const l of leads) {
    byStatus[l.websiteStatus] = (byStatus[l.websiteStatus] ?? 0) + 1;
    const reason = l.websiteIneligibilityReason ?? 'null';
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }

  const newCount = run.createdCount ?? 0;
  const dupCount = run.duplicateCount ?? 0;

  console.log(JSON.stringify({
    runId: run.id,
    provider: run.provider,
    query: run.query,
    location: run.location,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    collected: run.collected,
    createdCount: newCount,
    duplicateCount: dupCount,
    leadIdsCount: newIds.length,
    leadIds: newIds,
    summary: { byStatus, byReason },
    leads: leads.map((l, i) => ({
      n: i + 1,
      id: l.id,
      sourceId: l.sourceId,
      companyName: l.companyName,
      website: l.website,
      websiteDomain: l.websiteDomain,
      websiteStatus: l.websiteStatus,
      websiteIneligibilityReason: l.websiteIneligibilityReason,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      source: l.source,
      sourceUrl: l.sourceUrl,
    })),
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
