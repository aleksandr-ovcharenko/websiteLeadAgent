import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { crawlSite } from '../../../../packages/redesign-engine/src/crawl/crawlSite.js';
import { extractFromCrawl } from '../../../../packages/redesign-engine/src/extract/extractFromCrawl.js';
import { importToCms } from '../../../../packages/redesign-engine/src/import/importToCms.js';

const logger = pino({ level: 'info' });
const prisma = new PrismaClient();

function help() {
  console.log(`
Usage:
  npm run redesign -- --lead=<leadId> [--force] [--template=<id>]
  npm run redesign -- --website=https://garantk.by/ [--force] [--template=<id>]

Templates:
  construction-modern-v1  (default)

Pipeline:
  validate lead -> crawl -> extract -> import to CMS
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const lead = args.find((a) => a.startsWith('--lead='))?.split('=')[1];
  const website = args.find((a) => a.startsWith('--website='))?.split('=')[1];
  const template = args.find((a) => a.startsWith('--template='))?.split('=')[1] ?? 'construction-modern-v1';
  const force = args.includes('--force');
  return { lead, website, template, force };
}

async function findLead({ lead, website }: { lead?: string; website?: string }) {
  if (lead) {
    const l = await (prisma as any).lead.findUnique({ where: { id: lead } });
    if (!l) throw new Error(`Lead not found: ${lead}`);
    return l;
  }
  if (website) {
    const l = await (prisma as any).lead.findFirst({
      where: {
        OR: [{ website }, { websiteDomain: website.replace(/^https?:\/\//, '').replace(/\/$/, '') }]
      }
    });
    if (!l) throw new Error(`Lead not found for website: ${website}`);
    return l;
  }
  throw new Error('Provide --lead=<id> or --website=<url>');
}

async function main() {
  const { lead, website, template, force } = parseArgs();
  if (!lead && !website) {
    help();
    process.exit(1);
  }

  try {
    const l = await findLead({ lead, website });

    if (l.manualReviewStatus !== 'GOOD') {
      throw new Error(`Lead ${l.id} is not GOOD (status: ${l.manualReviewStatus})`);
    }

    if (l.redesignStage && l.redesignStage !== 'NOT_SELECTED' && !force) {
      logger.info({ leadId: l.id, stage: l.redesignStage }, 'redesign.already_started');
      console.log('Redesign already started. Use --force to rerun.');
      process.exit(0);
    }

    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'SELECTED_FOR_REDESIGN' }
    });

    const baseUrl = l.website;
    if (!baseUrl) throw new Error(`Lead has no website: ${l.id}`);

    if (force) {
      const existing = await (prisma as any).site.findUnique({ where: { leadId: l.id } });
      if (existing) {
        logger.info({ siteId: existing.id }, 'redesign.cleanup_old_site');
        await (prisma as any).site.delete({ where: { id: existing.id } });
      }
    }

    const artifactDir = join('data', 'redesign', l.id);
    await mkdir(artifactDir, { recursive: true });

    logger.info({ leadId: l.id, baseUrl }, 'redesign.crawl.start');
    const crawled = await crawlSite({ baseUrl, maxPages: 15 });
    logger.info({ pages: crawled.length }, 'redesign.crawl.done');

    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CONTENT_EXTRACTED' }
    });

    const content = extractFromCrawl(crawled, baseUrl);
    logger.info({
      pages: content.pages.length,
      services: content.services.length,
      projects: content.projects.length,
      news: content.news.length,
      media: content.media.length
    }, 'redesign.extract.done');

    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CONTENT_TRANSFORMED' }
    });

    const siteSlug = `garantk-by-${l.id.slice(-6)}`;
    const previewSlug = `${Math.random().toString(36).slice(2, 10)}`;

    const { siteId } = await importToCms({
      leadId: l.id,
      siteName: l.companyName || 'Redesign Site',
      siteSlug,
      previewSlug,
      templateId: template,
      content,
      artifactDir,
      storageBaseUrl: `/redesign-media/${l.id}`
    }, prisma);

    logger.info({ leadId: l.id, siteId, previewSlug }, 'redesign.import.done');

    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CMS_IMPORTED' }
    });

    console.log(`\nRedesign imported for lead ${l.id}`);
    console.log(`  siteId: ${siteId}`);
    console.log(`  previewSlug: ${previewSlug}`);
    console.log(`  artifact: ${artifactDir}`);
    console.log(`\nNext: run "npm run site:renderer" and open /preview/${previewSlug}`);
  } catch (err: any) {
    logger.error(err, 'redesign.failed');
    console.error(err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
