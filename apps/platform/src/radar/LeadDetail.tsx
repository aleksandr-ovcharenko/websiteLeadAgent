import { useEffect, useState } from 'react';
import { Button } from '../cms/ui';
import { LeadScoreRing, scoreHue, ScorePill } from './RadarScoreRing';

type Lead = any;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  SUCCESS: 'Complete',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
  UNKNOWN: 'Unknown',
  FOUND: 'Found',
  NOT_FOUND: 'Not found',
};

function statusColor(status: string) {
  if (status === 'SUCCESS' || status === 'FOUND') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'FAILED' || status === 'NOT_FOUND') return 'text-red-700 bg-red-50 border-red-200';
  if (status === 'PENDING' || status === 'UNKNOWN') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-[#57534e] bg-[#f5f4f2] border-[#e5e3df]';
}

function Status({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[#a8a29e] font-mono">{label}</span>
      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${statusColor(status)}`}>
        {STATUS_LABELS[status] || status}
      </span>
    </div>
  );
}

export default function LeadDetail({ lead, onClose, onStart, onReview, onSelect }: { lead: Lead; onClose: () => void; onStart: (op: string, input: any) => void; onReview: (status: string, note?: string) => void; onSelect: (selected: boolean) => void }) {
  const [tab, setTab] = useState<'desktop' | 'mobile'>('desktop');
  const [note, setNote] = useState(lead.manualReviewNote || '');
  const [review, setReview] = useState(lead.manualReviewStatus || 'UNREVIEWED');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setNote(lead.manualReviewNote || '');
    setReview(lead.manualReviewStatus || 'UNREVIEWED');
    setImgError(false);
  }, [lead.id]);

  const visual = lead.visualAnalysis || {};
  const lh = lead.lighthouseReport || {};
  const scores = lead.scoreDetailsV2?.parts || {};
  const score = lead.leadScoreV2 ?? lead.leadScore ?? 0;

  const screenshotUrl = lead.id ? `/audit/${lead.id}/${tab}.png` : '';
  const fullUrl = lead.id ? `/audit/${lead.id}/${tab}-full.png` : '';
  const hasWebsite = !!lead.website;
  const auditOk = lead.auditStatus === 'SUCCESS' || lead.auditStatus === 'complete';
  const lhOk = !!lead.lighthouseReport;
  const aiOk = visual?.status === 'SUCCESS';
  const scored = lead.leadScoreV2 !== null && lead.leadScoreV2 !== undefined;
  const readyForReview = !!(
    hasWebsite && auditOk && lhOk && aiOk && scored
  );

  const handleReview = (s: string) => {
    setReview(s);
    onReview(s, note);
  };

  const primaryAction = () => {
    if (!hasWebsite) return null;
    if (!auditOk) return { label: 'Qualify', op: 'RUN_FULL_QUALIFICATION', input: { leadId: lead.id, force: false } };
    if (!scored) return { label: 'Qualify', op: 'RUN_FULL_QUALIFICATION', input: { leadId: lead.id, force: false } };
    if (review === 'GOOD' && lead.redesignStage !== 'SELECTED_FOR_REDESIGN' && !lead.site) return { label: 'Select for redesign', op: 'SELECT', input: {} };
    if (lead.site) return { label: 'Open site', op: 'OPEN_SITE', input: {} };
    if (review === 'GOOD') return { label: 'Generate site', op: 'GENERATE_SITE', input: { leadId: lead.id } };
    return null;
  };

  const action = primaryAction();

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-[#e5e3df] flex flex-col z-40 shadow-[-4px_0_24px_rgba(28,25,23,0.07)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0ede8] shrink-0">
        <span className="text-[11px] font-mono text-[#a8a29e]">Lead detail</span>
        <button onClick={onClose} className="text-[#a8a29e] hover:text-[#1c1917]">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative bg-[#f0ede8]">
          <div className="absolute top-3 left-3 z-10 flex rounded overflow-hidden border border-white/30 shadow-sm">
            {(['desktop', 'mobile'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-2.5 py-1 text-[10px] font-mono capitalize ${tab === t ? 'bg-[#1c1917] text-white' : 'bg-white/80 text-[#57534e] hover:bg-white'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="aspect-[16/10] relative overflow-hidden bg-[#fafaf9]">
            {auditOk ? (
              imgError ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                  <span className="text-[#a8a29e] text-[12px] font-mono mb-2">Screenshot unavailable</span>
                  <span className="text-[10px] text-[#57534e] font-mono">Audit exists but image not found</span>
                </div>
              ) : (
                <a href={fullUrl} target="_blank" rel="noreferrer" className="block w-full h-full">
                  <img
                    src={screenshotUrl}
                    alt={`${lead.companyName} website`}
                    className="w-full h-full object-contain object-top cursor-pointer hover:opacity-95"
                    onError={() => setImgError(true)}
                  />
                </a>
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                <span className="text-[#a8a29e] text-[12px] font-mono mb-2">No screenshot yet</span>
                {hasWebsite && <span className="text-[10px] text-[#57534e] font-mono">Run audit to capture</span>}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-5 pb-4 border-b border-[#f0ede8]">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-[16px] text-[#1c1917] leading-tight">{lead.companyName || '—'}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-[#276749] hover:underline break-all">{lead.website}</a>
                ) : (
                  <span className="text-[12px] font-mono text-[#9b1c1c]">No website</span>
                )}
                {lead.categories?.[0] && <span className="text-[11px] text-[#a8a29e]">· {lead.categories[0]}</span>}
                {lead.city && <span className="text-[11px] text-[#a8a29e]">· {lead.city}</span>}
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <LeadScoreRing score={score} size={48} />
              <span className="text-[10px] font-mono text-[#a8a29e] mt-1">Lead score</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-[#f0ede8]">
          <div className="text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider mb-2">Qualification completeness</div>
          <div className="grid grid-cols-2 gap-2">
            <Status label="Website" status={hasWebsite ? 'FOUND' : 'NOT_FOUND'} />
            <Status label="Audit" status={lead.auditStatus || 'PENDING'} />
            <Status label="Lighthouse" status={lhOk ? 'SUCCESS' : 'PENDING'} />
            <Status label="AI analysis" status={visual?.status || 'PENDING'} />
            <Status label="Scored" status={scored ? 'SUCCESS' : 'PENDING'} />
            <Status label="Review" status={lead.manualReviewStatus || 'UNREVIEWED'} />
          </div>
          {!readyForReview && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-800 font-mono">
              Qualification incomplete. Complete all steps above before review.
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-b border-[#f0ede8]">
          <div className="text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider mb-2">Scores</div>
          <div className="space-y-2">
            {[
              { l: 'Visual opportunity', v: 100 - (lead.visualQualityScore ?? 0) },
              { l: 'Technical opportunity', v: 100 - (lead.technicalQualityScore ?? 0) },
              { l: 'Business confidence', v: lead.businessConfidenceScore ?? lead.businessScore ?? 0 },
              { l: 'Redesign potential', v: (visual.redesignPotential ?? 0) * 10 },
            ].map(({ l, v }) => (
              <div key={l} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#a8a29e] w-[116px] shrink-0">{l}</span>
                <div className="flex-1 h-[3px] rounded-full bg-[#ebe9e5] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: scoreHue(v).ring }} />
                </div>
                <ScorePill value={v} />
              </div>
            ))}
          </div>
        </div>

        {visual?.summary && (
          <div className="px-5 py-4 border-b border-[#f0ede8]">
            <div className="text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider mb-2">AI assessment</div>
            <p className="text-[13px] text-[#44403c] leading-[1.6]">{visual.summary}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {visual.problems?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-[#a8a29e] mb-1">Problems</div>
                  {visual.problems.map((p: string, i: number) => <div key={i} className="text-[11px] text-[#57534e] leading-snug">— {p}</div>)}
                </div>
              )}
              {visual.strengths?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-[#a8a29e] mb-1">Strengths</div>
                  {visual.strengths.map((p: string, i: number) => <div key={i} className="text-[11px] text-[#57534e] leading-snug">+ {p}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {lh && (
          <div className="px-5 py-4 border-b border-[#f0ede8]">
            <div className="text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider mb-2">Lighthouse</div>
            <div className="flex gap-5">
              {[
                ['Performance', lh.performance],
                ['Accessibility', lh.accessibility],
                ['SEO', lh.seo],
                ['Best practices', lh.bestPractices],
              ].map(([l, v]) => (
                <div key={l as string} className="text-center">
                  <div style={{ color: scoreHue(v as number).text }} className="text-[15px] font-mono font-semibold">{v ?? '—'}</div>
                  <div className="text-[10px] font-mono text-[#a8a29e]">{l as string}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#e5e3df] p-4 space-y-3">
        <div className="text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider">Decision</div>
        {readyForReview ? (
          <div className="flex rounded overflow-hidden border border-[#ddd9d4] divide-x">
            {(['BAD', 'UNSURE', 'GOOD'] as const).map((s) => {
              const active = review === s;
              return (
                <button key={s} onClick={() => handleReview(s)}
                  className={`flex-1 py-2 text-[12px] font-mono font-medium ${active ? 'text-white' : 'text-[#78716c] hover:bg-[#f5f4f2]'}`}
                  style={{ background: active ? (s === 'GOOD' ? '#276749' : s === 'BAD' ? '#9b1c1c' : '#92600a') : 'transparent' }}>
                  {s === 'GOOD' ? 'Approve' : s === 'BAD' ? 'Reject' : 'Maybe'}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-[#78716c] font-mono p-2 bg-[#fafaf9] border border-[#e5e3df] rounded">
            Review disabled until qualification is complete.
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (readyForReview && note !== (lead.manualReviewNote || '')) onReview(review, note); }}
          disabled={!readyForReview}
          placeholder={readyForReview ? 'Review note (optional)' : 'Notes disabled until ready'}
          className={`w-full h-16 p-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] font-mono resize-none ${!readyForReview ? 'opacity-50' : ''}`}
        />
        <div className="flex gap-2">
          {action && (
            <Button size="sm" onClick={() => {
              if (action.op === 'OPEN_SITE' && lead.site) window.open(`/showcase/${lead.site.previewToken}`, '_blank');
              else if (action.op === 'SELECT') onSelect(true);
              else onStart(action.op, action.input);
            }} className="flex-1">
              {action.label}
            </Button>
          )}
          {hasWebsite && !auditOk && (
            <Button size="sm" variant="secondary" onClick={() => onStart('AUDIT_WEBSITE', { leadId: lead.id })}>Audit</Button>
          )}
          {auditOk && (
            <Button size="sm" variant="secondary" onClick={() => onStart('RUN_FULL_QUALIFICATION', { leadId: lead.id, force: true })}>Re-qualify</Button>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 text-[11px] font-mono text-[#57534e] border border-[#e5e3df] rounded hover:bg-[#f5f4f2]">Open original ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}
