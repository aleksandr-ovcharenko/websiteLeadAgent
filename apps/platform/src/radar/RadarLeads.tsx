import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';
import { OperationConsole } from './OperationConsole';
import RadarStats from './RadarStats';
import RadarFilters, { Filters, PrimaryView, defaultFilters } from './RadarFilters';
import LeadDetail from './LeadDetail';
import { LeadScoreRing } from './RadarScoreRing';
import { leadMatchesFilters, mergeLeadsPreserveOrder, pickAdjacentSelection } from './leadMerge';

type Mode = 'all' | 'audit' | 'selected';

function getInitialState(mode: Mode): { view: PrimaryView; filters: Filters } {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const validViews: PrimaryView[] = ['all', 'review', 'generation'];
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
  const color = s === 'SUCCESS' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : s === 'FAILED' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200';
  // Full-width badge: status text changes never resize the cell.
  return <span className={`inline-flex w-full items-center justify-center truncate px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}>{(label as any)[s] || s}</span>;
}

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
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [qualifying, setQualifying] = useState(false);

  const counts = stats
    ? { all: stats.total ?? 0, review: stats.readyForReview ?? 0, generation: stats.readyForGeneration ?? 0 }
    : { all: 0, review: 0, generation: 0 };

  // Live state is kept in a ref so background timers/SSE handlers always act
  // on the *current* selection, filters and rows — never a stale closure.
  const stateRef = useRef({ filters, view, discoveryRunId, selectedLeadId, leads });
  stateRef.current = { filters, view, discoveryRunId, selectedLeadId, leads };

  const getParams = () => {
    const s = stateRef.current;
    const p: any = { limit: 200, sort: s.filters.sort, qualificationStatus: s.filters.qualificationStatus || 'ALL' };
    if (s.filters.q) p.q = s.filters.q;
    if (s.filters.websiteStatus) p.websiteStatus = s.filters.websiteStatus;
    if (s.filters.manual) p.manual = s.filters.manual;
    if (s.filters.generationStatus) p.generationStatus = s.filters.generationStatus;
    if (s.discoveryRunId) p.discoveryRunId = s.discoveryRunId;
    return p;
  };

  // Ids absent from the latest background payload are stale members of the
  // UI snapshot — they stay rendered (marked) until an explicit refresh
  // boundary rebuilds membership from the authoritative server result.
  const staleIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true);
    else setLoading(true);
    try {
      const params = getParams();
      const res = await api.getLeads(params);
      const items: any[] = res.items || [];
      // Absence from a payload implies "moved out of view" ONLY when the
      // payload is provably a complete authoritative result for the current
      // scope: offset 0 and items.length === meta.total. The endpoint is
      // limited; a row beyond the returned window is absent but still a
      // member, so completeness must come from pagination metadata.
      const total = res.meta?.total;
      const offset = res.meta?.offset ?? 0;
      const payloadComplete = typeof total === 'number' && offset === 0 && items.length === total;
      const itemIds = new Set(items.map((l: any) => l.id));
      staleIdsRef.current = isBackground && payloadComplete
        ? new Set(stateRef.current.leads.map((l: any) => l.id).filter((id) => !itemIds.has(id)))
        : new Set();
      const selId = stateRef.current.selectedLeadId;
      setLeads((prev) => {
        if (!isBackground) return items;
        // Transient empty payloads must not flash an empty table.
        if (prev.length > 0 && items.length === 0) return prev;
        // Background reconciliation preserves the displayed row order.
        return mergeLeadsPreserveOrder(prev, items);
      });
      setError(null);
      if (selId) {
        const updated = items.find((l: any) => l.id === selId);
        // The user's selection is authoritative: refreshes only refresh the
        // data of the selected lead, never the selection itself. A lead that
        // left the current view keeps its last-known object so the detail
        // panel stays mounted — LeadDetail shows a "not in current view"
        // notice instead of selection jumping to another row.
        if (updated) {
          setSelectedLead((prev: any) =>
            prev && prev.id === updated.id && JSON.stringify(prev) === JSON.stringify(updated) ? prev : updated
          );
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let mounted = true;
    const load = async () => { if (mounted) await refreshRef.current(false); };
    load();
    // Polling is only a slow fallback; timely updates arrive via SSE below.
    const interval = setInterval(() => { if (mounted) refreshRef.current(true); }, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [view, discoveryRunId, filters.q, filters.websiteStatus, filters.qualificationStatus, filters.manual, filters.generationStatus, filters.sort]);

  // SSE: only lead-scoped events (an actual leadId) or RADAR pipeline
  // lifecycle transitions trigger a debounced quiet reconciliation. Events
  // from unrelated domains (DISCOVERY, FACTORY, SYSTEM, console logs) never
  // touch lead-list or selection state.
  useEffect(() => {
    const RADAR_LIFECYCLE = /start|complete|success|fail|finish|ready|cancel/i;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refreshRef.current(true);
      }, 700);
    };
    try {
      es = new EventSource('/api/activity/stream', { withCredentials: true });
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          const affectsLead = !!ev?.leadId;
          const radarLifecycle = ev?.module === 'RADAR' && RADAR_LIFECYCLE.test(`${ev.eventType ?? ''} ${ev.stage ?? ''}`);
          if (affectsLead || radarLifecycle) schedule();
        } catch { /* malformed event — ignore */ }
      };
    } catch { /* SSE unsupported — polling fallback covers updates */ }
    return () => {
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  // Stats are polled once by RadarStats (which owns the KPI card polling)
  // and pushed up via onStats — no duplicate interval here.

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

  // Apply a lead patch to both the list row and the open detail panel in
  // place — never via a foreground refresh that flashes the table.
  const patchLead = (id: string, patch: Record<string, any>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    if (stateRef.current.selectedLeadId === id) {
      setSelectedLead((prev: any) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    }
  };

  // After an explicit user action that removes the selected lead from the
  // current view, move selection to the adjacent row in the displayed order.
  const advanceSelectionIfOutOfView = (updatedLead: any) => {
    if (!leadMatchesFilters(updatedLead, stateRef.current.filters, stateRef.current.view)) {
      const order = stateRef.current.leads.map((l) => l.id);
      const nextId = pickAdjacentSelection(order, updatedLead.id);
      setSelectedLeadId(nextId);
      setSelectedLead(nextId ? stateRef.current.leads.find((l) => l.id === nextId) ?? null : null);
    }
  };

  function reviewLead(status: string, note?: string) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    const id = selectedLead.id;
    const snapshot = { manualReviewStatus: selectedLead.manualReviewStatus, manualReviewNote: selectedLead.manualReviewNote, reviewedAt: selectedLead.reviewedAt };
    const optimistic = {
      ...selectedLead,
      manualReviewStatus: status,
      manualReviewNote: note ?? selectedLead.manualReviewNote,
      reviewedAt: status === 'UNREVIEWED' ? null : new Date().toISOString(),
    };
    patchLead(id, { manualReviewStatus: optimistic.manualReviewStatus, manualReviewNote: optimistic.manualReviewNote, reviewedAt: optimistic.reviewedAt });
    return api.reviewLead(id, status, note)
      .then(() => {
        advanceSelectionIfOutOfView(optimistic);
        refreshRef.current(true);
      })
      .catch((e) => {
        patchLead(id, snapshot);
        setError(e.message || 'Review failed');
        throw e;
      });
  }

  function selectForRedesign(selected: boolean) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    const id = selectedLead.id;
    const snapshot = { redesignStage: selectedLead.redesignStage };
    const stage = selected ? 'SELECTED_FOR_REDESIGN' : 'NOT_SELECTED';
    const optimistic = { ...selectedLead, redesignStage: stage };
    patchLead(id, { redesignStage: stage });
    return api.setRedesignStage(id, stage)
      .then(() => {
        advanceSelectionIfOutOfView(optimistic);
        refreshRef.current(true);
      })
      .catch((e) => {
        patchLead(id, snapshot);
        setError(e.message || 'Select failed');
        throw e;
      });
  }

  return (
    <>
    <div className="flex-1 flex flex-col min-w-0" data-testid="radar-main">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">Leads</h1>
        <div className="flex items-center gap-2">
          {/* Space is always reserved so the header never shifts when the
              indicator appears/disappears during background work. */}
          <span className={`text-[11px] text-[#a8a29e] font-mono w-[64px] text-right transition-opacity duration-200 ${refreshing ? 'opacity-100' : 'opacity-0'}`}>Updating…</span>
          <Button size="sm" variant="secondary" onClick={() => refresh(false)}>Refresh</Button>
        </div>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        <RadarStats discoveryRunId={discoveryRunId} onRunChange={setDiscoveryRunId} onQualify={qualifyRun} qualifying={qualifying} onStats={setStats} />
        <RadarFilters
          filters={filters}
          onChange={(f) => setFilters({ ...filters, ...f })}
          view={view}
          onView={handleView}
          counts={counts}
        />

        {loading && leads.length === 0 && <div className="text-[13px] text-[#a8a29e]">Loading leads…</div>}
        {!loading && leads.length === 0 && <div className="text-[13px] text-[#a8a29e]">No leads match the filter.</div>}

        {leads.length > 0 && (
          <div data-testid="radar-table" className="bg-white border border-[#e5e3df] rounded-md overflow-x-auto">
            {/* table-fixed + proportional column widths: live cell content
                changes can never resize columns or shift rows horizontally;
                proportions adapt only to deliberate container resizes
                (detail panel open/close), not to data. */}
            <table className="w-full text-left text-[12px] table-fixed">
              <colgroup>
                <col style={{ width: '21%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '11%' }} />
                <col />
              </colgroup>
              <thead className="bg-[#fafaf9] border-b border-[#e5e3df]">
                <tr>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Company</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Website</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Score</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Visual</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Tech</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Business</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Audit</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">AI</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Review</th>
                  <th className="px-3 py-2 font-medium text-[#57534e]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eeeb]">
                {leads.map((lead) => {
                  // Stable UI snapshot vs authoritative membership: a row whose
                  // lead stopped matching the current view due to background
                  // state changes stays rendered (no layout shift) but is
                  // marked as stale until an explicit refresh boundary.
                  const stale = staleIdsRef.current.has(lead.id) || !leadMatchesFilters(lead, filters, view);
                  return (
                  <tr data-testid="radar-lead-row" data-lead-id={lead.id} data-stale={stale || undefined} key={lead.id}
                    title={stale ? 'Moved out of current view — will be removed on the next refresh' : undefined}
                    className={`hover:bg-[#fafaf9] cursor-pointer ${stale ? 'opacity-60' : ''}`} onClick={() => { setSelectedLead(lead); setSelectedLeadId(lead.id); }}>
                    <td className="px-3 py-2">
                      <div className="text-[#1c1917] font-medium truncate">{lead.companyName}</div>
                      <div className={`text-[10px] font-mono truncate ${stale ? 'text-amber-600' : 'text-[#a8a29e]'}`}>
                        {stale ? 'Moved out of current view' : (lead.categories?.[0] || '—')}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="text-[#276749] hover:underline truncate block" onClick={(e) => e.stopPropagation()}>{lead.websiteDomain || lead.website}</a>
                      ) : <span className="text-[10px] text-red-700 font-mono">No website</span>}
                    </td>
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><LeadScoreRing score={lead.leadScoreV2 ?? lead.leadScore} size={32} /></div></td>
                    <td className="px-3 py-2 text-[11px] font-mono tabular-nums text-[#57534e]">{lead.visualQualityScore ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] font-mono tabular-nums text-[#57534e]">{lead.technicalQualityScore ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] font-mono tabular-nums text-[#57534e]">{lead.businessConfidenceScore ?? lead.businessScore ?? '—'}</td>
                    <td className="px-3 py-2">{statusBadge(lead.auditStatus, 'audit')}</td>
                    <td className="px-3 py-2">{statusBadge(lead.visualAnalysis?.status, 'ai')}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex w-full justify-center truncate text-[10px] font-mono px-1.5 py-0.5 rounded border ${lead.manualReviewStatus === 'GOOD' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : lead.manualReviewStatus === 'BAD' ? 'text-red-700 bg-red-50 border-red-200' : lead.manualReviewStatus === 'UNSURE' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-[#57534e] bg-[#f5f4f2] border-[#e5e3df]'}`}>
                        {lead.manualReviewStatus || 'UNREVIEWED'}
                      </span>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {lead.website && (
                          <Button data-testid="qualify-button" size="sm" onClick={() => startOperation('RUN_FULL_QUALIFICATION', { leadId: lead.id })}>Qualify</Button>
                        )}
                        {lead.site && (
                          <a href={`/showcase/${lead.site.previewToken}`} target="_blank" rel="noreferrer" className="text-[#276749] hover:underline text-[11px]">Open</a>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
    </div>

    {/* The detail panel is a real flex sibling of the main column — it takes
        layout space and can never overlay or intercept Radar controls. */}
    {selectedLead && (
      <LeadDetail
        lead={selectedLead}
        inCurrentView={leadMatchesFilters(selectedLead, filters, view)}
        onClose={() => { setSelectedLead(null); setSelectedLeadId(null); }}
        onStart={(op, input) => startOperation(op, input, selectedLead)}
        onReview={reviewLead}
        onSelect={selectForRedesign}
      />
    )}
    </>
  );
}
