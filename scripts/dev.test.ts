import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { killAll } from './dev';

function isAlive(cp: ReturnType<typeof spawn>) {
  return cp.exitCode === null && cp.signalCode === null;
}

describe('dev.ts killAll', () => {
  it('terminates a child process tree and is safe to call repeatedly', async () => {
    // A detached child with its own grandchild — mimics `npx tsx ...` trees.
    const cp = spawn('bash', ['-c', 'sleep 30 & sleep 30'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });
    const list = [{ label: 'test-sleep', cp }];

    expect(isAlive(cp)).toBe(true);
    expect(() => killAll(list)).not.toThrow();
    // Idempotent: calling again while shutting down must not throw.
    expect(() => killAll(list)).not.toThrow();

    await delay(1000);
    expect(isAlive(cp)).toBe(false);

    // Grandchild should also be gone (process-group kill).
    if (process.platform !== 'win32') {
      const { execSync } = await import('node:child_process');
      const out = execSync('pgrep -f "sleep 30" || true').toString().trim();
      expect(out).toBe('');
    }
  }, 15000);
});
