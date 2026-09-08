import { describe, it, expect } from 'vitest';
import { getBulkAiEligibility } from './bulkAiEligibility';

const base = { id: 'a', website: 'https://x.by', websiteStatus: 'FOUND', auditStatus: 'SUCCESS' };

describe('getBulkAiEligibility', () => {
  it('allows a healthy lead with a completed audit', () => {
    expect(getBulkAiEligibility(base)).toEqual({ result: 'STARTED', reason: 'first_run' });
  });

  it('marks rerun for a lead that already has AI success', () => {
    expect(getBulkAiEligibility({ ...base, visualAnalysis: { status: 'SUCCESS' } })).toEqual({ result: 'STARTED', reason: 'rerun' });
  });

  it('skips website-unreachable leads', () => {
    expect(getBulkAiEligibility({ ...base, websiteStatus: 'FAILED' })).toEqual({ result: 'SKIPPED', reason: 'no_viable_website' });
    expect(getBulkAiEligibility({ ...base, website: null })).toEqual({ result: 'SKIPPED', reason: 'no_viable_website' });
  });

  it('skips leads that are not audited', () => {
    expect(getBulkAiEligibility({ ...base, auditStatus: 'FAILED' })).toEqual({ result: 'SKIPPED', reason: 'audit_not_success' });
    expect(getBulkAiEligibility({ ...base, auditStatus: 'PENDING' })).toEqual({ result: 'SKIPPED', reason: 'audit_not_success' });
  });

  it('skips rejected leads and those with running AI', () => {
    expect(getBulkAiEligibility({ ...base, manualReviewStatus: 'BAD' })).toEqual({ result: 'SKIPPED', reason: 'rejected' });
    expect(getBulkAiEligibility(base, [{ operationId: 'RUN_VISUAL_ANALYSIS' }])).toEqual({ result: 'SKIPPED', reason: 'ai_running' });
  });
});
