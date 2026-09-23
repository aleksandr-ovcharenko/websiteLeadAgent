import { useState, useMemo, useEffect, useRef } from 'react'
import { Screen, Navigate } from './types'
import { IconEdit, IconEye, IconMore, IconTrash, IconChevronLeft, IconPlus, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'
import { mediaUrlOf } from './mediaUrl'
import { StructuredBlocksEditor } from './StructuredBlocksEditor'

interface NewsListProps {
  onNavigate: Navigate
}

function useNewsFilters() {
  const { news } = useStudio()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => {
    const c = { all: news.length, published: 0, draft: 0, archived: 0 }
    news.forEach((n: any) => { const s = uiStatus(n.status); if (s in c) (c as any)[s]++ })
    return c
  }, [news])

  const visible = useMemo(() => news.filter((n: any) => {
    const s = uiStatus(n.status)
    const matchFilter = filter === 'all' || s === filter
    const matchSearch = (n.title || '').toLowerCase().includes(search.toLowerCase()) || (n.slug || '').includes(search.toLowerCase())
    return matchFilter && matchSearch
  }), [news, search, filter])

  const statusFilter = useMemo(() => [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Published', value: 'published', count: counts.published },
    { label: 'Draft', value: 'draft', count: counts.draft },
    { label: 'Archived', value: 'archived', count: counts.archived },
  ], [counts])

  return { search, setSearch, filter, setFilter, visible, statusFilter }
}

export function NewsList({ onNavigate }: NewsListProps) {
  const { siteId, news, refresh, site, canEdit } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { search, setSearch, filter, setFilter, visible, statusFilter } = useNewsFilters()
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await api.deleteNews(siteId, deleteId); await refresh(); show('News deleted') } catch (e: any) { show(e.message || 'Failed') }
    setDeleteId(null)
  }

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Новости"
        actions={canEdit ? <Button variant="primary" onClick={() => onNavigate('news-editor', 'new')}><IconPlus size={12} />Добавить новость</Button> : undefined}
        filters={<FilterTabs tabs={statusFilter} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search news…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-surface border border-border rounded p-12 text-center">
          <p className="text-[13px] text-text-subtle mb-3">No news found.</p>
          {canEdit && <Button variant="primary" size="sm" onClick={() => onNavigate('news-editor', 'new')}>Add news</Button>}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Title', 'Slug', 'Status', 'Updated', ''].map(col => <th key={col} className="text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-2 bg-surface-raised whitespace-nowrap">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((n: any) => (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-surface-raised/60 transition-colors group">
                  <td className="px-4 py-2"><button onClick={() => onNavigate('news-editor', n.id)} className="text-[13px] font-medium text-text hover:text-accent transition-colors text-left">{n.title}</button></td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle mono">{n.slug}</td>
                  <td className="px-4 py-2"><Badge variant={uiStatus(n.status)} /></td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle whitespace-nowrap">{formatDate(n.updatedAt)}</td>
                  <td className="px-4 py-2 text-right w-10">
                    <DropdownMenu
                      trigger={<span className="inline-flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"><IconMore size={13} /></span>}
                      ariaLabel="Row actions"
                      items={[
                        ...(canEdit ? [{ label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('news-editor', n.id) }] : []),
                        { label: 'Preview', icon: <IconEye size={12} />, onClick: () => window.open(`/showcase/${site?.previewToken || ''}${n.previewPath || `/news/${n.slug}`}`, '_blank') },
                        ...(canEdit ? [{ label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(n.id), danger: true, divider: true }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDelete open={!!deleteId} title="Удалить новость?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}

type SaveState = 'saved' | 'saving' | 'unsaved'
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-[12px] text-text-subtle"><span className="inline-block w-3 h-3 rounded-full border border-border border-t-gray-500 animate-spin" />Saving…</span>
  if (state === 'unsaved') return <span className="flex items-center gap-1.5 text-[12px] text-warning"><span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />Unsaved changes</span>
  return <span className="flex items-center gap-1.5 text-[12px] text-text-subtle"><IconCheck size={12} className="text-success flex-shrink-0" />Saved</span>
}

function SideSection({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return <div className={`px-5 py-4 ${noBorder ? '' : 'border-b border-border'}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-3">{title}</p>{children}</div>
}

interface NewsEditorProps {
  newsId?: string | null
  returnTo?: Screen | null
  onNavigate: Navigate
}

export function NewsEditor({ newsId, returnTo, onNavigate }: NewsEditorProps) {
  const { siteId, news, refresh, site, media, canEdit } = useStudio()
  const isNew = !newsId || newsId === 'new'
  const item = isNew ? null : news.find((n: any) => n.id === newsId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [blocks, setBlocks] = useState<any[]>([])
  const [status, setStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [coverImageId, setCoverImageId] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [uploading, setUploading] = useState(false)
  const { toast, show } = useToast()

  // Populate once per entity — a bundle refetch must not wipe unsaved edits.
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    const key = item ? `id:${item.id}` : `new:${newsId ?? ''}`
    if (loadedFor.current === key) return
    loadedFor.current = key
    if (item) {
      setTitle(item.title || ''); setSlug(item.slug || ''); setExcerpt(item.excerpt || ''); setStatus(uiStatus(item.status))
      setCoverImageId(item.coverImageId || ''); setSeoTitle(item.seoTitle || ''); setSeoDesc(item.seoDescription || '')
      setPublishedAt(item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : '')
      setBlocks(item.blocks || [])
    } else {
      setTitle(''); setSlug(''); setExcerpt(''); setBlocks([]); setStatus('draft'); setCoverImageId(''); setSeoTitle(''); setSeoDesc(''); setPublishedAt('')
    }
    setSaveState('saved')
  }, [newsId, item])

  const markDirty = () => setSaveState('unsaved')

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload: any = { title, slug, excerpt, blocks, coverImageId, publishedAt, seoTitle, seoDescription: seoDesc, status: publish ? 'PUBLISHED' : apiStatus(status) }
      if (isNew) {
        const { news: created } = await api.createNews(siteId, payload)
        show(publish ? 'News published' : 'News saved')
        await refresh()
        // Stay in the editor — deep-link the new id so refresh/share works.
        onNavigate('news-editor', created?.id, { returnTo: returnTo ?? undefined })
      } else {
        await api.updateNews(siteId, item!.id, payload)
        show(publish ? 'News updated' : 'News saved')
        await refresh()
        setSaveState('saved')
      }
    } catch (e: any) { show(e.message || 'Failed to save'); setSaveState('unsaved') }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const { media } = await api.uploadMedia(siteId, file); setCoverImageId(media.id); markDirty(); show('Image uploaded') } catch (e: any) { show(e.message) }
    setUploading(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-surface border-b border-border px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate(returnTo ?? 'news')} className="flex items-center gap-1 text-[12px] text-text-subtle hover:text-text transition-colors"><IconChevronLeft size={13} />{returnTo === 'dashboard' ? 'Dashboard' : 'News'}</button>
          <span className="text-text-subtle">/</span>
          <span className="text-[13px] font-medium text-text truncate">{title || 'New post'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex items-center gap-2 flex-shrink-0">
          {(() => {
            const path = item?.previewPath
            return (
              <Button variant="ghost" size="sm" disabled={!path}
                onClick={() => path && window.open(`/showcase/${site?.previewToken || ''}${path}`, '_blank')}>
                <IconEye size={12} />{path ? 'Preview' : 'Detail preview unavailable'}
              </Button>
            )
          })()}
          {canEdit && <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>}
          {canEdit && <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-bg p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-surface border border-border rounded px-5 py-4">
              <div data-cms-control="news:title"><input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Post title" className="w-full text-[20px] font-semibold text-text placeholder-text-subtle bg-transparent border-0 focus:outline-none leading-tight" /></div>
            </div>

            <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3.5">
              <div data-cms-control="news:excerpt"><Textarea label="Excerpt" value={excerpt} onChange={v => { setExcerpt(v); markDirty() }} rows={2} placeholder="Short summary shown in listings…" /></div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-text-muted">Content blocks</label>
                <StructuredBlocksEditor key={item?.id || 'new'} entityKind="news" value={blocks} onChange={b => { setBlocks(b); markDirty() }} />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-2">Cover image</p>
              <div className="bg-surface border border-border rounded p-4">
                {coverImageId ? (
                  <div className="flex items-center gap-3 mb-3">
                    <img src={mediaUrlOf(siteId, (media || []).find((m: any) => m.id === coverImageId)) || ''} alt="" className="w-16 h-16 object-cover rounded border" />
                    <span className="text-[12px] text-text-muted mono">{coverImageId}</span>
                    <button onClick={() => { setCoverImageId(''); markDirty() }} className="ml-auto text-danger text-[12px]">Remove</button>
                  </div>
                ) : null}
                <label className="h-[120px] border border-dashed border-border rounded flex flex-col items-center justify-center gap-2 text-text-subtle hover:bg-surface-raised hover:border-accent hover:text-accent cursor-pointer transition-colors">
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  {uploading ? <span className="text-[12px]">Uploading…</span> : <><IconUpload size={18} /><span className="text-[12px]">Click to upload or drag image here</span><span className="text-[11px] text-text-subtle">JPG, PNG — recommended 1200×800</span></>}
                </label>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-[272px] flex-shrink-0 border-l border-border bg-surface overflow-y-auto">
          <SideSection title="Publication">
            <Select label="Status" value={status} onChange={v => { setStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]} />
            <div className="mt-3">
              <Input label="Published" type="date" value={publishedAt} onChange={v => { setPublishedAt(v); markDirty() }} />
            </div>
          </SideSection>
          <SideSection title="URL">
            <Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/news/" />
          </SideSection>
          <SideSection title="SEO">
            <Input label="Title" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty() }} placeholder="Defaults to post title" />
            <div className="flex flex-col gap-1 mt-3">
              <label className="text-[12px] font-medium text-text-muted">Description</label>
              <textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); markDirty() }} rows={3} placeholder="Brief description for search results" className="w-full border border-border rounded text-[12px] text-text placeholder-text-subtle px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none leading-relaxed" />
              <p className="text-[10px] text-text-subtle text-right">{seoDesc.length}/160</p>
            </div>
          </SideSection>
          {!isNew && canEdit && (
            <SideSection title="Danger zone" noBorder>
              <button onClick={async () => { try { await api.deleteNews(siteId, item!.id); await refresh(); onNavigate(returnTo ?? 'news') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-text-muted hover:text-danger transition-colors py-1.5">Delete post</button>
            </SideSection>
          )}
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
