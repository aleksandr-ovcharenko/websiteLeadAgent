import { runCrawl } from '../packages/redesign-engine/dist/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await runCrawl({
    leadId: 'cmthnoa4f004dtnq3jt3hcleo',
    prisma,
    maxPages: 5,
    maxDepth: 2,
  });

  console.log(JSON.stringify({
    homepage: result.crawlResult.homepage,
    pages: result.crawlResult.pages.length,
    warnings: result.crawlResult.warnings,
    crawlJsonPath: result.crawlJsonPath,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
