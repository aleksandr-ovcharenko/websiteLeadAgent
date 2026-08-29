import { useState, useMemo, useEffect } from 'react'
import { Screen } from './types'
import { IconEdit, IconEye, IconMore, IconTrash, IconChevronLeft, IconPlus, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'

interface NewsListProps {
  onNavigate: (s: Screen, id?: string) => void
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
  const { siteId, news, refresh } = useStudio()
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
        actions={<Button variant="primary" onClick={() => onNavigate('news-editor', 'new')}><IconPlus size={12} />Добавить новость</Button>}
        filters={<FilterTabs tabs={statusFilter} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search news…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <p className="text-[13px] text-gray-400 mb-3">No news found.</p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('news-editor', 'new')}>Add news</Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Title', 'Slug', 'Status', 'Updated', ''].map(col => <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((n: any) => (
                <tr key={n.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                  <td className="px-4 py-2"><button onClick={() => onNavigate('news-editor', n.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors text-left">{n.title}</button></td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 mono">{n.slug}</td>
                  <td className="px-4 py-2"><Badge variant={uiStatus(n.status)} /></td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{formatDate(n.updatedAt)}</td>
                  <td className="px-4 py-2 text-right w-10">
                    <DropdownMenu
                      trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                      items={[
                        { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('news-editor', n.id) },
                        { label: 'Preview', icon: <IconEye size={12} />, onClick: () => window.open(`/showcase/${n.site?.previewToken || ''}/news/${n.slug}`, '_blank') },
                        { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(n.id), danger: true, divider: true },
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
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-[12px] text-gray-400"><span className="inline-block w-3 h-3 rounded-full border border-gray-300 border-t-gray-500 animate-spin" />Saving…</span>
  if (state === 'unsaved') return <span className="flex items-center gap-1.5 text-[12px] text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />Unsaved changes</span>
  return <span className="flex items-center gap-1.5 text-[12px] text-gray-400"><IconCheck size={12} className="text-emerald-500 flex-shrink-0" />Saved</span>
}

function SideSection({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return <div className={`px-5 py-4 ${noBorder ? '' : 'border-b border-gray-100'}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">{title}</p>{children}</div>
}

interface NewsEditorProps {
  newsId?: string | null
  onNavigate: (s: Screen) => void
}

export function NewsEditor({ newsId, onNavigate }: NewsEditorProps) {
  const { siteId, news, refresh, site } = useStudio()
  const isNew = !newsId || newsId === 'new'
  const item = isNew ? null : news.find((n: any) => n.id === newsId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [coverImageId, setCoverImageId] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [uploading, setUploading] = useState(false)
  const { toast, show } = useToast()

  useEffect(() => {
    if (item) {
      setTitle(item.title || ''); setSlug(item.slug || ''); setExcerpt(item.excerpt || ''); setStatus(uiStatus(item.status))
      setCoverImageId(item.coverImageId || ''); setSeoTitle(item.seoTitle || ''); setSeoDesc(item.seoDescription || '')
      const text = ((item.blocks || []).map((b: any) => b.content || '').join('\n\n'))
      setContent(text)
    } else {
      setTitle(''); setSlug(''); setExcerpt(''); setContent(''); setStatus('draft'); setCoverImageId(''); setSeoTitle(''); setSeoDesc('')
    }
    setSaveState('saved')
  }, [newsId, item])

  const markDirty = () => setSaveState('unsaved')

  const blocksFromContent = (text: string) => text.split(/\n{2,}/).filter(Boolean).map((content: string) => ({ type: 'text', content }))

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload: any = { title, slug, excerpt, blocks: blocksFromContent(content), coverImageId, seoTitle, seoDescription: seoDesc, status: publish ? 'PUBLISHED' : apiStatus(status) }
      if (isNew) { await api.createNews(siteId, payload); show(publish ? 'News published' : 'News saved') }
      else { await api.updateNews(siteId, item!.id, payload); show(publish ? 'News updated' : 'News saved') }
      await refresh(); onNavigate('news')
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
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate('news')} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"><IconChevronLeft size={13} />News</button>
          <span className="text-gray-200">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New post'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => window.open(slug ? `/showcase/${site?.previewToken || ''}/news/${slug}` : `/showcase/${site?.previewToken || ''}`, '_blank')}><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Post title" className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight" />
            </div>

            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3.5">
              <Textarea label="Excerpt" value={excerpt} onChange={v => { setExcerpt(v); markDirty() }} rows={2} placeholder="Short summary shown in listings…" />
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-gray-600">Content</label>
                <textarea value={content} onChange={e => { setContent(e.target.value); markDirty() }} rows={12} placeholder="Write the post content here. Use blank lines between paragraphs." className="w-full border border-gray-300 rounded text-[13px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-y leading-relaxed" />
                <p className="text-[10px] text-gray-400 text-right">{content.length} chars</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cover image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                {coverImageId ? (
                  <div className="flex items-center gap-3 mb-3">
                    <img src={`/api/cms/sites/${siteId}/media` /* no direct url */} alt="" className="w-16 h-16 object-cover rounded border" onError={() => undefined} />
                    <span className="text-[12px] text-gray-600 mono">{coverImageId}</span>
                    <button onClick={() => { setCoverImageId(''); markDirty() }} className="ml-auto text-red-500 text-[12px]">Remove</button>
                  </div>
                ) : null}
                <label className="h-[120px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  {uploading ? <span className="text-[12px]">Uploading…</span> : <><IconUpload size={18} /><span className="text-[12px]">Click to upload or drag image here</span><span className="text-[11px] text-gray-300">JPG, PNG — recommended 1200×800</span></>}
                </label>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication">
            <Select label="Status" value={status} onChange={v => { setStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]} />
          </SideSection>
          <SideSection title="URL">
            <Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/news/" />
          </SideSection>
          <SideSection title="SEO">
            <Input label="Title" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty() }} placeholder="Defaults to post title" />
            <div className="flex flex-col gap-1 mt-3">
              <label className="text-[12px] font-medium text-gray-600">Description</label>
              <textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); markDirty() }} rows={3} placeholder="Brief description for search results" className="w-full border border-gray-300 rounded text-[12px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none leading-relaxed" />
              <p className="text-[10px] text-gray-400 text-right">{seoDesc.length}/160</p>
            </div>
          </SideSection>
          {!isNew && (
            <SideSection title="Danger zone" noBorder>
              <button onClick={async () => { try { await api.deleteNews(siteId, item!.id); await refresh(); onNavigate('news') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">Delete post</button>
            </SideSection>
          )}
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
