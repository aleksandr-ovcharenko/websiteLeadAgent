import type { PrismaClient } from '@prisma/client';
import type { SecurityFindingInput, SecurityScanner } from './scanner.js';
import { NpmAuditScanner } from './scanners/npmAudit.js';
import { WlaSastScanner } from './scanners/wlaSast.js';
import { RegexSecretScanner } from './scanners/regexSecrets.js';
import type pino from 'pino';

export interface AuditServiceOptions {
  prisma: PrismaClient;
  logger: pino.Logger;
  repoRoot: string;
  commitSha?: string;
}

export class SecurityAuditService {
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private repoRoot: string;

  constructor(opts: AuditServiceOptions) {
    this.prisma = opts.prisma;
    this.logger = opts.logger;
    this.repoRoot = opts.repoRoot;
  }

  get scanners(): SecurityScanner[] {
    return [new NpmAuditScanner(), new WlaSastScanner(), new RegexSecretScanner()];
  }

  async runAll(opts?: { category?: string; scanner?: string; commitSha?: string; buildId?: string }): Promise<any[]> {
    const results: any[] = [];
    const enabled = this.scanners.filter((s) => (!opts?.category || s.category === opts.category) && (!opts?.scanner || s.id === opts.scanner));
    for (const scanner of enabled) {
      results.push(await this.runOne(scanner, opts));
    }
    return results;
  }

  async runOne(scanner: SecurityScanner, opts?: { commitSha?: string; buildId?: string }): Promise<any> {
    const audit = await this.prisma.securityAudit.create({
      data: {
        scanner: scanner.id,
        category: scanner.category,
        status: 'RUNNING',
        commitSha: opts?.commitSha,
        buildId: opts?.buildId,
      },
    });

    try {
      const start = Date.now();
      const result = await scanner.run({ repoRoot: this.repoRoot, commitSha: opts?.commitSha, buildId: opts?.buildId });
      const end = Date.now();
      this.logger.info({ scanner: scanner.id, findings: result.findings.length, durationMs: end - start }, 'security.audit.complete');

      // Persist findings and affect map
      for (const f of result.findings) {
        await this.upsertFinding(f, audit.id);
      }

      // Resolve previously open findings from this scanner that were not reported this run
      const lastDetected = new Date(audit.startedAt);
      const resolved = await this.prisma.securityFinding.updateMany({
        where: {
          scanner: scanner.id,
          status: 'OPEN',
          lastDetectedAt: { lt: lastDetected },
        },
        data: { status: 'RESOLVED', lastDetectedAt: new Date() },
      });

      const updated = await this.prisma.securityAudit.update({
        where: { id: audit.id },
        data: {
          completedAt: new Date(),
          status: result.status,
          statusMessage: result.statusMessage || undefined,
          rawResult: result.raw ? (result.raw as any) : undefined,
          summary: result.summary ? (result.summary as any) : undefined,
        },
      });

      this.logger.info({ scanner: scanner.id, resolvedCount: resolved.count }, 'security.finding.reconciled');
      return updated;
    } catch (err: any) {
      this.logger.error({ scanner: scanner.id, err: err.message }, 'security.audit.failed');
      await this.prisma.securityAudit.update({
        where: { id: audit.id },
        data: {
          completedAt: new Date(),
          status: 'FAILED',
          statusMessage: err.message,
        },
      });
      throw err;
    }
  }

  private async upsertFinding(f: SecurityFindingInput, auditId: string): Promise<void> {
    let dependencyId: string | undefined;
    if (f.dependencyEcosystem && f.dependencyName && f.dependencyVersion) {
      const dep = await this.prisma.securityDependency.upsert({
        where: {
          ecosystem_name_version: { ecosystem: f.dependencyEcosystem, name: f.dependencyName, version: f.dependencyVersion },
        },
        update: { lastCheckedAt: new Date() },
        create: {
          ecosystem: f.dependencyEcosystem,
          name: f.dependencyName,
          version: f.dependencyVersion,
          cves: f.cve ? [{ cve: f.cve, severity: f.severity, fixedVersion: f.fixedVersion }] : undefined,
        },
      });
      dependencyId = dep.id;
    }

    const finding = await this.prisma.securityFinding.upsert({
      where: { fingerprint: f.fingerprint },
      update: {
        lastDetectedAt: new Date(),
        auditId,
        status: f.status === 'RESOLVED' ? undefined : undefined, // keep OPEN/FIXING unless explicitly changed
      },
      create: {
        auditId,
        product: f.product,
        severity: f.severity as any,
        category: f.category as any,
        scanner: f.scanner,
        source: f.source,
        ruleId: f.ruleId,
        fingerprint: f.fingerprint,
        title: f.title,
        description: f.description,
        evidence: f.evidence as any,
        cwe: f.cwe,
        cve: f.cve,
        dependencyId,
        fixedVersion: f.fixedVersion,
        createdBy: f.scanner,
      },
    });

    // Re-open if resolved
    if (finding.status === 'RESOLVED' || finding.status === 'FALSEPOSITIVE') {
      await this.prisma.securityFinding.update({
        where: { id: finding.id },
        data: { status: 'OPEN', lastDetectedAt: new Date() },
      });
    }

    if (f.affects) {
      for (const a of f.affects) {
        await this.prisma.securityAffect.upsert({
          where: {
            findingId_assetType_assetId: { findingId: finding.id, assetType: a.type as any, assetId: a.id },
          },
          update: { assetName: a.name },
          create: {
            findingId: finding.id,
            assetType: a.type as any,
            assetId: a.id,
            assetName: a.name,
          },
        });
      }
    }
  }
}
