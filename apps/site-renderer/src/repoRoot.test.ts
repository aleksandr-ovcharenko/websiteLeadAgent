import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveRepoRoot } from './repoRoot.js';

// Regression: the renderer previously resolved REPO_ROOT from process.cwd(),
// which silently broke asset/media serving when started from a package dir.
const moduleUrl = 'file:///repo/apps/site-renderer/src/repoRoot.ts';

describe('resolveRepoRoot', () => {
  it('derives the repo root from the module location, not cwd', () => {
    const root = resolveRepoRoot(moduleUrl, {});
    expect(root).toBe(path.resolve('/repo'));
  });

  it('is identical regardless of the process cwd', () => {
    const a = resolveRepoRoot(moduleUrl, {});
    process.chdir('/');
    const b = resolveRepoRoot(moduleUrl, {});
    expect(a).toBe(b);
  });

  it('honours the WLA_REPO_ROOT override', () => {
    expect(resolveRepoRoot(moduleUrl, { WLA_REPO_ROOT: '/custom' })).toBe('/custom');
  });
});
