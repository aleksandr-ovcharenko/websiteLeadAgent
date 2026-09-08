import { execFile } from 'node:child_process';
import type { SecurityFindingInput, SecurityScanner } from '../scanner.js';

interface SastRule {
  pattern: string;
  title: string;
  severity: SecurityFindingInput['severity'];
  category: string;
  environment: SecurityFindingInput['environment'];
  reachability: SecurityFindingInput['reachability'];
  product: (file: string) => string;
}

const RULES: SastRule[] = [
  { pattern: 'eval\\(', title: 'Potential code injection via eval()', severity: 'HIGH', category: 'INJECTION', environment: 'RUNTIME', reachability: 'REACHABLE', product: productFromFile },
  { pattern: 'new Function\\(', title: 'Potential code injection via new Function()', severity: 'HIGH', category: 'INJECTION', environment: 'RUNTIME', reachability: 'REACHABLE', product: productFromFile },
  { pattern: 'child_process\\.exec|exec\\(|execSync\\(', title: 'Potential command execution', severity: 'HIGH', category: 'INJECTION', environment: 'RUNTIME', reachability: 'REACHABLE', product: productFromFile },
  { pattern: 'ignoreHTTPSErrors', title: 'TLS certificate validation disabled', severity: 'HIGH', category: 'CONFIG', environment: 'RUNTIME', reachability: 'REACHABLE', product: () => 'auditor' },
  { pattern: 'dangerouslySetInnerHTML', title: 'Raw HTML injection point', severity: 'MEDIUM', category: 'XSS', environment: 'RUNTIME', reachability: 'REACHABLE', product: productFromFile },
];

function productFromFile(file: string): string {
  if (file.startsWith('apps/auditor')) return 'auditor';
  if (file.startsWith('apps/dashboard')) return 'dashboard';
  if (file.startsWith('apps/cms')) return 'cms';
  if (file.startsWith('apps/gateway')) return 'gateway';
  if (file.startsWith('apps/platform')) return 'hub';
  if (file.startsWith('apps/site-renderer')) return 'renderer';
  if (file.startsWith('packages/redesign-engine')) return 'redesign-engine';
  if (file.startsWith('packages/templates')) return 'templates';
  if (file.startsWith('packages/security')) return 'security-package';
  return 'wla-platform';
}

function gitGrep(repoRoot: string, pattern: string, pathSpec: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['grep', '-n', '-E', pattern, '--', ...pathSpec], { cwd: repoRoot }, (err, stdout) => {
      if (err && (err as any).code === 1 && !stdout) return resolve('');
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

export class WlaSastScanner implements SecurityScanner {
  readonly id = 'wla-sast';
  readonly category = 'sast';

  async run(ctx: { repoRoot: string }): Promise<any> {
    const findings: SecurityFindingInput[] = [];
    for (const rule of RULES) {
      const out = await gitGrep(ctx.repoRoot, rule.pattern, ['apps/', 'packages/']);
      const lines = out.split('\n').filter(Boolean);
      for (const line of lines) {
        const [file, raw] = line.split(':', 2);
        if (!file || !raw) continue;
        const [ln, ...rest] = raw.split(':');
        const text = rest.join(':');
        const product = rule.product(file);
        const fingerprint = [this.id, file, ln, rule.title].join('|');
        findings.push({
          product,
          severity: rule.severity,
          category: rule.category as any,
          environment: rule.environment,
          reachability: rule.reachability,
          scanner: this.id,
          source: 'wla-sast',
          ruleId: rule.title,
          canonicalId: fingerprint,
          fingerprint,
          title: rule.title,
          description: `${rule.title} in ${file}:${ln}`,
          evidence: { file, line: parseInt(ln, 10), text, pattern: rule.pattern },
          affects: [{ type: 'APP', id: product, name: product }],
        });
      }
    }
    return { status: 'SUCCESS' as const, findings, summary: { rulesRun: RULES.length } };
  }
}
