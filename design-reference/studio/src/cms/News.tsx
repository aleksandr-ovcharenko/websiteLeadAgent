import { useState } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconEye, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'

interface NewsItem {
  id: string; title: string; publishDate: string; status: 'published' | 'draft'; updated: string
}

const NEWS_DATA: NewsItem[] = [
  { id: '1', title: 'Компания завершила строительство производственного комплекса', publishDate: '28 Aug 2026', status: 'published', updated: 'Today, 11:20' },
  { id: '2', title: 'Новости компании за август', publishDate: '', status: 'draft', updated: 'Yesterday, 18:10' },
  { id: '3', title: 'ГАРАНТ КАЧЕСТВА получил сертификат ISO 9001', publishDate: '15 Aug 2026', status: 'published', updated: '15 Aug' },
  { id: '4', title: 'Открытие нового офиса в Бресте', publishDate: '10 Aug 2026', status: 'published', updated: '10 Aug' },
  { id: '5', title: 'Участие в строительной выставке BATIMAT 2026', publishDate: '05 Aug 2026', status: 'published', updated: '5 Aug' },
  { id: '6', title: 'Приглашаем на день открытых дверей', publishDate: '01 Aug 2026', status: 'published', updated: '1 Aug' },
]

const FILTER_TABS = [
  { label: 'All', value: 'all', count: 6 },
  { label: 'Published', value: 'published', count: 5 },
  { label: 'Draft', value: 'draft', count: 1 },
]

interface NewsListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function NewsList({ onNavigate }: NewsListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [items, setItems] = useState(NEWS_DATA)

  const visible = items.filter(n => {
    const matchFilter = filter === 'all' || n.status === filter
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Новости"
        actions={
          <Button variant="primary" onClick={() => onNavigate('news-editor', 'new')}>
            <IconPlus size={12} />
            Добавить новость
          </Button>
        }
        filters={<FilterTabs tabs={FILTER_TABS} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search news…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <p className="text-[13px] text-gray-400 mb-3">У вас пока нет новостей.</p>
          <Button variant="primary" onClick={() => onNavigate('news-editor', 'new')}>
            <IconPlus size={12} />
            Добавить первую новость
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Title', 'Published', 'Status', 'Updated', ''].map(col => (
                  <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(item => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                  <td className="px-4 py-2">
                    <button onClick={() => onNavigate('news-editor', item.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors text-left">{item.title}</button>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{item.publishDate || '—'}</td>
                  <td className="px-4 py-2"><Badge variant={item.status} /></td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{item.updated}</td>
                  <td className="px-4 py-2 w-10 text-right">
                    <DropdownMenu
                      trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                      items={[
                        { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('news-editor', item.id) },
                        { label: 'Preview', icon: <IconEye size={12} />, onClick: () => {} },
                        { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(item.id), danger: true, divider: true },
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
        title="Удалить новость?"
        onConfirm={() => { setItems(n => n.filter(x => x.id !== deleteId)); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

// ─── News Editor ──────────────────────────────────────────────────────────────

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

interface NewsEditorProps {
  newsId?: string | null
  onNavigate: (s: Screen) => void
}

export function NewsEditor({ newsId, onNavigate }: NewsEditorProps) {
  const isNew = !newsId || newsId === 'new'
  const item = isNew ? null : NEWS_DATA.find(n => n.id === newsId)

  const [title, setTitle] = useState(item?.title ?? '')
  const [slug, setSlug] = useState(isNew ? '' : `news/${newsId}`)
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [publishDate, setPublishDate] = useState(item?.publishDate ?? '')
  const [status, setStatus] = useState<'published' | 'draft'>(item?.status ?? 'draft')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const { toast, show } = useToast()

  const markDirty = () => setSaveState('unsaved')

  const handleSave = () => {
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Article saved') }, 700)
  }

  const handlePublish = () => {
    setStatus('published')
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Article published') }, 700)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => onNavigate('news')}
            className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <IconChevronLeft size={13} />
            News
          </button>
          <span className="text-gray-200 flex-shrink-0">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New article'}</span>
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
        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">

            {/* Title + Excerpt — combined writing area */}
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); markDirty() }}
                placeholder="Article title"
                className="w-full text-[22px] font-semibold text-gray-900 placeholder-gray-200 bg-transparent border-0 focus:outline-none leading-tight"
              />
              <div className="mt-3 pt-3 border-t border-gray-100">
                <textarea
                  value={excerpt}
                  onChange={e => { setExcerpt(e.target.value); markDirty() }}
                  placeholder="Short summary — shown in article listings and social previews"
                  rows={2}
                  className="w-full text-[14px] text-gray-500 placeholder-gray-300 bg-transparent border-0 focus:outline-none resize-none leading-relaxed"
                />
                <p className="text-[11px] text-gray-400 text-right mt-1">{excerpt.length}/280</p>
              </div>
            </div>

            {/* Cover image */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cover image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="h-[120px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <IconUpload size={18} />
                  <span className="text-[12px]">Click to upload or drag image here</span>
                  <span className="text-[11px] text-gray-300">JPG, PNG — recommended 1200×630</span>
                </div>
              </div>
            </div>

            {/* Article content */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Article content</p>
              <div className="bg-white border border-gray-200 rounded overflow-hidden">
                {/* Minimal writing toolbar */}
                <div className="flex items-center gap-px px-3 py-1.5 border-b border-gray-100 bg-gray-50">
                  <button className="flex items-center justify-center w-7 h-7 rounded text-[12px] font-bold text-gray-500 hover:bg-white hover:shadow-sm transition-all">B</button>
                  <button className="flex items-center justify-center w-7 h-7 rounded text-[12px] italic font-serif text-gray-500 hover:bg-white hover:shadow-sm transition-all">I</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] font-semibold text-gray-500 hover:bg-white hover:shadow-sm transition-all">H2</button>
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] font-semibold text-gray-500 hover:bg-white hover:shadow-sm transition-all">H3</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] text-gray-500 hover:bg-white hover:shadow-sm transition-all">Link</button>
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] text-gray-500 hover:bg-white hover:shadow-sm transition-all">List</button>
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] text-gray-400 hover:bg-white hover:shadow-sm transition-all">" "</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] text-gray-500 hover:bg-white hover:shadow-sm transition-all">
                    <IconUpload size={11} />
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={e => { setContent(e.target.value); markDirty() }}
                  placeholder="Write the full article here. Use the toolbar above for formatting."
                  rows={14}
                  className="w-full border-0 px-5 py-4 text-[14px] text-gray-800 placeholder-gray-300 focus:outline-none resize-y leading-[1.75]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication">
            <div className="flex flex-col gap-3">
              <Select
                label="Status"
                value={status}
                onChange={v => { setStatus(v as 'published' | 'draft'); markDirty() }}
                options={[{value:'published',label:'Published'},{value:'draft',label:'Draft'}]}
              />
              <Input
                label="Publication date"
                type="date"
                value={publishDate}
                onChange={v => { setPublishDate(v); markDirty() }}
              />
            </div>
          </SideSection>

          <SideSection title="URL">
            <Input
              label="Slug"
              value={slug}
              onChange={v => { setSlug(v); markDirty() }}
              prefix="/"
            />
            <p className="text-[11px] text-gray-400 mono mt-2 truncate">
              garantk.by/{slug || '<slug>'}
            </p>
          </SideSection>

          <SideSection title="SEO">
            <div className="flex flex-col gap-3">
              <Input
                label="Title"
                value={seoTitle}
                onChange={v => { setSeoTitle(v); markDirty() }}
                placeholder="Defaults to article title"
              />
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-gray-600">Description</label>
                <textarea
                  value={seoDesc}
                  onChange={e => { setSeoDesc(e.target.value); markDirty() }}
                  placeholder="Defaults to excerpt"
                  rows={3}
                  className="w-full border border-gray-300 rounded text-[12px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none leading-relaxed"
                />
                <p className="text-[10px] text-gray-400 text-right">{seoDesc.length}/160</p>
              </div>
            </div>
          </SideSection>

          <SideSection title="Danger zone" noBorder>
            <div className="flex flex-col gap-0.5">
              <button className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">
                Delete article
              </button>
            </div>
          </SideSection>
        </aside>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
