import type { PrismaClient } from '@prisma/client';

export interface SecurityFindingInput {
  product: string; // e.g. 'dashboard', 'cms', 'template:construction-industrial-v1'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  scanner: string;
  source: string;
  ruleId?: string;
  fingerprint: string;
  title: string;
  description: string;
  evidence: Record<string, any>;
  cwe?: string;
  cve?: string;
  fixedVersion?: string;
  dependencyEcosystem?: string;
  dependencyName?: string;
  dependencyVersion?: string;
  affects?: Array<{ type: 'APP' | 'TEMPLATE' | 'SITEBUILD' | 'WORKER'; id: string; name?: string }>;
}

export interface SecurityScanner {
  readonly id: string;
  readonly category: string;
  readonly version?: string;
  run(ctx: { repoRoot: string; commitSha?: string; buildId?: string }): Promise<{
    status: 'SUCCESS' | 'FAILED';
    statusMessage?: string;
    findings: SecurityFindingInput[];
    raw?: Record<string, any>;
    summary?: Record<string, any>;
  }>;
}

export function buildFingerprint(scanner: string, ruleId: string | undefined, title: string, extra?: string): string {
  const parts = [scanner, ruleId || '', title, extra || ''];
  // simple stable hash approach: cuid-like is unnecessary; use deterministic sha256 prefix? Keep simple string.
  const raw = parts.join('|').replace(/\s+/g, ' ').trim();
  return Buffer.from(raw).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
}
