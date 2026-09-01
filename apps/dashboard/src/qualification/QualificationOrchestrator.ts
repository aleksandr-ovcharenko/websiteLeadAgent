import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import type { OperationService } from '../operations/OperationService.js';
import { ActivityService } from '../activity/ActivityService.js';

export interface QualificationOrchestratorDeps {
  operations: OperationService;
  prisma: PrismaClient;
  logger: pino.Logger;
  activity: ActivityService;
}

const STAGE_OPERATION: Record<string, string> = {
  enrich: 'ENRICH_LEAD',
  audit: 'AUDIT_WEBSITE',
  lighthouse: 'RUN_LIGHTHOUSE',
  ai: 'RUN_VISUAL_ANALYSIS',
  scoring: 'RECALCULATE_SCORE',
};

const STOPPING_STATUSES = new Set(['FAILED', 'INTERRUPTED', 'CANCELLED']);

export class QualificationOrchestrator {
  private operations: OperationService;
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private activity: ActivityService;

  constructor(deps: QualificationOrchestratorDeps) {
    this.operations = deps.operations;
    this.prisma = deps.prisma;
    this.logger = deps.logger;
    this.activity = deps.activity;
  }

  async resume(leadId: string, contextRunId?: string) {
    return this.advance(leadId, contextRunId);
  }

  async advance(leadId: string, contextRunId?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        website: true,
        websiteStatus: true,
        auditStatus: true,
        scoreStatus: true,
      enrichmentStatus: true,
        lighthouseReport: { select: { id: true } },
        visualAnalysis: { select: { status: true } },
      },
    });
    if (!lead) {
      this.logger.warn({ leadId }, 'qualification.advance.lead_not_found');
      return { ok: false, started: null, reason: 'lead_not_found' };
    }

    const active = await this.prisma.operationRun.findMany({
      where: { leadId, status: { in: ['PENDING', 'RUNNING'] } },
      select: { id: true, operationId: true, status: true },
    });
    const activeByOp = new Map(active.map((r: any) => [r.operationId, r]));

    const startingModule = (operationId: string) => {
      if (operationId === 'AUDIT_WEBSITE') return 'AUDIT';
      if (operationId === 'RUN_LIGHTHOUSE') return 'LIGHTHOUSE';
      if (operationId === 'RUN_VISUAL_ANALYSIS') return 'AI';
      if (operationId === 'RECALCULATE_SCORE') return 'SCORING';
      return 'RADAR';
    };

    const startIfAble = async (stage: string, input: Record<string, any>) => {
      const operationId = STAGE_OPERATION[stage];
      if (activeByOp.has(operationId)) return null;
      const { run, alreadyActive } = await this.operations.execute({ operationId, input, leadId });
      if (alreadyActive) return null;
      const runId = run.id;
      await this.activity.log({
        level: 'INFO',
        module: startingModule(operationId),
        eventType: `${stage}_auto_started`,
        message: `${stage} started automatically`,
        leadId,
        runId,
        details: { contextRunId },
      });
      return { operationId, runId, stage };
    };

    if (lead.websiteStatus !== 'FOUND' || !lead.website) {
      if (STOPPING_STATUSES.has(lead.enrichmentStatus)) {
        return { ok: false, started: null, reason: `enrichment_${lead.enrichmentStatus.toLowerCase()}` };
      }
      if (lead.enrichmentStatus !== 'SUCCESS' && !activeByOp.has('ENRICH_LEAD')) {
        const started = await startIfAble('enrich', { leadIds: [leadId] });
        return { ok: true, started };
      }
      return { ok: false, started: null, reason: 'no_website' };
    }

    if (lead.auditStatus !== 'SUCCESS') {
      if (STOPPING_STATUSES.has(lead.auditStatus)) {
        return { ok: false, started: null, reason: `audit_${lead.auditStatus.toLowerCase()}` };
      }
      const started = await startIfAble('audit', { leadId, website: lead.website });
      return { ok: true, started };
    }

    if (!lead.lighthouseReport) {
      if (lead.auditStatus !== 'SUCCESS') {
        return { ok: false, started: null, reason: 'audit_not_success' };
      }
      const started = await startIfAble('lighthouse', { leadId, url: lead.website });
      return { ok: true, started };
    }

    const visualStatus = lead.visualAnalysis?.status;
    if (visualStatus !== 'SUCCESS') {
      if (visualStatus && STOPPING_STATUSES.has(visualStatus)) {
        return { ok: false, started: null, reason: `visual_${visualStatus.toLowerCase()}` };
      }
      const started = await startIfAble('ai', { leadId, force: false });
      return { ok: true, started };
    }

    if (lead.scoreStatus !== 'SUCCESS') {
      if (STOPPING_STATUSES.has(lead.scoreStatus)) {
        return { ok: false, started: null, reason: `score_${lead.scoreStatus.toLowerCase()}` };
      }
      const started = await startIfAble('scoring', { leadId });
      return { ok: true, started };
    }

    await this.activity.log({
      level: 'INFO',
      module: 'RADAR',
      eventType: 'qualification_ready',
      message: 'Qualification ready for review',
      leadId,
      details: { contextRunId },
    });
    return { ok: true, started: null, readyForReview: true };
  }
}
