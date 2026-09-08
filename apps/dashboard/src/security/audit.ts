import type { PrismaClient } from '@prisma/client';
import type { SecurityFindingInput, SecurityScanner } from './scanner.js';
import { NpmAuditScanner } from './scanners/npmAudit.js';
import { WlaSastScanner } from './scanners/wlaSast.js';
import { RegexSecretScanner } from './scanners/regexSecrets.js';
import { OsvScanner } from './scanners/osv.js';
import { evaluateSecurityGate } from './gate.js';
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
    return [
      new NpmAuditScanner(),
      new WlaSastScanner(),
      new RegexSecretScanner(),
      new OsvScanner({ endpoint: process.env.OSV_ENDPOINT, fixturePath: process.env.OSV_FIXTURE, timeoutMs: 60000 }),
    ];
  }

  async runAll(opts?: { category?: string; scanner?: string; commitSha?: string; buildId?: string }): Promise<any[]> {
    const configs = await this.prisma.securityScannerConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.scanner, c.enabled]));

    const results: any[] = [];
    const enabled = this.scanners.filter((s) => {
      if (opts?.scanner) return s.id === opts.scanner;
      if (opts?.category) return s.category === opts.category && configMap.get(s.id) !== false;
      return configMap.get(s.id) !== false;
    });

    for (const scanner of enabled) {
      results.push(await this.runOne(scanner, opts));
    }

    const gate = await evaluateSecurityGate(this.prisma);
    this.logger.info({ gate: gate.status, ...gate }, 'security.gate');
    return { results, gate };
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
      if (result.status === 'FAILED') {
        throw new Error(result.statusMessage || `${scanner.id} reported failure`);
      }
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
          status: { in: ['OPEN', 'FIXING'] },
          lastDetectedAt: { lt: lastDetected },
        },
        data: { status: 'RESOLVED', lastDetectedAt: new Date() },
      });

      // For dependency scanners, also resolve findings from other scanners when the
      // vulnerable dependency+version is no longer present in the lockfile.
      if (scanner.category === 'dependency') {
        const presentDeps = new Set(
          result.findings
            .filter((f) => f.dependencyName && f.dependencyVersion)
            .map((f) => `${f.dependencyName}@${f.dependencyVersion}`)
        );
        const openDepFindings = await this.prisma.securityFinding.findMany({
          where: {
            status: { in: ['OPEN', 'FIXING'] },
            category: 'DEPENDENCY',
            scanner: { not: scanner.id },
          },
          include: { dependency: true },
        });
        const missingDepIds = openDepFindings
          .filter((f) => f.dependency && !presentDeps.has(`${f.dependency.name}@${f.dependency.version}`))
          .map((f) => f.id);
        if (missingDepIds.length > 0) {
          await this.prisma.securityFinding.updateMany({
            where: { id: { in: missingDepIds } },
            data: { status: 'RESOLVED', lastDetectedAt: new Date() },
          });
          this.logger.info({ scanner: scanner.id, resolvedMissing: missingDepIds.length }, 'security.finding.resolved.missing_dep');
        }
      }

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

    const canonicalId = f.canonicalId || f.fingerprint;
    const finding = await this.prisma.securityFinding.upsert({
      where: { fingerprint: f.fingerprint },
      update: {
        lastDetectedAt: new Date(),
        auditId,
        environment: (f.environment as any) ?? 'UNKNOWN',
        reachability: (f.reachability as any) ?? 'UNKNOWN',
        canonicalId,
      },
      create: {
        auditId,
        product: f.product,
        severity: f.severity as any,
        category: f.category as any,
        environment: (f.environment as any) ?? 'UNKNOWN',
        reachability: (f.reachability as any) ?? 'UNKNOWN',
        scanner: f.scanner,
        source: f.source,
        ruleId: f.ruleId,
        canonicalId,
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
