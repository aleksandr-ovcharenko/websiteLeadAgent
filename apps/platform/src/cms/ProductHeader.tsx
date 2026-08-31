import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { IconChevronLeft, IconChevronDown, IconExternal, IconBell } from './icons'

export type ProductArea = 'hub' | 'radar' | 'factory' | 'forge' | 'studio'

interface DemoVariant {
  id: string
  name: string
  templateId: string
  previewToken: string
  isPreferred: boolean
}

interface SiteContext {
  id: string
  name: string
  domain: string
  initials: string
  previewToken: string
  demoVariants: DemoVariant[]
}

interface ProductHeaderProps {
  productArea: ProductArea
  siteId?: string
  user?: { globalRole?: string; email?: string; name?: string } | null
  onNavigate: (area: ProductArea) => void
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase().slice(0, 2)
}

function mapSite(s: any): SiteContext {
  const variants = s.demoVariants || []
  const preferred = variants.find((v: DemoVariant) => v.isPreferred) || variants[0]
  return {
    id: s.id,
    name: s.name || 'Untitled',
    domain: s.domain || '—',
    initials: getInitials(s.name || ''),
    previewToken: preferred?.previewToken || s.previewToken || '',
    demoVariants: variants,
  }
}

function WLALogo() {
  return (
    <div className="flex items-center gap-2 flex-shrink-0 select-none">
      <div className="w-[26px] h-[26px] rounded-[4px] bg-[#1a2332] flex items-center justify-center">
        <span className="text-white text-[9px] font-bold tracking-tight leading-none">WLA</span>
      </div>
      <span className="text-[13px] font-semibold text-gray-900 leading-none">WebsiteLeadAgent</span>
    </div>
  )
}

function SiteAvatar({ site }: { site: SiteContext }) {
  return (
    <div className="w-[18px] h-[18px] rounded-[3px] bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
      <span className="text-[#16a34a] text-[7px] font-bold leading-none">{site.initials}</span>
    </div>
  )
}

function ShowcaseToast({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-[#1a2332] text-white text-[12px] px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 pointer-events-none">
      <IconExternal size={12} className="text-[#16a34a] flex-shrink-0" />
      <span>
        Opening Showcase for <span className="font-semibold text-[#4ade80] mono">{name}</span>…
      </span>
    </div>
  )
}

const AREA_LABELS: { area: Exclude<ProductArea, 'hub' | 'studio'>; label: string }[] = [
  { area: 'radar', label: 'Radar' },
  { area: 'factory', label: 'Factory' },
  { area: 'forge', label: 'Forge' },
]

export default function ProductHeader({ productArea, siteId, user, onNavigate }: ProductHeaderProps) {
  const [siteOpen, setSiteOpen] = useState(false)
  const [showcaseOpen, setShowcaseOpen] = useState(false)
  const [showcaseVisible, setShowcaseVisible] = useState(false)
  const [availableSites, setAvailableSites] = useState<SiteContext[]>([])
  const [currentSite, setCurrentSite] = useState<SiteContext | null>(null)
  const [sitesLoading, setSitesLoading] = useState(false)
  const siteRef = useRef<HTMLDivElement>(null)
  const showcaseRef = useRef<HTMLDivElement>(null)

  const userRole = user?.globalRole?.toLowerCase() ?? 'editor'
  const isSuperAdmin = userRole === 'super_admin'
  const isStudio = productArea === 'studio'
  const isEditor = !isSuperAdmin

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (siteRef.current && !siteRef.current.contains(e.target as Node)) setSiteOpen(false)
      if (showcaseRef.current && !showcaseRef.current.contains(e.target as Node)) setShowcaseOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!isStudio) return
    setSitesLoading(true)
    Promise.all([
      api.getSites().then((res: any) => setAvailableSites((res.sites || []).map(mapSite))),
      siteId ? api.getSite(siteId).then((res: any) => setCurrentSite(mapSite(res.site || res))) : Promise.resolve(),
    ])
      .catch(() => { /* keep previous/empty */ })
      .finally(() => setSitesLoading(false))
  }, [isStudio, siteId])

  useEffect(() => {
    if (isStudio && siteId && currentSite && currentSite.id !== siteId) {
      api.getSite(siteId).then((res: any) => setCurrentSite(mapSite(res.site || res)))
    }
  }, [siteId])

  const handleShowcase = () => {
    if (!currentSite) return
    setShowcaseVisible(true)
    window.open(`/showcase/${currentSite.previewToken}`, '_blank', 'noopener,noreferrer')
  }

  const handleSiteChange = (site: SiteContext) => {
    setSiteOpen(false)
    window.location.href = `/studio/${site.id}`
  }

  const displaySite = currentSite

  return (
    <>
      <header className="h-[48px] flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-30">
        <button
          onClick={() => (isSuperAdmin ? onNavigate('hub') : undefined)}
          className={`flex-shrink-0 ${isSuperAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
          title={isSuperAdmin ? 'WebsiteLeadAgent Hub' : undefined}
        >
          <WLALogo />
        </button>

        <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

        {isStudio && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider select-none">Studio</span>
            {isSuperAdmin && (
              <button
                onClick={() => onNavigate('forge')}
                className="flex items-center gap-1 h-[26px] px-2.5 rounded text-[12px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <IconChevronLeft size={12} />
                Forge
              </button>
            )}
          </div>
        )}

        {!isStudio && isSuperAdmin && (
          <nav className="flex items-center gap-0.5">
            {AREA_LABELS.map(({ area, label }) => {
              const isActive = productArea === area
              return (
                <button
                  key={area}
                  onClick={() => onNavigate(area)}
                  className={`h-[26px] px-3 rounded text-[13px] font-medium transition-colors select-none ${
                    isActive ? 'bg-[#1a2332] text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        )}

        <div className="flex-1" />

        {isStudio && displaySite && (
          <>
            <div className="relative" ref={siteRef}>
              <button
                onClick={() => (isSuperAdmin || availableSites.length > 1) ? setSiteOpen(o => !o) : undefined}
                className={`flex items-center gap-2 h-[30px] px-2.5 rounded border border-gray-200 transition-colors ${
                  isSuperAdmin || availableSites.length > 1
                    ? 'hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <SiteAvatar site={displaySite} />
                <div className="flex flex-col items-start leading-none gap-0.5">
                  <span className="text-[12px] font-semibold text-gray-900">{displaySite.name}</span>
                  <span className="text-[10px] text-gray-400 mono">{displaySite.domain}</span>
                </div>
                {(isSuperAdmin || availableSites.length > 1) && <IconChevronDown size={11} className="text-gray-400 ml-0.5" />}
              </button>

              {siteOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-50">
                  <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {isSuperAdmin ? 'Switch site' : 'Your sites'}
                    </p>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {availableSites.map(site => (
                      <button
                        key={site.id}
                        onClick={() => handleSiteChange(site)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${site.id === displaySite.id ? 'bg-gray-50' : ''}`}
                      >
                        <SiteAvatar site={site} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-900 truncate">{site.name}</p>
                          <p className="text-[10px] text-gray-400 mono">{site.domain}</p>
                        </div>
                        {site.id === displaySite.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[12px] text-gray-500">Active</span>
            </div>

            <div className="relative" ref={showcaseRef}>
              <button
                onClick={() => setShowcaseOpen(o => !o)}
                className="flex items-center gap-1.5 h-[30px] px-3 rounded border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors flex-shrink-0"
              >
                <IconExternal size={11} />
                Open Showcase
                <IconChevronDown size={10} />
              </button>

              {showcaseOpen && currentSite && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-50">
                  <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Choose variant</p>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {currentSite.demoVariants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setShowcaseVisible(true)
                          window.open(`/showcase/${v.previewToken}`, '_blank', 'noopener,noreferrer')
                          setShowcaseOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-gray-900">{v.name || v.templateId}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{v.templateId}</p>
                        </div>
                        {v.isPreferred && <span className="text-[10px] text-amber-600">preferred</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isStudio && !displaySite && (
          <div className="text-[12px] text-gray-400">{sitesLoading ? 'Loading site…' : 'No site'}</div>
        )}

        {isEditor && !isStudio && (
          <span className="text-[11px] font-medium text-gray-500 pl-3 border-l border-gray-200">Studio</span>
        )}

        <button className="relative w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
          <IconBell size={14} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200 flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-[#1a2332] flex items-center justify-center">
            <span className="text-white text-[9px] font-semibold select-none">
              {isSuperAdmin ? 'SA' : userRole === 'site_admin' ? 'A' : 'E'}
            </span>
          </div>
          <div className="hidden md:flex flex-col leading-none gap-0.5">
            <span className="text-[12px] font-medium text-gray-800">{user?.name || 'User'}</span>
            <span className="text-[10px] text-[#16a34a]">
              {isSuperAdmin ? 'Super Admin' : userRole === 'site_admin' ? 'Site Admin' : 'Editor'}
            </span>
          </div>
        </div>
      </header>

      {showcaseVisible && currentSite && (
        <ShowcaseToast name={currentSite.name} onDismiss={() => setShowcaseVisible(false)} />
      )}
    </>
  )
}
