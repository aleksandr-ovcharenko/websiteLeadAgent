// V3.7.5 Part E — one managed backfill of Forge previews for active sites.
// Real publish path (showcase 200 → verified PNG → row → gateway check);
// no site regeneration, no new Site/DemoVariant rows.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { backfillForgePreviews } from '../packages/redesign-engine/src/pipeline/forgePreview.js';

const prisma = new PrismaClient();

async function main() {
  const report = await backfillForgePreviews({ prisma, limit: 50 });
  console.log(JSON.stringify({ scanned: report.scanned, succeeded: report.succeeded, failed: report.failed, skipped: report.skipped }));
  for (const r of report.results) console.log(JSON.stringify(r));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
