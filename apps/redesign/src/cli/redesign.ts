import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { generateSite } from '@minsk/redesign-engine';

const logger = pino({ level: 'info' });
const prisma = new PrismaClient();

function help() {
  console.log(`
Usage:
  npm run redesign -- --lead=<leadId> [--force] [--mode=retry|regenerate|reset] [--template=<id>]
  npm run redesign -- --website=https://example.com/ [--force] [--mode=retry|regenerate|reset] [--template=<id>]

Templates:
  construction-modern-v1  (default)
  construction-industrial-v1

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
  const mode = args.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'regenerate';
  return { lead, website, template, force, mode: mode as 'retry' | 'regenerate' | 'reset' };
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
  const { lead, website, template, force, mode } = parseArgs();
  if (!lead && !website) {
    help();
    process.exit(1);
  }

  try {
    const l = await findLead({ lead, website });
    const { siteId, previewSlug } = await generateSite({
      leadId: l.id,
      templateId: template,
      force,
      mode,
      prisma
    });

    console.log(`\nRedesign imported for lead ${l.id}`);
    console.log(`  siteId: ${siteId}`);
    console.log(`  previewToken: ${previewSlug}`);
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
