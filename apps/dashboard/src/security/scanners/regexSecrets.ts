import { execFile } from 'node:child_process';
import type { SecurityFindingInput, SecurityScanner } from '../scanner.js';

interface SecretRule {
  name: string;
  pattern: string;
  severity: SecurityFindingInput['severity'];
}

const RULES: SecretRule[] = [
  { name: 'google-api-key', pattern: 'AIza[0-9A-Za-z_-]{35}', severity: 'HIGH' },
  { name: 'openai-api-key', pattern: 'sk-[a-zA-Z0-9]{48}', severity: 'CRITICAL' },
  { name: 'github-pat', pattern: 'ghp_[a-zA-Z0-9]{36}', severity: 'CRITICAL' },
  { name: 'slack-bot-token', pattern: 'xoxb-[0-9a-zA-Z-]+', severity: 'HIGH' },
  { name: 'aws-access-key', pattern: 'AKIA[0-9A-Z]{16}', severity: 'CRITICAL' },
  { name: 'npm-auth-token', pattern: 'npm_[a-zA-Z0-9]{36}', severity: 'HIGH' },
];

function gitGrep(repoRoot: string, pattern: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['grep', '-n', '-E', pattern], { cwd: repoRoot }, (err, stdout) => {
      if (err && (err as any).code === 1 && !stdout) return resolve('');
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

export class RegexSecretScanner implements SecurityScanner {
  readonly id = 'regex-secrets';
  readonly category = 'secrets';

  async run(ctx: { repoRoot: string }): Promise<any> {
    const findings: SecurityFindingInput[] = [];
    for (const rule of RULES) {
      const out = await gitGrep(ctx.repoRoot, rule.pattern);
      const lines = out.split('\n').filter(Boolean);
      for (const line of lines) {
        // git grep -n output: file:line:content
        const m = line.match(/^(.+):(\d+):(.*)$/);
        if (!m) continue;
        const [, file, ln, text] = m;
        const fingerprint = [this.id, rule.name, file, ln].join('|');
        findings.push({
          product: 'wla-platform',
          severity: rule.severity,
          category: 'SECRETS',
          environment: 'UNKNOWN',
          reachability: 'UNKNOWN',
          scanner: this.id,
          source: 'git-grep',
          ruleId: rule.name,
          canonicalId: fingerprint,
          fingerprint,
          title: `Possible ${rule.name} secret`,
          description: `Detected pattern for ${rule.name} in ${file}:${ln}. Verify and rotate if real.`,
          evidence: { file, line: parseInt(ln, 10), text: text.slice(0, 200), detector: rule.name },
          affects: [{ type: 'APP', id: 'wla-platform', name: 'wla-platform' }],
        });
      }
    }
    return { status: 'SUCCESS' as const, findings, summary: { rulesRun: RULES.length } };
  }
}
