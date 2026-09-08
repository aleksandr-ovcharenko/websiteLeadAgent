import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SecurityFindingInput, SecurityScanner } from '../scanner.js';

interface NpmAuditAdvisory {
  title?: string;
  source?: number | string;
  dependency?: string;
  name?: string;
  range?: string;
}

interface NpmAuditVuln {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  isDirect?: boolean;
  via: (string | NpmAuditAdvisory)[];
  effects?: string[];
  range: string;
  nodes: string[];
  fixAvailable?: boolean | { name: string; version: string };
}

interface NpmAuditJson {
  metadata?: {
    vulnerabilities?: Record<string, number>;
  };
  vulnerabilities?: Record<string, NpmAuditVuln>;
}

function productFromPath(path: string): string {
  if (path.includes('apps/dashboard') || path.includes('@minsk/dashboard')) return 'dashboard';
  if (path.includes('apps/cms') || path.includes('@minsk/cms')) return 'cms';
  if (path.includes('apps/platform') || path.includes('@minsk/platform')) return 'hub';
  if (path.includes('apps/auditor') || path.includes('@minsk/auditor')) return 'auditor';
  if (path.includes('apps/gateway') || path.includes('@minsk/gateway')) return 'gateway';
  if (path.includes('apps/site-renderer') || path.includes('@minsk/site-renderer')) return 'renderer';
  if (path.includes('packages/redesign-engine') || path.includes('@minsk/redesign-engine')) return 'redesign-engine';
  if (path.includes('packages/templates') || path.includes('@minsk/templates')) return 'templates';
  if (path.includes('packages/security') || path.includes('@minsk/security')) return 'security-package';
  if (path.includes('node_modules/playwright') || path.includes('node_modules/puppeteer-core') || path.includes('node_modules/lighthouse')) return 'auditor';
  if (path.includes('node_modules/vitest')) return 'dev-tooling';
  return 'wla-platform';
}

function cleanAdvisory(via: any): { title: string; source?: string } {
  if (typeof via === 'string') return { title: `${via} dependency` };
  return { title: via.title || via.name || 'Unknown advisory', source: String(via.source || '') };
}

function severityOf(s: NpmAuditVuln['severity']): SecurityFindingInput['severity'] {
  const map: Record<string, SecurityFindingInput['severity']> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    moderate: 'MEDIUM',
    low: 'LOW',
  };
  return map[s] || 'INFO';
}

async function buildVersionMap(repoRoot: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const raw = await readFile(join(repoRoot, 'package-lock.json'), 'utf-8');
    const lock = JSON.parse(raw);
    const pkgs = lock.packages || {};
    for (const [nodePath, info] of Object.entries(pkgs)) {
      const dep = info as any;
      if (dep && dep.version) {
        const name = nodePath.split('/node_modules/').pop() || nodePath;
        map[name] = dep.version;
        map[nodePath.replace('node_modules/', '')] = dep.version;
      }
    }
  } catch {
    // ignore; fall back to audit nodes
  }
  return map;
}

export class NpmAuditScanner implements SecurityScanner {
  readonly id = 'npm-audit';
  readonly category = 'dependency';

  async run(ctx: { repoRoot: string; commitSha?: string }): Promise<any> {
    const versionMap = await buildVersionMap(ctx.repoRoot);
    const raw = await new Promise<string>((resolve, reject) => {
      execFile('npm', ['audit', '--json'], { cwd: ctx.repoRoot, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        // npm audit exits non-zero when vulnerabilities are present, but still prints JSON on stdout
        if (stdout) return resolve(stdout);
        if (err) return reject(new Error(String(err.message || stderr || 'npm audit failed')));
        return reject(new Error(stderr || 'npm audit produced no output'));
      });
    });

    let audit: NpmAuditJson;
    try {
      audit = JSON.parse(raw);
    } catch (err: any) {
      return { status: 'FAILED' as const, statusMessage: `npm audit JSON parse error: ${err.message}`, findings: [], raw: { raw } };
    }

    const counts = audit.metadata?.vulnerabilities || {};
    const vulns = audit.vulnerabilities || {};
    const findings: SecurityFindingInput[] = [];

    for (const [pkg, v] of Object.entries(vulns)) {
      const installedVersion = versionMap[pkg] || v.range;
      const fixedVersion = typeof v.fixAvailable === 'object' ? v.fixAvailable.version : undefined;
      const advisory = v.via?.find((x: any) => typeof x === 'object' && x.title) || v.via?.[0];
      const adv = cleanAdvisory(advisory);
      const source = typeof advisory === 'object' ? (advisory as any).source : undefined;
      const cveMatch = String(source || adv.title).match(/(CVE-\d{4}-\d+)/);
      const ghsaMatch = String(source || adv.title).match(/(GHSA-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})/);

      // Build affects from all installed nodes
      const products = new Map<string, string>();
      for (const node of v.nodes || []) {
        const prod = productFromPath(node);
        products.set(prod, prod);
      }
      if (products.size === 0) products.set('wla-platform', 'wla-platform');

      const affects: any[] = [];
      for (const prod of products.values()) {
        const assetType = prod === 'templates' ? 'TEMPLATE' : 'APP';
        const assetId = prod === 'templates' ? 'template:all' : prod;
        affects.push({ type: assetType, id: assetId, name: prod });
      }

      const primaryProduct = products.values().next().value || 'wla-platform';
      const fingerprint = [this.id, pkg, installedVersion, adv.title].join('|');
      findings.push({
        product: primaryProduct,
        severity: severityOf(v.severity),
        category: 'DEPENDENCY',
        scanner: this.id,
        source: 'npm-audit',
        ruleId: cveMatch?.[1] || ghsaMatch?.[1] || adv.title,
        fingerprint,
        title: adv.title,
        description: `Vulnerable dependency ${pkg}@${installedVersion} (${v.range}). ${adv.title}`,
        evidence: { package: pkg, installedVersion, range: v.range, fixAvailable: v.fixAvailable, via: v.via, nodes: v.nodes },
        cve: cveMatch?.[1],
        fixedVersion,
        dependencyEcosystem: 'npm',
        dependencyName: pkg,
        dependencyVersion: installedVersion,
        affects,
      });
    }

    return {
      status: 'SUCCESS' as const,
      findings,
      raw: audit,
      summary: { counts, packagesScanned: Object.keys(versionMap).length },
    };
  }
}
