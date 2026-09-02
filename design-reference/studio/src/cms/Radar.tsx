import { useState } from 'react'
import { ProductArea } from './types'
import { IconPlus, IconChevronDown, IconX, IconCheck, IconExternal } from './icons'
import { Button, Input, Select, useToast, Toast } from './ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveryRun {
  id: string
  city: string
  query: string
  date: string
  totalLeads: number
  goodLeads: number
  status: 'completed' | 'running' | 'failed'
}

interface Lead {
  id: string
  company: string
  domain: string
  city: string
  score: number
  quality: 'good' | 'bad' | 'pending'
  hasWebsite: boolean
  generationStatus?: 'generating' | 'done' | null
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const DISCOVERY_RUNS: DiscoveryRun[] = [
  { id: 'dr1', city: 'Minsk', query: 'Construction', date: '29 Aug 2026', totalLeads: 48, goodLeads: 8, status: 'completed' },
  { id: 'dr2', city: 'Minsk', query: 'Renovation', date: '28 Aug 2026', totalLeads: 36, goodLeads: 5, status: 'completed' },
  { id: 'dr3', city: 'Minsk', query: 'Engineering', date: '27 Aug 2026', totalLeads: 51, goodLeads: 11, status: 'completed' },
  { id: 'dr4', city: 'Grodno', query: 'Construction', date: '25 Aug 2026', totalLeads: 29, goodLeads: 4, status: 'failed' },
  { id: 'dr5', city: 'Brest', query: 'Architecture', date: '22 Aug 2026', totalLeads: 41, goodLeads: 7, status: 'completed' },
]

const LEADS_BY_RUN: Record<string, Lead[]> = {
  dr1: [
    { id: 'l1', company: 'ГАРАНТ КАЧЕСТВА', domain: 'garantk.by', city: 'Minsk', score: 87, quality: 'good', hasWebsite: true, generationStatus: 'done' },
    { id: 'l2', company: 'Строй Инвест', domain: 'stroyinvest.by', city: 'Minsk', score: 82, quality: 'good', hasWebsite: true, generationStatus: 'done' },
    { id: 'l3', company: 'МеталлСтрой', domain: '—', city: 'Minsk', score: 76, quality: 'good', hasWebsite: false },
    { id: 'l4', company: 'БелСтройГрупп', domain: 'bsg.by', city: 'Minsk', score: 71, quality: 'good', hasWebsite: true },
    { id: 'l5', company: 'Фундамент-Про', domain: '—', city: 'Minsk', score: 68, quality: 'good', hasWebsite: false },
    { id: 'l6', company: 'ГеоСервис', domain: 'geoservice.by', city: 'Minsk', score: 45, quality: 'pending', hasWebsite: true },
    { id: 'l7', company: 'ТехноСтрой', domain: 'technostroy.by', city: 'Minsk', score: 38, quality: 'bad', hasWebsite: true },
    { id: 'l8', company: 'АлтайСтрой', domain: '—', city: 'Minsk', score: 22, quality: 'bad', hasWebsite: false },
  ],
  dr2: [
    { id: 'l9',  company: 'РеноМастер', domain: 'reno-master.by', city: 'Minsk', score: 91, quality: 'good', hasWebsite: true },
    { id: 'l10', company: 'КвартирРем', domain: '—', city: 'Minsk', score: 74, quality: 'good', hasWebsite: false },
    { id: 'l11', company: 'ОтделкаПлюс', domain: 'otdelka-plus.by', city: 'Minsk', score: 69, quality: 'good', hasWebsite: true },
    { id: 'l12', company: 'СтройФинанс', domain: '—', city: 'Minsk', score: 31, quality: 'bad', hasWebsite: false },
  ],
}

const DISCOVERY_STAGES = [
  'Discovering businesses',
  'Enriching data',
  'Website audit',
  'Lighthouse analysis',
  'AI visual scoring',
  'Scoring & ranking',
]

// ─── Components ───────────────────────────────────────────────────────────────

function QualityBadge({ quality }: { quality: Lead['quality'] }) {
  if (quality === 'good') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-px rounded leading-4">
      GOOD
    </span>
  )
  if (quality === 'bad') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-px rounded leading-4">
      BAD
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-px rounded leading-4">
      —
    </span>
  )
}

function RunStatusBadge({ status }: { status: DiscoveryRun['status'] }) {
  if (status === 'running') return (
    <span className="flex items-center gap-1 text-[11px] text-emerald-600">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Running
    </span>
  )
  if (status === 'failed') return (
    <span className="flex items-center gap-1 text-[11px] text-red-500">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Failed
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
      Completed
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface RadarProps {
  onNavigate: (area: ProductArea) => void
}

export default function Radar({ onNavigate }: RadarProps) {
  const [currentRunId, setCurrentRunId] = useState('dr1')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [newDiscoveryOpen, setNewDiscoveryOpen] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [progressStep, setProgressStep] = useState(2)
  const [qualityFilter, setQualityFilter] = useState<'all' | 'good' | 'bad' | 'pending'>('all')
  const [discCity, setDiscCity] = useState('')
  const [discQuery, setDiscQuery] = useState('')
  const [discLimit, setDiscLimit] = useState('50')
  const { toast, show } = useToast()

  const currentRun = DISCOVERY_RUNS.find(r => r.id === currentRunId) ?? DISCOVERY_RUNS[0]
  const leads = LEADS_BY_RUN[currentRunId] ?? LEADS_BY_RUN['dr1']
  const filteredLeads = leads.filter(l => qualityFilter === 'all' || l.quality === qualityFilter)

  const handleStartDiscovery = () => {
    if (!discCity || !discQuery) return
    setNewDiscoveryOpen(false)
    setShowProgress(true)
    setProgressStep(0)
    const interval = setInterval(() => {
      setProgressStep(p => {
        if (p >= DISCOVERY_STAGES.length - 1) { clearInterval(interval); return p }
        return p + 1
      })
    }, 1200)
    show('Discovery started')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7]">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-gray-900 flex-shrink-0">Radar</span>
          <span className="text-gray-200 flex-shrink-0">/</span>

          {/* Current run pill */}
          <div className="relative">
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="flex items-center gap-2 h-[28px] px-2.5 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
            >
              <RunStatusBadge status={currentRun.status} />
              <span className="text-[12px] font-medium text-gray-800 whitespace-nowrap">
                {currentRun.city} · {currentRun.query}
              </span>
              <span className="text-[11px] text-gray-400">{currentRun.date}</span>
              <span className="text-[11px] text-gray-400 mono">{currentRun.totalLeads} leads</span>
              <IconChevronDown size={11} className="text-gray-400" />
            </button>

            {historyOpen && (
              <div className="absolute top-full left-0 mt-1 w-[400px] bg-white border border-gray-200 rounded shadow-lg z-50">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Discovery history</p>
                  <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <IconX size={13} />
                  </button>
                </div>
                {DISCOVERY_RUNS.map(run => (
                  <button
                    key={run.id}
                    onClick={() => { setCurrentRunId(run.id); setHistoryOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-t border-gray-50 ${run.id === currentRunId ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-900">{run.city} · {run.query}</span>
                        <RunStatusBadge status={run.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-gray-400">{run.date}</span>
                        <span className="text-[11px] text-gray-500">{run.totalLeads} leads</span>
                        <span className="text-[11px] text-emerald-600 font-medium">{run.goodLeads} GOOD</span>
                      </div>
                    </div>
                    {run.status === 'failed' && (
                      <button className="flex-shrink-0 text-[11px] text-amber-600 hover:text-amber-700 transition-colors px-2 py-0.5 rounded border border-amber-200 bg-amber-50">
                        Retry
                      </button>
                    )}
                    {run.id === currentRunId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-px bg-gray-100 rounded p-0.5">
          {([['all', 'All'], ['good', 'Good'], ['pending', 'Pending'], ['bad', 'Bad']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setQualityFilter(val)}
              className={`h-[22px] px-2.5 rounded text-[11px] font-medium transition-colors ${qualityFilter === val ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Button variant="primary" size="sm" onClick={() => setNewDiscoveryOpen(true)}>
          <IconPlus size={12} />
          New discovery
        </Button>
      </div>

      {/* Discovery progress banner */}
      {showProgress && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3">
          <div className="max-w-[720px]">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[12px] font-semibold text-gray-800">Discovery in progress — Minsk · {discQuery || 'New Search'}</p>
              <button onClick={() => setShowProgress(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <IconX size={13} />
              </button>
            </div>
            <div className="flex items-start gap-8">
              {DISCOVERY_STAGES.map((stage, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i < progressStep ? (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <IconCheck size={9} className="text-white" />
                    </span>
                  ) : i === progressStep ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[#16a34a] animate-pulse flex-shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />
                  )}
                  <span className={`text-[11px] whitespace-nowrap ${i < progressStep ? 'text-gray-400 line-through' : i === progressStep ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                    {stage}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden w-full max-w-[400px]">
                <div
                  className="h-full bg-[#16a34a] rounded-full transition-all duration-700"
                  style={{ width: `${(progressStep / (DISCOVERY_STAGES.length - 1)) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{progressStep * 8} / {Number(discLimit) || 50} leads processed</p>
            </div>
          </div>
        </div>
      )}

      {/* Lead table */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[1060px]">
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Company', 'Domain', 'Location', 'Score', 'Quality', 'Actions'].map(col => (
                    <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-[13px] font-medium text-gray-900">{lead.company}</span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-gray-400 mono">
                      {lead.domain !== '—' ? (
                        <a href="#" className="hover:text-[#16a34a] transition-colors flex items-center gap-1">
                          {lead.domain}
                          <IconExternal size={10} />
                        </a>
                      ) : (
                        <span className="text-gray-300">No website</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[12px] text-gray-400">{lead.city}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-[48px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-medium text-gray-700">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <QualityBadge quality={lead.quality} />
                    </td>
                    <td className="px-4 py-2">
                      {lead.generationStatus === 'done' ? (
                        <button
                          onClick={() => onNavigate('forge')}
                          className="text-[12px] text-[#16a34a] hover:text-[#15803d] transition-colors flex items-center gap-1"
                        >
                          Open in Forge →
                        </button>
                      ) : lead.quality === 'good' && !lead.generationStatus ? (
                        <button
                          onClick={() => { show(`Factory run started for ${lead.company}`); onNavigate('factory') }}
                          className="h-[24px] px-2.5 rounded border border-[#16a34a] text-[11px] font-medium text-[#16a34a] hover:bg-[#16a34a] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Generate Demo
                        </button>
                      ) : (
                        <span className="text-[12px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-gray-400">No leads match the current filter.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-[12px] text-gray-400">
              {filteredLeads.length} leads · {currentRun.goodLeads} GOOD
            </p>
          </div>
        </div>
      </div>

      {/* New discovery dialog */}
      {newDiscoveryOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded w-[440px] shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-semibold text-gray-900">New discovery</h2>
              <button onClick={() => setNewDiscoveryOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <IconX size={14} />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3.5">
              <Input
                label="City"
                value={discCity}
                onChange={setDiscCity}
                placeholder="e.g. Minsk, Brest, Grodno"
              />
              <Input
                label="Business category / search query"
                value={discQuery}
                onChange={setDiscQuery}
                placeholder="e.g. Construction, Architecture, Engineering"
              />
              <Select
                label="Lead limit"
                value={discLimit}
                onChange={setDiscLimit}
                options={[
                  { value: '25', label: '25 leads' },
                  { value: '50', label: '50 leads' },
                  { value: '100', label: '100 leads' },
                  { value: '200', label: '200 leads' },
                ]}
              />
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">What will happen</p>
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  Businesses will be discovered via public sources, enriched with website and contact data, then scored by AI. The result will appear as a new discovery batch in Radar.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setNewDiscoveryOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleStartDiscovery}>
                Start discovery
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
