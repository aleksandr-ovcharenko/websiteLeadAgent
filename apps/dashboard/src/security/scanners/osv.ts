import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyNpmDependency } from '@minsk/security';
import type { SecurityFindingInput, SecurityScanner } from '../scanner.js';

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: { type: string; score: string }[];
  affected?: Array<{
    package: { name: string; ecosystem: string };
    ranges: Array<{ type: string; events: Array<{ introduced?: string; fixed?: string }> }>;
    versions?: string[];
  }>;
}

interface OsvBatchResult {
  results: Array<{ vulns?: OsvVuln[] }>;
}

interface LockPackage {
  name: string;
  version: string;
  path: string;
  isDev: boolean;
}

function severityFromOsv(vuln: OsvVuln): SecurityFindingInput['severity'] {
  // Prefer CVSS v3 base score if present
  const scores = vuln.severity || [];
  for (const s of scores) {
    const score = parseFloat(s.score);
    if (!isNaN(score)) {
      if (score >= 9.0) return 'CRITICAL';
      if (score >= 7.0) return 'HIGH';
      if (score >= 4.0) return 'MEDIUM';
      if (score > 0) return 'LOW';
    }
  }
  // Fallback based on id prefix or aliases
  const text = [vuln.id, ...(vuln.aliases || [])].join(' ');
  if (/CVE-.*-.*(?:200[0-9]|201[0-9]|202[0-2])\b/.test(text)) return 'LOW';
  return 'MEDIUM';
}

function selectRuleId(vuln: OsvVuln): string {
  if (vuln.id.startsWith('GHSA-')) return vuln.id;
  const ghsa = (vuln.aliases || []).find((a) => a.startsWith('GHSA-'));
  if (ghsa) return ghsa;
  const cve = (vuln.aliases || []).find((a) => a.startsWith('CVE-'));
  if (cve) return cve;
  return vuln.id;
}

function selectAlias(vuln: OsvVuln, prefix: 'GHSA' | 'CVE'): string | undefined {
  return (vuln.aliases || []).find((a) => a.startsWith(`${prefix}-`));
}

function fixedVersionFromAffected(affected: OsvVuln['affected'], pkgName: string, version: string): string | undefined {
  for (const aff of affected || []) {
    if (aff.package?.name !== pkgName) continue;
    for (const range of aff.ranges || []) {
      let introduced: string | undefined;
      for (const ev of range.events || []) {
        if (ev.introduced !== undefined) introduced = ev.introduced;
        if (ev.fixed !== undefined && (introduced === '0' || introduced === '0.0.0' || introduced === undefined)) {
          return ev.fixed;
        }
      }
    }
  }
  return undefined;
}

async function loadLockPackages(repoRoot: string): Promise<LockPackage[]> {
  const packages: LockPackage[] = [];
  try {
    const raw = await readFile(join(repoRoot, 'package-lock.json'), 'utf-8');
    const lock = JSON.parse(raw);
    const pkgs = lock.packages || {};
    for (const [nodePath, info] of Object.entries(pkgs)) {
      const p = info as any;
      if (p && p.version) {
        if (!nodePath.includes('node_modules/')) continue;
        const name = String(nodePath.split('node_modules/').pop() || nodePath).replace(/^\//, '');
        packages.push({ name, version: p.version, path: nodePath, isDev: !!p.dev });
      }
    }
  } catch {
    // ignore
  }
  return packages;
}

export interface OsvScannerOptions {
  endpoint?: string;
  batchSize?: number;
  timeoutMs?: number;
  retries?: number;
  fixturePath?: string;
}

export class OsvScanner implements SecurityScanner {
  readonly id = 'osv-scanner';
  readonly category = 'dependency';
  private opts: OsvScannerOptions;

  constructor(opts: OsvScannerOptions = {}) {
    this.opts = {
      endpoint: opts.endpoint || 'https://api.osv.dev/v1/querybatch',
      batchSize: opts.batchSize || 1000,
      timeoutMs: opts.timeoutMs || 30000,
      retries: opts.retries ?? 2,
      fixturePath: opts.fixturePath,
    };
  }

  async run(ctx: { repoRoot: string; commitSha?: string }): Promise<any> {
    const packages = await loadLockPackages(ctx.repoRoot);
    if (packages.length === 0) {
      return { status: 'SUCCESS' as const, findings: [], summary: { packages: 0 } };
    }

    let rawResult: OsvBatchResult;
    if (this.opts.fixturePath) {
      const fixture = await readFile(this.opts.fixturePath, 'utf-8');
      rawResult = JSON.parse(fixture);
    } else {
      rawResult = await this.queryBatch(packages);
    }

    const findings: SecurityFindingInput[] = [];
    let vulnerablePackages = 0;

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const result = rawResult.results?.[i];
      if (!result?.vulns?.length) continue;
      vulnerablePackages++;

      for (const vuln of result.vulns) {
        const ruleId = selectRuleId(vuln);
        const cve = selectAlias(vuln, 'CVE');
        const ghsa = selectAlias(vuln, 'GHSA');
        const canonicalId = ['npm', pkg.name, pkg.version, ruleId].join('|');
        const fingerprint = [this.id, pkg.name, pkg.version, ruleId].join('|');
        const classification = classifyNpmDependency({ packageName: pkg.name, isDev: pkg.isDev });
        const fixedVersion = fixedVersionFromAffected(vuln.affected, pkg.name, pkg.version);

        findings.push({
          product: 'wla-platform',
          severity: severityFromOsv(vuln),
          category: 'DEPENDENCY',
          environment: classification.environment,
          reachability: classification.reachability,
          scanner: this.id,
          source: 'osv',
          ruleId,
          canonicalId,
          fingerprint,
          title: vuln.summary || vuln.id,
          description: vuln.details || `OSV vulnerability ${vuln.id} affects ${pkg.name}@${pkg.version}`,
          evidence: { package: pkg.name, installedVersion: pkg.version, vulnId: vuln.id, aliases: vuln.aliases, affected: vuln.affected, path: pkg.path, classification },
          cve,
          fixedVersion,
          dependencyEcosystem: 'npm',
          dependencyName: pkg.name,
          dependencyVersion: pkg.version,
          affects: [{ type: 'APP', id: 'wla-platform', name: 'wla-platform' }],
        });
      }
    }

    return {
      status: 'SUCCESS' as const,
      findings,
      raw: rawResult,
      summary: { packages: packages.length, vulnerablePackages },
    };
  }

  private async queryBatch(packages: LockPackage[]): Promise<OsvBatchResult> {
    const queries = packages.map((p) => ({ package: { name: p.name, ecosystem: 'npm' }, version: p.version }));
    const results: OsvBatchResult['results'] = [];

    for (let i = 0; i < queries.length; i += (this.opts.batchSize || 1000)) {
      const chunk = queries.slice(i, i + (this.opts.batchSize || 1000));
      let lastErr: Error | undefined;
      for (let attempt = 0; attempt <= (this.opts.retries || 0); attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
          const res = await fetch(this.opts.endpoint!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: chunk }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`OSV API error ${res.status}: ${await res.text().catch(() => '')}`);
          const json = (await res.json()) as OsvBatchResult;
          results.push(...(json.results || []));
          break;
        } catch (err: any) {
          lastErr = err;
          if (attempt === (this.opts.retries || 0)) throw lastErr;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    return { results };
  }
}
