import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.redesignRun.findUnique({ where: { id: 'cmtrhy68l0002kl3ah2sx20ri' } });
console.log('crawlJsonPath:', r.crawlJsonPath);
console.log('contentJsonPath:', r.contentJsonPath);
console.log('stage:', r.stage, 'siteId:', r.siteId);
await p.$disconnect();
