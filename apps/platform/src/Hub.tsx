import { useEffect, useState } from 'react'
import { ProductArea } from './cms/ProductHeader'
import { IconChevronRight } from './cms/icons'
import { api } from './cms/api'

interface HubProps {
  onNavigate: (area: ProductArea) => void
}

interface HubStats {
  totalLeads: number
  goodLeads: number
  totalSites: number
  activeRuns: number
  runningRuns: number
}

const MODULES: {
  area: ProductArea
  name: string
  tagline: string
  description: string
  statColor: string
  mark: React.ReactNode
}[] = [
  {
    area: 'radar',
    name: 'Radar',
    tagline: 'Discover & qualify leads',
    description: 'Search for potential clients by city and business category. Score, filter, and select leads for website generation.',
    statColor: 'bg-emerald-500',
    mark: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    area: 'factory',
    name: 'Factory',
    tagline: 'Generation pipeline',
    description: 'Monitor website generation runs stage by stage. Track progress, review errors, and retry failed jobs.',
    statColor: 'bg-amber-400',
    mark: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3l14 9-14 9V3z"/>
      </svg>
    ),
  },
  {
    area: 'forge',
    name: 'Forge',
    tagline: 'Generated websites',
    description: 'All generated sites in one place. Open Studio to edit content, share Showcase links with clients.',
    statColor: 'bg-gray-400',
    mark: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
  },
]

export default function Hub({ onNavigate }: HubProps) {
  const [stats, setStats] = useState<HubStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getHubStats()
      .then((s) => { setStats(s); setError(null); })
      .catch((e) => setError(e.message || 'Failed to load Hub stats'))
      .finally(() => setLoading(false))
  }, [])

  const statLabel = (area: ProductArea) => {
    if (!stats) return '…'
    if (area === 'radar') return `${stats.totalLeads} leads`
    if (area === 'factory') return `${stats.runningRuns} processing`
    if (area === 'forge') return `${stats.totalSites} generated sites`
    return '—'
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f5f7] flex items-center justify-center">
        <div className="text-[13px] font-mono text-gray-400">Loading Hub…</div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f5f7] flex items-center justify-center">
        <div className="text-[13px] font-mono text-red-600">{error || 'No data'}</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f5f7]">
      <div className="max-w-[880px] mx-auto px-8 py-12">
        <div className="mb-10">
          <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">WebsiteLeadAgent</h1>
          <p className="text-[13px] text-gray-400 mt-1">Business website generation platform</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {MODULES.map(m => (
            <button
              key={m.area}
              onClick={() => onNavigate(m.area)}
              className="bg-white border border-gray-200 rounded p-5 text-left hover:border-gray-300 hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-8 h-8 rounded bg-[#1a2332] flex items-center justify-center text-white flex-shrink-0">
                  {m.mark}
                </div>
                <span className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1">
                  <IconChevronRight size={14} />
                </span>
              </div>

              <p className="text-[15px] font-semibold text-gray-900 mb-0.5">{m.name}</p>
              <p className="text-[12px] text-gray-500 mb-4 leading-snug">{m.tagline}</p>
              <p className="text-[12px] text-gray-400 leading-relaxed mb-5">{m.description}</p>

              <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.statColor}`} />
                <span className="text-[11px] text-gray-500">{statLabel(m.area)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded px-5 py-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Current activity</p>
          <div className="flex items-center gap-0 divide-x divide-gray-100">
            <ActivityCell label="Leads discovered">
              <span className="text-[13px] font-medium text-gray-800">{stats.totalLeads} in Radar</span>
            </ActivityCell>
            <ActivityCell label="Sites processing">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-gray-800">
                {stats.runningRuns > 0 ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                ) : null}
                {stats.runningRuns} in Factory
              </span>
            </ActivityCell>
            <ActivityCell label="Generated sites">
              <span className="text-[13px] font-medium text-gray-800">{stats.totalSites} in Forge</span>
            </ActivityCell>
            <ActivityCell label="Good leads">
              <span className="text-[13px] font-medium text-gray-800">{stats.goodLeads} ready to generate</span>
            </ActivityCell>
            <div className="flex-1 flex items-center justify-end pl-5">
              <button
                onClick={() => onNavigate('factory')}
                className="text-[12px] text-[#16a34a] hover:text-[#15803d] transition-colors"
              >
                View Factory →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 pr-6 first:pl-0 pl-6">
      <p className="text-[11px] text-gray-400">{label}</p>
      {children}
    </div>
  )
}
