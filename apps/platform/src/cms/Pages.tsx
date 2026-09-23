import { useState, useEffect, useMemo, useRef } from 'react'
import { Screen, Navigate } from './types'
import { IconEdit, IconEye, IconCopy, IconTrash, IconMore, IconChevronLeft, IconGrip, IconPlus, IconX, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar, Modal } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'
import { mediaUrlOf } from './mediaUrl'

// Canonical block types offered for NEW blocks (contentBlockSchema).
// Legacy Team/Stats/Map are intentionally absent: unknown existing blocks
// load as read-only and are preserved verbatim on save.
const BLOCK_TYPES = ['Hero', 'Text', 'Image', 'Gallery', 'Services', 'Projects', 'News', 'About', 'Vacancies', 'CTA', 'Contacts', 'Certificates']

const BLOCK_UI_TO_API: Record<string, string> = {
  Hero: 'hero', Text: 'text', Image: 'image', Gallery: 'gallery',
  Services: 'services', Projects: 'projects', News: 'news', About: 'about',
  Vacancies: 'vacancies', CTA: 'cta', Contacts: 'contacts', Certificates: 'certificates'
}
const BLOCK_API_TO_UI: Record<string, string> = Object.fromEntries(Object.entries(BLOCK_UI_TO_API).map(([k, v]) => [v, k]))
const COLLECTION_TYPES = new Set(['Services', 'Projects', 'News', 'Vacancies'])

function newBlock(type: string): BlockUi {
  const id = `b${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  return { id, type, summary: '…', data: {}, enabled: true, unsupported: false, raw: undefined }
}

interface BlockUi {
  id: string
  type: string
  summary: string
  data: Record<string, any>
  enabled: boolean
  unsupported: boolean
  /** Original API payload — unknown fields must survive the round-trip. */
  raw?: Record<string, any>
}

function toApiBlock(b: BlockUi): any {
  // Unknown / unsupported blocks round-trip verbatim (plus enabled flag).
  if (b.unsupported || !BLOCK_UI_TO_API[b.type]) {
    return { ...(b.raw || {}), id: b.id, type: b.raw?.type || b.type.toLowerCase(), enabled: b.enabled }
  }
  const d = { ...b.data }
  const base: any = { ...(b.raw || {}), id: b.id, type: BLOCK_UI_TO_API[b.type], enabled: b.enabled }
  switch (b.type) {
    case 'Hero': return { ...base, tag: d.subheading || '', title: d.heading || '', body: d.subheading || '', buttonLabel: d.buttonLabel || '', buttonUrl: d.buttonUrl || '', imageId: d.imageId || undefined }
    case 'Text': return { ...base, heading: d.heading || '', content: d.content || '' }
    case 'Image': return { ...base, imageId: d.imageId || '', caption: d.caption || '' }
    case 'Gallery': return { ...base, imageIds: d.imageIds || [] }
    case 'Services': case 'Projects': case 'News': case 'Vacancies': {
      const ids = (d.selectedItemIdsText ?? '')
      const selectedItemIds = String(ids).split('\n').map((s: string) => s.trim()).filter(Boolean)
      return {
        ...base, heading: d.heading || '',
        limit: d.limit === '' || d.limit == null ? null : Number(d.limit),
        pageSize: d.pageSize === '' || d.pageSize == null ? undefined : Number(d.pageSize),
        showAllLink: d.showAllLink !== false,
        selectedItemIds: selectedItemIds.length ? selectedItemIds : undefined,
      }
    }
    case 'About': return { ...base, heading: d.heading || '', content: d.content || '', imageId: d.imageId || undefined }
    case 'CTA': return { ...base, title: d.heading || '', description: d.description || '', buttonLabel: d.buttonLabel || '', buttonUrl: d.buttonUrl || '' }
    case 'Contacts': return { ...base, heading: d.heading || 'Контакты' }
    case 'Certificates': return {
      ...base, heading: d.heading || '', description: d.description || '',
      items: (d.items || []).map((it: any, i: number) => ({
        mediaId: it.mediaId, caption: it.caption || '', docType: it.docType || '',
        enabled: it.enabled !== false, sortOrder: i,
        ...(it.sourceUrl ? { sourceUrl: it.sourceUrl } : {}),
      })).filter((it: any) => it.mediaId)
    }
    default: return { ...base, ...d }
  }
}

function fromApiBlock(raw: any): BlockUi {
  const known = !!BLOCK_API_TO_UI[raw?.type]
  const type = known ? BLOCK_API_TO_UI[raw.type] : (raw?.type ? raw.type[0].toUpperCase() + raw.type.slice(1) : 'Text')
  let data: Record<string, any> = {}
  switch (raw?.type) {
    case 'hero': data = { heading: raw.title || '', subheading: raw.body || raw.tag || '', buttonLabel: raw.buttonLabel || '', buttonUrl: raw.buttonUrl || '', imageId: raw.imageId || '' }; break
    case 'text': data = { heading: raw.heading || '', content: raw.content || '' }; break
    case 'image': data = { imageId: raw.imageId || '', caption: raw.caption || '' }; break
    case 'gallery': data = { imageIds: raw.imageIds || [] }; break
    case 'services':
    case 'projects':
    case 'news':
    case 'vacancies': data = { heading: raw.heading || '', limit: raw.limit ?? '', pageSize: raw.pageSize ?? '', showAllLink: raw.showAllLink !== false, selectedItemIdsText: (raw.selectedItemIds || []).join('\n') }; break
    case 'about': data = { heading: raw.heading || '', content: raw.content || '', imageId: raw.imageId || '' }; break
    case 'cta': data = { heading: raw.title || '', description: raw.description || '', buttonLabel: raw.buttonLabel || '', buttonUrl: raw.buttonUrl || '' }; break
    case 'contacts': data = { heading: raw.heading || '' }; break
    case 'certificates': data = { heading: raw.heading || '', description: raw.description || '', items: raw.items || [] }; break
    default: data = {}
  }
  const summary = raw?.title || raw?.heading || raw?.content || type
  return {
    // Stable id: preserve the persisted block id; generate one only when absent.
    id: raw?.id || `b${Math.random().toString(36).slice(2)}`,
    type,
    summary: String(summary || type).slice(0, 40),
    data,
    enabled: raw?.enabled !== false,
    unsupported: !known,
    raw,
  }
}

interface PagesListProps {
  onNavigate: Navigate
}

function usePageFilters() {
  const { pages } = useStudio()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const statusCounts = useMemo(() => {
    const c = { all: pages.length, published: 0, draft: 0, archived: 0 }
    pages.forEach(p => { const s = uiStatus(p.status); if (s in c) (c as any)[s]++ })
    return c
  }, [pages])

  const visible = useMemo(() => {
    return pages.filter(p => {
      const s = uiStatus(p.status)
      const matchFilter = filter === 'all' || s === filter
      const matchSearch = (p.title || '').toLowerCase().includes(search.toLowerCase()) || (p.slug || '').toLowerCase().includes(search.toLowerCase())
      return matchFilter && matchSearch
    })
  }, [pages, search, filter])

  const statusFilter = useMemo(() => [
    { label: 'All', value: 'all', count: statusCounts.all },
    { label: 'Published', value: 'published', count: statusCounts.published },
    { label: 'Draft', value: 'draft', count: statusCounts.draft },
    { label: 'Archived', value: 'archived', count: statusCounts.archived },
  ], [statusCounts])

  return { search, setSearch, filter, setFilter, visible, statusFilter }
}

export function PagesList({ onNavigate }: PagesListProps) {
  const { siteId, pages, refresh, role, canEdit } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { search, setSearch, filter, setFilter, visible, statusFilter } = usePageFilters()
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId || busy) return
    setBusy(true)
    try {
      await api.deletePage(siteId, deleteId)
      await refresh()
      show('Page deleted')
    } catch (e: any) {
      show(e.message || 'Failed to delete')
    } finally {
      setBusy(false); setDeleteId(null)
    }
  }

  const duplicatePage = async (page: any) => {
    if (busy) return
    setBusy(true)
    try {
      const copySlug = `${page.slug || 'page'}-copy`
      await api.createPage(siteId, {
        title: `${page.title || 'Page'} (копия)`,
        slug: copySlug,
        blocks: page.blocks || [],
        status: 'DRAFT',
        isHomepage: false,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
      })
      await refresh()
      show('Page duplicated as draft')
    } catch (e: any) {
      show(e.message || 'Failed to duplicate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Страницы"
        actions={canEdit ? <Button variant="primary" onClick={() => onNavigate('page-editor', 'new')}><IconPlus size={12} />Добавить страницу</Button> : undefined}
        filters={<FilterTabs tabs={statusFilter} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search pages…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-surface border border-border rounded p-12 text-center">
          <p className="text-[13px] text-text-subtle mb-3">No pages match your filter.</p>
          {canEdit && <Button variant="primary" size="sm" onClick={() => onNavigate('page-editor', 'new')}><IconPlus size={12} /> Add page</Button>}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Title', 'Slug', 'Status', 'Updated', 'Author', ''].map(col => (
                  <th key={col} className="text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-2 bg-surface-raised whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(page => (
                <tr key={page.id} className="border-b border-border last:border-0 hover:bg-surface-raised/60 transition-colors group">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2">
                      <button onClick={() => onNavigate('page-editor', page.id)} className="text-[13px] font-medium text-text hover:text-accent transition-colors text-left">{page.title}</button>
                      {page.isHomepage && <Badge variant="homepage" />}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle mono">{page.isHomepage ? '/' : (page.slug || '/')}</td>
                  <td className="px-4 py-2"><Badge variant={uiStatus(page.status)} /></td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle whitespace-nowrap">{formatDate(page.updatedAt)}</td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle">Editor</td>
                  <td className="px-4 py-2 text-right w-10">
                    <DropdownMenu
                      ariaLabel={`Действия: ${page.title || page.slug}`}
                      trigger={<span className="inline-flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"><IconMore size={13} /></span>}
                      items={[
                        ...(canEdit ? [{ label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('page-editor', page.id) }] : []),
                        { label: page.isHomepage ? 'Home' : 'Preview', icon: <IconEye size={12} />, onClick: () => { const url = page.isHomepage ? `/showcase/${page.site?.previewToken || ''}` : `/showcase/${page.site?.previewToken || ''}/${page.slug}`; window.open(url, '_blank') } },
                        ...(canEdit ? [
                          { label: 'Duplicate', icon: <IconCopy size={12} />, onClick: () => duplicatePage(page), disabled: busy },
                          { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(page.id), danger: true, divider: true },
                        ] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDelete
        open={!!deleteId}
        title="Удалить страницу?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

type SaveState = 'saved' | 'saving' | 'unsaved'

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-[12px] text-text-subtle"><span className="inline-block w-3 h-3 rounded-full border border-border border-t-gray-500 animate-spin" />Saving…</span>
  if (state === 'unsaved') return <span className="flex items-center gap-1.5 text-[12px] text-warning"><span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />Unsaved changes</span>
  return <span className="flex items-center gap-1.5 text-[12px] text-text-subtle"><IconCheck size={12} className="text-success flex-shrink-0" />Saved</span>
}

// ─── Certificates block editor ───────────────────────────────────────────────
// Ordered document items linked to CMS Media: add-from-media picker, reorder,
// hide/show, caption editing. items[i].mediaId is the persisted Media id.

function CertificatesEditor({ block, onChange }: { block: BlockUi; onChange: (patch: Record<string, any>) => void }) {
  const { siteId, media } = useStudio()
  const [pickerOpen, setPickerOpen] = useState(false)
  const items: any[] = block.data.items || []

  const urlOf = (mediaId: string) => {
    const m = (media || []).find((x: any) => x.id === mediaId)
    return m ? mediaUrlOf(siteId, m) : undefined
  }
  const nameOf = (mediaId: string) => {
    const m = (media || []).find((x: any) => x.id === mediaId)
    return m?.originalFilename || m?.filename || mediaId
  }
  const isPdf = (mediaId: string, docType?: string) => {
    const m = (media || []).find((x: any) => x.id === mediaId)
    return docType === 'pdf' || (m?.mimeType || '') === 'application/pdf' || /\.pdf$/i.test(m?.filename || '')
  }

  const setItems = (next: any[]) => onChange({ items: next })
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]; [next[i], next[j]] = [next[j], next[i]]
    setItems(next)
  }
  const setItem = (i: number, patch: any) => setItems(items.map((it, x) => x === i ? { ...it, ...patch } : it))
  const removeItem = (i: number) => setItems(items.filter((_, x) => x !== i))
  const addMedia = (m: any) => {
    if (items.some((it) => it.mediaId === m.id)) return
    setItems([...items, {
      mediaId: m.id,
      caption: m.caption || m.alt || m.originalFilename || '',
      docType: (m.mimeType === 'application/pdf' || /\.pdf$/i.test(m.filename || '')) ? 'pdf' : 'image',
      enabled: true,
      sortOrder: items.length,
    }])
    setPickerOpen(false)
  }

  const pickerItems = (media || []).filter((m: any) => !items.some((it) => it.mediaId === m.id))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-text-muted">Документы ({items.length})</span>
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}><IconPlus size={11} />Add from Media</Button>
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] text-text-subtle py-2">Нет документов — добавьте из медиатеки.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it, i) => {
            const url = urlOf(it.mediaId)
            const hidden = it.enabled === false
            return (
              <div key={it.mediaId || i} className={`flex items-center gap-2.5 border border-border rounded px-2 py-1.5 bg-surface ${hidden ? 'opacity-50' : ''}`}>
                <div className="w-9 h-12 flex-shrink-0 border border-border bg-white overflow-hidden flex items-center justify-center">
                  {isPdf(it.mediaId, it.docType)
                    ? <span className="text-[9px] font-bold text-text-subtle">PDF</span>
                    : url ? <img src={url} alt="" className="w-full h-full object-contain" /> : <IconX size={10} />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <input
                    value={it.caption || ''}
                    onChange={e => setItem(i, { caption: e.target.value })}
                    placeholder={nameOf(it.mediaId)}
                    className="w-full h-6 px-1.5 border border-transparent hover:border-border focus:border-accent rounded text-[12px] text-text bg-transparent focus:outline-none"
                  />
                  <span className="text-[10px] text-text-subtle mono truncate">{nameOf(it.mediaId)}{hidden ? ' · hidden' : ''}</span>
                </div>
                <div className="flex items-center gap-px flex-shrink-0">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover disabled:opacity-30">↑</button>
                  <button aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover disabled:opacity-30">↓</button>
                  <button aria-label={hidden ? 'Show document' : 'Hide document'} onClick={() => setItem(i, { enabled: hidden })} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover"><IconEye size={11} /></button>
                  <button aria-label="Remove document" onClick={() => removeItem(i)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-danger hover:bg-danger-subtle"><IconX size={11} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={pickerOpen} title="Добавить документ из медиатеки" onClose={() => setPickerOpen(false)}>
        {pickerItems.length === 0 ? (
          <p className="text-[12px] text-text-subtle">Все файлы уже добавлены, или медиатека пуста.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-[320px] overflow-y-auto">
            {pickerItems.map((m: any) => {
              const url = mediaUrlOf(siteId, m)
              const pdf = m.mimeType === 'application/pdf' || /\.pdf$/i.test(m.filename || '')
              return (
                <button key={m.id} onClick={() => addMedia(m)} className="flex flex-col border border-border rounded overflow-hidden hover:border-accent transition-colors">
                  <div className="w-full aspect-[3/4] bg-surface-raised flex items-center justify-center overflow-hidden">
                    {pdf ? <span className="text-[10px] font-bold text-text-subtle">PDF</span> : url ? <img src={url} alt="" className="w-full h-full object-contain" /> : null}
                  </div>
                  <span className="text-[10px] text-text-muted truncate px-1.5 py-1 text-left w-full">{m.originalFilename || m.filename}</span>
                </button>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}

function SideSection({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return <div className={`px-5 py-4 ${noBorder ? '' : 'border-b border-border'}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-3">{title}</p>{children}</div>
}

interface PageEditorProps {
  pageId?: string | null
  returnTo?: Screen | null
  onNavigate: Navigate
}

function defaultPageBlocks(): BlockUi[] {
  return [
    { id: 'b1', type: 'Hero', summary: 'Hero block', enabled: true, unsupported: false, data: { heading: 'Надёжный партнёр в строительстве', subheading: 'Опыт более 20 лет. Работаем по всей Беларуси.', buttonLabel: 'Связаться с нами', buttonUrl: '/contacts' } },
    { id: 'b2', type: 'Services', summary: 'Services listing', enabled: true, unsupported: false, data: {} },
    { id: 'b3', type: 'Projects', summary: 'Projects listing', enabled: true, unsupported: false, data: {} },
  ]
}

export function PageEditor({ pageId, returnTo, onNavigate }: PageEditorProps) {
  const { siteId, site, settings, pages, news, projects, services, products, vacancies, refresh, canEdit } = useStudio()
  const isNew = !pageId || pageId === 'new'
  const page = isNew ? null : pages.find((p: any) => p.id === pageId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [isHomepage, setIsHomepage] = useState(false)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [showInNav, setShowInNav] = useState(false)
  const [blocks, setBlocks] = useState<BlockUi[]>([])
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const { toast, show } = useToast()

  // Populate once per page — a bundle refetch must not wipe unsaved edits.
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    const key = page ? `id:${page.id}` : `new:${pageId ?? ''}`
    if (loadedFor.current === key) return
    loadedFor.current = key
    if (page) {
      setTitle(page.title || '')
      setSlug(page.slug || '')
      setStatus(uiStatus(page.status))
      setIsHomepage(!!page.isHomepage)
      setSeoTitle(page.seoTitle || '')
      setSeoDesc(page.seoDescription || '')
      setBlocks(((page.blocks || []).map(fromApiBlock) as BlockUi[]).length ? (page.blocks || []).map(fromApiBlock) : [])
    } else {
      setTitle('')
      setSlug('')
      setStatus('draft')
      setIsHomepage(false)
      setSeoTitle('')
      setSeoDesc('')
      setBlocks([])
    }
    setSaveState('saved')
    setActiveBlock(null)
  }, [pageId, page])

  const markDirty = () => setSaveState('unsaved')

  const buildPayload = () => ({
    title,
    slug: slug.replace(/^\//, ''),
    blocks: blocks.map(toApiBlock),
    status: apiStatus(status),
    isHomepage,
    seoTitle,
    seoDescription: seoDesc,
    showInNav
  })

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload = buildPayload()
      if (publish) payload.status = 'PUBLISHED'
      if (isNew) {
        const { page: created } = await api.createPage(siteId, payload)
        show(publish ? 'Page published' : 'Page saved')
        await refresh()
        // Stay in the editor — deep-link the new id so refresh/share works.
        onNavigate('page-editor', created?.id, { returnTo: returnTo ?? undefined })
      } else {
        await api.updatePage(siteId, page!.id, payload)
        show(publish ? 'Page updated' : 'Page saved')
        await refresh()
        setSaveState('saved')
      }
    } catch (e: any) {
      show(e.message || 'Failed to save')
      setSaveState('unsaved')
    }
  }

  const removeBlock = (id: string) => { setBlocks(b => b.filter(x => x.id !== id)); markDirty() }
  const duplicateBlock = (id: string) => {
    const block = blocks.find(b => b.id === id)
    if (block) { setBlocks(b => [...b, { ...block, id: `b${Date.now()}_${Math.random().toString(36).slice(2, 5)}` }]); markDirty() }
  }
  const updateBlockData = (id: string, patch: Record<string, any>) => {
    setBlocks(b => b.map(x => x.id === id ? { ...x, data: { ...x.data, ...patch }, summary: (Object.values({ ...x.data, ...patch }).find(v => typeof v === 'string' && v) as string) || x.type } : x))
    markDirty()
  }

  const addBlock = (type: string) => {
    const b = newBlock(type)
    setBlocks(bl => [...bl, b])
    setActiveBlock(b.id)
    setAddOpen(false)
    markDirty()
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks(bl => {
      const i = bl.findIndex(x => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= bl.length) return bl
      const next = [...bl]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    markDirty()
  }

  const toggleBlockEnabled = (id: string) => {
    setBlocks(bl => bl.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x))
    markDirty()
  }

  const active = blocks.find(b => b.id === activeBlock)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-surface border-b border-border px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate(returnTo ?? 'pages')} className="flex items-center gap-1 text-[12px] text-text-subtle hover:text-text transition-colors whitespace-nowrap flex-shrink-0"><IconChevronLeft size={13} />{returnTo === 'dashboard' ? 'Dashboard' : 'Pages'}</button>
          <span className="text-text-subtle flex-shrink-0">/</span>
          <span className="text-[13px] font-medium text-text truncate">{title || 'New page'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
          {isHomepage && <span className="flex-shrink-0"><Badge variant="homepage" /></span>}
        </div>
        <div className="flex items-center justify-center flex-shrink-0"><SaveIndicator state={saveState} /></div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => { const token = site?.previewToken || ''; const path = (isHomepage || slug === 'index') ? '' : slug; window.open(path ? `/showcase/${token}/${path}` : `/showcase/${token}`, '_blank') }}><IconEye size={12} />Preview</Button>
          {canEdit && <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>}
          {canEdit && <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-bg p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-surface border border-border rounded px-5 py-4">
              <div data-cms-control="page:title"><input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Page title" className="w-full text-[20px] font-semibold text-text placeholder-text-subtle bg-transparent border-0 focus:outline-none leading-tight" /></div>
              <p className="text-[11px] text-text-subtle mono mt-2">{settings?.companyName || site?.domain || 'site'}{(slug ? (slug.startsWith('/') ? slug : '/' + slug) : '/<slug>').replace(/\/$/, '')}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-2">Page content</p>
              {blocks.length === 0 && !addOpen && (
                <div className="bg-surface border border-dashed border-border rounded px-5 py-8 text-center mb-1">
                  <p className="text-[13px] text-text-subtle mb-3">This page has no content blocks yet.</p>
                  <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}><IconPlus size={12} />Add first block</Button>
                </div>
              )}

              <div className="flex flex-col gap-px">
                {blocks.map((block, bi) => {
                  const isActive = activeBlock === block.id
                  return (
                    <div key={block.id} className={`bg-surface border rounded overflow-hidden transition-all ${isActive ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border hover:border-border'} ${!block.enabled ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer group/row" onClick={() => setActiveBlock(isActive ? null : block.id)}>
                        <span className="text-text-subtle hover:text-text-muted cursor-grab flex-shrink-0" onClick={e => e.stopPropagation()}><IconGrip size={13} /></span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest w-[60px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-text-subtle'}`}>{block.type}</span>
                        <span className="flex-1 text-[13px] text-text-muted truncate min-w-0">{block.summary}{!block.enabled ? ' · hidden' : ''}</span>
                        <div className="flex items-center gap-px opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button aria-label="Move block up" disabled={bi === 0} onClick={() => moveBlock(block.id, -1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:pointer-events-none">↑</button>
                          <button aria-label="Move block down" disabled={bi === blocks.length - 1} onClick={() => moveBlock(block.id, 1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:pointer-events-none">↓</button>
                          <button aria-label={block.enabled ? 'Hide block' : 'Show block'} onClick={() => toggleBlockEnabled(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover transition-colors"><IconEye size={11} /></button>
                          <button aria-label="Duplicate block" onClick={() => duplicateBlock(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover transition-colors"><IconCopy size={11} /></button>
                          <button aria-label="Remove block" onClick={() => removeBlock(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-danger hover:bg-danger-subtle transition-colors"><IconX size={11} /></button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-raised">
                          {block.unsupported && (
                            <p className="text-[12px] text-warning py-2">Unsupported block type “{block.raw?.type || block.type}”. Read-only — the block is preserved as-is on save.</p>
                          )}
                          <div className="pt-3 flex flex-col gap-2.5" data-cms-control={`page:block:${block.id}`} style={block.unsupported ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>
                            {block.type === 'Hero' && (
                              <>
                                <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:subheading`}><Input label="Subheading" value={block.data.subheading || ''} onChange={v => updateBlockData(block.id, { subheading: v })} /></div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div data-cms-control={`page:block:${block.id}:buttonLabel`}><Input label="Primary button" value={block.data.buttonLabel || ''} onChange={v => updateBlockData(block.id, { buttonLabel: v })} /></div>
                                  <div data-cms-control={`page:block:${block.id}:buttonUrl`}><Input label="Button link" value={block.data.buttonUrl || ''} onChange={v => updateBlockData(block.id, { buttonUrl: v })} /></div>
                                </div>
                              </>
                            )}
                            {block.type === 'Text' && (
                              <>
                                <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Section heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:content`}><Textarea label="Content" value={block.data.content || ''} onChange={v => updateBlockData(block.id, { content: v })} rows={4} /></div>
                              </>
                            )}
                            {block.type === 'Image' && (
                              <>
                                <div data-cms-control={`page:block:${block.id}:imageId`}><Input label="Media ID or URL" value={block.data.imageId || ''} onChange={v => updateBlockData(block.id, { imageId: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:caption`}><Input label="Caption" value={block.data.caption || ''} onChange={v => updateBlockData(block.id, { caption: v })} /></div>
                              </>
                            )}
                            {block.type === 'Gallery' && (
                              <>
                                <Textarea label="Image IDs (one per line)" value={(block.data.imageIds || []).join('\n')} onChange={v => updateBlockData(block.id, { imageIds: v.split('\n').map(s => s.trim()).filter(Boolean) })} rows={4} />
                              </>
                            )}
                            {COLLECTION_TYPES.has(block.type) && (() => {
                              const totalByType: Record<string, number> = { Services: services.length, Projects: projects.length, News: news.length, Vacancies: vacancies.length, Products: (products || []).length }
                              const total = totalByType[block.type] ?? 0
                              const lim = block.data.limit === '' || block.data.limit == null ? total : Math.min(Number(block.data.limit), total)
                              return (
                              <>
                                <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Section heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:limit`}><Input label="Карточек на главной (пусто = лимит шаблона)" type="number" value={block.data.limit === '' || block.data.limit == null ? '' : String(block.data.limit)} onChange={v => updateBlockData(block.id, { limit: v === '' ? '' : Math.max(1, Math.floor(Number(v) || 0)) })} /></div>
                                <Select label="Карточек на странице раздела" value={String(block.data.pageSize ?? '')} onChange={v => updateBlockData(block.id, { pageSize: v === '' ? '' : Number(v) })} options={[{ value: '', label: 'Default (6)' }, { value: '3', label: '3' }, { value: '6', label: '6' }, { value: '12', label: '12' }, { value: '18', label: '18' }, { value: '24', label: '24' }]} />
                                <div data-cms-control={`page:block:${block.id}:selectedItemIdsText`}><Textarea label="Selected item IDs (one per line, optional)" value={block.data.selectedItemIdsText || ''} onChange={v => updateBlockData(block.id, { selectedItemIdsText: v })} rows={2} /></div>
                                <label className="flex items-center gap-2 text-[12px] text-text-muted cursor-pointer">
                                  <input type="checkbox" checked={block.data.showAllLink !== false} onChange={e => updateBlockData(block.id, { showAllLink: e.target.checked })} />
                                  Показывать ссылку «Смотреть все»
                                </label>
                                <p className="text-[11px] text-text-subtle">На главной будет показано {block.data.limit === '' || block.data.limit == null ? 'по лимиту шаблона' : `${lim} из ${total}`}</p>
                              </>
                              )
                            })()}
                            {block.type === 'About' && (
                              <>
                                <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:content`}><Textarea label="Content" value={block.data.content || ''} onChange={v => updateBlockData(block.id, { content: v })} rows={4} /></div>
                                <div data-cms-control={`page:block:${block.id}:imageId`}><Input label="Media ID (optional)" value={block.data.imageId || ''} onChange={v => updateBlockData(block.id, { imageId: v })} /></div>
                              </>
                            )}
                            {block.type === 'CTA' && (
                              <>
                                <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:description`}><Textarea label="Description" value={block.data.description || ''} onChange={v => updateBlockData(block.id, { description: v })} rows={3} /></div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div data-cms-control={`page:block:${block.id}:buttonLabel`}><Input label="Button label" value={block.data.buttonLabel || ''} onChange={v => updateBlockData(block.id, { buttonLabel: v })} /></div>
                                  <div data-cms-control={`page:block:${block.id}:buttonUrl`}><Input label="Button link" value={block.data.buttonUrl || ''} onChange={v => updateBlockData(block.id, { buttonUrl: v })} /></div>
                                </div>
                              </>
                            )}
                            {block.type === 'Contacts' && (
                              <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Heading" value={block.data.heading || 'Контакты'} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                            )}
                            {block.type === 'Certificates' && (
                              <>
                                <div data-cms-control={`page:block:${block.id}:heading`}><Input label="Section heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} /></div>
                                <div data-cms-control={`page:block:${block.id}:description`}><Textarea label="Description" value={block.data.description || ''} onChange={v => updateBlockData(block.id, { description: v })} rows={2} /></div>
                                <CertificatesEditor block={block} onChange={patch => updateBlockData(block.id, patch)} />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-1">
                {addOpen ? (
                  <div className="bg-surface border border-border rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-semibold text-text">Choose a block type</p>
                      <button onClick={() => setAddOpen(false)} className="w-5 h-5 flex items-center justify-center rounded text-text-subtle hover:text-text-muted hover:bg-surface-hover transition-colors"><IconX size={12} /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BLOCK_TYPES.map(bt => (
                        <button key={bt} onClick={() => addBlock(bt)} className="flex items-center justify-center h-8 px-2 rounded border border-border text-[12px] text-text-muted hover:border-accent hover:text-accent hover:bg-success-subtle/30 transition-colors">{bt}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddOpen(true)} className="w-full flex items-center justify-center gap-2 h-9 rounded border border-dashed border-border text-[13px] text-text-subtle hover:border-accent hover:text-accent hover:bg-success-subtle/20 transition-colors"><IconPlus size={12} />Add block</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="w-[272px] flex-shrink-0 border-l border-border bg-surface overflow-y-auto">
          <SideSection title="Publication">
            <Select label="Status" value={status} onChange={v => { setStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]} />
          </SideSection>

          <SideSection title="URL">
            <div data-cms-control="page:slug"><Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/" /></div>
            <p className="text-[11px] text-text-subtle mono mt-2 truncate">{settings?.companyName || site?.domain || 'site'}/{slug || '<slug>'}</p>
          </SideSection>

          <SideSection title="Visibility">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isHomepage} onChange={e => {
                const next = e.target.checked
                const other = pages.find((p: any) => p.isHomepage && p.id !== pageId)
                if (next && other && !window.confirm(`"${other.title}" is currently the homepage. Make "${title || 'this page'}" the homepage instead?`)) return
                if (!next && page?.isHomepage && !window.confirm('Remove the homepage flag? The site will have no homepage.')) return
                setIsHomepage(next); markDirty()
              }} className="w-3.5 h-3.5 accent-accent" />
              <span className="text-[12px] text-text">Homepage</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={showInNav} onChange={e => { setShowInNav(e.target.checked); markDirty() }} className="w-3.5 h-3.5 accent-accent" />
              <span className="text-[12px] text-text">Show in navigation</span>
            </label>
          </SideSection>

          <SideSection title="SEO">
            <div className="flex flex-col gap-3">
              <Input label="Title" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty() }} placeholder="Defaults to page title" />
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-text-muted">Description</label>
                <textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); markDirty() }} placeholder="Brief description for search results" rows={3} className="w-full border border-border rounded text-[12px] text-text placeholder-text-subtle px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-none leading-relaxed" />
                <p className="text-[10px] text-text-subtle text-right">{seoDesc.length}/160</p>
              </div>
            </div>
          </SideSection>

          <SideSection title="Danger zone" noBorder>
            {!isNew && (
              <div className="flex flex-col gap-0.5">
                <button onClick={() => setStatus('archived')} className="text-left text-[12px] text-text-muted hover:text-warning transition-colors py-1.5">Archive this page</button>
                <button onClick={async () => { try { await api.deletePage(siteId, page!.id); await refresh(); onNavigate('pages') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-text-muted hover:text-danger transition-colors py-1.5">Delete page permanently</button>
              </div>
            )}
          </SideSection>
        </aside>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
