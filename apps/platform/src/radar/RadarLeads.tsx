import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';
import { OperationConsole } from './OperationConsole';
import RadarStats from './RadarStats';
import RadarFilters, { Filters, PrimaryView, defaultFilters } from './RadarFilters';
import LeadDetail from './LeadDetail';
import { LeadScoreRing } from './RadarScoreRing';
import { LeadSelectionStore } from './selection';
import { mergeLeadsPreserveOrder } from './leadMerge';

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

// Memoized: an unchanged lead object (identity-preserved by the merge) never
// re-renders — background updates touch only the rows that actually changed.
const LeadRow = memo(function LeadRow({ lead, checked, onCheck, onSelect, onQualify }: {
  lead: any; checked: boolean; onCheck: (id: string, v: boolean) => void;
  onSelect: (lead: any) => void; onQualify: (lead: any) => void;
}) {
  return (
    <tr data-testid="radar-lead-row" data-lead-id={lead.id} className="hover:bg-surface-raised cursor-pointer" onClick={() => onSelect(lead)}>
      <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" data-testid="lead-check" checked={checked} onChange={(e) => onCheck(lead.id, e.target.checked)} />
      </td>
      <td className="px-3 py-2">
        <div className="text-text font-medium truncate max-w-[180px]">{lead.companyName}</div>
        <div className="text-[10px] text-text-subtle font-mono">{lead.categories?.[0] || '—'}</div>
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

export default function RadarLeads({ mode = 'all' }: { mode?: Mode }) {
  const initial = getInitialState(mode);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveryRunId, setDiscoveryRunId] = useState('');
  const [view, setView] = useState<PrimaryView>(initial.view);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [stats, setStats] = useState<any>(null);
  // ONE authoritative selection identity. Background data can only patch
  // lead records — it can never change which lead the user is viewing.
  const selectionRef = useRef<LeadSelectionStore | null>(null);
  if (!selectionRef.current) selectionRef.current = new LeadSelectionStore();
  const selection = selectionRef.current;
  const [, setSelectionTick] = useState(0);
  const selectLead = (lead: any | null, source: Parameters<LeadSelectionStore['select']>[1]) => {
    selection.select(lead, source);
    setSelectionTick((t) => t + 1);
  };
  const selectedLeadId = selection.selectedId;
  const selectedLead = selection.currentLead(leads);
  // Bulk selection is identity-based — never row indices.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [qualifying, setQualifying] = useState(false);

  const counts = stats
    ? { all: stats.total ?? 0, review: stats.readyForReview ?? 0, generation: stats.readyForGeneration ?? 0, failed: stats.failed ?? 0 }
    : { all: 0, review: 0, generation: 0, failed: 0 };

  // Rows are patched by stable identity: an unchanged lead keeps its object
  // reference so the memoized row is never re-rendered. Order is preserved;
  // background data can never resort or rebuild the user's view.
  const patchLead = useCallback((lead: any) => {
    setLeads((prev) => {
      const i = prev.findIndex((l) => l.id === lead.id);
      if (i < 0) return prev; // not in the current view — next explicit refresh admits it
      if (JSON.stringify(prev[i]) === JSON.stringify(lead)) return prev;
      const next = prev.slice();
      next[i] = lead;
      return next;
    });
    selection.applyLeadData([lead]);
  }, []);

  const getParams = () => {
    const p: any = { limit: 200, sort: filters.sort, qualificationStatus: filters.qualificationStatus || 'ALL' };
    if (filters.q) p.q = filters.q;
    if (filters.websiteStatus) p.websiteStatus = filters.websiteStatus;
    if (filters.manual) p.manual = filters.manual;
    if (filters.generationStatus) p.generationStatus = filters.generationStatus;
    if (discoveryRunId) p.discoveryRunId = discoveryRunId;
    return p;
  };

  const refresh = async (isBackground = false) => {
    if (isBackground) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.getLeads(getParams());
      const items = res.items || [];
      // A transient empty background payload must not flash an empty table.
      // mergePreserves order AND object identity for unchanged rows.
      const byId = (prev: any[]) => new Map(prev.map((l) => [l.id, l]));
      setLeads((prev) => {
        if (!isBackground) return items;
        if (prev.length > 0 && items.length === 0) return prev;
        const prevById = byId(prev);
        const same = items.map((l) => {
          const old = prevById.get(l.id);
          return old && JSON.stringify(old) === JSON.stringify(l) ? old : l;
        });
        return mergeLeadsPreserveOrder(prev, same);
      });
      setError(null);
      // Data-only update: refreshes the selected lead's snapshot if present.
      // Can never change selection identity.
      selection.applyLeadData(items);
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let mounted = true;
    const load = async () => { if (mounted) await refreshRef.current(false); };
    load();
    // Resilience fallback only — SSE provides timely per-lead patching.
    const interval = setInterval(() => { if (mounted) refreshRef.current(true); }, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [view, discoveryRunId, filters.q, filters.websiteStatus, filters.qualificationStatus, filters.manual, filters.generationStatus, filters.sort]);

  // SSE drives targeted per-lead updates: an event for lead B patches B's
  // data via GET /api/leads/:id — never a full-list refetch, never selection.
  useEffect(() => {
    let es: EventSource | null = null;
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    try {
      es = new EventSource('/api/activity/stream', { withCredentials: true });
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          const leadId = ev?.leadId;
          if (!leadId || typeof leadId !== 'string') return;
          if (pending.has(leadId)) return;
          pending.set(leadId, setTimeout(() => {
            pending.delete(leadId);
            api.getLead(leadId).then((r) => r?.lead && patchLead(r.lead)).catch(() => {});
          }, 400));
        } catch { /* malformed event */ }
      };
    } catch { /* SSE unsupported — poll fallback covers updates */ }
    return () => {
      es?.close();
      pending.forEach((t) => clearTimeout(t));
    };
  }, [patchLead]);

  useEffect(() => {
    let mounted = true;
    const loadStats = async () => {
      try {
        const s = await api.getLeadStats(discoveryRunId || undefined);
        if (mounted) setStats(s);
      } catch (e: any) {
        // stats are non-fatal; the list fetch will surface real errors
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 5000);
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
      .then(({ run }) => {
        setActiveRunId(run.id);
      })
      .catch((e) => setError(e.message || 'Qualify discovery run failed'))
      .finally(() => setQualifying(false));
  }

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
      // Failed/skipped items stay checked for correction; successful ones uncheck.
      const keep = new Set([...failedIds, ...skippedIds]);
      setCheckedIds((prev) => new Set([...prev].filter((id) => keep.has(id))));
      if (action === 'delete') {
        const deleted = new Set(results.filter((r) => r.result === 'success').map((r) => r.id));
        setLeads((prev) => prev.filter((l) => !deleted.has(l.id)));
        if (selectedLeadId && deleted.has(selectedLeadId)) selectLead(null, 'USER_CLEAR');
      }
      await refreshRef.current(true);
    } catch (e: any) {
      setBulkResult(`${action} failed: ${e?.message || 'error'}`);
    } finally {
      setBulkBusy(null);
    }
  }

  function reviewLead(status: string, note?: string) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    return api.reviewLead(selectedLead.id, status, note)
      .then(() => refreshRef.current(true))
      .catch((e) => { setError(e.message || 'Review failed'); throw e; });
  }

  function selectForRedesign(selected: boolean) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    return api.setRedesignStage(selectedLead.id, selected ? 'SELECTED_FOR_REDESIGN' : 'NOT_SELECTED')
      .then(() => refreshRef.current(true))
      .catch((e) => { setError(e.message || 'Select failed'); throw e; });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-surface border-b border-border px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-text">Leads</h1>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] text-text-subtle font-mono w-[64px] text-right transition-opacity duration-200 ${refreshing ? 'opacity-100' : 'opacity-0'}`}>Updating…</span>
          <Button size="sm" variant="secondary" onClick={() => refresh(false)}>Refresh</Button>
        </div>
      </div>

      <div className={`p-6 ${selectedLead ? 'pr-[420px]' : ''}`}>
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
        {error && <div className="mb-4 text-[12px] text-danger bg-danger-subtle border border-danger-subtle rounded px-3 py-2">{error}</div>}
        <RadarStats discoveryRunId={discoveryRunId} onRunChange={setDiscoveryRunId} onQualify={qualifyRun} qualifying={qualifying} />
        <RadarFilters
          filters={filters}
          onChange={(f) => setFilters({ ...filters, ...f })}
          view={view}
          onView={handleView}
          counts={counts}
        />

        {loading && <div className="text-[13px] text-text-subtle">Loading leads…</div>}
        {!loading && leads.length === 0 && <div className="text-[13px] text-text-subtle">No leads match the filter.</div>}

        {!loading && leads.length > 0 && (
          <div className="bg-surface border border-border rounded-md overflow-hidden">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-raised border-b border-border">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      data-testid="lead-check-all"
                      checked={leads.length > 0 && leads.every((l) => checkedIds.has(l.id))}
                      onChange={(e) => setCheckedIds(e.target.checked ? new Set(leads.map((l) => l.id)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium text-text">Company</th>
                  <th className="px-3 py-2 font-medium text-text">Website</th>
                  <th className="px-3 py-2 font-medium text-text">Score</th>
                  <th className="px-3 py-2 font-medium text-text">Visual</th>
                  <th className="px-3 py-2 font-medium text-text">Tech</th>
                  <th className="px-3 py-2 font-medium text-text">Business</th>
                  <th className="px-3 py-2 font-medium text-text">Audit</th>
                  <th className="px-3 py-2 font-medium text-text">AI</th>
                  <th className="px-3 py-2 font-medium text-text">Review</th>
                  <th className="px-3 py-2 font-medium text-text">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    checked={checkedIds.has(lead.id)}
                    onCheck={(id, v) => setCheckedIds((prev) => { const n = new Set(prev); v ? n.add(id) : n.delete(id); return n; })}
                    onSelect={(l) => selectLead(l, 'USER_ROW_CLICK')}
                    onQualify={(l) => startOperation('RUN_FULL_QUALIFICATION', { leadId: l.id })}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
