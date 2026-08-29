import { useState, useRef, useEffect } from 'react'
import { IconExternal, IconBell, IconChevronDown } from './icons'
import { Screen } from './types'
import { useStudio, formatDate } from './context'
import { api } from './api'

interface TopBarProps {
  onNavigate: (s: Screen) => void
}

export default function TopBar({ onNavigate }: TopBarProps) {
  const { site, settings, user, role, loading, error } = useStudio()
  const [siteOpen, setSiteOpen] = useState(false)
  const [sites, setSites] = useState<any[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getSites().then((data) => setSites(data.sites || [])).catch(() => setSites([]))
  }, [])

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setSiteOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const domain = site?.domain || settings?.companyName || site?.name || '—'
  const previewUrl = site?.previewToken ? `/showcase/${site.previewToken}` : '#'
  const userLabel = user?.email?.split('@')[0] || 'User'
  const roleLabel = role === 'SUPER_ADMIN' ? 'Super admin' : role === 'ADMIN' ? 'Site admin' : 'Editor'

  return (
    <header className="flex-shrink-0 h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative" ref={ref}>
          <button
            onClick={() => setSiteOpen(!siteOpen)}
            className="flex items-center gap-2.5 h-9 pl-2.5 pr-3 rounded border border-gray-200 hover:border-gray-300 transition-colors bg-white"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-semibold text-emerald-700">
              {(settings?.companyName || site?.name || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="text-left">
              <p className="text-[12px] font-semibold text-gray-900 leading-none">{settings?.companyName || site?.name || 'Loading…'}</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">{site?.domain || domain}</p>
            </div>
            <IconChevronDown size={12} className="text-gray-400 ml-1" />
          </button>

          {siteOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg py-1 z-40">
              {sites.length > 1 && (
                <div className="px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Switch site</div>
              )}
              {sites.filter((s: any) => s.id !== site?.id).map((s: any) => (
                <a
                  key={s.id}
                  href={`/studio/${s.id}`}
                  onClick={(e) => { e.preventDefault(); setSiteOpen(false); window.location.href = `/studio/${s.id}` }}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 transition-colors text-left text-[12px] text-gray-600"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-semibold text-emerald-700">
                    {(s.siteSettings?.companyName || s.name || 'S').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-gray-900 leading-none">{s.siteSettings?.companyName || s.name}</p>
                    <p className="text-[10px] text-gray-400 leading-none mt-0.5">{s.domain}</p>
                  </div>
                </a>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { setSiteOpen(false); onNavigate('site-settings') }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 transition-colors text-left text-[12px] text-gray-600"
              >
                Site settings
              </button>
              <button
                onClick={() => { window.location.href = '/forge' }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 transition-colors text-left text-[12px] text-gray-600"
              >
                Back to all sites
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[12px]">
          <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : loading ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          <span className="text-gray-500">{error ? 'Error' : loading ? 'Loading' : 'Active'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 transition-colors"
        >
          <IconExternal size={12} />
          Preview
        </a>

        <button className="relative w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <IconBell size={15} />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-[11px] font-medium text-white">
            {userLabel.slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[12px] font-medium text-gray-900 leading-none">{userLabel}</p>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
