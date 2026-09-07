import { describe, it, expect } from 'vitest';
import { LeadSelectionStore } from './selection';

const saga = { id: 'saga', companyName: 'Saga, компания' };
const svisloch = { id: 'svisloch', companyName: 'Свислочь, дом торговли' };
const mira = { id: 'mira', companyName: 'Mira Home, дизайн-студия' };
const virevro = { id: 'virevro', companyName: 'ВирЕвроСтрой' };

describe('LeadSelectionStore — user selection is authoritative', () => {
  it('background payloads containing other leads never change selection (video regression)', () => {
    // Exact sequence from the recorded failure: Saga selected, then audit
    // events for Свислочь, Mira Home, ВирЕвроСтрой interleaved with polls.
    const store = new LeadSelectionStore();
    store.select(saga, 'USER_ROW_CLICK');

    store.applyLeadData([svisloch]); // SSE: Svisloch AUDIT_FAILED
    expect(store.selectedId).toBe('saga');
    store.applyLeadData([saga, svisloch]); // poll payload
    expect(store.selectedId).toBe('saga');
    store.applyLeadData([mira]); // SSE: Mira AUDIT_FAILED
    store.applyLeadData([virevro, svisloch, mira]); // poll
    expect(store.selectedId).toBe('saga');
    expect(store.currentLead([svisloch, mira, virevro])?.companyName).toBe('Saga, компания');
  });

  it('an event-lead id can never become the selected id', () => {
    const store = new LeadSelectionStore();
    store.select(saga, 'USER_ROW_CLICK');
    for (const lead of [svisloch, mira, virevro, svisloch, mira]) {
      store.applyLeadData([lead]);
      expect(store.selectedId).toBe('saga');
    }
  });

  it('never falls back to the first row when the selected lead is absent', () => {
    const store = new LeadSelectionStore();
    store.select(saga, 'USER_ROW_CLICK');
    store.applyLeadData([svisloch, mira, virevro]); // saga not in payload
    expect(store.selectedId).toBe('saga');
    expect(store.currentLead([svisloch, mira])?.id).toBe('saga'); // snapshot preserved
  });

  it('updates the selected lead data in place without changing identity', () => {
    const store = new LeadSelectionStore();
    store.select(saga, 'USER_ROW_CLICK');
    store.applyLeadData([{ ...saga, auditStatus: 'SUCCESS' }, svisloch]);
    expect(store.selectedId).toBe('saga');
    expect(store.currentLead([])?.auditStatus).toBe('SUCCESS');
  });

  it('throws loudly when a background source tries to select a lead', () => {
    const store = new LeadSelectionStore();
    // @ts-expect-error illegal source
    expect(() => store.select(svisloch, 'SSE_RECONCILE')).toThrow(/illegal source/);
    // @ts-expect-error illegal source
    expect(() => store.select(mira, 'POLL')).toThrow(/illegal source/);
  });

  it('user clear and user navigation remain the only identity changes', () => {
    const store = new LeadSelectionStore();
    store.select(saga, 'USER_ROW_CLICK');
    store.select(null, 'USER_CLEAR');
    expect(store.selectedId).toBeNull();
    expect(store.currentLead([saga])).toBeNull();
    store.select(mira, 'USER_NAVIGATION');
    expect(store.selectedId).toBe('mira');
  });
});
