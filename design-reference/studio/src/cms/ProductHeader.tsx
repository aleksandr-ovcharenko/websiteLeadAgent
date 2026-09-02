import { useState, useRef, useEffect } from 'react'
import { SiteContext, UserRole, ProductArea } from './types'
import { IconChevronLeft, IconChevronDown, IconExternal, IconBell } from './icons'

// ─── WLA logo mark ────────────────────────────────────────────────────────────

function WLALogo() {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-[26px] h-[26px] rounded-[4px] bg-[#1a2332] flex items-center justify-center select-none">
        <span className="text-white text-[9px] font-bold tracking-tight leading-none">WLA</span>
      </div>
      <span className="text-[13px] font-semibold text-gray-900 leading-none">WebsiteLeadAgent</span>
    </div>
  )
}

// ─── Site avatar ──────────────────────────────────────────────────────────────

function SiteAvatar({ site }: { site: SiteContext }) {
  return (
    <div className="w-[18px] h-[18px] rounded-[3px] bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
      <span className="text-[#16a34a] text-[7px] font-bold leading-none">{site.initials}</span>
    </div>
  )
}

// ─── Inline showcase toast ────────────────────────────────────────────────────

function ShowcaseToast({ domain, onDismiss }: { domain: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-[#1a2332] text-white text-[12px] px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 pointer-events-none">
      <IconExternal size={12} className="text-[#16a34a] flex-shrink-0" />
      <span>Opening Showcase for <span className="font-semibold text-[#4ade80] mono">{domain}</span>…</span>
    </div>
  )
}

// ─── ProductHeader ────────────────────────────────────────────────────────────

interface ProductHeaderProps {
  productArea: ProductArea
  currentSite: SiteContext
  availableSites: SiteContext[]
  userRole: UserRole
  onNavigate: (area: ProductArea) => void
  onSiteChange: (site: SiteContext) => void
  onRoleToggle: () => void
}

const AREA_LABELS: { area: Exclude<ProductArea, 'hub' | 'studio'>; label: string }[] = [
  { area: 'radar', label: 'Radar' },
  { area: 'factory', label: 'Factory' },
  { area: 'forge', label: 'Forge' },
]

export default function ProductHeader({
  productArea,
  currentSite,
  availableSites,
  userRole,
  onNavigate,
  onSiteChange,
  onRoleToggle,
}: ProductHeaderProps) {
  const [siteOpen, setSiteOpen] = useState(false)
  const [showcaseVisible, setShowcaseVisible] = useState(false)
  const siteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (siteRef.current && !siteRef.current.contains(e.target as Node)) setSiteOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isSuperAdmin = userRole === 'super_admin'
  const isStudio = productArea === 'studio'

  const handleShowcase = () => {
    setShowcaseVisible(true)
    window.open(`https://${currentSite.domain}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <header className="h-[48px] flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-30">

        {/* LEFT — WLA brand → Hub */}
        <button
          onClick={() => isSuperAdmin ? onNavigate('hub') : undefined}
          className={`flex-shrink-0 ${isSuperAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
          title={isSuperAdmin ? 'WebsiteLeadAgent Hub' : undefined}
        >
          <WLALogo />
        </button>

        {/* Divider after logo */}
        <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

        {/* STUDIO mode: Studio label + ← Forge */}
        {isStudio && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider select-none">
              Studio
            </span>
            {isSuperAdmin && (
              <button
                onClick={() => onNavigate('forge')}
                className="flex items-center gap-1 h-[26px] px-2.5 rounded text-[12px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Return to Forge"
              >
                <IconChevronLeft size={12} />
                Forge
              </button>
            )}
          </div>
        )}

        {/* GLOBAL mode (hub / radar / factory / forge): product nav tabs */}
        {!isStudio && isSuperAdmin && (
          <nav className="flex items-center gap-0.5">
            {AREA_LABELS.map(({ area, label }) => {
              const isActive = productArea === area
              return (
                <button
                  key={area}
                  onClick={() => onNavigate(area)}
                  className={`h-[26px] px-3 rounded text-[13px] font-medium transition-colors select-none ${
                    isActive
                      ? 'bg-[#1a2332] text-white'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        )}

        <div className="flex-1" />

        {/* STUDIO mode: site context, active status, open showcase */}
        {isStudio && (
          <>
            {/* Site context / switcher */}
            <div className="relative" ref={siteRef}>
              <button
                onClick={() => (isSuperAdmin || availableSites.length > 1) ? setSiteOpen(o => !o) : undefined}
                className={`flex items-center gap-2 h-[30px] px-2.5 rounded border border-gray-200 transition-colors ${
                  (isSuperAdmin || availableSites.length > 1)
                    ? 'hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <SiteAvatar site={currentSite} />
                <div className="flex flex-col items-start leading-none gap-0.5">
                  <span className="text-[12px] font-semibold text-gray-900">{currentSite.name}</span>
                  <span className="text-[10px] text-gray-400 mono">{currentSite.domain}</span>
                </div>
                {(isSuperAdmin || availableSites.length > 1) && (
                  <IconChevronDown size={11} className="text-gray-400 ml-0.5" />
                )}
              </button>

              {siteOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-50">
                  <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {isSuperAdmin ? 'Switch site' : 'Your sites'}
                    </p>
                  </div>
                  <div className="py-1">
                    {availableSites.map(site => (
                      <button
                        key={site.id}
                        onClick={() => { onSiteChange(site); setSiteOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${site.id === currentSite.id ? 'bg-gray-50' : ''}`}
                      >
                        <SiteAvatar site={site} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-900 truncate">{site.name}</p>
                          <p className="text-[10px] text-gray-400 mono">{site.domain}</p>
                        </div>
                        {site.id === currentSite.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active status pip */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[12px] text-gray-500">Active</span>
            </div>

            {/* Open Showcase */}
            <button
              onClick={handleShowcase}
              className="flex items-center gap-1.5 h-[30px] px-3 rounded border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors flex-shrink-0"
            >
              <IconExternal size={11} />
              Open Showcase
            </button>
          </>
        )}

        {/* Notification bell */}
        <button className="relative w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
          <IconBell size={14} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
        </button>

        {/* User + role toggle (role toggle is demo-only) */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200 flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-[#1a2332] flex items-center justify-center">
            <span className="text-white text-[9px] font-semibold select-none">
              {userRole === 'super_admin' ? 'SA' : userRole === 'site_admin' ? 'A' : 'E'}
            </span>
          </div>
          <div className="hidden md:flex flex-col leading-none gap-0.5">
            <span className="text-[12px] font-medium text-gray-800">Administrator</span>
            <button
              onClick={onRoleToggle}
              className="text-[10px] text-[#16a34a] hover:text-[#15803d] transition-colors text-left"
              title="Toggle role (demo)"
            >
              {userRole === 'super_admin' ? 'Super Admin' : userRole === 'site_admin' ? 'Site Admin' : 'Editor'} ↕
            </button>
          </div>
        </div>
      </header>

      {showcaseVisible && (
        <ShowcaseToast domain={currentSite.domain} onDismiss={() => setShowcaseVisible(false)} />
      )}
    </>
  )
}
