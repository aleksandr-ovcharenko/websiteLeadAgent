import { describe, it, expect } from 'vitest';
import { computeQualification } from './qualification';

function makeLead(overrides: any = {}) {
  return {
    website: 'https://example.com',
    websiteStatus: 'FOUND',
    websiteIneligibilityReason: null,
    auditStatus: 'PENDING',
    auditErrorMessage: null,
    lighthouseReport: null,
    visualAnalysis: { status: 'PENDING', errorMessage: null },
    scoreStatus: 'PENDING',
    scoreDetailsV2: null,
    ...overrides,
  };
}

describe('computeQualification', () => {
  it('CASE A: Audit FAILED shows failure reason, blocked downstream, retryable', () => {
    const lead = makeLead({
      auditStatus: 'FAILED',
      auditErrorMessage: 'Playwright Chromium is not installed.',
    });
    const result = computeQualification(lead);

    const audit = result.stages.find(s => s.id === 'audit')!;
    const screenshots = result.stages.find(s => s.id === 'screenshots')!;
    const lighthouse = result.stages.find(s => s.id === 'lighthouse')!;
    const ai = result.stages.find(s => s.id === 'ai')!;

    expect(audit.status).toBe('FAILED');
    expect(audit.reason).toBe('Playwright Chromium is not installed.');
    expect(screenshots.status).toBe('FAILED');
    expect(lighthouse.status).toBe('WAITING');
    expect(ai.status).toBe('WAITING');
    expect(lighthouse.waitingFor).toEqual(['Audit', 'Screenshots']);
    expect(ai.waitingFor).toEqual(['Audit', 'Screenshots', 'Lighthouse']);
    expect(result.firstBlocking?.id).toBe('audit');
    expect(result.firstBlocking?.reason).toBe('Playwright Chromium is not installed.');
    expect(result.readyForReview).toBe(false);

    const blocked = result.stages.slice(result.firstBlockingIndex + 1).filter(s => s.status === 'WAITING');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.map(s => s.id)).toEqual(expect.arrayContaining(['lighthouse', 'ai', 'scoring']));
  });

  it('CASE B: Audit complete, Lighthouse RUNNING, AI pending', () => {
    const lead = makeLead({
      auditStatus: 'SUCCESS',
      lighthouseReport: null,
      visualAnalysis: { status: 'PENDING' },
      scoreStatus: 'PENDING',
    });
    const result = computeQualification(lead, { lighthouse: 'RUNNING' });

    const lighthouse = result.stages.find(s => s.id === 'lighthouse')!;
    const ai = result.stages.find(s => s.id === 'ai')!;

    expect(result.stages.find(s => s.id === 'audit')!.status).toBe('SUCCESS');
    expect(lighthouse.status).toBe('RUNNING');
    expect(ai.status).toBe('WAITING');
    expect(ai.waitingFor).toEqual(['Lighthouse']);
    expect(result.firstBlocking?.id).toBe('lighthouse');
    expect(result.readyForReview).toBe(false);
  });

  it('CASE C: Everything complete → ready for review', () => {
    const lead = makeLead({
      auditStatus: 'SUCCESS',
      lighthouseReport: { performance: 80, accessibility: 90, seo: 85, bestPractices: 95 },
      visualAnalysis: { status: 'SUCCESS', errorMessage: null },
      scoreStatus: 'SUCCESS',
      scoreDetailsV2: { parts: {} },
      manualReviewStatus: 'UNREVIEWED',
    });
    const result = computeQualification(lead);

    expect(result.stages.every(s => ['SUCCESS', 'FOUND'].includes(s.status))).toBe(true);
    expect(result.firstBlocking).toBeNull();
    expect(result.readyForReview).toBe(true);
  });

  it('CASE D: Scoring failed → review locked, scoring failure shown', () => {
    const lead = makeLead({
      auditStatus: 'SUCCESS',
      lighthouseReport: { performance: 80, accessibility: 90, seo: 85, bestPractices: 95 },
      visualAnalysis: { status: 'SUCCESS', errorMessage: null },
      scoreStatus: 'FAILED',
      scoreDetailsV2: { error: 'Visual analysis trust score out of range' },
    });
    const result = computeQualification(lead);

    const scoring = result.stages.find(s => s.id === 'scoring')!;
    expect(scoring.status).toBe('FAILED');
    expect(scoring.reason).toBe('Visual analysis trust score out of range');
    expect(result.firstBlocking?.id).toBe('scoring');
    expect(result.readyForReview).toBe(false);
  });
});
