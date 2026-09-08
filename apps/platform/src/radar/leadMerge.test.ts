import { describe, it, expect } from 'vitest';
import { leadMatchesFilters } from './leadMerge';
import { defaultFilters } from './RadarFilters';

const filters = { ...defaultFilters.all };

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
