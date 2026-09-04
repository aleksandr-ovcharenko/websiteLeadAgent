import { useState, useEffect, useMemo } from 'react'
import { Screen } from './types'
import { IconEdit, IconEye, IconCopy, IconTrash, IconMore, IconChevronLeft, IconGrip, IconPlus, IconX, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'

const BLOCK_TYPES = ['Hero', 'Text', 'Image', 'Gallery', 'Services', 'Projects', 'News', 'CTA', 'Contacts', 'Team', 'Stats', 'Map']

const BLOCK_UI_TO_API: Record<string, string> = {
  Hero: 'hero', Text: 'text', Image: 'image', Gallery: 'gallery',
  Services: 'services', Projects: 'projects', News: 'news', CTA: 'cta',
  Contacts: 'contacts', Team: 'team', Stats: 'stats', Map: 'map'
}
const BLOCK_API_TO_UI: Record<string, string> = Object.fromEntries(Object.entries(BLOCK_UI_TO_API).map(([k, v]) => [v, k]))

function newBlock(type: string): BlockUi {
  const id = `b${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  return { id, type, summary: '…', data: {} }
}

interface BlockUi {
  id: string
  type: string
  summary: string
  data: Record<string, any>
}

function toApiBlock(b: BlockUi): any {
  const t = BLOCK_UI_TO_API[b.type] || b.type.toLowerCase()
  const d = { ...b.data }
  switch (b.type) {
    case 'Hero': return { type: 'hero', tag: d.subheading || '', title: d.heading || '', body: d.subheading || '', buttonLabel: d.buttonLabel || '', buttonUrl: d.buttonUrl || '' }
    case 'Text': return { type: 'text', heading: d.heading || '', content: d.content || '' }
    case 'Image': return { type: 'image', imageId: d.imageId || '', caption: d.caption || '' }
    case 'Gallery': return { type: 'gallery', imageIds: d.imageIds || [] }
    case 'Services': return { type: 'services', limit: d.limit ? Number(d.limit) : null }
    case 'Projects': return { type: 'projects', limit: d.limit ? Number(d.limit) : null }
    case 'News': return { type: 'news', limit: d.limit ? Number(d.limit) : null }
    case 'CTA': return { type: 'cta', title: d.heading || '', description: d.description || '', buttonLabel: d.buttonLabel || '', buttonUrl: d.buttonUrl || '' }
    case 'Contacts': return { type: 'contacts', heading: d.heading || 'Контакты' }
    case 'Team': return { type: 'team', heading: d.heading || 'Команда', members: d.members || [] }
    case 'Stats': return { type: 'stats', heading: d.heading || 'В цифрах', stats: d.stats || [] }
    case 'Map': return { type: 'map', heading: d.heading || 'Как нас найти' }
    default: return { type: t, ...d }
  }
}

function fromApiBlock(raw: any): BlockUi {
  const type = BLOCK_API_TO_UI[raw.type] || (raw.type ? raw.type[0].toUpperCase() + raw.type.slice(1) : 'Text')
  let data: Record<string, any> = {}
  switch (raw.type) {
    case 'hero': data = { heading: raw.title || '', subheading: raw.body || raw.tag || '', buttonLabel: raw.buttonLabel || '', buttonUrl: raw.buttonUrl || '' }; break
    case 'text': data = { heading: raw.heading || '', content: raw.content || '' }; break
    case 'image': data = { imageId: raw.imageId || '', caption: raw.caption || '' }; break
    case 'gallery': data = { imageIds: raw.imageIds || [] }; break
    case 'services':
    case 'projects':
    case 'news': data = { limit: raw.limit ?? '' }; break
    case 'cta': data = { heading: raw.title || '', description: raw.description || '', buttonLabel: raw.buttonLabel || '', buttonUrl: raw.buttonUrl || '' }; break
    case 'contacts': data = { heading: raw.heading || '' }; break
    case 'team': data = { heading: raw.heading || '', members: raw.members || [] }; break
    case 'stats': data = { heading: raw.heading || '', stats: raw.stats || [] }; break
    case 'map': data = { heading: raw.heading || '' }; break
    default: data = { ...raw, type: undefined }
  }
  const summary = raw.title || raw.heading || raw.content || type
  return { id: `b${Math.random().toString(36).slice(2)}`, type, summary: (summary || type).slice(0, 40), data }
}

interface PagesListProps {
  onNavigate: (s: Screen, id?: string) => void
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
  const { siteId, pages, refresh, role } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { search, setSearch, filter, setFilter, visible, statusFilter } = usePageFilters()
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
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

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Страницы"
        actions={<Button variant="primary" onClick={() => onNavigate('page-editor', 'new')}><IconPlus size={12} />Добавить страницу</Button>}
        filters={<FilterTabs tabs={statusFilter} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search pages…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-surface border border-border rounded p-12 text-center">
          <p className="text-[13px] text-text-subtle mb-3">No pages match your filter.</p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('page-editor', 'new')}><IconPlus size={12} /> Add page</Button>
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
                    <button onClick={() => onNavigate('page-editor', page.id)} className="text-[13px] font-medium text-text hover:text-accent transition-colors text-left">{page.title}</button>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle mono">{page.slug || '/'}</td>
                  <td className="px-4 py-2"><Badge variant={uiStatus(page.status)} /></td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle whitespace-nowrap">{formatDate(page.updatedAt)}</td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle">Editor</td>
                  <td className="px-4 py-2 text-right w-10">
                    <DropdownMenu
                      trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:bg-surface-hover hover:text-text-muted transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                      items={[
                        { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('page-editor', page.id) },
                        { label: page.isHomepage ? 'Home' : 'Preview', icon: <IconEye size={12} />, onClick: () => { const url = page.isHomepage ? `/showcase/${page.site?.previewToken || ''}` : `/showcase/${page.site?.previewToken || ''}/${page.slug}`; window.open(url, '_blank') } },
                        { label: 'Duplicate', icon: <IconCopy size={12} />, onClick: () => {} },
                        { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(page.id), danger: true, divider: true },
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

function SideSection({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return <div className={`px-5 py-4 ${noBorder ? '' : 'border-b border-border'}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-3">{title}</p>{children}</div>
}

interface PageEditorProps {
  pageId?: string | null
  onNavigate: (s: Screen) => void
}

function defaultPageBlocks(): BlockUi[] {
  return [
    { id: 'b1', type: 'Hero', summary: 'Hero block', data: { heading: 'Надёжный партнёр в строительстве', subheading: 'Опыт более 20 лет. Работаем по всей Беларуси.', buttonLabel: 'Связаться с нами', buttonUrl: '/contacts' } },
    { id: 'b2', type: 'Services', summary: 'Services listing', data: {} },
    { id: 'b3', type: 'Projects', summary: 'Projects listing', data: {} },
  ]
}

export function PageEditor({ pageId, onNavigate }: PageEditorProps) {
  const { siteId, site, settings, pages, refresh } = useStudio()
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

  useEffect(() => {
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
        onNavigate('pages')
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

  const active = blocks.find(b => b.id === activeBlock)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-surface border-b border-border px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate('pages')} className="flex items-center gap-1 text-[12px] text-text-subtle hover:text-text transition-colors whitespace-nowrap flex-shrink-0"><IconChevronLeft size={13} />Pages</button>
          <span className="text-text-subtle flex-shrink-0">/</span>
          <span className="text-[13px] font-medium text-text truncate">{title || 'New page'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <div className="flex items-center justify-center flex-shrink-0"><SaveIndicator state={saveState} /></div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => { const token = site?.previewToken || ''; window.open(slug ? `/showcase/${token}/${slug}` : `/showcase/${token}`, '_blank') }}><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-bg p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-surface border border-border rounded px-5 py-4">
              <input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Page title" className="w-full text-[20px] font-semibold text-text placeholder-text-subtle bg-transparent border-0 focus:outline-none leading-tight" />
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
                {blocks.map(block => {
                  const isActive = activeBlock === block.id
                  return (
                    <div key={block.id} className={`bg-surface border rounded overflow-hidden transition-all ${isActive ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border hover:border-border'}`}>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer group/row" onClick={() => setActiveBlock(isActive ? null : block.id)}>
                        <span className="text-text-subtle hover:text-text-muted cursor-grab flex-shrink-0" onClick={e => e.stopPropagation()}><IconGrip size={13} /></span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest w-[60px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-text-subtle'}`}>{block.type}</span>
                        <span className="flex-1 text-[13px] text-text-muted truncate min-w-0">{block.summary}</span>
                        <div className="flex items-center gap-px opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => duplicateBlock(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover transition-colors"><IconCopy size={11} /></button>
                          <button onClick={() => removeBlock(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-danger hover:bg-danger-subtle transition-colors"><IconX size={11} /></button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-raised">
                          <div className="pt-3 flex flex-col gap-2.5">
                            {block.type === 'Hero' && (
                              <>
                                <Input label="Heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} />
                                <Input label="Subheading" value={block.data.subheading || ''} onChange={v => updateBlockData(block.id, { subheading: v })} />
                                <div className="grid grid-cols-2 gap-2.5">
                                  <Input label="Primary button" value={block.data.buttonLabel || ''} onChange={v => updateBlockData(block.id, { buttonLabel: v })} />
                                  <Input label="Button link" value={block.data.buttonUrl || ''} onChange={v => updateBlockData(block.id, { buttonUrl: v })} />
                                </div>
                              </>
                            )}
                            {block.type === 'Text' && (
                              <>
                                <Input label="Section heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} />
                                <Textarea label="Content" value={block.data.content || ''} onChange={v => updateBlockData(block.id, { content: v })} rows={4} />
                              </>
                            )}
                            {block.type === 'Image' && (
                              <>
                                <Input label="Media ID or URL" value={block.data.imageId || ''} onChange={v => updateBlockData(block.id, { imageId: v })} />
                                <Input label="Caption" value={block.data.caption || ''} onChange={v => updateBlockData(block.id, { caption: v })} />
                              </>
                            )}
                            {block.type === 'Gallery' && (
                              <>
                                <Textarea label="Image IDs (one per line)" value={(block.data.imageIds || []).join('\n')} onChange={v => updateBlockData(block.id, { imageIds: v.split('\n').map(s => s.trim()).filter(Boolean) })} rows={4} />
                              </>
                            )}
                            {(block.type === 'Projects' || block.type === 'Services' || block.type === 'News') && (
                              <Select label="Number of items" value={String(block.data.limit ?? '')} onChange={v => updateBlockData(block.id, { limit: v === 'all' ? '' : Number(v) })} options={[{ value: '', label: 'All' }, { value: '3', label: '3' }, { value: '6', label: '6' }, { value: '9', label: '9' }]} />
                            )}
                            {block.type === 'CTA' && (
                              <>
                                <Input label="Heading" value={block.data.heading || ''} onChange={v => updateBlockData(block.id, { heading: v })} />
                                <Textarea label="Description" value={block.data.description || ''} onChange={v => updateBlockData(block.id, { description: v })} rows={3} />
                                <div className="grid grid-cols-2 gap-2.5">
                                  <Input label="Button label" value={block.data.buttonLabel || ''} onChange={v => updateBlockData(block.id, { buttonLabel: v })} />
                                  <Input label="Button link" value={block.data.buttonUrl || ''} onChange={v => updateBlockData(block.id, { buttonUrl: v })} />
                                </div>
                              </>
                            )}
                            {block.type === 'Contacts' && (
                              <Input label="Heading" value={block.data.heading || 'Контакты'} onChange={v => updateBlockData(block.id, { heading: v })} />
                            )}
                            {['Team', 'Stats', 'Map'].includes(block.type) && (
                              <p className="text-[12px] text-text-subtle py-0.5">This block displays automatically — no settings required.</p>
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
            <Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/" />
            <p className="text-[11px] text-text-subtle mono mt-2 truncate">{settings?.companyName || site?.domain || 'site'}/{slug || '<slug>'}</p>
          </SideSection>

          <SideSection title="Visibility">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isHomepage} onChange={e => { setIsHomepage(e.target.checked); markDirty() }} className="w-3.5 h-3.5 accent-accent" />
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
