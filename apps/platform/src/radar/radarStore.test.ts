import { describe, it, expect } from 'vitest';
import { RadarStore } from './radarStore';

const mk = (id: string, extra: any = {}) => ({ id, companyName: `Lead ${id}`, updatedAt: `2026-01-01T00:00:${String(extra.rev ?? 0).padStart(2, '0')}.000Z`, ...extra });

describe('RadarStore — view snapshot immutability', () => {
  it('entity patches never mutate visibleLeadIds (100-event storm)', () => {
    const s = new RadarStore();
    const leads = Array.from({ length: 50 }, (_, i) => mk(`l${i}`, { rev: 1 }));
    s.loadView(leads);
    const before = s.getVisibleIds();
    // 100 random patches across all leads
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const id = `l${i % 50}`;
      s.patchEntity(mk(id, { rev: 10 + i, auditStatus: 'FAILED' }));
      n++;
    }
    expect(n).toBe(100);
    expect(s.getVisibleIds()).toEqual(before);
    expect(s.getVisibleIds()).toBe(before); // same array reference
    expect(s.getLead('l7').auditStatus).toBe('FAILED');
  });

  it('out-of-order patches are ignored via revision', () => {
    const s = new RadarStore();
    s.loadView([mk('a', { rev: 5 })]);
    s.patchEntity(mk('a', { rev: 10, leadScoreV2: 90 }));
    s.patchEntity(mk('a', { rev: 7, leadScoreV2: 1 })); // stale delivery
    expect(s.getLead('a').leadScoreV2).toBe(90);
  });

  it('LEAD_CREATED surfaces as pending, never auto-inserts', () => {
    const s = new RadarStore();
    s.loadView([mk('a'), mk('b')]);
    s.patchEntity(mk('new1', { rev: 2 }));
    expect(s.getVisibleIds()).toEqual(['a', 'b']);
    expect([...s.getPending()]).toContain('new1');
  });

  it('filter-membership drift keeps the row and flags the view', () => {
    const s = new RadarStore();
    const failedView = { matches: (l: any) => l.auditStatus === 'FAILED' };
    s.setViewSpec(failedView);
    s.loadView([mk('a', { auditStatus: 'FAILED' }), mk('b', { auditStatus: 'FAILED' })]);
    s.patchEntity(mk('b', { rev: 2, auditStatus: 'SUCCESS' })); // recovered
    expect(s.getVisibleIds()).toEqual(['a', 'b']); // row stays
    expect([...s.getPending()]).toContain('b');    // view flagged
  });

  it('explicit refresh (loadView) reconciles pending changes', () => {
    const s = new RadarStore();
    s.setViewSpec({ matches: (l: any) => l.auditStatus === 'FAILED' });
    s.loadView([mk('a', { auditStatus: 'FAILED' }), mk('b', { auditStatus: 'FAILED' })]);
    s.patchEntity(mk('b', { rev: 2, auditStatus: 'SUCCESS' }));
    s.loadView([mk('a', { auditStatus: 'FAILED' }), mk('new', { rev: 3, auditStatus: 'FAILED' })]);
    expect(s.getVisibleIds()).toEqual(['a', 'new']);
    expect(s.getPending().size).toBe(0);
  });

  it('external deletion flags the view; user deletion removes rows', () => {
    const s = new RadarStore();
    s.loadView([mk('a'), mk('b'), mk('c')]);
    s.noteExternalDelete('b');
    expect(s.getVisibleIds()).toEqual(['a', 'b', 'c']);
    expect(s.getLead('b').__deleted).toBe(true);
    s.removeEntities(['a']);
    expect(s.getVisibleIds()).toEqual(['b', 'c']);
    expect(s.getLead('a')).toBeNull();
  });

  it('subscribers are notified only by writes', () => {
    const s = new RadarStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.loadView([mk('a')]);
    expect(calls).toBe(1);
    s.patchEntity(mk('a')); // identical content → no-op
    expect(calls).toBe(1);
    s.patchEntity(mk('a', { rev: 9, auditStatus: 'FAILED' }));
    expect(calls).toBe(2);
  });
});
