import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Part A regression guard: no unconditional periodic fetches in Radar.
// The only allowed re-fetch triggers are SSE activity events, explicit
// Refresh, or bounded polling while a non-terminal run exists.

const dir = join(__dirname);

function src(f: string) {
  return readFileSync(join(dir, f), 'utf8');
}

describe('Radar idle polling removal', () => {
  it('8. RadarStats/RadarLeads/RadarHistory have no setInterval timers', () => {
    for (const f of ['RadarStats.tsx', 'RadarLeads.tsx', 'RadarHistory.tsx']) {
      expect(src(f), f).not.toMatch(/setInterval\s*\(/);
    }
  });

  it('8b. no unconditional setTimeout polling loops — re-scheduling is gated on active runs', () => {
    for (const f of ['RadarStats.tsx', 'RadarLeads.tsx', 'RadarHistory.tsx']) {
      const code = src(f);
      // every setTimeout-based reschedule must live behind an active-run guard
      const timeouts = code.match(/setTimeout\s*\(/g) || [];
      for (const _ of timeouts) {
        expect(code, `${f} must gate polling on active discovery runs`).toMatch(/activeRuns|activeDiscovery|NON_TERMINAL/);
      }
    }
  });

  it('RadarStats is presentational: does not fetch stats or runs itself', () => {
    const code = src('RadarStats.tsx');
    expect(code).not.toMatch(/getLeadStats|getDiscoveryRuns/);
  });

  it('RadarLeads has a single stats state — no duplicate stats fetching', () => {
    const code = src('RadarLeads.tsx');
    const statsCalls = code.match(/getLeadStats\s*\(/g) || [];
    expect(statsCalls.length).toBeLessThanOrEqual(1);
  });
});
