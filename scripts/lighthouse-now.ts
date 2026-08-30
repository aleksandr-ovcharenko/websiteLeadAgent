import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runLighthouseForLead } from '../apps/auditor/src/lighthouse/runLighthouse.js';

const prisma = new PrismaClient();

async function main() {
  const leadId = process.argv[2] || 'cmtg7gm0m00fmxe7t6gu97pq0';
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, website: true, companyName: true },
  });
  if (!lead || !lead.website) {
    console.log('No lead or website');
    await prisma.$disconnect();
    return;
  }

  console.log('Running Lighthouse for', lead.id, lead.website);
  const result = await runLighthouseForLead({ leadId: lead.id, url: lead.website });
  console.log(JSON.stringify(result.summary, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
