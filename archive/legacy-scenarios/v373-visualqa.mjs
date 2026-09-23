import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runVisualQa } from '../packages/redesign-engine/dist/qa/visualQa.js';
import { pickQaRoutes } from '../packages/redesign-engine/dist/qa/postRenderQa.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [siteId, token, outDir] = process.argv.slice(2);
const prisma = new PrismaClient();
const routes = await pickQaRoutes(prisma, siteId);
const report = await runVisualQa({ siteId, previewToken: token, prisma, artifactDir: outDir, pass: 1, routes });
await writeFile(join(outDir, 'visual-qa.json'), JSON.stringify(report, null, 2));
console.log('errors:', report.errors.length, 'warnings:', report.warnings.length, 'shots:', report.screenshots.length, 'auditRows:', Object.values(report.textAudit).flat().length, 'hardcoded:', Object.values(report.textAudit).flat().filter(r=>r.hardcoded).length);
await prisma.$disconnect();
process.exit(report.errors.length ? 1 : 0);
