// V3.7.6 Phase 5 — static anti-overfit gate.
//
// Fails if client-specific values leak into production code or operational
// scripts: customer domains, brand names, site/lead/crawl-run IDs, preview
// tokens, or per-client route slugs used as conditions.
//
// Allowed locations for client values:
//   - test files and test fixtures (tests/**, **/*.test.*, **/fixtures/**)
//   - the quarantined archive/legacy-scenarios/** tree (marked non-production)
//   - reports/docs (*.md), generated data (data/**)
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..');

// Production code + operational scripts: no client values allowed here.
const SCAN_ROOTS = ['apps', 'packages', 'scripts', 'prisma'];

const ALLOWED = [
  /(^|\/)archive\/legacy-scenarios\//, // quarantined non-production scenarios
  /(^|\/)legacy\//,
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/, // tests may carry fixture inputs
  /(^|\/)fixtures?\//,              // test fixtures
  /\.md$/,                          // docs/reports
  /(^|\/)e2e\//,                    // Playwright evidence specs
  /(^|\/)generated-sites\//,        // generated output
  /(^|\/)dist\//,
  /node_modules/,
  /CHANGELOG|schema\.prisma$/,
];

// Client/domain identifiers that must never appear in scanned code.
// Aggregator/marketplace deny-list entries in the eligibility policy
// (evaluateWebsiteEligibility.ts POLICY) are platform data, not client
// overfit — they are intentionally absent here.
const CLIENT_TERMS = [
  /nexttrade/i, /\b100m3\b/i, /\batelit\b/i, /\bmapid\b/i, /garantk/i,
  /protender/i, /\blishen\b/i, /proekt-m/i, /\bversh\.by/i, /savit/i,
  /northwaterfront/i, /radlen/i, /minskdsk/i, /\bmrs\.by/i,
];

// Hardcoded runtime identifiers (Prisma cuid-shaped strings).
const CUID_RE = /\bcm[a-z0-9]{22,}\b/;
// Hardcoded preview tokens in showcase URLs.
const SHOWCASE_TOKEN_RE = /\/showcase\/[a-z0-9]{6,}/i;

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'generated-sites', 'legacy', 'archive'].includes(e)) continue;
      yield* walk(p);
    } else if (/\.(ts|tsx|mjs|js)$/.test(e)) {
      yield p;
    }
  }
}

function isAllowed(path: string) {
  const rel = relative(ROOT, path);
  return ALLOWED.some((re) => re.test(rel));
}

function collect() {
  const hits: string[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(ROOT, root);
    let files: string[] = [];
    try { files = [...walk(abs)]; } catch { continue; }
    for (const f of files) {
      if (isAllowed(f)) continue;
      const rel = relative(ROOT, f);
      const src = readFileSync(f, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const term of CLIENT_TERMS) {
          if (term.test(line)) hits.push(`${rel}:${i + 1} client term ${term.source}: ${line.trim().slice(0, 90)}`);
        }
        if (CUID_RE.test(line)) hits.push(`${rel}:${i + 1} hardcoded id: ${line.trim().slice(0, 90)}`);
        if (SHOWCASE_TOKEN_RE.test(line)) hits.push(`${rel}:${i + 1} hardcoded showcase token: ${line.trim().slice(0, 90)}`);
      }
    }
  }
  return hits;
}

describe('anti-overfit gate', () => {
  it('no client-specific values in production code or operational scripts', () => {
    const hits = collect();
    expect(hits, `\n${hits.join('\n')}`).toEqual([]);
  });
});
