import { useEffect, useMemo, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';
import { OperationConsole } from './OperationConsole';

type Mode = 'all' | 'audit' | 'selected';

interface Lead {
  id: string;
  companyName: string;
  website: string | null;
  websiteDomain: string | null;
  leadScoreV2: number | null;
  businessScore: number | null;
  auditStatus: string | null;
  lighthouseReport: any;
  visualAnalysis: { status: string } | null;
  selectedForRedesign: boolean;
  demoGenerated: boolean;
  manualReviewStatus: string | null;
  site: { previewToken: string } | null;
}

export default function RadarLeads({ mode = 'all' }: { mode?: Mode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.getLeads(200, 0, 0, 0, 100, 0, 100, '', '', '');
      setLeads(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const list = (leads || []).filter((l) => {
      const matches = (l.companyName || '').toLowerCase().includes(q.toLowerCase())
        || (l.websiteDomain || '').toLowerCase().includes(q.toLowerCase());
      if (!matches) return false;
      if (mode === 'audit') return l.auditStatus !== 'SUCCESS';
      if (mode === 'selected') return l.selectedForRedesign;
      return true;
    });
    return list.sort((a, b) => (b.leadScoreV2 || 0) - (a.leadScoreV2 || 0));
  }, [leads, q, mode]);

  function startOperation(operationId: string, lead: Lead, input: Record<string, any> = {}) {
    api.startOperation({ operationId, input: { ...input, leadId: lead.id }, leadId: lead.id, entityType: 'Lead', entityId: lead.id })
      .then(({ run }) => {
        setActiveRunId(run.id);
        setActiveTitle(`${operationId} · ${lead.companyName}`);
      })
      .catch((e) => setError(e.message || `${operationId} failed`));
  }

  const headers = {
    all: 'Leads',
    audit: 'Audit queue',
    selected: 'Selected for redesign',
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">{headers[mode]}</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search leads…"
            className="h-9 px-3 text-[13px] border border-[#e5e3df] rounded w-56"
          />
          <Button size="sm" variant="secondary" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        {loading && <div className="text-[13px] text-[#a8a29e]">Loading leads…</div>}
        {!loading && filtered.length === 0 && <div className="text-[13px] text-[#a8a29e]">No leads match the filter.</div>}

        <div className="bg-white border border-[#e5e3df] rounded-md overflow-hidden">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#fafaf9] border-b border-[#e5e3df]">
              <tr>
                <th className="px-4 py-2 font-medium text-[#57534e]">Company</th>
                <th className="px-4 py-2 font-medium text-[#57534e]">Website</th>
                <th className="px-4 py-2 font-medium text-[#57534e]">Score</th>
                <th className="px-4 py-2 font-medium text-[#57534e]">Audit</th>
                <th className="px-4 py-2 font-medium text-[#57534e]">Lighthouse</th>
                <th className="px-4 py-2 font-medium text-[#57534e]">AI</th>
                <th className="px-4 py-2 font-medium text-[#57534e]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eeeb]">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#fafaf9]">
                  <td className="px-4 py-2 text-[#1c1917] font-medium">{lead.companyName}</td>
                  <td className="px-4 py-2 text-[#57534e]">
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noreferrer" className="text-[#276749] hover:underline">{lead.websiteDomain || lead.website}</a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2">{lead.leadScoreV2 ?? '—'}</td>
                  <td className="px-4 py-2">{lead.auditStatus || '—'}</td>
                  <td className="px-4 py-2">{lead.lighthouseReport ? '✓' : '—'}</td>
                  <td className="px-4 py-2">{lead.visualAnalysis?.status || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {lead.website && lead.auditStatus !== 'SUCCESS' && (
                        <Button size="sm" onClick={() => startOperation('AUDIT_WEBSITE', lead)}>Audit</Button>
                      )}
                      {lead.website && lead.auditStatus === 'SUCCESS' && (
                        <Button size="sm" variant="secondary" onClick={() => startOperation('AUDIT_WEBSITE', lead, { force: true })}>Re-audit</Button>
                      )}
                      {lead.website && !lead.lighthouseReport && (
                        <Button size="sm" variant="secondary" onClick={() => startOperation('RUN_LIGHTHOUSE', lead)}>Lighthouse</Button>
                      )}
                      {lead.lighthouseReport && (
                        <Button size="sm" variant="secondary" onClick={() => startOperation('RUN_LIGHTHOUSE', lead, { force: true })}>Re-Lighthouse</Button>
                      )}
                      {lead.auditStatus === 'SUCCESS' && lead.visualAnalysis?.status !== 'SUCCESS' && (
                        <Button size="sm" variant="secondary" onClick={() => startOperation('RUN_VISUAL_ANALYSIS', lead)}>AI</Button>
                      )}
                      {lead.visualAnalysis?.status === 'SUCCESS' && (
                        <Button size="sm" variant="secondary" onClick={() => startOperation('RUN_VISUAL_ANALYSIS', lead, { force: true })}>Re-AI</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => startOperation('RECALCULATE_SCORE', lead)}>Score</Button>
                      <Button size="sm" variant="ghost" onClick={() => startOperation('RUN_FULL_QUALIFICATION', lead)}>Qualify</Button>
                      {lead.website && (
                        <Button size="sm" variant="ghost" onClick={() => startOperation('GENERATE_SITE', lead)}>Generate</Button>
                      )}
                      {lead.site && (
                        <a href={`/showcase/${lead.site.previewToken}`} target="_blank" rel="noreferrer" className="text-[#276749] hover:underline text-[11px]">Showcase</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeRunId && (
          <div className="mt-6">
            <OperationConsole runId={activeRunId} title={activeTitle} onClose={() => setActiveRunId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
