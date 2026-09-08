import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';
import { OperationConsole } from './OperationConsole';
import RadarStats from './RadarStats';
import RadarFilters, { Filters, PrimaryView, defaultFilters } from './RadarFilters';
import LeadDetail from './LeadDetail';
import { LeadScoreRing } from './RadarScoreRing';
import { LeadSelectionStore } from './selection';
import { createRadarStore, RadarStore } from './radarStore';
import { leadMatchesFilters } from './leadMerge';

type Mode = 'all' | 'audit' | 'selected';

function getInitialState(mode: Mode): { view: PrimaryView; filters: Filters } {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const validViews: PrimaryView[] = ['all', 'review', 'generation', 'failed'];
  const view = validViews.includes(viewParam as PrimaryView)
    ? (viewParam as PrimaryView)
    : mode === 'selected'
      ? 'generation'
      : 'all';
  const filters: Filters = { ...defaultFilters[view] };
  if (mode === 'audit' && !validViews.includes(viewParam as PrimaryView)) {
    filters.qualificationStatus = 'PENDING';
  }
  if (mode === 'selected' && !validViews.includes(viewParam as PrimaryView)) {
    filters.manual = 'GOOD';
    filters.generationStatus = 'SELECTED';
  }
  return { view, filters };
}

function statusBadge(status?: string | null, type: 'audit' | 'lighthouse' | 'ai' = 'audit') {
  const s = status || 'PENDING';
  const label = { audit: { PENDING: 'Audit', SUCCESS: 'Audited', FAILED: 'Failed' }, lighthouse: { PENDING: 'Lighthouse', SUCCESS: 'Lighthouse', FAILED: 'Failed' }, ai: { PENDING: 'AI', SUCCESS: 'AI', FAILED: 'Failed' } }[type];
  const color = s === 'SUCCESS' ? 'text-success bg-success-subtle border-success-subtle' : s === 'FAILED' ? 'text-danger bg-danger-subtle border-danger-subtle' : 'text-warning bg-warning-subtle border-warning-subtle';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}>{(label as any)[s] || s}</span>;
}

function buildParams(filters: Filters, discoveryRunId: string) {
  const p: any = { limit: 200, sort: filters.sort, qualificationStatus: filters.qualificationStatus || 'ALL' };
  if (filters.q) p.q = filters.q;
  if (filters.websiteStatus) p.websiteStatus = filters.websiteStatus;
  if (filters.manual) p.manual = filters.manual;
  if (filters.generationStatus) p.generationStatus = filters.generationStatus;
  if (discoveryRunId) p.discoveryRunId = discoveryRunId;
  return p;
}

/**
 * Row subscribes to its own entity by ID. An entity patch for lead B
 * rerenders only this row — the table shell and every other row get +0
 * renders. data-rc exposes the render count for dev verification.
 */
const LeadRow = memo(function LeadRow({ store, leadId, checked, stale, onCheck, onSelect, onQualify }: {
  store: RadarStore; leadId: string; checked: boolean; stale: boolean;
  onCheck: (id: string, v: boolean) => void; onSelect: (lead: any) => void; onQualify: (lead: any) => void;
}) {
  const lead = useSyncExternalStore(store.subscribe, () => store.getLead(leadId));
  const rc = useRef(0);
  rc.current++;
  if (!lead) return null;
  return (
    <tr data-testid="radar-lead-row" data-lead-id={leadId} data-rc={rc.current} className="hover:bg-surface-raised cursor-pointer" onClick={() => onSelect(lead)}>
      <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" data-testid="lead-check" checked={checked} onChange={(e) => onCheck(leadId, e.target.checked)} />
      </td>
      <td className="px-3 py-2">
        <div className="text-text font-medium truncate max-w-[180px]">{lead.companyName}</div>
        <div className="text-[10px] text-text-subtle font-mono flex items-center gap-1">
          {lead.categories?.[0] || '—'}
          {stale && <span data-testid="view-drift" title="This row's data no longer matches the current view — Refresh view to reconcile" className="text-warning">· drifted</span>}
        </div>
      </td>
      <td className="px-3 py-2">
        {lead.website ? (
          <a href={lead.website} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate max-w-[120px] inline-block" onClick={(e) => e.stopPropagation()}>{lead.websiteDomain || lead.website}</a>
        ) : <span className="text-[10px] text-danger font-mono">No website</span>}
        {lead.websiteStatus === 'FAILED' && (
          <span className="block text-[9px] font-mono text-danger" title={lead.auditErrorMessage || 'Website unreachable'}>unreachable</span>
        )}
      </td>
      <td className="px-3 py-2"><div className="flex items-center gap-2"><LeadScoreRing score={lead.leadScoreV2 ?? lead.leadScore} size={32} /></div></td>
      <td className="px-3 py-2 text-[11px] font-mono text-text">{lead.visualQualityScore ?? '—'}</td>
      <td className="px-3 py-2 text-[11px] font-mono text-text">{lead.technicalQualityScore ?? '—'}</td>
      <td className="px-3 py-2 text-[11px] font-mono text-text">{lead.businessConfidenceScore ?? lead.businessScore ?? '—'}</td>
      <td className="px-3 py-2">{statusBadge(lead.auditStatus, 'audit')}</td>
      <td className="px-3 py-2">{statusBadge(lead.visualAnalysis?.status, 'ai')}</td>
      <td className="px-3 py-2">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${lead.manualReviewStatus === 'GOOD' ? 'text-success bg-success-subtle border-success-subtle' : lead.manualReviewStatus === 'BAD' ? 'text-danger bg-danger-subtle border-danger-subtle' : lead.manualReviewStatus === 'UNSURE' ? 'text-warning bg-warning-subtle border-warning-subtle' : 'text-text bg-surface-raised border-border'}`}>
          {lead.manualReviewStatus || 'UNREVIEWED'}
        </span>
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          {lead.website && (
            <Button data-testid="qualify-button" size="sm" onClick={() => onQualify(lead)}>Qualify</Button>
          )}
          {lead.site && (
            <a href={`/showcase/${lead.site.previewToken}`} target="_blank" rel="noreferrer" className="text-accent hover:underline text-[11px]">Open</a>
          )}
        </div>
      </td>
    </tr>
  );
});

/**
 * The table shell consumes only the immutable view snapshot. Entity patches
 * never reach this component — it rerenders only on explicit view rebuilds
 * or checked/selected UI-state changes.
 */
const RadarTable = memo(function RadarTable({ store, ids, checkedIds, pendingIds, onCheck, onSelect, onQualify, onCheckAll }: {
  store: RadarStore; ids: string[]; checkedIds: Set<string>; pendingIds: Set<string>;
  onCheck: (id: string, v: boolean) => void; onSelect: (lead: any) => void; onQualify: (lead: any) => void;
  onCheckAll: (v: boolean) => void;
}) {
  const rc = useRef(0);
  rc.current++;
  const allChecked = ids.length > 0 && ids.every((id) => checkedIds.has(id));
  return (
    <div data-rc={rc.current} data-testid="radar-table" className="bg-surface border border-border rounded-md overflow-hidden">
      <table className="w-full text-left text-[12px] table-fixed">
        <thead className="bg-surface-raised border-b border-border">
          <tr>
            <th className="px-2 py-2 w-8">
              <input type="checkbox" data-testid="lead-check-all" checked={allChecked} onChange={(e) => onCheckAll(e.target.checked)} />
            </th>
            <th className="px-3 py-2 font-medium text-text">Company</th>
            <th className="px-3 py-2 font-medium text-text w-[140px]">Website</th>
            <th className="px-3 py-2 font-medium text-text w-[60px]">Score</th>
            <th className="px-3 py-2 font-medium text-text w-[70px]">Visual</th>
            <th className="px-3 py-2 font-medium text-text w-[70px]">Tech</th>
            <th className="px-3 py-2 font-medium text-text w-[70px]">Business</th>
            <th className="px-3 py-2 font-medium text-text w-[70px]">Audit</th>
            <th className="px-3 py-2 font-medium text-text w-[60px]">AI</th>
            <th className="px-3 py-2 font-medium text-text w-[110px]">Review</th>
            <th className="px-3 py-2 font-medium text-text w-[110px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ids.map((leadId) => (
            <LeadRow
              key={leadId}
              store={store}
              leadId={leadId}
              checked={checkedIds.has(leadId)}
              stale={pendingIds.has(leadId)}
              onCheck={onCheck}
              onSelect={onSelect}
              onQualify={onQualify}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default function RadarLeads({ mode = 'all' }: { mode?: Mode }) {
  const initial = getInitialState(mode);
  // Entity store + immutable view snapshot. There is intentionally NO
  // leads[] React state — background paths cannot touch the view.
  const storeRef = useRef<RadarStore | null>(null);
  if (!storeRef.current) storeRef.current = createRadarStore();
  const store = storeRef.current;
  const visibleIds = useSyncExternalStore(store.subscribe, store.getVisibleIds);
  const pendingIds = useSyncExternalStore(store.subscribe, store.getPending);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryRunId, setDiscoveryRunId] = useState('');
  const [view, setView] = useState<PrimaryView>(initial.view);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [stats, setStats] = useState<any>(null);
  const [sseLive, setSseLive] = useState(true);

  // Selection: single authoritative identity, isolated from entity data.
  const selectionRef = useRef<LeadSelectionStore | null>(null);
  if (!selectionRef.current) selectionRef.current = new LeadSelectionStore();
  const selection = selectionRef.current;
  const [, setSelectionTick] = useState(0);
  const selectLead = useCallback((lead: any | null, source: Parameters<LeadSelectionStore['select']>[1]) => {
    selection.select(lead, source);
    setSelectionTick((t) => t + 1);
  }, [selection]);
  const selectedLeadId = selection.selectedId;
  // Detail data follows the entity store by ID; snapshot survives the lead
  // leaving the current view.
  const selectedEntity = useSyncExternalStore(store.subscribe, () => (selectedLeadId ? store.getLead(selectedLeadId) : null));
  if (selectedEntity && !selectedEntity.__deleted) selection.applyLeadData([selectedEntity]);
  const selectedLead = selectedEntity && !selectedEntity.__deleted ? selectedEntity : selection.currentLead([]);

  // Bulk selection: identity-based, isolated from entity patches.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [qualifying, setQualifying] = useState(false);

  const counts = stats
    ? { all: stats.total ?? 0, review: stats.readyForReview ?? 0, generation: stats.readyForGeneration ?? 0, failed: stats.failed ?? 0 }
    : { all: 0, review: 0, generation: 0, failed: 0 };

  // Keep the store's filter predicate current so membership drift is
  // detected — rows are never removed by background data, only flagged.
  store.setViewSpec({ matches: (lead: any) => leadMatchesFilters(lead, filters, view) });

  // ---- EXPLICIT VIEW BOUNDARY: the only code path that rebuilds the ----
  // ---- snapshot. Never invoked by timers, SSE, or entity patches.    ----
  const loadView = useCallback(async (f: Filters, runId: string) => {
    setLoading(true);
    try {
      const res = await api.getLeads(buildParams(f, runId));
      store.loadView(res.items || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    loadView(filters, discoveryRunId);
  }, [view, discoveryRunId, filters.q, filters.websiteStatus, filters.qualificationStatus, filters.manual, filters.generationStatus, filters.sort]);

  // ---- SSE: LEAD_PATCH-style events patch entities by ID only. -------
  // EventSource sends Last-Event-ID on reconnect; the server replays missed
  // events, so gaps self-heal. A dead stream falls back to a delta fetch.
  useEffect(() => {
    let es: EventSource | null = null;
    let dead = false;
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const fetchLead = (id: string) => {
      api.getLead(id).then((r) => r?.lead && store.patchEntity(r.lead)).catch(() => {});
    };
    const schedulePatch = (leadId: string) => {
      if (pending.has(leadId)) return;
      pending.set(leadId, setTimeout(() => { pending.delete(leadId); fetchLead(leadId); }, 250));
    };
    const connect = () => {
      try {
        es = new EventSource('/api/activity/stream', { withCredentials: true });
        es.onopen = () => {
          setSseLive(true);
          // After a reconnect, replayed events cover missed patches; as a
          // belt-and-suspenders recovery, pull the entity delta since our
          // newest revision — entities only, never the view.
          if (dead) {
            dead = false;
            const since = store.getSinceCursor();
            api.getLeadChanges?.(since).then((r: any) => {
              for (const l of r?.items || []) store.patchEntity(l);
            }).catch(() => {});
          }
        };
        es.onmessage = (msg) => {
          try {
            const ev = JSON.parse(msg.data);
            const leadId = ev?.leadId;
            if (typeof leadId !== 'string') return;
            if (ev?.eventType === 'lead_deleted') { store.noteExternalDelete(leadId); return; }
            schedulePatch(leadId);
          } catch { /* malformed event */ }
        };
        es.onerror = () => { setSseLive(false); dead = true; };
      } catch { setSseLive(false); dead = true; }
    };
    connect();
    return () => { es?.close(); pending.forEach((t) => clearTimeout(t)); };
  }, [store]);

  // ---- Stats: an independent store region — cannot touch the table. ---
  useEffect(() => {
    let mounted = true;
    const loadStats = async () => {
      try {
        const s = await api.getLeadStats(discoveryRunId || undefined);
        if (mounted) setStats(s);
      } catch { /* stats are non-fatal */ }
    };
    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [discoveryRunId]);

  const handleView = (v: PrimaryView) => {
    setView(v);
    setFilters(defaultFilters[v]);
    const url = new URL(window.location.href);
    url.searchParams.set('view', v);
    window.history.replaceState(null, '', url.toString());
  };

  function startOperation(operationId: string, input: Record<string, any> = {}, lead?: any) {
    api.startOperation({ operationId, input: { ...input }, leadId: input.leadId, entityType: 'Lead', entityId: input.leadId })
      .then(({ run }) => {
        setActiveRunId(run.id);
        setActiveTitle(`${operationId}${lead ? ` · ${lead.companyName}` : ''}`);
      })
      .catch((e) => setError(e.message || `${operationId} failed`));
  }

  function qualifyRun() {
    if (!discoveryRunId) return;
    setQualifying(true);
    setActiveTitle('Qualify discovery run');
    api.startOperation({ operationId: 'QUALIFY_DISCOVERY_RUN', input: { discoveryRunId, concurrency: 2 }, entityType: 'DiscoveryRun', entityId: discoveryRunId })
      .then(({ run }) => setActiveRunId(run.id))
      .catch((e) => setError(e.message || 'Qualify discovery run failed'))
      .finally(() => setQualifying(false));
  }

  // User action: patches the affected entity — never rebuilds the view.
  const patchAfterAction = (leadId: string) => {
    api.getLead(leadId).then((r) => r?.lead && store.patchEntity(r.lead)).catch(() => {});
  };

  async function runBulk(action: 'reaudit' | 'approve' | 'reject' | 'delete') {
    const ids = [...checkedIds];
    if (!ids.length) return;
    if (action === 'delete' && !window.confirm(`Delete ${ids.length} selected lead(s)? Lead history and technical reports are removed; generated Sites and CMS content are not deleted.`)) return;
    setBulkBusy(action);
    setBulkResult(null);
    try {
      const { results } = await api.bulkLeads(ids, action);
      const ok = results.filter((r) => r.result === 'success').length;
      const skipped = results.filter((r) => r.result === 'skipped').length;
      const failedIds = results.filter((r) => r.result === 'failed').map((r) => r.id);
      const skippedIds = results.filter((r) => r.result === 'skipped').map((r) => r.id);
      setBulkResult(`${action}: ${ok} succeeded${skipped ? `, ${skipped} skipped` : ''}${failedIds.length ? `, ${failedIds.length} failed` : ''}`);
      const keep = new Set([...failedIds, ...skippedIds]);
      setCheckedIds((prev) => new Set([...prev].filter((id) => keep.has(id))));
      if (action === 'delete') {
        // User-requested destructive change: rows leave the view explicitly.
        const deleted = results.filter((r) => r.result === 'success').map((r) => r.id);
        store.removeEntities(deleted);
        if (selectedLeadId && deleted.includes(selectedLeadId)) selectLead(null, 'USER_CLEAR');
      } else {
        // One action → N entity patches; the view snapshot is untouched.
        for (const id of ids) patchAfterAction(id);
      }
    } catch (e: any) {
      setBulkResult(`${action} failed: ${e?.message || 'error'}`);
    } finally {
      setBulkBusy(null);
    }
  }

  function reviewLead(status: string, note?: string) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    return api.reviewLead(selectedLead.id, status, note)
      .then(() => patchAfterAction(selectedLead.id))
      .catch((e) => { setError(e.message || 'Review failed'); throw e; });
  }

  function selectForRedesign(selected: boolean) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    return api.setRedesignStage(selectedLead.id, selected ? 'SELECTED_FOR_REDESIGN' : 'NOT_SELECTED')
      .then(() => patchAfterAction(selectedLead.id))
      .catch((e) => { setError(e.message || 'Select failed'); throw e; });
  }

  const onCheck = useCallback((id: string, v: boolean) => {
    setCheckedIds((prev) => { const n = new Set(prev); if (v) n.add(id); else n.delete(id); return n; });
  }, []);
  const onCheckAll = useCallback((v: boolean) => {
    setCheckedIds(v ? new Set(visibleIds) : new Set());
  }, [visibleIds]);
  const onSelectRow = useCallback((lead: any) => selectLead(lead, 'USER_ROW_CLICK'), [selectLead]);
  const onQualifyRow = useCallback((lead: any) => startOperation('RUN_FULL_QUALIFICATION', { leadId: lead.id }), []);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-surface border-b border-border px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-text">Leads</h1>
        <div className="flex items-center gap-2">
          {!sseLive && <span className="text-[11px] text-warning font-mono">Live updates reconnecting…</span>}
          <Button size="sm" variant="secondary" onClick={() => loadView(filters, discoveryRunId)}>Refresh</Button>
        </div>
      </div>

      <div className={`p-6 ${selectedLead ? 'pr-[420px]' : ''}`}>
        {error && <div className="mb-4 text-[12px] text-danger bg-danger-subtle border border-danger-subtle rounded px-3 py-2">{error}</div>}

        {pendingIds.size > 0 && (
          <div data-testid="view-pending" className="mb-4 flex items-center gap-3 bg-warning-subtle border border-border rounded-md px-4 py-2 text-[12px]">
            <span className="text-text">{pendingIds.size} view change{pendingIds.size === 1 ? '' : 's'} available</span>
            <Button size="sm" variant="secondary" onClick={() => loadView(filters, discoveryRunId)}>Refresh view</Button>
          </div>
        )}

        {checkedIds.size > 0 && (
          <div data-testid="bulk-bar" className="mb-4 flex items-center gap-2 bg-surface border border-border rounded-md px-4 py-2">
            <span className="text-[12px] font-mono text-text">{checkedIds.size} selected</span>
            <div className="h-4 w-px bg-border" />
            <Button size="sm" variant="secondary" disabled={!!bulkBusy} onClick={() => runBulk('reaudit')}>Re-audit</Button>
            <Button size="sm" variant="secondary" disabled={!!bulkBusy} onClick={() => runBulk('approve')}>Approve</Button>
            <Button size="sm" variant="secondary" disabled={!!bulkBusy} onClick={() => runBulk('reject')}>Reject</Button>
            <Button size="sm" variant="secondary" disabled={!!bulkBusy} onClick={() => runBulk('delete')}>Delete</Button>
            {bulkResult && <span data-testid="bulk-result" className="text-[11px] font-mono text-text-muted ml-2">{bulkResult}</span>}
          </div>
        )}

        <RadarStats discoveryRunId={discoveryRunId} onRunChange={setDiscoveryRunId} onQualify={qualifyRun} qualifying={qualifying} />
        <RadarFilters
          filters={filters}
          onChange={(f) => setFilters({ ...filters, ...f })}
          view={view}
          onView={handleView}
          counts={counts}
        />

        {loading && <div className="text-[13px] text-text-subtle">Loading leads…</div>}
        {!loading && visibleIds.length === 0 && <div className="text-[13px] text-text-subtle">No leads match the filter.</div>}

        {!loading && visibleIds.length > 0 && (
          <RadarTable
            store={store}
            ids={visibleIds}
            checkedIds={checkedIds}
            pendingIds={pendingIds}
            onCheck={onCheck}
            onCheckAll={onCheckAll}
            onSelect={onSelectRow}
            onQualify={onQualifyRow}
          />
        )}

        {activeRunId && (
          <div className="mt-6">
            <OperationConsole runId={activeRunId} title={activeTitle} onClose={() => setActiveRunId(null)} />
          </div>
        )}
      </div>

      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => selectLead(null, 'USER_CLEAR')}
          onStart={(op, input) => startOperation(op, input, selectedLead)}
          onReview={reviewLead}
          onSelect={selectForRedesign}
        />
      )}
    </div>
  );
}
