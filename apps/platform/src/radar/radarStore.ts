/**
 * RadarStore — normalized live-entity store for the Radar table.
 *
 * Three strictly separated state regions:
 *
 *   A. ENTITY STORE  — leadById + per-lead revision. Patched by ID only.
 *   B. VIEW SNAPSHOT — visibleLeadIds. Immutable between explicit user
 *      view boundaries (open / filter / sort / view / refresh).
 *   C. UI STATE      — lives outside this store (React component state):
 *      selectedLeadId, checkedLeadIds, scroll.
 *
 * Background events (SSE, deltas, operation results) can only call
 * `patchEntity` / `removeEntity` / `noteExternalCreate` — they physically
 * cannot mutate the view snapshot. `loadView` is the ONLY function that
 * writes `visibleLeadIds`, and it is invoked exclusively from explicit
 * user actions.
 *
 * React binding: `useSyncExternalStore(store.subscribe, () => snapshot)`.
 * `getLead(id)` returns a stable object reference — a row rerenders only
 * when its own entity actually changed.
 */

export interface RadarViewSpec {
  /** Filter predicate applied only to compute the "no longer matches"
      badge + pending-view count — never to remove a row in background. */
  matches?: (lead: any) => boolean;
}

export class RadarStore {
  private leadById = new Map<string, any>();
  private revision = new Map<string, number>();
  private visibleIds: string[] = [];
  private listeners = new Set<() => void>();
  private viewSpec: RadarViewSpec = {};
  /** IDs awaiting a user-acknowledged view rebuild: new leads, leads whose
      filter membership flipped, externally deleted leads. */
  private pendingIds = new Set<string>();
  private knownIds = new Set<string>();

  // ---- subscription -------------------------------------------------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private notify() {
    for (const fn of [...this.listeners]) fn();
  }

  // ---- snapshots (must return stable references) --------------------
  getLead = (id: string) => this.leadById.get(id) ?? null;
  getVisibleIds = () => this.visibleIds;
  getPending = () => this.pendingIds;

  /** Cursor for delta recovery: the newest entity revision seen. */
  getSinceCursor = () => Math.max(0, ...[...this.revision.values()]);

  setViewSpec(spec: RadarViewSpec) {
    this.viewSpec = spec;
  }

  // ---- explicit user boundary: the ONLY writer of visibleLeadIds ----
  loadView(items: any[]) {
    for (const l of items) {
      this.leadById.set(l.id, l);
      this.revision.set(l.id, this.revOf(l));
      this.knownIds.add(l.id);
    }
    this.visibleIds = items.map((l) => l.id);
    // This is the user-acknowledged rebuild — all drift is now reconciled.
    this.pendingIds.clear();
    this.notify();
  }

  // ---- background writes: entities only, NEVER the view -------------
  patchEntity(lead: any) {
    const id = lead?.id;
    if (!id) return;
    const rev = this.revOf(lead);
    const prev = this.revision.get(id);
    // Ignore out-of-order/stale deliveries (delayed GET after SSE, etc.).
    if (prev !== undefined && rev < prev) return;
    const existing = this.leadById.get(id);
    if (existing && JSON.stringify(existing) === JSON.stringify(lead)) return;
    this.leadById.set(id, lead);
    this.revision.set(id, rev);
    if (!this.knownIds.has(id)) {
      // LEAD_CREATED: never auto-insert — surface as pending view change.
      this.knownIds.add(id);
      if (!this.visibleIds.includes(id)) this.pendingIds.add(id);
    } else if (this.visibleIds.includes(id) && this.viewSpec.matches && !this.viewSpec.matches(lead)) {
      // Filter-membership drift: row stays, flagged for explicit refresh.
      this.pendingIds.add(id);
    } else if (this.pendingIds.has(id) && this.viewSpec.matches?.(lead)) {
      this.pendingIds.delete(id);
    }
    this.notify();
  }

  /** External deletion: keep the row position, mark the entity gone and
      flag the view as needing a user refresh. User-triggered deletes use
      `removeEntities` instead. */
  noteExternalDelete(id: string) {
    if (!this.visibleIds.includes(id) && !this.leadById.has(id)) return;
    const lead = this.leadById.get(id);
    if (lead) {
      this.leadById.set(id, { ...lead, __deleted: true });
      this.revision.set(id, Number.MAX_SAFE_INTEGER);
    }
    this.pendingIds.add(id);
    this.notify();
  }

  /** User-triggered removal (bulk delete): explicit boundary, allowed to
      drop rows because the user asked for it. */
  removeEntities(ids: string[]) {
    const drop = new Set(ids);
    for (const id of ids) {
      this.leadById.delete(id);
      this.revision.delete(id);
      this.knownIds.delete(id);
      this.pendingIds.delete(id);
    }
    this.visibleIds = this.visibleIds.filter((id) => !drop.has(id));
    this.notify();
  }

  // ---- helpers ------------------------------------------------------
  private revOf(lead: any): number {
    const t = Date.parse(lead?.updatedAt ?? '');
    return Number.isFinite(t) ? t : ++this.localRev;
  }
  private localRev = 0;

  /** Dev/test instrumentation — row render counters live in the DOM via
      data-rc attributes; this reports store-level state. */
  debug() {
    return {
      entities: this.leadById.size,
      visible: this.visibleIds.length,
      pending: this.pendingIds.size,
    };
  }
}

export function createRadarStore() {
  return new RadarStore();
}
