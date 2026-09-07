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
    <header className="flex-shrink-0 h-14 bg-surface border-b border-border px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative" ref={ref}>
          <button
            onClick={() => setSiteOpen(!siteOpen)}
            className="flex items-center gap-2.5 h-9 pl-2.5 pr-3 rounded border border-border hover:border-border transition-colors bg-surface"
          >
            <div className="w-5 h-5 rounded-full bg-success-subtle flex items-center justify-center text-[10px] font-semibold text-success">
              {(settings?.companyName || site?.name || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="text-left">
              <p className="text-[12px] font-semibold text-text leading-none">{settings?.companyName || site?.name || 'Loading…'}</p>
              <p className="text-[10px] text-text-subtle leading-none mt-0.5">{site?.domain || domain}</p>
            </div>
            <IconChevronDown size={12} className="text-text-subtle ml-1" />
          </button>

          {siteOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-border rounded shadow-lg py-1 z-40">
              {sites.length > 1 && (
                <div className="px-3 py-2 text-[10px] font-medium text-text-subtle uppercase tracking-wider">Switch site</div>
              )}
              {sites.filter((s: any) => s.id !== site?.id).map((s: any) => (
                <a
                  key={s.id}
                  href={`/studio/${s.id}`}
                  onClick={(e) => { e.preventDefault(); setSiteOpen(false); window.location.href = `/studio/${s.id}` }}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-surface-raised transition-colors text-left text-[12px] text-text-muted"
                >
                  <div className="w-5 h-5 rounded-full bg-success-subtle flex items-center justify-center text-[10px] font-semibold text-success">
                    {(s.siteSettings?.companyName || s.name || 'S').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-text leading-none">{s.siteSettings?.companyName || s.name}</p>
                    <p className="text-[10px] text-text-subtle leading-none mt-0.5">{s.domain}</p>
                  </div>
                </a>
              ))}
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setSiteOpen(false); onNavigate('site-settings') }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-surface-raised transition-colors text-left text-[12px] text-text-muted"
              >
                Site settings
              </button>
              <button
                onClick={() => { window.location.href = '/forge' }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-surface-raised transition-colors text-left text-[12px] text-text-muted"
              >
                Back to all sites
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[12px]">
          <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-danger' : loading ? 'bg-warning' : 'bg-success'}`} />
          <span className="text-text-muted">{error ? 'Error' : loading ? 'Loading' : 'Active'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text transition-colors"
        >
          <IconExternal size={12} />
          Preview
        </a>

        <button className="relative w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-subtle hover:text-text-muted hover:bg-surface-raised transition-colors">
          <IconBell size={15} />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-surface-inverse flex items-center justify-center text-[11px] font-medium text-text-inverse">
            {userLabel.slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[12px] font-medium text-text leading-none">{userLabel}</p>
            <p className="text-[10px] text-text-subtle leading-none mt-0.5">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
