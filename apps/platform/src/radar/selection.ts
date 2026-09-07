/**
 * LeadSelectionStore — the single authoritative selection state for Radar.
 *
 * Invariants (see .ai/invariants.md):
 * - USER SELECTION IS AUTHORITATIVE: only explicit user-intent sources may
 *   change which lead is selected. Background data paths (polling, SSE,
 *   reconciliation, review/audit/qualification responses) may update lead
 *   DATA only — never the selected identity.
 * - EVENT TARGET IS NOT UI SELECTION: a payload containing lead B updates
 *   B's data; it can never navigate the detail panel to B.
 * - NEVER FALL BACK TO FIRST ROW: if the selected lead is absent from a
 *   background payload, the last-known snapshot is kept; nothing else is
 *   selected.
 */
export type SelectionSource =
  | 'USER_ROW_CLICK'
  | 'USER_NAVIGATION'
  | 'USER_CLEAR'
  | 'INITIAL_DEEP_LINK';

const ALLOWED: ReadonlySet<SelectionSource> = new Set([
  'USER_ROW_CLICK',
  'USER_NAVIGATION',
  'USER_CLEAR',
  'INITIAL_DEEP_LINK',
]);

export class LeadSelectionStore {
  /** The only selection identity. Everything else derives from this. */
  selectedId: string | null = null;
  /** Last-known full record for the selected lead; survives the lead
      temporarily leaving the current filtered page. */
  private snapshot: any | null = null;

  /** Explicit user-intent selection. Any other source throws — background
      code paths must never call this. */
  select(lead: any | null, source: SelectionSource): void {
    if (!ALLOWED.has(source)) {
      throw new Error(`LeadSelectionStore.select: illegal source "${source}" — background data may never change selection`);
    }
    this.selectedId = lead ? lead.id : null;
    this.snapshot = lead ?? null;
  }

  /**
   * Background reconciliation: patches lead data only. If the payload
   * contains the selected lead, its snapshot is refreshed in place; if not,
   * the snapshot is kept. The return value carries NO selection semantics —
   * callers must not interpret membership as selection.
   */
  applyLeadData(items: any[]): void {
    if (!this.selectedId) return;
    const updated = items.find((l) => l.id === this.selectedId);
    if (updated) this.snapshot = updated;
  }

  /** The lead object to render: fresh row data when the selected lead is in
      the current list, else the preserved snapshot. Never another lead. */
  currentLead(rows: any[]): any | null {
    if (!this.selectedId) return null;
    return rows.find((l) => l.id === this.selectedId) ?? this.snapshot;
  }
}
