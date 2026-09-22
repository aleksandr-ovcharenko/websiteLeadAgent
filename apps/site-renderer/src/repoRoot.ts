import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root must not depend on the launch cwd — derive it from this file's
// location (apps/site-renderer/src → repo root). An override is still possible
// via WLA_REPO_ROOT for unusual deployments.
export function resolveRepoRoot(moduleUrl: string, env: Record<string, string | undefined> = process.env): string {
  return env.WLA_REPO_ROOT || path.resolve(fileURLToPath(moduleUrl), '../../../..');
}
