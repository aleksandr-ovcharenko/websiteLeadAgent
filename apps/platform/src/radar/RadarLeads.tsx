import { useEffect, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';
import { OperationConsole } from './OperationConsole';
import RadarStats from './RadarStats';
import RadarFilters, { Filters, PrimaryView, defaultFilters } from './RadarFilters';
import LeadDetail from './LeadDetail';
import { LeadScoreRing } from './RadarScoreRing';

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
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}>{(label as any)[s] || s}</span>;
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
      setLeads((prev) => (isBackground && prev.length > 0 && items.length === 0) ? prev : items);
      setError(null);
      if (selectedLeadId) {
        const updated = items.find((l: any) => l.id === selectedLeadId);
        if (updated) setSelectedLead(updated);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => { if (mounted) await refresh(false); };
    load();
    const interval = setInterval(() => { if (mounted) refresh(true); }, 3000);
    return () => { mounted = false; clearInterval(interval); };
  }, [view, discoveryRunId, filters.q, filters.websiteStatus, filters.qualificationStatus, filters.manual, filters.generationStatus, filters.sort]);

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

  function reviewLead(status: string, note?: string) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    return api.reviewLead(selectedLead.id, status, note)
      .then(() => refresh(false))
      .catch((e) => { setError(e.message || 'Review failed'); throw e; });
  }

  function selectForRedesign(selected: boolean) {
    if (!selectedLead) return Promise.reject(new Error('No lead selected'));
    return api.setRedesignStage(selectedLead.id, selected ? 'SELECTED_FOR_REDESIGN' : 'NOT_SELECTED')
      .then(() => refresh(false))
      .catch((e) => { setError(e.message || 'Select failed'); throw e; });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">Leads</h1>
        <div className="flex items-center gap-2">
          {refreshing && <span className="text-[11px] text-[#a8a29e] font-mono">Updating…</span>}
          <Button size="sm" variant="secondary" onClick={() => refresh(false)}>Refresh</Button>
        </div>
      </div>

      <div className={`p-6 ${selectedLead ? 'pr-[420px]' : ''}`}>
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        <RadarStats discoveryRunId={discoveryRunId} onRunChange={setDiscoveryRunId} onQualify={qualifyRun} qualifying={qualifying} />
        <RadarFilters
          filters={filters}
          onChange={(f) => setFilters({ ...filters, ...f })}
          view={view}
          onView={handleView}
          counts={counts}
        />

        {loading && <div className="text-[13px] text-[#a8a29e]">Loading leads…</div>}
        {!loading && leads.length === 0 && <div className="text-[13px] text-[#a8a29e]">No leads match the filter.</div>}

        {!loading && leads.length > 0 && (
          <div className="bg-white border border-[#e5e3df] rounded-md overflow-hidden">
            <table className="w-full text-left text-[12px]">
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
                {leads.map((lead) => (
                  <tr data-testid="radar-lead-row" key={lead.id} className="hover:bg-[#fafaf9] cursor-pointer" onClick={() => { setSelectedLead(lead); setSelectedLeadId(lead.id); }}>
                    <td className="px-3 py-2">
                      <div className="text-[#1c1917] font-medium truncate max-w-[180px]">{lead.companyName}</div>
                      <div className="text-[10px] text-[#a8a29e] font-mono">{lead.categories?.[0] || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="text-[#276749] hover:underline truncate max-w-[120px] inline-block" onClick={(e) => e.stopPropagation()}>{lead.websiteDomain || lead.website}</a>
                      ) : <span className="text-[10px] text-red-700 font-mono">No website</span>}
                    </td>
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><LeadScoreRing score={lead.leadScoreV2 ?? lead.leadScore} size={32} /></div></td>
                    <td className="px-3 py-2 text-[11px] font-mono text-[#57534e]">{lead.visualQualityScore ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] font-mono text-[#57534e]">{lead.technicalQualityScore ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] font-mono text-[#57534e]">{lead.businessConfidenceScore ?? lead.businessScore ?? '—'}</td>
                    <td className="px-3 py-2">{statusBadge(lead.auditStatus, 'audit')}</td>
                    <td className="px-3 py-2">{statusBadge(lead.visualAnalysis?.status, 'ai')}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${lead.manualReviewStatus === 'GOOD' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : lead.manualReviewStatus === 'BAD' ? 'text-red-700 bg-red-50 border-red-200' : lead.manualReviewStatus === 'UNSURE' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-[#57534e] bg-[#f5f4f2] border-[#e5e3df]'}`}>
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
          onClose={() => { setSelectedLead(null); setSelectedLeadId(null); }}
          onStart={(op, input) => startOperation(op, input, selectedLead)}
          onReview={reviewLead}
          onSelect={selectForRedesign}
        />
      )}
    </div>
  );
}
