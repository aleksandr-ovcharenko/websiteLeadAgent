import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OsvScanner } from '../apps/dashboard/src/security/scanners/osv.js';

const fixturePath = join(process.cwd(), 'tests/fixtures/osv-batch.json');

function makeRepo(pkg: { name: string; version: string; dev?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), 'wla-osv-'));
  const lock = {
    name: 'wla-test',
    packages: {
      '': { name: 'wla-test' },
      [`node_modules/${pkg.name}`]: { version: pkg.version, dev: pkg.dev ?? false },
    },
  };
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lock, null, 2));
  return dir;
}

describe('OSV scanner', () => {
  let dir: string;

  beforeAll(() => { dir = makeRepo({ name: 'lodash', version: '4.17.0' }); });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

  it('normalizes fixture into SecurityFindingInput', async () => {
    const scanner = new OsvScanner({ fixturePath, timeoutMs: 1000 });
    const result = await scanner.run({ repoRoot: dir });
    expect(result.status).toBe('SUCCESS');
    expect(result.findings.length).toBe(1);
    const f = result.findings[0];
    expect(f.dependencyName).toBe('lodash');
    expect(f.dependencyVersion).toBe('4.17.0');
    expect(f.ruleId).toBe('GHSA-abc1-def2-ghi3');
    expect(f.cve).toBe('CVE-2023-12345');
    expect(f.severity).toBe('CRITICAL');
    expect(f.canonicalId).toBe('npm|lodash|4.17.0|GHSA-abc1-def2-ghi3');
    expect(f.environment).toBe('RUNTIME');
    expect(f.fixedVersion).toBe('4.17.21');
  });

  it('classifies build-only dependencies as non-reachable', async () => {
    const devDir = makeRepo({ name: 'vitest', version: '1.0.0', dev: true });
    const scanner = new OsvScanner({ fixturePath, timeoutMs: 1000 });
    const result = await scanner.run({ repoRoot: devDir });
    rmSync(devDir, { recursive: true, force: true });
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].environment).toBe('BUILD');
    expect(result.findings[0].reachability).toBe('NOT_REACHABLE');
  });
});
