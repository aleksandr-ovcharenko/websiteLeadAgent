import { describe, it, expect } from 'vitest';
import { mergeLeadsPreserveOrder, pickAdjacentSelection, leadMatchesFilters } from './leadMerge';
import { defaultFilters } from './RadarFilters';

const filters = { ...defaultFilters.all };

describe('mergeLeadsPreserveOrder', () => {
  it('patches rows in place without reordering them during background updates', () => {
    const prev = [
      { id: 'a', leadScoreV2: 10 },
      { id: 'b', leadScoreV2: 90 },
      { id: 'c', leadScoreV2: 50 },
    ];
    // Server returns rows re-sorted by the new score of B.
    const items = [
      { id: 'b', leadScoreV2: 99 },
      { id: 'c', leadScoreV2: 50 },
      { id: 'a', leadScoreV2: 10 },
    ];
    const merged = mergeLeadsPreserveOrder(prev, items);
    expect(merged.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(merged[1].leadScoreV2).toBe(99);
  });

  it('appends newly discovered leads at the end without moving existing rows', () => {
    const prev = [{ id: 'a' }, { id: 'b' }];
    const items = [{ id: 'x' }, { id: 'a' }, { id: 'b' }];
    const merged = mergeLeadsPreserveOrder(prev, items);
    expect(merged.map((l) => l.id)).toEqual(['a', 'b', 'x']);
  });

  it('keeps rows absent from a background payload until an explicit refresh boundary', () => {
    // A background state transition must not collapse the list under the
    // user's viewport — the snapshot stays stable until a deliberate refresh.
    const prev = [{ id: 'a' }, { id: 'b' }];
    const items = [{ id: 'a' }];
    expect(mergeLeadsPreserveOrder(prev, items).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('uses server order on initial load (empty previous list)', () => {
    const items = [{ id: 'b' }, { id: 'a' }];
    expect(mergeLeadsPreserveOrder([], items).map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('pickAdjacentSelection', () => {
  it('prefers the next row in displayed order', () => {
    expect(pickAdjacentSelection(['a', 'b', 'c'], 'b')).toBe('c');
  });
  it('falls back to the previous row for the last row', () => {
    expect(pickAdjacentSelection(['a', 'b', 'c'], 'c')).toBe('b');
  });
  it('returns null when nothing remains', () => {
    expect(pickAdjacentSelection(['a'], 'a')).toBeNull();
  });
  it('never invents a selection for an unknown id', () => {
    expect(pickAdjacentSelection(['a', 'b'], 'zzz')).toBeNull();
  });
});

describe('leadMatchesFilters', () => {
  const base = {
    id: 'l1',
    companyName: 'Acme',
    website: 'https://acme.by',
    websiteDomain: 'acme.by',
    websiteStatus: 'FOUND',
    manualReviewStatus: 'UNREVIEWED',
    redesignStage: 'NOT_SELECTED',
    readyForReview: true,
  };

  it('matches the default all view', () => {
    expect(leadMatchesFilters(base, filters, 'all')).toBe(true);
  });

  it('drops a lead out of a manual-status view after review', () => {
    const f = { ...filters, manual: 'UNREVIEWED' };
    expect(leadMatchesFilters({ ...base, manualReviewStatus: 'BAD' }, f, 'all')).toBe(false);
  });

  it('requires readyForReview for the READY qualification view', () => {
    const f = { ...filters, qualificationStatus: 'READY' };
    expect(leadMatchesFilters({ ...base, readyForReview: false }, f, 'review')).toBe(false);
    expect(leadMatchesFilters(base, f, 'review')).toBe(true);
  });

  it('requires GOOD + pipeline stage for READY_FOR_GENERATION', () => {
    const f = { ...filters, generationStatus: 'READY_FOR_GENERATION' };
    // Early GOOD alone is not generation-ready.
    expect(leadMatchesFilters({ ...base, manualReviewStatus: 'GOOD' }, f, 'generation')).toBe(false);
    expect(leadMatchesFilters({ ...base, manualReviewStatus: 'GOOD', redesignStage: 'SELECTED_FOR_REDESIGN' }, f, 'generation')).toBe(true);
    // BAD never enters generation readiness.
    expect(leadMatchesFilters({ ...base, manualReviewStatus: 'BAD', redesignStage: 'SELECTED_FOR_REDESIGN' }, f, 'generation')).toBe(false);
  });
});
