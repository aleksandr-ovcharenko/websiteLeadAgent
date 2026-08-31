import { useEffect, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';
import { OperationConsole } from './OperationConsole';
import RadarStats from './RadarStats';
import RadarFilters, { Filters } from './RadarFilters';
import LeadDetail from './LeadDetail';
import { LeadScoreRing } from './RadarScoreRing';

type Mode = 'all' | 'audit' | 'selected';

function statusBadge(status?: string | null, type: 'audit' | 'lighthouse' | 'ai' = 'audit') {
  const s = status || 'PENDING';
  const label = { audit: { PENDING: 'Audit', SUCCESS: 'Audited', FAILED: 'Failed' }, lighthouse: { PENDING: 'Lighthouse', SUCCESS: 'Lighthouse', FAILED: 'Failed' }, ai: { PENDING: 'AI', SUCCESS: 'AI', FAILED: 'Failed' } }[type];
  const color = s === 'SUCCESS' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : s === 'FAILED' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}>{(label as any)[s] || s}</span>;
}

export default function RadarLeads({ mode = 'all' }: { mode?: Mode }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryRunId, setDiscoveryRunId] = useState('');
  const [quick, setQuick] = useState(mode === 'audit' ? 'needs_audit' : mode === 'selected' ? 'selected' : 'ready_for_review');
  const [filters, setFilters] = useState<Filters>({ q: '', sort: 'v2_desc', websiteStatus: '', auditStatus: '', manual: '' });
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [qualifying, setQualifying] = useState(false);

  const getParams = () => {
    const p: any = { limit: 200, sort: filters.sort };
    if (filters.q) p.q = filters.q;
    if (filters.websiteStatus) p.websiteStatus = filters.websiteStatus;
    if (filters.auditStatus) p.auditStatus = filters.auditStatus;
    if (filters.manual) p.manual = filters.manual;
    if (discoveryRunId) p.discoveryRunId = discoveryRunId;
    if (quick === 'all') { p.qualificationStatus = 'ALL'; p.websiteStatus = 'FOUND'; }
    if (quick === 'qualification_pending') p.qualificationStatus = 'PENDING';
    if (quick === 'ready_for_review') p.qualificationStatus = 'READY';
    if (quick === 'failed') p.qualificationStatus = 'FAILED';
    if (quick === 'no_website') { p.qualificationStatus = 'ALL'; p.websiteStatus = 'NOT_FOUND'; }
    if (quick === 'needs_audit') p.qualificationStatus = 'PENDING';
    if (quick === 'needs_ai') p.qualificationStatus = 'PENDING';
    if (quick === 'good') { p.qualificationStatus = 'READY'; p.manual = 'GOOD'; }
    if (quick === 'unsure') { p.qualificationStatus = 'READY'; p.manual = 'UNSURE'; }
    if (quick === 'bad') { p.qualificationStatus = 'READY'; p.manual = 'BAD'; }
    if (quick === 'selected') { p.qualificationStatus = 'ALL'; p.manual = 'GOOD'; }
    if (quick === 'generated') { p.qualificationStatus = 'ALL'; p.websiteStatus = 'FOUND'; }
    return p;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.getLeads(getParams());
      setLeads(res.items || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [mode, discoveryRunId, filters.q, filters.websiteStatus, filters.auditStatus, filters.manual, quick, filters.sort]);

  const handleQuick = (key: string) => {
    setQuick(key);
    setFilters({ ...filters, websiteStatus: '', auditStatus: '', manual: '', q: '' });
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
    if (!selectedLead) return;
    api.reviewLead(selectedLead.id, status, note)
      .then(() => refresh())
      .catch((e) => setError(e.message || 'Review failed'));
  }

  function selectForRedesign(selected: boolean) {
    if (!selectedLead) return;
    api.setRedesignStage(selectedLead.id, selected ? 'SELECTED_FOR_REDESIGN' : 'NOT_SELECTED')
      .then(() => refresh())
      .catch((e) => setError(e.message || 'Select failed'));
  }

  const headers = { all: 'Leads', audit: 'Audit queue', selected: 'Selected for redesign' };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">{headers[mode]}</h1>
        <Button size="sm" variant="secondary" onClick={refresh}>Refresh</Button>
      </div>

      <div className={`p-6 ${selectedLead ? 'pr-[420px]' : ''}`}>
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        <RadarStats discoveryRunId={discoveryRunId} onRunChange={setDiscoveryRunId} onQualify={qualifyRun} qualifying={qualifying} />
        <RadarFilters filters={filters} onChange={(f) => setFilters({ ...filters, ...f })} quick={quick} onQuick={handleQuick} />

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
                  <tr key={lead.id} className="hover:bg-[#fafaf9] cursor-pointer" onClick={() => setSelectedLead(lead)}>
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
                          <Button size="sm" onClick={() => startOperation('RUN_FULL_QUALIFICATION', { leadId: lead.id })}>Qualify</Button>
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
          onClose={() => setSelectedLead(null)}
          onStart={(op, input) => startOperation(op, input, selectedLead)}
          onReview={reviewLead}
          onSelect={selectForRedesign}
        />
      )}
    </div>
  );
}
