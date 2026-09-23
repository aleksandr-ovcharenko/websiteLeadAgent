#!/usr/bin/env node
// wla generate --lead-id=<id> | --url=<url> | --run-id=<id>
// Full autonomous pipeline: crawl → generate → content guard → CMS import →
// renderer serve → render+visual QA gates → (auto-fix) → screenshots → site
// ready for human review.
import 'dotenv/config';
import { generateSite } from '@minsk/redesign-engine';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { ensureQualified, LeadReviewRequiredError, parseArgs, resolveLead, resolveResume } from './generateCore.js';
import { ActivityService } from '../activity/ActivityService.js';
import { DiscoveryService } from '../discovery/service.js';
import { OperationService } from '../operations/OperationService.js';
import { sanitizeWorkerEnv } from '@minsk/security';

async function main() {
  const args = parseArgs(process.argv);
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const prisma = new PrismaClient();
  try {
    const resume = await resolveResume(args, { prisma });
    const log = (msg: string, extra?: any) => logger.info(extra, msg);
    const lead = await resolveLead(resume.leadId ? { 'lead-id': resume.leadId } : args, { prisma, log });

    // Qualification gate: generation is allowed only for a lead that a human
    // review moved to GOOD. For anything else we start the real qualification
    // workflow and stop with LEAD_REVIEW_REQUIRED + leadId.
    if (lead.manualReviewStatus !== 'GOOD') {
      const activity = new ActivityService({ prisma, logger });
      const workerEnv = sanitizeWorkerEnv(process.env);
      const discovery = new DiscoveryService({ prisma, logger, env: workerEnv, activity });
      const operations = new OperationService({ prisma, logger, env: workerEnv, discovery, activity });
      discovery.setQualificationOrchestrator(operations.qualification);
      await ensureQualified(lead, {
        prisma,
        qualification: operations.qualification,
        onProgress: (msg) => logger.info(msg),
      });
    }

    const result = await generateSite({
      leadId: lead.id,
      prisma,
      logger,
      resumeFromStage: resume.resumeFromStage as any,
      crawlRunId: resume.crawlRunId,
      force: resume.force,
    });
    console.log(JSON.stringify({ ok: true, leadId: lead.id, ...result }, null, 2));
  } catch (e: any) {
    if (e instanceof LeadReviewRequiredError) {
      console.log(JSON.stringify({ ok: false, error: 'LEAD_REVIEW_REQUIRED', leadId: e.leadId, qualification: e.qualification }));
      process.exitCode = 2;
      return;
    }
    console.error(`generate failed: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
