import { useState, useRef, useEffect } from 'react'
import { Screen } from './types'
import { IconChevronDown, IconExternal, IconBell } from './icons'

interface TopBarProps {
  onNavigate: (s: Screen) => void
}

const SITES = [
  { name: 'ГАРАНТ КАЧЕСТВА', domain: 'garantk.by', initials: 'ГК' },
  { name: 'Строй Инвест', domain: 'stroyinvest.by', initials: 'СИ' },
]

export default function TopBar({ onNavigate }: TopBarProps) {
  const [currentSite, setCurrentSite] = useState(0)
  const [siteOpen, setSiteOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const site = SITES[currentSite]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setSiteOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-[52px] flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-20">
      {/* Site switcher */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setSiteOpen(o => !o)}
          className="flex items-center gap-2 h-8 pl-2 pr-2.5 rounded border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="w-5 h-5 rounded bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[#16a34a] text-[8px] font-bold tracking-tight">{site.initials}</span>
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[13px] font-medium text-gray-900 truncate max-w-[130px] leading-tight">{site.name}</span>
            <span className="text-[11px] text-gray-400 mono leading-tight">{site.domain}</span>
          </div>
          <IconChevronDown size={12} className="text-gray-400 flex-shrink-0 ml-0.5" />
        </button>

        {siteOpen && (
          <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded shadow-lg z-50">
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch site</p>
            </div>
            {SITES.map((s, i) => (
              <button
                key={i}
                onClick={() => { setCurrentSite(i); setSiteOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === currentSite ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                <div className="w-6 h-6 rounded bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#16a34a] text-[8px] font-bold">{s.initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 truncate leading-tight">{s.name}</p>
                  <p className="text-[11px] text-gray-400 mono leading-tight">{s.domain}</p>
                </div>
                {i === currentSite && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                )}
              </button>
            ))}
            <div className="border-t border-gray-100 mx-0 my-1" />
            <button className="w-full text-left px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
              + Add site
            </button>
          </div>
        )}
      </div>

      {/* Active indicator */}
      <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
        <span className="text-[12px] text-gray-500">Active</span>
      </div>

      <div className="flex-1" />

      {/* Preview action */}
      <button
        className="flex items-center gap-1.5 h-[30px] px-3 rounded border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        onClick={() => {}}
      >
        <IconExternal size={12} />
        Open preview
      </button>

      {/* Notifications */}
      <button className="relative w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
        <IconBell size={15} />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
      </button>

      {/* User */}
      <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
        <div className="w-6 h-6 rounded-full bg-[#1a2332] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-semibold">A</span>
        </div>
        <div className="hidden md:flex flex-col leading-tight">
          <span className="text-[13px] font-medium text-gray-800">Administrator</span>
          <span className="text-[11px] text-gray-400">Admin</span>
        </div>
      </div>
    </header>
  )
}
