import { useEffect, useState } from 'react'
import { ProductArea } from './cms/ProductHeader'
import { Button } from './cms/ui'
import { IconX, IconCheck, IconChevronRight } from './cms/icons'
import { api } from './cms/api'
import { RevisionHistory } from './cms/RevisionHistory'
import { OperationConsole } from './radar/OperationConsole'

type RunStatus = 'queued' | 'running' | 'failed' | 'completed'

interface PipelineRun {
  id: string
  runNumber: number
  company: string
  domain: string
  status: RunStatus
  currentStage: string
  stagesDone: number
  stagesTotal: number
  started: string
  duration: string
  failedStage?: string
  failedReason?: string
  leadId?: string
  siteId?: string
  forgeId?: string
  previewToken?: string
  stageResults?: StageGate[]
  resumeFromStage?: string | null
}

interface StageGate {
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL'
  stage: string
  errors: string[]
  warnings: string[]
  metrics: Record<string, number | string | boolean>
  artifactPaths: string[]
  retryFromStage: string
  durationMs?: number
}

interface Toast {
  id: string
  message: string
}

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const show = (message: string) => {
    setToast({ id: String(Date.now()), message })
    setTimeout(() => setToast(null), 3000)
  }
  return { toast, show }
}

const GATE_LABELS: Record<string, string> = {
  CRAWLED: 'Crawl',
  EXTRACTED: 'Extract',
  CONTENT_VALIDATED: 'Content QA',
  GRAPH_BUILT: 'Graph',
  CMS_IMPORT_READY: 'CMS import QA',
  CMS_IMPORTED: 'CMS import',
  RENDERED: 'Render',
  RENDER_VALIDATED: 'Route/media QA',
  VISUAL_VALIDATED: 'Visual QA',
  HUMAN_REVIEW_READY: 'Human review',
}

const GATE_ORDER = Object.keys(GATE_LABELS)

function buildStages(run: PipelineRun) {
  // Prefer the typed gate contract persisted on the run (V3.7.2+); fall back
  // to the legacy fixed list for runs predating it.
  const gates = run.stageResults
  if (gates && gates.length) {
    const byStage = new Map(gates.map(g => [g.stage, g]))
    return GATE_ORDER.map(stage => {
      const g = byStage.get(stage)
      if (!g) return { name: GATE_LABELS[stage], status: 'pending' as const, gate: undefined }
      const status = g.status === 'FAIL' ? 'failed' as const : 'done' as const
      return { name: GATE_LABELS[stage], status, gate: g }
    })
  }
  const names = [
    'Lead selected', 'Content extraction', 'Content transformation',
    'CMS import', 'Website generation', 'Validation', 'Demo ready',
  ]
  return names.map((name, i) => {
    if (run.status === 'failed' && name === run.failedStage) return { name, status: 'failed' as const, gate: undefined }
    if (i < run.stagesDone) return { name, status: 'done' as const, gate: undefined }
    if (i === run.stagesDone && run.status === 'running') return { name, status: 'running' as const, gate: undefined }
    return { name, status: 'pending' as const, gate: undefined }
  })
}

function StatusBadge({ status }: { status: RunStatus }) {
  const styles: Record<RunStatus, string> = {
    queued: 'text-text-muted bg-surface-hover border-border',
    running: 'text-success bg-success-subtle border-success-subtle',
    failed: 'text-danger bg-danger-subtle border-danger-subtle',
    completed: 'text-text-muted bg-surface-hover border-border',
  }
  const labels: Record<RunStatus, string> = {
    queued: 'QUEUED', running: 'RUNNING', failed: 'FAILED', completed: 'COMPLETED',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${styles[status]}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
      {labels[status]}
    </span>
  )
}

function StageRow({ stage }: { stage: { name: string; status: 'done' | 'running' | 'failed' | 'pending'; gate?: StageGate } }) {
  const [open, setOpen] = useState(false)
  const g = stage.gate
  const hasDetail = !!g && (g.errors.length > 0 || g.warnings.length > 0 || Object.keys(g.metrics).length > 0)
  return (
    <div className="py-1.5">
      <div
        className={`flex items-center gap-3 ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setOpen(!open)}
      >
        <div className="w-5 flex items-center justify-center flex-shrink-0">
          {stage.status === 'done' && g?.status === 'PASS_WITH_WARNINGS' && (
            <span className="w-4 h-4 rounded-full bg-warning flex items-center justify-center">
              <IconCheck size={9} className="text-text-inverse" />
            </span>
          )}
          {stage.status === 'done' && g?.status !== 'PASS_WITH_WARNINGS' && (
            <span className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <IconCheck size={9} className="text-text-inverse" />
            </span>
          )}
          {stage.status === 'running' && (
            <span className="w-4 h-4 rounded-full border-2 border-accent flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            </span>
          )}
          {stage.status === 'failed' && (
            <span className="w-4 h-4 rounded-full bg-danger flex items-center justify-center">
              <IconX size={8} className="text-text-inverse" />
            </span>
          )}
          {stage.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full border-2 border-border" />}
        </div>
        <span className="text-[12px] text-text">{stage.name}</span>
        {g && g.warnings.length > 0 && (
          <span className="text-[10px] text-warning mono">{g.warnings.length}w</span>
        )}
        {g && g.errors.length > 0 && (
          <span className="text-[10px] text-danger mono">{g.errors.length}e</span>
        )}
        {hasDetail && <IconChevronRight size={10} className={`text-text-subtle transition-transform ${open ? 'rotate-90' : ''}`} />}
      </div>
      {open && g && (
        <div className="ml-8 mt-1.5 mb-1 space-y-1.5">
          {g.errors.map((e, i) => (
            <p key={`e${i}`} className="text-[11px] text-danger leading-snug">{e}</p>
          ))}
          {g.warnings.map((w, i) => (
            <p key={`w${i}`} className="text-[11px] text-warning leading-snug">{w}</p>
          ))}
          {g.status === 'FAIL' && (
            <p className="text-[10px] text-text-subtle">
              Retry from: <span className="mono">{GATE_LABELS[g.retryFromStage] || g.retryFromStage}</span>
              {g.retryFromStage === 'CRAWLED' && ' · recrawl required'}
            </p>
          )}
          {g.artifactPaths?.length > 0 && (
            <div className="text-[10px] text-text-subtle mono leading-snug break-all">
              {g.artifactPaths.map((p, i) => <div key={i}>{p.split('/').slice(-2).join('/')}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ArtifactPanel({ runId }: { runId: string }) {
  const [tab, setTab] = useState<'crawl' | 'source' | 'semantic'>('source')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const fetcher =
      tab === 'crawl'
        ? api.getCrawlArtifact
        : tab === 'semantic'
        ? api.getSourceContentGraphArtifact
        : api.getSourceDocumentsArtifact
    fetcher(runId)
      .then((json) => { setData(json); setLoading(false) })
      .catch((e: any) => { setError(e?.message || 'Failed to load artifact'); setLoading(false) })
  }, [runId, tab])

  return (
    <div className="px-5 py-4 border-b border-border">
      <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-2">Artifacts</p>
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setTab('crawl')}
          className={`text-[11px] px-2 py-1 rounded border ${tab === 'crawl' ? 'bg-success-subtle border-success-subtle text-success' : 'bg-surface border-border text-text-muted hover:bg-surface-raised'}`}
        >
          crawl.json
        </button>
        <button
          onClick={() => setTab('source')}
          className={`text-[11px] px-2 py-1 rounded border ${tab === 'source' ? 'bg-success-subtle border-success-subtle text-success' : 'bg-surface border-border text-text-muted hover:bg-surface-raised'}`}
        >
          source-documents.json
        </button>
        <button
          onClick={() => setTab('semantic')}
          className={`text-[11px] px-2 py-1 rounded border ${tab === 'semantic' ? 'bg-success-subtle border-success-subtle text-success' : 'bg-surface border-border text-text-muted hover:bg-surface-raised'}`}
        >
          source-content-graph.json
        </button>
      </div>
      {loading && <p className="text-[11px] text-text-subtle">Loading…</p>}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      {!loading && !error && data && (
        <pre className="text-[10px] text-text-muted bg-surface-raised border border-border rounded p-2 overflow-auto max-h-[260px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

interface FactoryProps {
  onNavigate: (area: ProductArea) => void
}

export default function Factory({ onNavigate }: FactoryProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeTitle, setActiveTitle] = useState('')
  const { toast, show } = useToast()

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getFactoryRuns()
      setRuns(res.runs || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load factory runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const handleRetry = async (run: PipelineRun) => {
    if (!run.leadId) { show('No leadId for this run'); return; }
    setRetrying(run.id)
    try {
      const { run: op } = await api.startOperation({
        operationId: 'GENERATE_SITE',
        input: { leadId: run.leadId, crawlRunId: run.id, force: true, mode: 'retry', resumeFromStage: run.resumeFromStage ?? undefined },
        entityType: 'RedesignRun',
        entityId: run.id,
      })
      setActiveRunId(op.id)
      setActiveTitle(`Generate site: ${run.company}`)
      show(`Run #${run.runNumber} queued for retry`)
    } catch (e: any) {
      show(e.message || 'Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  const selectedRun = runs.find(r => r.id === selectedRunId) || null

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-bg items-center justify-center">
        <div className="text-[13px] font-mono text-text-subtle">Loading Factory…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-bg items-center justify-center">
        <div className="text-[13px] font-mono text-danger mb-3">{error}</div>
        <Button size="sm" onClick={refresh}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">
      <div className="flex-shrink-0 bg-surface border-b border-border px-5 h-[46px] flex items-center gap-3">
        <span className="text-[13px] font-semibold text-text">Factory</span>
        <span className="text-[12px] text-text-subtle">Generation pipeline</span>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[12px] text-text-subtle">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {runs.filter(r => r.status === 'running').length} running
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            {runs.filter(r => r.status === 'queued').length} queued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            {runs.filter(r => r.status === 'failed').length} failed
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-[900px]">
            {runs.length === 0 ? (
              <div className="bg-surface border border-border rounded py-14 text-center text-[13px] text-text-subtle">
                No factory runs yet
              </div>
            ) : (
              <div className="bg-surface border border-border rounded overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {['#', 'Company', 'Status', 'Stage', 'Progress', 'Started', 'Duration', ''].map(col => (
                        <th key={col} className="text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-2 bg-surface-raised whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => (
                      <tr
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id === selectedRunId ? null : run.id)}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${selectedRunId === run.id ? 'bg-success-subtle' : 'hover:bg-surface-raised/60'}`}
                      >
                        <td className="px-4 py-2.5 text-[11px] text-text-subtle mono whitespace-nowrap">#{run.runNumber}</td>
                        <td className="px-4 py-2.5">
                          <div>
                            <p className="text-[13px] font-medium text-text">{run.company}</p>
                            {run.domain !== '—' && <p className="text-[11px] text-text-subtle mono">{run.domain}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                        <td className="px-4 py-2.5 text-[12px] text-text-muted max-w-[140px] truncate">
                          {run.status === 'failed' ? <span className="text-danger">{run.failedStage}</span> : run.currentStage}
                        </td>
                        <td className="px-4 py-2.5">
                          {run.status !== 'queued' && (
                            <div className="flex items-center gap-2">
                              <div className="w-[48px] h-1.5 bg-surface-hover rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${run.status === 'failed' ? 'bg-danger' : 'bg-accent'}`}
                                  style={{ width: `${(run.stagesDone / run.stagesTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-text-muted mono whitespace-nowrap">{run.stagesDone}/{run.stagesTotal}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-text-subtle whitespace-nowrap">{run.started}</td>
                        <td className="px-4 py-2.5 text-[12px] text-text-subtle mono whitespace-nowrap">{run.duration}</td>
                        <td className="px-4 py-2.5 text-right">
                          <IconChevronRight size={13} className={`${selectedRunId === run.id ? 'text-accent' : 'text-text-subtle'} transition-colors`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selectedRun && (
          <aside className="w-[320px] flex-shrink-0 border-l border-border bg-surface overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div>
                <p className="text-[13px] font-semibold text-text">{selectedRun.company}</p>
                <p className="text-[11px] text-text-subtle">Generation run #{selectedRun.runNumber}</p>
              </div>
              <button onClick={() => setSelectedRunId(null)} className="text-text-subtle hover:text-text-muted transition-colors mt-0.5">
                <IconX size={14} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <StatusBadge status={selectedRun.status} />
              <span className="text-[12px] text-text-subtle">{selectedRun.started} · {selectedRun.duration}</span>
            </div>

            {selectedRun.status === 'failed' && (
              <div className="mx-5 mt-4 mb-2 bg-danger-subtle border border-danger-subtle rounded p-3.5">
                <p className="text-[12px] font-semibold text-danger mb-1">Failed at: {selectedRun.failedStage}</p>
                <p className="text-[12px] text-danger leading-relaxed">{selectedRun.failedReason}</p>
                {selectedRun.resumeFromStage && (
                  <p className="text-[11px] text-text-subtle mt-2">
                    Retry resumes from <span className="mono">{GATE_LABELS[selectedRun.resumeFromStage] || selectedRun.resumeFromStage}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="primary" size="sm" disabled={retrying === selectedRun.id} onClick={() => handleRetry(selectedRun)}>
                    {retrying === selectedRun.id ? 'Retrying…' : selectedRun.resumeFromStage ? `Retry from ${GATE_LABELS[selectedRun.resumeFromStage] || selectedRun.resumeFromStage}` : 'Retry'}
                  </Button>
                </div>
              </div>
            )}

            {activeRunId && (
              <div className="px-5 py-3 border-b border-border">
                <OperationConsole runId={activeRunId} title={activeTitle} onClose={() => setActiveRunId(null)} />
              </div>
            )}

            <ArtifactPanel runId={selectedRun.id} />

            {selectedRun.siteId && (
              <div className="px-5 py-4 border-b border-border">
                <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-3">Version history</p>
                <RevisionHistory siteId={selectedRun.siteId} />
              </div>
            )}

            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-3">Pipeline stages</p>
              <div className="flex flex-col divide-y divide-gray-50">
                {buildStages(selectedRun).map((stage, i) => (
                  <StageRow key={i} stage={stage} />
                ))}
              </div>
            </div>

            {selectedRun.status === 'completed' && selectedRun.forgeId && (
              <div className="px-5 py-4 border-t border-border">
                <p className="text-[11px] text-text-subtle mb-2.5">Demo ready — site available in Forge.</p>
                <Button variant="primary" size="sm" onClick={() => onNavigate('forge')}>Open in Forge →</Button>
              </div>
            )}

            {selectedRun.previewToken && (
              <div className="px-5 py-4 border-t border-border">
                <Button variant="secondary" size="sm" onClick={() => window.open(`/showcase/${selectedRun.previewToken}`, '_blank')}>
                  Open Showcase
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-surface-inverse text-text-inverse text-[12px] px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 pointer-events-none">
          {toast.message}
        </div>
      )}
    </div>
  )
}
