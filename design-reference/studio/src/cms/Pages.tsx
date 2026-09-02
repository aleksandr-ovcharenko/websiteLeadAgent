import { useState } from 'react'
import { Screen } from './types'
import { IconEdit, IconEye, IconCopy, IconTrash, IconMore, IconChevronLeft, IconGrip, IconPlus, IconX, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'

interface PageItem {
  id: string; title: string; slug: string; status: 'published' | 'draft' | 'archived'; updated: string; author: string
}

const PAGES: PageItem[] = [
  { id: '1', title: 'Главная', slug: '/', status: 'published', updated: 'Today, 14:32', author: 'Admin' },
  { id: '2', title: 'О компании', slug: '/about', status: 'published', updated: 'Yesterday, 11:45', author: 'Admin' },
  { id: '3', title: 'Контакты', slug: '/contacts', status: 'published', updated: '22 Aug', author: 'Admin' },
  { id: '4', title: 'Услуги', slug: '/services', status: 'published', updated: '20 Aug', author: 'Editor' },
  { id: '5', title: 'Объекты', slug: '/projects', status: 'published', updated: '18 Aug', author: 'Admin' },
  { id: '6', title: 'Новости', slug: '/news', status: 'published', updated: '18 Aug', author: 'Admin' },
  { id: '7', title: 'Вакансии', slug: '/vacancies', status: 'draft', updated: '15 Aug', author: 'Editor' },
  { id: '8', title: 'Политика конфиденциальности', slug: '/privacy', status: 'archived', updated: '10 Aug', author: 'Admin' },
]

const STATUS_FILTER = [
  { label: 'All', value: 'all', count: 8 },
  { label: 'Published', value: 'published', count: 6 },
  { label: 'Draft', value: 'draft', count: 1 },
  { label: 'Archived', value: 'archived', count: 1 },
]

interface PagesListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function PagesList({ onNavigate }: PagesListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pages, setPages] = useState(PAGES)

  const visible = pages.filter(p => {
    const matchFilter = filter === 'all' || p.status === filter
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Страницы"
        actions={
          <Button variant="primary" onClick={() => onNavigate('page-editor', 'new')}>
            <IconPlus size={12} />
            Добавить страницу
          </Button>
        }
        filters={<FilterTabs tabs={STATUS_FILTER} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search pages…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <p className="text-[13px] text-gray-400 mb-3">No pages match your filter.</p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('page-editor', 'new')}><IconPlus size={12} /> Add page</Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Title', 'Slug', 'Status', 'Updated', 'Author', ''].map(col => (
                  <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(page => (
                <tr key={page.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                  <td className="px-4 py-2">
                    <button onClick={() => onNavigate('page-editor', page.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors text-left">{page.title}</button>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 mono">{page.slug}</td>
                  <td className="px-4 py-2"><Badge variant={page.status} /></td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{page.updated}</td>
                  <td className="px-4 py-2 text-[12px] text-gray-400">{page.author}</td>
                  <td className="px-4 py-2 text-right w-10">
                    <DropdownMenu
                      trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                      items={[
                        { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('page-editor', page.id) },
                        { label: 'Preview', icon: <IconEye size={12} />, onClick: () => {} },
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
        onConfirm={() => { setPages(p => p.filter(x => x.id !== deleteId)); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

// ─── Page Editor ──────────────────────────────────────────────────────────────

type SaveState = 'saved' | 'saving' | 'unsaved'

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return (
    <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
      <span className="inline-block w-3 h-3 rounded-full border border-gray-300 border-t-gray-500 animate-spin" />
      Saving…
    </span>
  )
  if (state === 'unsaved') return (
    <span className="flex items-center gap-1.5 text-[12px] text-amber-500">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      Unsaved changes
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
      <IconCheck size={12} className="text-emerald-500 flex-shrink-0" />
      Saved
    </span>
  )
}

function SideSection({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div className={`px-5 py-4 ${noBorder ? '' : 'border-b border-gray-100'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">{title}</p>
      {children}
    </div>
  )
}

interface PageEditorProps {
  pageId?: string | null
  onNavigate: (s: Screen) => void
}

const BLOCK_TYPES = ['Hero', 'Text', 'Image', 'Gallery', 'Services', 'Projects', 'News', 'CTA', 'Contacts', 'Team', 'Stats', 'Map']

const INITIAL_BLOCKS = [
  { id: 'b1', type: 'Hero', summary: 'Строительная компания с опытом 20 лет' },
  { id: 'b2', type: 'Text', summary: 'О нас — основной текст' },
  { id: 'b3', type: 'Services', summary: 'Наши услуги (все)' },
  { id: 'b4', type: 'Projects', summary: 'Последние объекты (6)' },
  { id: 'b5', type: 'CTA', summary: 'Свяжитесь с нами' },
]

export function PageEditor({ pageId, onNavigate }: PageEditorProps) {
  const isNew = !pageId || pageId === 'new'
  const page = isNew ? null : PAGES.find(p => p.id === pageId)

  const [title, setTitle] = useState(page?.title ?? '')
  const [slug, setSlug] = useState(page?.slug ?? '')
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>(page?.status ?? 'draft')
  const [blocks, setBlocks] = useState(isNew ? [] : INITIAL_BLOCKS)
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [addOpen, setAddOpen] = useState(false)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [showInNav, setShowInNav] = useState(true)
  const { toast, show } = useToast()

  const markDirty = () => setSaveState('unsaved')

  const handleSave = () => {
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Changes saved') }, 700)
  }

  const handlePublish = () => {
    setStatus('published')
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Page published') }, 700)
  }

  const removeBlock = (id: string) => { setBlocks(b => b.filter(x => x.id !== id)); markDirty() }
  const duplicateBlock = (id: string) => {
    const block = blocks.find(b => b.id === id)
    if (block) { setBlocks(b => [...b, { ...block, id: `b${Date.now()}` }]); markDirty() }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => onNavigate('pages')}
            className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <IconChevronLeft size={13} />
            Pages
          </button>
          <span className="text-gray-200 flex-shrink-0">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New page'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <div className="flex items-center justify-center flex-shrink-0">
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm"><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={handleSave}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={handlePublish}>
            {status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content — ~70% */}
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">

            {/* Title block */}
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); markDirty() }}
                placeholder="Page title"
                className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight"
              />
              <p className="text-[11px] text-gray-400 mono mt-2">
                garantk.by{slug ? (slug.startsWith('/') ? slug : '/' + slug) : '/<slug>'}
              </p>
            </div>

            {/* Content blocks */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Page content</p>

              {blocks.length === 0 && !addOpen && (
                <div className="bg-white border border-dashed border-gray-300 rounded px-5 py-8 text-center mb-1">
                  <p className="text-[13px] text-gray-400 mb-3">This page has no content blocks yet.</p>
                  <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                    <IconPlus size={12} />
                    Add first block
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-px">
                {blocks.map(block => {
                  const isActive = activeBlock === block.id
                  return (
                    <div
                      key={block.id}
                      className={`bg-white border rounded overflow-hidden transition-all ${
                        isActive
                          ? 'border-[#16a34a] shadow-[0_0_0_1px_rgba(22,163,74,0.12)]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Block header row */}
                      <div
                        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer group/row"
                        onClick={() => setActiveBlock(isActive ? null : block.id)}
                      >
                        <span
                          className="text-gray-300 hover:text-gray-500 cursor-grab flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <IconGrip size={13} />
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest w-[60px] flex-shrink-0 ${isActive ? 'text-[#16a34a]' : 'text-gray-400'}`}>
                          {block.type}
                        </span>
                        <span className="flex-1 text-[13px] text-gray-600 truncate min-w-0">{block.summary}</span>
                        <div
                          className="flex items-center gap-px opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => duplicateBlock(block.id)}
                            title="Duplicate block"
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <IconCopy size={11} />
                          </button>
                          <button
                            onClick={() => removeBlock(block.id)}
                            title="Remove block"
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <IconX size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded edit fields */}
                      {isActive && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-[#fafafa]">
                          <div className="pt-3 flex flex-col gap-2.5">
                            {block.type === 'Hero' && (
                              <>
                                <Input label="Heading" value="Надёжный партнёр в строительстве" onChange={markDirty} />
                                <Input label="Subheading" value="Опыт более 20 лет. Работаем по всей Беларуси." onChange={markDirty} />
                                <div className="grid grid-cols-2 gap-2.5">
                                  <Input label="Primary button" value="Связаться с нами" onChange={markDirty} />
                                  <Input label="Button link" value="/contacts" onChange={markDirty} />
                                </div>
                              </>
                            )}
                            {block.type === 'Text' && (
                              <>
                                <Input label="Section heading" value="О компании" onChange={markDirty} />
                                <Textarea label="Content" value="ООО «ГАРАНТ КАЧЕСТВА» — строительная компания с более чем 20-летним опытом." onChange={markDirty} rows={4} />
                              </>
                            )}
                            {block.type === 'Projects' && (
                              <div className="grid grid-cols-2 gap-2.5">
                                <Select
                                  label="Number of items"
                                  value="6"
                                  onChange={markDirty}
                                  options={[{value:'3',label:'3'},{value:'6',label:'6'},{value:'9',label:'9'},{value:'all',label:'All'}]}
                                />
                                <Select
                                  label="Filter"
                                  value="all"
                                  onChange={markDirty}
                                  options={[{value:'all',label:'All'},{value:'completed',label:'Completed'},{value:'in-progress',label:'In progress'}]}
                                />
                              </div>
                            )}
                            {block.type === 'Services' && (
                              <Select
                                label="Display style"
                                value="grid"
                                onChange={markDirty}
                                options={[{value:'grid',label:'Grid'},{value:'list',label:'List'}]}
                              />
                            )}
                            {block.type === 'CTA' && (
                              <>
                                <Input label="Heading" value="Готовы начать проект?" onChange={markDirty} />
                                <div className="grid grid-cols-2 gap-2.5">
                                  <Input label="Button label" value="Связаться" onChange={markDirty} />
                                  <Input label="Button link" value="/contacts" onChange={markDirty} />
                                </div>
                              </>
                            )}
                            {['Image', 'Gallery', 'News', 'Contacts', 'Team', 'Stats', 'Map'].includes(block.type) && (
                              <p className="text-[12px] text-gray-400 py-0.5">
                                This block displays automatically — no settings required.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add block */}
              <div className="mt-1">
                {addOpen ? (
                  <div className="bg-white border border-gray-200 rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-semibold text-gray-800">Choose a block type</p>
                      <button
                        onClick={() => setAddOpen(false)}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BLOCK_TYPES.map(bt => (
                        <button
                          key={bt}
                          onClick={() => {
                            const newBlock = { id: `b${Date.now()}`, type: bt, summary: '…' }
                            setBlocks(b => [...b, newBlock])
                            setActiveBlock(newBlock.id)
                            setAddOpen(false)
                            markDirty()
                          }}
                          className="flex items-center justify-center h-8 px-2 rounded border border-gray-200 text-[12px] text-gray-600 hover:border-[#16a34a] hover:text-[#16a34a] hover:bg-emerald-50/30 transition-colors"
                        >
                          {bt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded border border-dashed border-gray-300 text-[13px] text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] hover:bg-emerald-50/20 transition-colors"
                  >
                    <IconPlus size={12} />
                    Add block
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings sidebar — ~30% */}
        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication">
            <Select
              label="Status"
              value={status}
              onChange={v => { setStatus(v as 'published' | 'draft' | 'archived'); markDirty() }}
              options={[{value:'published',label:'Published'},{value:'draft',label:'Draft'},{value:'archived',label:'Archived'}]}
            />
          </SideSection>

          <SideSection title="URL">
            <Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/" />
            <p className="text-[11px] text-gray-400 mono mt-2 truncate">
              garantk.by{slug ? (slug.startsWith('/') ? slug : '/' + slug) : '/<slug>'}
            </p>
          </SideSection>

          <SideSection title="Visibility">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInNav}
                onChange={e => { setShowInNav(e.target.checked); markDirty() }}
                className="w-3.5 h-3.5 accent-[#16a34a]"
              />
              <span className="text-[12px] text-gray-700">Show in navigation</span>
            </label>
          </SideSection>

          <SideSection title="SEO">
            <div className="flex flex-col gap-3">
              <Input
                label="Title"
                value={seoTitle}
                onChange={v => { setSeoTitle(v); markDirty() }}
                placeholder="Defaults to page title"
              />
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-gray-600">Description</label>
                <textarea
                  value={seoDesc}
                  onChange={e => { setSeoDesc(e.target.value); markDirty() }}
                  placeholder="Brief description for search results"
                  rows={3}
                  className="w-full border border-gray-300 rounded text-[12px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none leading-relaxed"
                />
                <p className="text-[10px] text-gray-400 text-right">{seoDesc.length}/160</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-gray-600">Social image</label>
                <div className="h-[72px] border border-dashed border-gray-300 rounded flex items-center justify-center gap-2 text-[12px] text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors">
                  <IconUpload size={13} />
                  Upload image
                </div>
              </div>
            </div>
          </SideSection>

          <SideSection title="Danger zone" noBorder>
            <div className="flex flex-col gap-0.5">
              <button className="text-left text-[12px] text-gray-500 hover:text-amber-600 transition-colors py-1.5">
                Archive this page
              </button>
              <button className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">
                Delete page permanently
              </button>
            </div>
          </SideSection>
        </aside>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
