import { generateSite } from '../packages/redesign-engine/dist/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leadId = 'cmthnoa4f004dtnq3jt3hcleo';
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { site: true } });
  const crawlRun = await prisma.redesignRun.findFirst({
    where: { leadId, stage: 'CRAWL_READY' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('existing site id:', lead?.site?.id, 'crawlRun id:', crawlRun?.id);

  const result = await generateSite({
    leadId,
    crawlRunId: crawlRun.id,
    prisma,
    onActivity: (event) => console.log('activity', event.type, event.message || ''),
  });

  console.log('generate result:', JSON.stringify({
    siteId: result.siteId,
    demoVariantId: result.demoVariantId,
    previewUrl: result.previewUrl,
    crawlRunId: result.crawlRunId,
  }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
