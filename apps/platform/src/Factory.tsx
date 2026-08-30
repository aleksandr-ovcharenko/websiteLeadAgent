import { useEffect, useState } from 'react'
import { ProductArea } from './cms/ProductHeader'
import { Button } from './cms/ui'
import { IconX, IconCheck, IconChevronRight } from './cms/icons'
import { api } from './cms/api'
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
  forgeId?: string
  previewToken?: string
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

function buildStages(run: PipelineRun) {
  const names = [
    'Lead selected', 'Content extraction', 'Content transformation',
    'CMS import', 'Website generation', 'Screenshot', 'Audit', 'Demo ready',
  ]
  return names.map((name, i) => {
    if (run.status === 'failed' && name === run.failedStage) return { name, status: 'failed' as const }
    if (i < run.stagesDone) return { name, status: 'done' as const }
    if (i === run.stagesDone && run.status === 'running') return { name, status: 'running' as const }
    return { name, status: 'pending' as const }
  })
}

function StatusBadge({ status }: { status: RunStatus }) {
  const styles: Record<RunStatus, string> = {
    queued: 'text-gray-500 bg-gray-100 border-gray-200',
    running: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    failed: 'text-red-600 bg-red-50 border-red-200',
    completed: 'text-gray-600 bg-gray-100 border-gray-200',
  }
  const labels: Record<RunStatus, string> = {
    queued: 'QUEUED', running: 'RUNNING', failed: 'FAILED', completed: 'COMPLETED',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${styles[status]}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {labels[status]}
    </span>
  )
}

function StageRow({ stage }: { stage: { name: string; status: 'done' | 'running' | 'failed' | 'pending' } }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        {stage.status === 'done' && (
          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <IconCheck size={9} className="text-white" />
          </span>
        )}
        {stage.status === 'running' && (
          <span className="w-4 h-4 rounded-full border-2 border-[#16a34a] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
          </span>
        )}
        {stage.status === 'failed' && (
          <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <IconX size={8} className="text-white" />
          </span>
        )}
        {stage.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />}
      </div>
      <span className="text-[12px] text-gray-700">{stage.name}</span>
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
        input: { leadId: run.leadId, force: true },
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
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7] items-center justify-center">
        <div className="text-[13px] font-mono text-gray-400">Loading Factory…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7] items-center justify-center">
        <div className="text-[13px] font-mono text-red-600 mb-3">{error}</div>
        <Button size="sm" onClick={refresh}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7]">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 h-[46px] flex items-center gap-3">
        <span className="text-[13px] font-semibold text-gray-900">Factory</span>
        <span className="text-[12px] text-gray-400">Generation pipeline</span>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {runs.filter(r => r.status === 'running').length} running
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {runs.filter(r => r.status === 'queued').length} queued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            {runs.filter(r => r.status === 'failed').length} failed
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-[900px]">
            {runs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded py-14 text-center text-[13px] text-gray-400">
                No factory runs yet
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['#', 'Company', 'Status', 'Stage', 'Progress', 'Started', 'Duration', ''].map(col => (
                        <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">
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
                        className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${selectedRunId === run.id ? 'bg-[#f0fdf4]' : 'hover:bg-gray-50/60'}`}
                      >
                        <td className="px-4 py-2.5 text-[11px] text-gray-400 mono whitespace-nowrap">#{run.runNumber}</td>
                        <td className="px-4 py-2.5">
                          <div>
                            <p className="text-[13px] font-medium text-gray-900">{run.company}</p>
                            {run.domain !== '—' && <p className="text-[11px] text-gray-400 mono">{run.domain}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                        <td className="px-4 py-2.5 text-[12px] text-gray-600 max-w-[140px] truncate">
                          {run.status === 'failed' ? <span className="text-red-500">{run.failedStage}</span> : run.currentStage}
                        </td>
                        <td className="px-4 py-2.5">
                          {run.status !== 'queued' && (
                            <div className="flex items-center gap-2">
                              <div className="w-[48px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${run.status === 'failed' ? 'bg-red-400' : 'bg-[#16a34a]'}`}
                                  style={{ width: `${(run.stagesDone / run.stagesTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-gray-500 mono whitespace-nowrap">{run.stagesDone}/{run.stagesTotal}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-gray-400 whitespace-nowrap">{run.started}</td>
                        <td className="px-4 py-2.5 text-[12px] text-gray-400 mono whitespace-nowrap">{run.duration}</td>
                        <td className="px-4 py-2.5 text-right">
                          <IconChevronRight size={13} className={`${selectedRunId === run.id ? 'text-[#16a34a]' : 'text-gray-300'} transition-colors`} />
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
          <aside className="w-[320px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">{selectedRun.company}</p>
                <p className="text-[11px] text-gray-400">Generation run #{selectedRun.runNumber}</p>
              </div>
              <button onClick={() => setSelectedRunId(null)} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                <IconX size={14} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <StatusBadge status={selectedRun.status} />
              <span className="text-[12px] text-gray-400">{selectedRun.started} · {selectedRun.duration}</span>
            </div>

            {selectedRun.status === 'failed' && (
              <div className="mx-5 mt-4 mb-2 bg-red-50 border border-red-200 rounded p-3.5">
                <p className="text-[12px] font-semibold text-red-700 mb-1">Failed at: {selectedRun.failedStage}</p>
                <p className="text-[12px] text-red-600 leading-relaxed">{selectedRun.failedReason}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="primary" size="sm" disabled={retrying === selectedRun.id} onClick={() => handleRetry(selectedRun)}>
                    {retrying === selectedRun.id ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </div>
            )}

            {activeRunId && (
              <div className="px-5 py-3 border-b border-gray-100">
                <OperationConsole runId={activeRunId} title={activeTitle} onClose={() => setActiveRunId(null)} />
              </div>
            )}

            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline stages</p>
              <div className="flex flex-col divide-y divide-gray-50">
                {buildStages(selectedRun).map((stage, i) => (
                  <StageRow key={i} stage={stage} />
                ))}
              </div>
            </div>

            {selectedRun.status === 'completed' && selectedRun.forgeId && (
              <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2.5">Demo ready — site available in Forge.</p>
                <Button variant="primary" size="sm" onClick={() => onNavigate('forge')}>Open in Forge →</Button>
              </div>
            )}

            {selectedRun.previewToken && (
              <div className="px-5 py-4 border-t border-gray-100">
                <Button variant="secondary" size="sm" onClick={() => window.open(`/showcase/${selectedRun.previewToken}`, '_blank')}>
                  Open Showcase
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-[#1a2332] text-white text-[12px] px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 pointer-events-none">
          {toast.message}
        </div>
      )}
    </div>
  )
}
