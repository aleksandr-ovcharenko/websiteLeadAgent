import { useMemo } from 'react'
import { Screen, Navigate } from './types'
import { IconPlus, IconChevronRight, IconEdit, IconEye } from './icons'
import { Badge } from './ui'
import { useStudio, formatDate } from './context'
import { buildRecentItems, type RecentItem } from './studioNavigation'

interface DashboardProps {
  onNavigate: Navigate
}

const QUICK_ACTIONS: { label: string; screen: Screen }[] = [
  { label: 'Новая страница', screen: 'page-editor' },
  { label: 'Новость', screen: 'news-editor' },
  { label: 'Новый объект', screen: 'project-editor' },
  { label: 'Новый товар', screen: 'product-editor' },
  { label: 'Загрузить медиа', screen: 'media' },
]



export default function Dashboard({ onNavigate }: DashboardProps) {
  const { site, settings, pages, news, projects, services, products, media, vacancies, users, loading, error, refresh, canEdit } = useStudio()

  const counts = useMemo(() => [
    { label: 'Pages', count: pages.length, screen: 'pages' as Screen },
    { label: 'Projects', count: projects.length, screen: 'projects' as Screen },
    { label: 'News', count: news.length, screen: 'news' as Screen },
    { label: 'Services', count: services.length, screen: 'services' as Screen },
    { label: 'Products', count: products.length, screen: 'products' as Screen },
    { label: 'Vacancies', count: vacancies.length, screen: 'vacancies' as Screen },
    { label: 'Media files', count: media.length, screen: 'media' as Screen },
  ], [pages, projects, news, services, products, vacancies, media])

  // V3.7.8 — registry-driven: every row carries a typed entityType + id, so
  // Edit/Preview resolve through the same registry the editors use. Unknown
  // kinds can't reach here — a new entity type lands by extending the registry.
  const recent = useMemo<RecentItem[]>(
    () => buildRecentItems({ pages, projects, news, services, products, vacancies }),
    [pages, projects, news, services, products, vacancies],
  )

  const openPreview = (path: string) => {
    if (site?.previewToken) window.open(`/showcase/${site.previewToken}${path}`, '_blank')
  }

  return (
    <div className="p-5 max-w-[1100px]">
      <div className="mb-4">
        <h1 className="text-[15px] font-semibold text-text">Dashboard</h1>
        <p className="text-[12px] text-text-subtle mt-0.5">Обзор сайта «{settings?.companyName || site?.name || '—'}»</p>
      </div>

      {error && (
        <div className="mb-4 bg-danger-subtle border border-danger-subtle rounded p-3 text-[12px] text-danger">
          {error} <button className="underline ml-2" onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="bg-surface border border-border rounded flex items-center gap-0 mb-4 overflow-hidden divide-x divide-gray-100">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-[12px] text-text-subtle">Template</span>
          <span className="text-[12px] font-medium text-text mono">{site?.templateId || '—'}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-[12px] text-text-subtle">Domain</span>
          <span className="text-[12px] font-medium text-text">{site?.domain || '—'}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-[12px] text-text-subtle">Last deploy</span>
          <span className="text-[12px] font-medium text-text">{site?.updatedAt ? formatDate(site.updatedAt) : '—'}</span>
        </div>
                <div className="flex-1" />
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-4">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="border-b border-border grid grid-cols-6 divide-x divide-gray-100">
              {counts.map(item => (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.screen)}
                  className="flex flex-col items-start px-4 py-3 hover:bg-surface-raised transition-colors group"
                >
                  <span className="text-[22px] font-bold text-text tabular-nums leading-none">{loading ? '—' : item.count}</span>
                  <span className="text-[11px] text-text-subtle mt-1 group-hover:text-accent transition-colors">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Последние изменения</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Content', 'Type', 'Status', 'Updated', 'User', ''].map(col => (
                    <th key={col} className="text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-2 bg-surface-raised/60 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-[13px] text-text-subtle">No recent activity</td></tr>
                )}
                {recent.map((row) => {
                  // Rows are registry-typed — editorScreen always resolves.
                  const openEditor = () => onNavigate(row.editorScreen, row.id, { returnTo: 'dashboard' })
                  return (
                  <tr key={`${row.entityType}:${row.id}`} className="border-b border-border last:border-0 hover:bg-surface-raised/40 transition-colors group">
                    <td className="px-4 py-2">
                      <button onClick={openEditor} className="text-[13px] font-medium text-text hover:text-accent transition-colors text-left">{row.title}</button>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-text-subtle">{row.typeLabel}</td>
                    <td className="px-4 py-2"><Badge variant={row.status ? String(row.status).toLowerCase() as any : 'draft'} /></td>
                    <td className="px-4 py-2 text-[12px] text-text-subtle whitespace-nowrap">{formatDate(row.updatedAt)}</td>
                    <td className="px-4 py-2 text-[12px] text-text-subtle">Editor</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        {canEdit && (
                          <button onClick={openEditor} title="Edit" aria-label={`Edit ${row.title}`} className="w-6 h-6 inline-flex items-center justify-center rounded text-text-subtle hover:text-accent hover:bg-surface-hover transition-colors"><IconEdit size={12} /></button>
                        )}
                        {row.previewPath && (
                          <button onClick={() => openPreview(row.previewPath!)} title="Preview" aria-label={`Preview ${row.title}`} className="w-6 h-6 inline-flex items-center justify-center rounded text-text-subtle hover:text-accent hover:bg-surface-hover transition-colors"><IconEye size={12} /></button>
                        )}
                      </span>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {canEdit && (
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Create</p>
              </div>
              <div className="flex flex-col divide-y divide-gray-100">
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    onClick={() => onNavigate(action.screen, 'new', { returnTo: 'dashboard' })}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-text hover:bg-surface-raised hover:text-accent transition-colors text-left group"
                  >
                    <IconPlus size={12} className="text-text-subtle group-hover:text-accent transition-colors flex-shrink-0" />
                    {action.label}
                    <IconChevronRight size={12} className="ml-auto text-text-subtle group-hover:text-accent transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Site info</p>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              {(site as any)?.originalWebsiteUrl ? (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-text-subtle flex-shrink-0">Original</span>
                  <a href={(site as any).originalWebsiteUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent font-medium text-right truncate hover:underline">
                    {(site as any).originalWebsiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-text-subtle flex-shrink-0">Original</span>
                  <span className="text-[12px] text-warning font-medium text-right">URL missing</span>
                </div>
              )}
              {[
                { label: 'Client', value: settings?.companyName || site?.name || '—' },
                { label: 'Industry', value: 'Construction' },
                { label: 'Created', value: site?.createdAt ? formatDate(site.createdAt) : '—' },
                { label: 'Last deploy', value: site?.updatedAt ? formatDate(site.updatedAt) : '—' },
                { label: 'Pages', value: `${pages.filter((p: any) => p.status === 'PUBLISHED').length} published` },
              ].map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-text-subtle flex-shrink-0">{row.label}</span>
                  <span className="text-[12px] text-text font-medium text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
