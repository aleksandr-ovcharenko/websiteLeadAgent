import { PrismaClient } from '@prisma/client';
import { evaluateWebsiteEligibility } from '../apps/collector/src/utils/evaluateWebsiteEligibility.js';

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { websiteStatus: { not: 'FOUND' } },
        { website: { not: null } },
      ],
    },
    select: {
      id: true,
      website: true,
      websiteDomain: true,
      websiteStatus: true,
      websiteIneligibilityReason: true,
      source: true,
      sourceUrl: true,
      redesignStage: true,
      manualReviewStatus: true,
      site: { select: { id: true } },
    },
    take: 2000,
  });

  let updated = 0;
  let skipped = 0;
  const byReason: Record<string, number> = {};

  for (const lead of leads) {
    if (lead.site?.id || lead.redesignStage !== 'NOT_SELECTED' || (lead.manualReviewStatus && lead.manualReviewStatus !== 'UNREVIEWED')) {
      skipped++;
      continue;
    }

    const eligibility = evaluateWebsiteEligibility(lead.website);

    const data: any = {
      website: eligibility.eligible ? eligibility.canonicalUrl : null,
      websiteDomain: eligibility.eligible ? eligibility.canonicalDomain : null,
      websiteStatus: eligibility.eligible ? 'FOUND' : 'NOT_FOUND',
      websiteIneligibilityReason: eligibility.eligible ? null : (eligibility.reason ?? 'NO_WEBSITE'),
    };

    const reason = data.websiteIneligibilityReason ?? 'FOUND';
    byReason[reason] = (byReason[reason] ?? 0) + 1;

    if (
      lead.website !== data.website ||
      lead.websiteDomain !== data.websiteDomain ||
      lead.websiteStatus !== data.websiteStatus ||
      lead.websiteIneligibilityReason !== data.websiteIneligibilityReason
    ) {
      await prisma.lead.update({ where: { id: lead.id }, data });
      updated++;
    }
  }

  console.log(JSON.stringify({ scanned: leads.length, updated, skipped, byReason }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
