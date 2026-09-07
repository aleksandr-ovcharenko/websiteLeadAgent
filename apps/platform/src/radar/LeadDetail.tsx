import { useEffect, useState } from 'react';
import { Button } from '../cms/ui';
import { api } from '../cms/api';
import { LeadScoreRing, scoreHue, ScorePill } from './RadarScoreRing';
import { computeQualification, STAGE_LABELS, STAGE_ICONS, stageColor } from './qualification';
import { CrawlViewer } from './CrawlViewer';

type Lead = any;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  WAITING: 'Waiting',
  SUCCESS: 'Complete',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
  UNKNOWN: 'Unknown',
  FOUND: 'Found',
  NOT_FOUND: 'Not found',
  UNREVIEWED: 'Unreviewed',
};

function statusColor(status: string) {
  if (status === 'SUCCESS' || status === 'FOUND') return 'text-success bg-success-subtle border-success-subtle';
  if (status === 'FAILED' || status === 'NOT_FOUND') return 'text-danger bg-danger-subtle border-danger-subtle';
  if (status === 'PENDING' || status === 'UNKNOWN') return 'text-warning bg-warning-subtle border-warning-subtle';
  return 'text-text bg-surface-raised border-border';
}

function Status({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-text-subtle font-mono">{label}</span>
      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${statusColor(status)}`}>
        {STATUS_LABELS[status] || status}
      </span>
    </div>
  );
}

export default function LeadDetail({ lead, onClose, onStart, onReview, onSelect }: { lead: Lead; onClose: () => void; onStart: (op: string, input: any) => void; onReview: (status: string, note?: string) => Promise<void> | void; onSelect: (selected: boolean) => Promise<void> | void }) {
  const [tab, setTab] = useState<'desktop' | 'mobile'>('desktop');
  const [note, setNote] = useState(lead.manualReviewNote || '');
  const [review, setReview] = useState(lead.manualReviewStatus || 'UNREVIEWED');
  const [imgError, setImgError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, 'RUNNING' | 'PENDING'>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [crawlRuns, setCrawlRuns] = useState<any[]>([]);
  const [viewingCrawl, setViewingCrawl] = useState<any>(null);

  useEffect(() => {
    setNote(lead.manualReviewNote || '');
    setReview(lead.manualReviewStatus || 'UNREVIEWED');
    setImgError(false);
    setSelecting(false);
    setGenerating(false);
    setOptimistic({});
    setCrawlRuns([]);
    setViewingCrawl(null);
    if (lead.id) {
      api.getFactoryRuns(lead.id)
        .then(({ runs }) => setCrawlRuns(runs || []))
        .catch(() => setCrawlRuns([]));
    }
  }, [lead.id]);

  useEffect(() => {
    setOptimistic(prev => {
      const { stages } = computeQualification(lead);
      const next: Record<string, 'RUNNING' | 'PENDING'> = {};
      for (const [key, value] of Object.entries(prev)) {
        const stage = stages.find(s => s.id === key);
        const terminal = stage && ['SUCCESS', 'FAILED', 'FOUND', 'SKIPPED', 'UNREVIEWED', 'NOT_FOUND'].includes(stage.status);
        if (value === 'RUNNING' && terminal) continue;
        next[key] = value;
      }
      return next;
    });
  }, [lead]);

  const visual = lead.visualAnalysis || {};
  const lh = lead.lighthouseReport || {};
  const scores = lead.scoreDetailsV2?.parts || {};
  const score = lead.leadScoreV2 ?? lead.leadScore ?? 0;

  const screenshotUrl = lead.id ? `/audit/${lead.id}/${tab}.png` : '';
  const fullUrl = lead.id ? `/audit/${lead.id}/${tab}-full.png` : '';
  const hasWebsite = !!lead.website;

  const tlsWarning: { status?: string; error?: string; message?: string } | null = (() => {
    const raw = lead.auditErrorMessage;
    if (!raw) return null;
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    if (typeof raw === 'object') return raw;
    return null;
  })();
  const hasTlsWarning = tlsWarning?.status === 'INVALID_CERTIFICATE';

  const { stages, firstBlocking, firstBlockingIndex, readyForReview } = computeQualification(lead, optimistic);
  const auditStatus = (optimistic.audit || lead.auditStatus || 'PENDING') as string;
  const scoreStatus = (optimistic.scoring || lead.scoreStatus || 'PENDING') as string;

  const handleReview = (s: string) => {
    setReview(s);
    Promise.resolve(onReview(s, note)).catch(() => {});
  };

  const setRunning = (stage: string) => {
    setOptimistic(prev => ({ ...prev, [stage]: 'RUNNING' }));
  };

  const handleRetryStage = (stageId: string) => {
    const input = { leadId: lead.id, force: true };
    if (stageId === 'audit' || stageId === 'screenshots') {
      onStart('AUDIT_WEBSITE', { leadId: lead.id, website: lead.website });
      setRunning('audit');
      setRunning('screenshots');
    } else if (stageId === 'lighthouse') {
      onStart('RUN_LIGHTHOUSE', input);
      setRunning('lighthouse');
    } else if (stageId === 'ai') {
      onStart('RUN_VISUAL_ANALYSIS', { leadId: lead.id, force: true });
      setRunning('ai');
    } else if (stageId === 'scoring') {
      onStart('RECALCULATE_SCORE', { leadId: lead.id });
      setRunning('scoring');
    }
  };

  const handleRunFullQualification = (force = false) => {
    onStart('RUN_FULL_QUALIFICATION', { leadId: lead.id, force });
    setRunning('audit');
  };

  const handleSelect = async () => {
    setSelecting(true);
    try {
      await onSelect(true);
    } finally {
      setSelecting(false);
    }
  };

  const handleCrawl = async () => {
    onStart('CRAWL_SITE', { leadId: lead.id });
  };

  const handleViewCrawl = (run: any) => setViewingCrawl(run);
  const closeCrawl = () => setViewingCrawl(null);

  const handleGenerate = async () => {
    setGenerating(true);
    const crawlRun = crawlRuns[0];
    if (crawlRun && (crawlRun.stage === 'CRAWL_READY' || crawlRun.stage === 'CRAWL_FAILED')) {
      onStart('GENERATE_SITE', { leadId: lead.id, crawlRunId: crawlRun.id });
    } else {
      onStart('GENERATE_SITE', { leadId: lead.id });
    }
  };

  const primaryAction = () => {
    if (!hasWebsite) return null;
    const anyRunning = stages.some(s => s.status === 'RUNNING');
    if (anyRunning) return { label: 'Qualifying…', disabled: true };
    if (firstBlocking) {
      const failed = ['FAILED', 'NOT_FOUND'].includes(firstBlocking.status);
      const label = failed ? `Retry ${firstBlocking.label}` : 'Run qualification';
      const action = failed ? () => handleRetryStage(firstBlocking.id) : () => handleRunFullQualification(false);
      return { label, action, variant: 'primary' as const };
    }
    if (lead.site || ['DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'].includes(lead.redesignStage || '')) {
      return { label: 'Open site', action: () => { if (lead.site) window.open(`/showcase/${lead.site.previewToken}`, '_blank'); } };
    }
    if (review === 'GOOD' && lead.redesignStage === 'NOT_SELECTED') {
      return { label: selecting ? 'Selecting…' : 'Select for redesign', action: handleSelect, disabled: selecting };
    }
    const crawlRun = crawlRuns[0];
    if (review === 'GOOD' && (lead.redesignStage === 'CRAWL_READY' || (crawlRun && crawlRun.stage === 'CRAWL_READY'))) {
      return { label: generating ? 'Generating…' : 'Generate demo', action: handleGenerate, disabled: generating };
    }
    if (review === 'GOOD' && ['SELECTED_FOR_REDESIGN', 'CRAWL_FAILED'].includes(lead.redesignStage || '')) {
      return { label: 'Crawl site', action: handleCrawl };
    }
    if (review === 'GOOD' && ['CONTENT_EXTRACTED', 'CONTENT_TRANSFORMED', 'CMS_IMPORTED'].includes(lead.redesignStage || '')) {
      return { label: generating ? 'Generating…' : 'Generate demo', action: handleGenerate, disabled: generating };
    }
    if (review === 'GOOD') return { label: 'Select for redesign', action: handleSelect, disabled: selecting };
    return null;
  };

  const action = primaryAction();
  const pipelineStage = lead.redesignStage && lead.redesignStage !== 'NOT_SELECTED'
    ? lead.redesignStage.replace(/_/g, ' ')
    : null;

  return (
    <div
      data-testid="lead-detail"
      className="fixed top-0 right-0 w-[420px] bg-surface border-l border-border flex flex-col z-40 shadow-[-4px_0_24px_var(--color-shadow)]"
      style={{ bottom: 'var(--console-height, 0px)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-[11px] font-mono text-text-subtle">Lead detail</span>
        <button onClick={onClose} className="text-text-subtle hover:text-text">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative bg-surface-hover">
          <div className="absolute top-3 left-3 z-10 flex rounded overflow-hidden border border-text-inverse/30 shadow-sm">
            {(['desktop', 'mobile'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-2.5 py-1 text-[10px] font-mono capitalize ${tab === t ? 'bg-surface-inverse text-text-inverse' : 'bg-surface/80 text-text hover:bg-surface'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="aspect-[16/10] relative overflow-hidden bg-surface-raised">
            {auditStatus === 'SUCCESS' ? (
              imgError ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                  <span className="text-text-subtle text-[12px] font-mono mb-2">Screenshot unavailable</span>
                  <span className="text-[10px] text-text font-mono">Audit exists but image not found</span>
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
                <span className="text-text-subtle text-[12px] font-mono mb-2">No screenshot yet</span>
                {hasWebsite && <span className="text-[10px] text-text font-mono">Run audit to capture</span>}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-[16px] text-text leading-tight">{lead.companyName || '—'}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-accent hover:underline break-all">{lead.website}</a>
                ) : (
                  <span className="text-[12px] font-mono text-danger">No website</span>
                )}
                {lead.categories?.[0] && <span className="text-[11px] text-text-subtle">· {lead.categories[0]}</span>}
                {lead.city && <span className="text-[11px] text-text-subtle">· {lead.city}</span>}
              </div>
              {hasTlsWarning && (
                <div className="w-full mt-2 p-2 rounded border bg-warning-subtle border-warning-subtle text-warning text-[11px] font-mono">
                  <span className="font-semibold">TLS warning:</span> {tlsWarning?.message} ({tlsWarning?.error})
                </div>
              )}
            </div>
            <div className="flex flex-col items-center shrink-0">
              <LeadScoreRing score={score} size={48} />
              <span className="text-[10px] font-mono text-text-subtle mt-1">Lead score</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-2">Qualification summary</div>
          <div className="space-y-1">
            {stages.map((s) => {
              const isBlocking = firstBlocking?.id === s.id;
              const failed = ['FAILED', 'NOT_FOUND'].includes(s.status);
              const rowClass = isBlocking && failed ? 'border-danger-subtle bg-danger-subtle' : isBlocking && s.status === 'RUNNING' ? 'border-info-subtle bg-info-subtle' : isBlocking ? 'border-warning-subtle bg-warning-subtle' : 'border-transparent hover:bg-surface-raised';
              const iconClass = s.status === 'FAILED' || s.status === 'NOT_FOUND' ? 'text-danger' : s.status === 'RUNNING' ? 'text-info animate-pulse' : ['SUCCESS', 'FOUND'].includes(s.status) ? 'text-success' : s.status === 'WAITING' ? 'text-text-subtle' : 'text-warning';
              return (
                <div key={s.id} className={`rounded border px-2.5 py-2 ${rowClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] font-mono w-4 ${iconClass}`}>
                        {STAGE_ICONS[s.status] || s.status[0]}
                      </span>
                      <span className="text-[12px] font-medium text-text">{s.label}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${stageColor(s.status)}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </div>
                  {s.status === 'RUNNING' && (
                    <div className="mt-1 text-[11px] text-info font-mono pl-6">Running…</div>
                  )}
                  {s.waitingFor && s.status === 'WAITING' && (
                    <div className="mt-1 text-[11px] text-text-muted font-mono pl-6">
                      Waiting for {s.waitingFor.join(', ')}.
                    </div>
                  )}
                  {failed && s.reason && isBlocking && (
                    <div className="mt-1.5 text-[11px] text-danger font-mono pl-6">
                      {s.reason}
                      {s.reason.length > 80 && (
                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                          className="ml-2 text-[10px] text-danger underline"
                        >
                          {expanded[s.id] ? 'Hide details' : 'Details'}
                        </button>
                      )}
                      {expanded[s.id] && (
                        <div className="mt-1 p-1.5 bg-surface/60 border border-danger-subtle rounded text-[10px] whitespace-pre-wrap">{s.reason}</div>
                      )}
                    </div>
                  )}
                  {failed && isBlocking && (
                    <div className="mt-1.5 text-[11px] text-danger font-mono pl-6">
                      <button onClick={() => handleRetryStage(s.id)} className="px-2 h-6 border border-danger-subtle rounded text-[10px] hover:bg-danger-subtle">
                        Retry {s.label}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className={`rounded border px-2.5 py-2 ${readyForReview ? 'border-success-subtle bg-success-subtle' : 'border-border bg-surface-raised'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-mono w-4 ${readyForReview ? 'text-success' : 'text-text-muted'}`}>{readyForReview ? '✓' : '🔒'}</span>
                  <span className="text-[12px] font-medium text-text">Review</span>
                </div>
                <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${readyForReview ? 'text-success bg-success-subtle border-success-subtle' : 'text-text-muted bg-surface-hover border-border'}`}>
                  {readyForReview ? (lead.manualReviewStatus || 'UNREVIEWED') : 'LOCKED'}
                </span>
              </div>
              {!readyForReview && firstBlocking && (
                <div className="mt-1.5 text-[11px] text-text-muted font-mono pl-6">
                  Review is unavailable because {firstBlocking.label.toLowerCase()} {['FAILED', 'NOT_FOUND'].includes(firstBlocking.status) ? 'failed' : 'is not complete'}.
                </div>
              )}
            </div>
          </div>
          {!readyForReview && firstBlocking && (
            <div className="mt-3 p-2.5 bg-danger-subtle border border-danger-subtle rounded text-[11px] text-danger font-mono">
              <p className="font-medium">Qualification is not ready for review.</p>
              <p className="mt-1">Blocking step: {firstBlocking.label} {firstBlocking.status}.</p>
              {stages.slice(firstBlockingIndex + 1).some(s => !['SUCCESS', 'SKIPPED', 'FOUND'].includes(s.status)) && (
                <p className="mt-1">Because {firstBlocking.label} did not complete, the following stages are blocked:</p>
              )}
              <ul className="mt-1 ml-4 list-disc">
                {stages.slice(firstBlockingIndex + 1).filter(s => !['SUCCESS', 'SKIPPED', 'FOUND'].includes(s.status)).map(s => <li key={s.id}>{s.label}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-2">Scores</div>
          {scoreStatus === 'SUCCESS' ? (
            <div className="space-y-2">
              {[
                { l: 'Visual opportunity', v: 100 - (lead.visualQualityScore ?? 0) },
                { l: 'Technical opportunity', v: 100 - (lead.technicalQualityScore ?? 0) },
                { l: 'Business confidence', v: lead.businessConfidenceScore ?? lead.businessScore ?? 0 },
                { l: 'Redesign potential', v: (visual.redesignPotential ?? 0) * 10 },
              ].map(({ l, v }) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-text-subtle w-[116px] shrink-0">{l}</span>
                  <div className="flex-1 h-[3px] rounded-full bg-surface-hover overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: scoreHue(v).ring }} />
                  </div>
                  <ScorePill value={v} />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2.5 bg-surface-raised border border-border rounded text-[11px] font-mono text-text-muted">
              Not calculated. Complete scoring to see scores.
            </div>
          )}
        </div>

        {visual?.summary && (
          <div className="px-5 py-4 border-b border-border">
            <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-2">AI assessment</div>
            <p className="text-[13px] text-text leading-[1.6]">{visual.summary}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {visual.problems?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-text-subtle mb-1">Problems</div>
                  {visual.problems.map((p: string, i: number) => <div key={i} className="text-[11px] text-text leading-snug">— {p}</div>)}
                </div>
              )}
              {visual.strengths?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-text-subtle mb-1">Strengths</div>
                  {visual.strengths.map((p: string, i: number) => <div key={i} className="text-[11px] text-text leading-snug">+ {p}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {lh && (
          <div className="px-5 py-4 border-b border-border">
            <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-2">Lighthouse</div>
            <div className="flex gap-5">
              {[
                ['Performance', lh.performance],
                ['Accessibility', lh.accessibility],
                ['SEO', lh.seo],
                ['Best practices', lh.bestPractices],
              ].map(([l, v]) => (
                <div key={l as string} className="text-center">
                  <div style={{ color: scoreHue(v as number).text }} className="text-[15px] font-mono font-semibold">{v ?? '—'}</div>
                  <div className="text-[10px] font-mono text-text-subtle">{l as string}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-4 space-y-3">
        <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider">Decision</div>
        {readyForReview ? (
          <div data-testid="lead-decision-buttons" className="flex rounded overflow-hidden border border-border divide-x">
            {(['BAD', 'UNSURE', 'GOOD'] as const).map((s) => {
              const active = review === s;
              return (
                <button key={s} onClick={() => handleReview(s)}
                  className={`flex-1 py-2 text-[12px] font-mono font-medium ${active ? 'text-text-inverse' : 'text-text-muted hover:bg-surface-raised'}`}
                  style={{ background: active ? (s === 'GOOD' ? 'var(--color-success)' : s === 'BAD' ? 'var(--color-danger)' : 'var(--color-warning)') : 'transparent' }}>
                  {s === 'GOOD' ? 'Approve' : s === 'BAD' ? 'Reject' : 'Maybe'}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-text-muted font-mono p-2 bg-surface-raised border border-border rounded">
            {firstBlocking ? (
              <>
                <p className="font-medium">Review is unavailable because qualification is incomplete.</p>
                <p className="mt-1">Blocking step: {firstBlocking.label} {['FAILED', 'NOT_FOUND'].includes(firstBlocking.status) ? 'failed' : 'is not complete'}.</p>
              </>
            ) : (
              <p>Review disabled until qualification is complete.</p>
            )}
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (readyForReview && note !== (lead.manualReviewNote || '')) Promise.resolve(onReview(review, note)).catch(() => {}); }}
          disabled={!readyForReview}
          placeholder={readyForReview ? 'Review note (optional)' : 'Notes disabled until ready'}
          className={`w-full h-16 p-2 text-[12px] border border-border rounded bg-surface-raised font-mono resize-none ${!readyForReview ? 'opacity-50' : ''}`}
        />
        <div className="flex gap-2 flex-wrap">
          {action && (
            <Button data-testid="lead-detail-primary-action" size="sm" disabled={action.disabled} onClick={() => { (action as any).action(); }} className="flex-1">
              {action.label}
            </Button>
          )}
          {hasWebsite && !['SUCCESS'].includes(auditStatus) && !stages.some(s => s.status === 'RUNNING') && (
            <Button size="sm" variant="secondary" onClick={() => handleRetryStage('audit')}>Audit</Button>
          )}
          {auditStatus === 'SUCCESS' && !stages.some(s => s.status === 'RUNNING') && (
            <Button size="sm" variant="secondary" onClick={() => handleRunFullQualification(true)}>Re-qualify</Button>
          )}
          {crawlRuns[0] && (
            <Button size="sm" variant="secondary" onClick={() => handleViewCrawl(crawlRuns[0])}>View crawl</Button>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 text-[11px] font-mono text-text border border-border rounded hover:bg-surface-raised">Open original ↗</a>
          )}
        </div>
      </div>
      {viewingCrawl && <CrawlViewer run={viewingCrawl} onClose={closeCrawl} />}
    </div>
  );
}
