import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { readdir } from 'node:fs/promises';

const prisma = new PrismaClient();

async function main() {
  const auditRoot = 'data/audit';
  const dirs = await readdir(auditRoot, { withFileTypes: true });
  const fixed: string[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const leadId = dir.name;
    const crawlPath = join(auditRoot, leadId, 'crawl.json');
    try {
      const crawl = JSON.parse(await readFile(crawlPath, 'utf-8'));
      if (crawl.httpStatus && crawl.httpStatus >= 400) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { auditStatus: true } });
        if (lead && lead.auditStatus !== 'FAILED') {
          await prisma.lead.update({
            where: { id: leadId },
            data: { auditStatus: 'FAILED' },
          });
          fixed.push(`${leadId} (HTTP ${crawl.httpStatus})`);
        }
      }
    } catch {}
  }
  console.log(`Fixed ${fixed.length} audits with HTTP >= 400`);
  for (const f of fixed) console.log(f);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
