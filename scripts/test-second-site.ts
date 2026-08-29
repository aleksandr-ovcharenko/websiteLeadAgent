import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateSite } from '@minsk/redesign-engine';
import { execSync } from 'node:child_process';

const prisma = new PrismaClient();

async function main() {
  // Ensure a clean previous test site for this lead
  const existing = await (prisma as any).lead.findFirst({
    where: { websiteDomain: 'example.com' },
    include: { site: true }
  });

  if (existing?.site) {
    await (prisma as any).site.delete({ where: { id: existing.site.id } });
  }

  const lead = await (prisma as any).lead.upsert({
    where: { source_sourceId: { source: 'dgis', sourceId: 'site-b-test' } },
    update: {
      companyName: 'Site B',
      website: 'https://example.com/',
      websiteDomain: 'example.com',
      manualReviewStatus: 'GOOD',
      redesignStage: 'NOT_SELECTED'
    },
    create: {
      source: 'dgis',
      sourceId: 'site-b-test',
      companyName: 'Site B',
      city: 'Test City',
      website: 'https://example.com/',
      websiteDomain: 'example.com',
      manualReviewStatus: 'GOOD',
      enrichmentStatus: 'SUCCESS',
      auditStatus: 'SUCCESS',
      scoreStatus: 'SUCCESS',
      generationStatus: 'SUCCESS',
      redesignStage: 'NOT_SELECTED'
    }
  });

  console.log('Lead for Site B:', lead.id);

  const { siteId, previewSlug } = await generateSite({
    leadId: lead.id,
    templateId: 'construction-modern-v1',
    force: true,
    prisma
  });

  console.log('Site B generated:', { siteId, previewSlug });

  const html = execSync(`curl -s http://localhost:3336/showcase/${previewSlug}`, { encoding: 'utf8' });
  const hasSiteB = html.includes('Site B');
  const hasOldCustomer = html.includes('Гарант Качества');

  console.log('Preview rendered customer name:', hasSiteB ? 'Site B' : 'NOT FOUND');
  console.log('Still contains hardcoded customer:', hasOldCustomer ? 'YES' : 'NO');
  if (!hasSiteB) process.exit(1);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
