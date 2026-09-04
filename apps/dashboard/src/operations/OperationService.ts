import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { EventEmitter } from 'node:events';
import { createRegistry } from './registry.js';
import type { OperationDefinition } from './registry.js';
import type { DiscoveryService } from '../discovery/service.js';
import { ActivityService } from '../activity/ActivityService.js';
import { QualificationOrchestrator } from '../qualification/QualificationOrchestrator.js';

export type OperationStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';

export interface RunContext {
  runId: string;
  prisma: PrismaClient;
  logger: pino.Logger;
  env: Record<string, string | undefined>;
  currentStage: string | null;
  stage: (name: string, message?: string) => Promise<void>;
  log: (level: string, message: string, options?: { stage?: string; metadata?: Record<string, any> }) => Promise<void>;
  info: (message: string, options?: { stage?: string; metadata?: Record<string, any> }) => Promise<void>;
  success: (message: string, options?: { stage?: string; metadata?: Record<string, any> }) => Promise<void>;
  warn: (message: string, options?: { stage?: string; metadata?: Record<string, any> }) => Promise<void>;
  error: (message: string, options?: { stage?: string; metadata?: Record<string, any> }) => Promise<void>;
  result: (value: any) => void;
  fail: (error: any) => void;
  cancelled: () => boolean;
}

export interface OperationInput {
  operationId: string;
  input?: Record<string, any>;
  entityType?: string;
  entityId?: string;
  leadId?: string;
  createdBy?: string;
}

const MODULE_MAP: Record<string, string> = {
  discovery: 'DISCOVERY',
  audit: 'AUDIT',
  lighthouse: 'LIGHTHOUSE',
  ai: 'AI',
  scoring: 'SCORING',
  enrichment: 'ENRICHMENT',
  factory: 'FACTORY',
  workflow: 'CORE',
};

function redactMetadata(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/api[_-]?key|token|secret|password|credential|auth/i.test(value) && value.length > 4) {
      return '<REDACTED>';
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(redactMetadata);
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (/api[_-]?key|token|secret|password|credential|authorization/i.test(k)) {
        out[k] = '<REDACTED>';
      } else {
        out[k] = redactMetadata(v);
      }
    }
    return out;
  }
  return value;
}

class AsyncSemaphore {
  private max: number;
  private current = 0;
  private queue: (() => void)[] = [];

  constructor(max: number) {
    this.max = max;
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.current++;
  }

  release() {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

export class OperationService {
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private env: Record<string, string | undefined>;
  private registry: Record<string, OperationDefinition>;
  private cancellations = new Set<string>();
  private emitter = new EventEmitter();
  private activity: ActivityService;
  public qualification: QualificationOrchestrator;
  private semaphores = new Map<string, AsyncSemaphore>();

  constructor(input: { prisma: PrismaClient; logger: pino.Logger; env: Record<string, string | undefined>; discovery: DiscoveryService; activity: ActivityService }) {
    this.prisma = input.prisma;
    this.logger = input.logger;
    this.env = input.env;
    this.activity = input.activity;
    this.qualification = new QualificationOrchestrator({ operations: this, prisma: input.prisma, logger: input.logger, activity: input.activity });
    this.registry = createRegistry({
      prisma: input.prisma,
      logger: input.logger,
      env: input.env,
      discovery: input.discovery,
      activity: input.activity,
      qualification: this.qualification,
    });
  }

  private async saveEvent(def: OperationDefinition, run: any, level: string, message: string, stage: string | null, metadata?: Record<string, any>) {
    const safeMetadata = metadata ? redactMetadata(metadata) : undefined;
    const [event] = await Promise.all([
      this.prisma.operationEvent.create({
        data: {
          operationRunId: run.id,
          level,
          stage,
          message,
          metadata: safeMetadata ?? {},
        },
      }),
      this.activity.log({
        level: level as any,
        module: MODULE_MAP[def.category] ?? 'CORE',
        eventType: stage ?? undefined,
        message,
        runId: run.id,
        leadId: run.leadId ?? undefined,
        siteId: run.entityType === 'Site' ? run.entityId ?? undefined : undefined,
        demoVariantId: run.entityType === 'DemoVariant' ? run.entityId ?? undefined : undefined,
        stage: stage ?? undefined,
        details: safeMetadata ?? {},
      }),
    ]);
    this.emitter.emit(`event:${run.id}`, event);
    return event;
  }

  private createContext(def: OperationDefinition, run: any): RunContext {
    const ctx: RunContext = {
      runId: run.id,
      prisma: this.prisma,
      logger: this.logger,
      env: this.env,
      currentStage: null,
      stage: async (name: string, message?: string) => {
        ctx.currentStage = name;
        await this.saveEvent(def, run, 'INFO', message ?? name, name);
      },
      log: async (level, message, options) => {
        await this.saveEvent(def, run, level, message, options?.stage ?? ctx.currentStage, options?.metadata);
      },
      info: async (message, options) => ctx.log('INFO', message, options),
      success: async (message, options) => ctx.log('SUCCESS', message, options),
      warn: async (message, options) => ctx.log('WARN', message, options),
      error: async (message, options) => ctx.log('ERROR', message, options),
      result: (value) => {
        // no-op; final result is set by execute wrapper
      },
      fail: (error) => {
        throw error instanceof Error ? error : new Error(String(error));
      },
      cancelled: () => this.cancellations.has(run.id),
    };
    return ctx;
  }

  async execute({ operationId, input, entityType, entityId, leadId, createdBy }: OperationInput) {
    const def = this.registry[operationId];
    if (!def) throw new Error(`Unknown operation: ${operationId}`);

    const active = await this.prisma.operationRun.findFirst({
      where: {
        operationId,
        leadId: leadId ?? null,
        entityId: entityId ?? null,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (active) {
      return { run: active, alreadyActive: true };
    }

    const run = await this.prisma.operationRun.create({
      data: {
        operationId,
        status: 'PENDING',
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        leadId: leadId ?? null,
        createdBy: createdBy ?? null,
        metadata: { input: redactMetadata(input ?? {}) },
      },
    });

    this.start(run.id, def, input ?? {}, operationId);
    return { run };
  }

  private getConcurrencyKey(def: OperationDefinition): string {
    // Browser-heavy operations share a single slot so Playwright and Lighthouse do not fight.
    if (def.category === 'lighthouse' || def.category === 'audit') return 'HEAVY';
    return def.category.toUpperCase();
  }

  private getSemaphore(def: OperationDefinition): AsyncSemaphore {
    const key = this.getConcurrencyKey(def);
    if (!this.semaphores.has(key)) {
      const envKey = `CONCURRENCY_${key}`;
      const raw = this.env[envKey] ?? {
        HEAVY: '1',
        AI: '1',
        SCORING: '2',
        DISCOVERY: '1',
        ENRICHMENT: '1',
        FACTORY: '1',
      }[key] ?? '1';
      const limit = Math.max(1, parseInt(raw, 10) || 1);
      this.semaphores.set(key, new AsyncSemaphore(limit));
    }
    return this.semaphores.get(key)!;
  }

  private async start(runId: string, def: OperationDefinition, input: Record<string, any>, operationId: string) {
    const sem = this.getSemaphore(def);
    await sem.acquire();
    try {
      const run = await this.prisma.operationRun.update({
        where: { id: runId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const ctx = this.createContext(def, run);
      await ctx.info(`Starting ${def.label}`, { stage: 'start', metadata: { operationId } });

      const result = await def.handler(ctx, input);

      if (this.cancellations.has(runId)) {
        await this.prisma.operationRun.update({
          where: { id: runId },
          data: { status: 'CANCELLED', finishedAt: new Date() },
        });
        await ctx.warn('Operation cancelled');
        return;
      }

      await this.prisma.operationRun.update({
        where: { id: runId },
        data: { status: 'SUCCESS', finishedAt: new Date(), result: redactMetadata(result ?? null) },
      });
      await ctx.success('Operation completed successfully', { stage: 'complete' });
      if (run.leadId) {
        await this.qualification.advance(run.leadId, run.id).catch((err: any) => {
          this.logger.warn({ leadId: run.leadId, err }, 'qualification.advance_failed');
        });
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({ runId, err }, 'operation.failed');
      const error: any = { message, name: err instanceof Error ? err.name : 'Error' };
      if (err.code) error.code = err.code;
      if (err.protocolMethod) error.protocolMethod = err.protocolMethod;
      if (err.attempt) error.attempt = err.attempt;
      if (err.details) error.details = err.details;
      await this.prisma.operationRun.update({
        where: { id: runId },
        data: { status: 'FAILED', finishedAt: new Date(), error },
      });
      try {
        const failedRun = await this.prisma.operationRun.findUnique({ where: { id: runId } });
        const ctx = this.createContext(def, failedRun || { id: runId });
        await ctx.error(message, { stage: 'error', metadata: { error } });
      } catch {}
    } finally {
      sem.release();
    }
  }

  async getRun(runId: string) {
    return this.prisma.operationRun.findUnique({
      where: { id: runId },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async listRuns(take = 50, skip = 0) {
    const [items, count] = await Promise.all([
      this.prisma.operationRun.findMany({ orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.operationRun.count(),
    ]);
    return { items, count };
  }

  async listEvents(runId: string) {
    return this.prisma.operationEvent.findMany({
      where: { operationRunId: runId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async cancel(runId: string) {
    this.cancellations.add(runId);
    return this.prisma.operationRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
  }

  subscribe(runId: string, listener: (event: any) => void) {
    this.emitter.on(`event:${runId}`, listener);
    return () => {
      this.emitter.off(`event:${runId}`, listener);
    };
  }

  getDefinitions() {
    return Object.entries(this.registry).map(([id, def]) => ({ id, ...def }));
  }

  async reconcileAll() {
    const now = new Date();
    const [interruptedRuns] = await this.prisma.$transaction([
      this.prisma.operationRun.updateMany({
        where: { status: { in: ['RUNNING', 'PENDING'] } },
        data: { status: 'INTERRUPTED', finishedAt: now, error: { message: 'Server restarted or process terminated before completion' } },
      }),
    ]);
    if (interruptedRuns.count > 0) {
      this.logger.warn({ count: interruptedRuns.count }, 'operation.reconcile.interrupted');
    }

    // Reconcile lead qualification statuses that are PENDING but already have results.
    await this.prisma.$transaction([
      this.prisma.lead.updateMany({
        where: { auditStatus: 'PENDING', auditErrorMessage: { not: null } },
        data: { auditStatus: 'FAILED' },
      }),
      this.prisma.lead.updateMany({
        where: { scoreStatus: 'PENDING', leadScoreV2: { not: null } },
        data: { scoreStatus: 'SUCCESS', scoredAt: now },
      }),
    ]);

    // Reconcile visual analysis records.
    await this.prisma.$transaction([
      this.prisma.visualAnalysis.updateMany({
        where: { status: 'PENDING', errorMessage: { not: null } },
        data: { status: 'FAILED' },
      }),
      this.prisma.visualAnalysis.updateMany({
        where: { status: 'PENDING', errorMessage: null, summary: { not: '' } },
        data: { status: 'SUCCESS' },
      }),
    ]);

    this.logger.info('operation.reconcile.complete');
  }
}
