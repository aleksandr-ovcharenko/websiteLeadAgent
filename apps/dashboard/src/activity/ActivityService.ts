import { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { EventEmitter } from 'node:events';
import { normalizeError, type NormalizedError } from './normalizeError.js';

export type ActivityLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ActivityInput {
  level?: ActivityLevel;
  module: string;
  eventType?: string;
  message: string;
  stage?: string;
  runId?: string;
  discoveryRunId?: string;
  pipelineRunId?: string;
  leadId?: string;
  siteId?: string;
  demoVariantId?: string;
  durationMs?: number;
  details?: Record<string, any>;
  error?: unknown;
}

export interface ActivityFilter {
  limit?: number;
  before?: string;
  level?: string;
  levelGte?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module?: string;
  runId?: string;
  leadId?: string;
  siteId?: string;
  demoVariantId?: string;
}

const LEVEL_ORDER = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

function redact(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/api[_-]?key|token|secret|password|credential|authorization/i.test(value) && value.length > 4) {
      return '<REDACTED>';
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (/api[_-]?key|token|secret|password|credential|authorization/i.test(k)) {
        out[k] = '<REDACTED>';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export class ActivityService {
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private emitter = new EventEmitter();

  constructor(input: { prisma: PrismaClient; logger: pino.Logger }) {
    this.prisma = input.prisma;
    this.logger = input.logger;
  }

  async log(input: ActivityInput) {
    const level = input.level ?? 'INFO';
    const normalized: NormalizedError | null = input.error ? normalizeError(input.error) : null;

    const details = redact(input.details ?? {});

    const event = await this.prisma.activityEvent.create({
      data: {
        level,
        module: input.module,
        eventType: input.eventType ?? null,
        message: input.message,
        stage: input.stage ?? null,
        runId: input.runId ?? null,
        discoveryRunId: input.discoveryRunId ?? null,
        pipelineRunId: input.pipelineRunId ?? null,
        leadId: input.leadId ?? null,
        siteId: input.siteId ?? null,
        demoVariantId: input.demoVariantId ?? null,
        durationMs: input.durationMs ?? null,
        details: details ?? {},
        errorCode: normalized?.code ?? null,
        errorMessage: normalized?.friendlyMessage ?? null,
        rawError: normalized ? `${normalized.rawMessage}\n${normalized.stack ?? ''}`.trim() : null,
      },
    });

    this.logger.info({
      activityId: event.id,
      module: input.module,
      eventType: input.eventType,
      level,
      message: input.message,
      runId: input.runId,
      leadId: input.leadId,
      siteId: input.siteId,
      errorCode: normalized?.code,
    });

    this.emitter.emit('event', event);
    return event;
  }

  debug(input: Omit<ActivityInput, 'level'>) { return this.log({ ...input, level: 'DEBUG' }); }
  info(input: Omit<ActivityInput, 'level'>) { return this.log({ ...input, level: 'INFO' }); }
  warn(input: Omit<ActivityInput, 'level'>) { return this.log({ ...input, level: 'WARN' }); }
  success(input: Omit<ActivityInput, 'level'>) { return this.log({ ...input, level: 'INFO' }); }
  async error(input: Omit<ActivityInput, 'level'>) {
    const error = input.error;
    const message = input.message || (error instanceof Error ? error.message : String(error));
    return this.log({ ...input, level: 'ERROR', message, error });
  }

  async history(filter: ActivityFilter = {}) {
    const minLevel = filter.levelGte ? LEVEL_ORDER[filter.levelGte] : 0;
    const levels = Object.entries(LEVEL_ORDER)
      .filter(([, v]) => v >= minLevel)
      .map(([k]) => k);

    const where: any = {
      level: { in: levels },
    };
    if (filter.level) where.level = filter.level;
    if (filter.before) where.timestamp = { lt: new Date(filter.before) };
    if (filter.module) where.module = filter.module;
    if (filter.runId) where.runId = filter.runId;
    if (filter.leadId) where.leadId = filter.leadId;
    if (filter.siteId) where.siteId = filter.siteId;
    if (filter.demoVariantId) where.demoVariantId = filter.demoVariantId;

    const items = await this.prisma.activityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(500, Math.max(1, filter.limit ?? 200)),
    });
    return { items: items.reverse(), nextCursor: items[0]?.timestamp?.toISOString() };
  }

  subscribe(listener: (event: any) => void) {
    this.emitter.on('event', listener);
    return () => { this.emitter.off('event', listener); };
  }

  async cleanup() {
    const now = new Date();
    const infoCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const warnCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [info, warn] = await Promise.all([
      this.prisma.activityEvent.deleteMany({ where: { level: 'INFO', timestamp: { lt: infoCutoff } } }),
      this.prisma.activityEvent.deleteMany({ where: { level: { in: ['WARN', 'ERROR'] }, timestamp: { lt: warnCutoff } } }),
    ]);

    const total = await this.prisma.activityEvent.count();
    if (total > 50000) {
      const overflow = total - 50000;
      const old = await this.prisma.activityEvent.findMany({
        orderBy: { timestamp: 'asc' },
        take: overflow,
        select: { id: true },
      });
      await this.prisma.activityEvent.deleteMany({ where: { id: { in: old.map(e => e.id) } } });
    }

    return { deleted: { info: info.count, warn: warn.count } };
  }
}
