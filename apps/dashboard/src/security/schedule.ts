import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { SecurityAuditService } from './audit.js';

export interface SecurityScheduleOptions {
  prisma: PrismaClient;
  logger: pino.Logger;
  repoRoot: string;
  dependencyRefreshMs?: number;
  fullAuditMs?: number;
}

export class SecurityScheduleService {
  private audit: SecurityAuditService;
  private logger: pino.Logger;
  private prisma: PrismaClient;
  private repoRoot: string;
  private dependencyRefreshMs: number;
  private fullAuditMs: number;
  private dependencyTimer?: NodeJS.Timeout;
  private fullAuditTimer?: NodeJS.Timeout;
  private running = new Set<string>();

  constructor(opts: SecurityScheduleOptions) {
    this.prisma = opts.prisma;
    this.logger = opts.logger;
    this.repoRoot = opts.repoRoot;
    this.audit = new SecurityAuditService({ prisma: opts.prisma, logger: opts.logger, repoRoot: opts.repoRoot });
    this.dependencyRefreshMs = opts.dependencyRefreshMs ?? 1000 * 60 * 60; // 1 hour
    this.fullAuditMs = opts.fullAuditMs ?? 1000 * 60 * 60 * 24; // 1 day
  }

  start() {
    this.stop();
    this.dependencyTimer = setInterval(() => this.runGuarded('dependency-refresh', () => this.audit.runAll({ category: 'dependency' })), this.dependencyRefreshMs);
    this.fullAuditTimer = setInterval(() => this.runGuarded('full-audit', () => this.audit.runAll()), this.fullAuditMs);
    // Run an initial dependency refresh shortly after startup to avoid a long cold wait.
    setTimeout(() => this.runGuarded('dependency-refresh', () => this.audit.runAll({ category: 'dependency' })), 5000);
  }

  stop() {
    if (this.dependencyTimer) clearInterval(this.dependencyTimer);
    if (this.fullAuditTimer) clearInterval(this.fullAuditTimer);
  }

  private async runGuarded(label: string, task: () => Promise<any>) {
    if (this.running.has(label)) {
      this.logger.warn({ label }, 'security.schedule.skipped.already_running');
      return;
    }
    this.running.add(label);
    try {
      this.logger.info({ label }, 'security.schedule.start');
      await task();
      this.logger.info({ label }, 'security.schedule.complete');
    } catch (err: any) {
      this.logger.error({ label, err: err.message }, 'security.schedule.failed');
      // Audit status is persisted by SecurityAuditService; a failure creates a FAILED audit row.
    } finally {
      this.running.delete(label);
    }
  }
}
