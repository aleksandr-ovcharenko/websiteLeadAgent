import { useState, useMemo, useEffect } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconEye, IconX, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'

interface ProjectsListProps {
  onNavigate: (s: Screen, id?: string) => void
}

function useProjectFilters() {
  const { projects } = useStudio()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const visible = useMemo(() => projects.filter((p: any) => {
    const matchFilter = filter === 'all' || (filter === 'draft' && uiStatus(p.status) === 'draft') || (filter === 'completed' && p.projectStatus === 'completed') || (filter === 'in-progress' && p.projectStatus === 'in-progress')
    const q = search.toLowerCase()
    const matchSearch = (p.title || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q)
    return matchFilter && matchSearch
  }), [projects, search, filter])

  const tabs = [
    { label: 'All', value: 'all' },
    { label: 'Completed', value: 'completed' },
    { label: 'In progress', value: 'in-progress' },
    { label: 'Draft', value: 'draft' },
  ]

  return { search, setSearch, filter, setFilter, visible, tabs }
}

export function ProjectsList({ onNavigate }: ProjectsListProps) {
  const { siteId, projects, refresh, site } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { search, setSearch, filter, setFilter, visible, tabs } = useProjectFilters()
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await api.deleteProject(siteId, deleteId); await refresh(); show('Project deleted') } catch (e: any) { show(e.message || 'Failed') }
    setDeleteId(null)
  }

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Объекты"
        actions={<Button variant="primary" onClick={() => onNavigate('project-editor', 'new')}><IconPlus size={12} />Добавить объект</Button>}
        filters={<FilterTabs tabs={tabs} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />}
      />

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['Project', 'Location', 'Project status', 'Published', 'Updated', ''].map(col => <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((project: any) => (
              <tr key={project.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                      {project.coverImageId ? <img src={`/api/cms/sites/${siteId}/media`} alt="" className="w-full h-full object-cover" onError={() => undefined} /> : null}
                    </div>
                    <button onClick={() => onNavigate('project-editor', project.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors text-left">{project.title}</button>
                  </div>
                </td>
                <td className="px-4 py-2 text-[12px] text-gray-400 max-w-[180px] truncate">{project.location}</td>
                <td className="px-4 py-2"><Badge variant={project.projectStatus === 'completed' ? 'published' : 'draft'} /></td>
                <td className="px-4 py-2"><Badge variant={uiStatus(project.status)} /></td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{formatDate(project.updatedAt)}</td>
                <td className="px-4 py-2 w-10 text-right">
                  <DropdownMenu
                    trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                    items={[
                      { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('project-editor', project.id) },
                      { label: 'Preview', icon: <IconEye size={12} />, onClick: () => window.open(`/showcase/${site?.previewToken || ''}/projects/${project.slug}`, '_blank') },
                      { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(project.id), danger: true, divider: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDelete open={!!deleteId} title="Удалить объект?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
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

interface ProjectEditorProps {
  projectId?: string | null
  onNavigate: (s: Screen) => void
}

export function ProjectEditor({ projectId, onNavigate }: ProjectEditorProps) {
  const { siteId, projects, refresh, site } = useStudio()
  const isNew = !projectId || projectId === 'new'
  const project = isNew ? null : projects.find((p: any) => p.id === projectId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [projectStatus, setProjectStatus] = useState<'completed' | 'in-progress'>('completed')
  const [pubStatus, setPubStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [content, setContent] = useState('')
  const [coverImageId, setCoverImageId] = useState('')
  const [galleryImageIds, setGalleryImageIds] = useState<string[]>([])
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [uploading, setUploading] = useState(false)
  const { toast, show } = useToast()

  useEffect(() => {
    if (project) {
      setTitle(project.title || ''); setSlug(project.slug || ''); setExcerpt(project.excerpt || ''); setCategory(project.category || ''); setLocation(project.location || '')
      setCompletionDate(project.completionDate ? new Date(project.completionDate).toISOString().slice(0, 10) : '')
      setProjectStatus(project.projectStatus === 'completed' ? 'completed' : 'in-progress')
      setPubStatus(uiStatus(project.status))
      setCoverImageId(project.coverImageId || '')
      setGalleryImageIds((project.projectMedia || []).map((m: any) => m.media?.id || m.mediaId).filter(Boolean))
      setContent((project.blocks || []).map((b: any) => b.content || '').join('\n\n'))
      setSeoTitle(project.seoTitle || ''); setSeoDesc(project.seoDescription || '')
    } else {
      setTitle(''); setSlug(''); setExcerpt(''); setCategory(''); setLocation(''); setCompletionDate(''); setProjectStatus('completed'); setPubStatus('draft'); setContent(''); setCoverImageId(''); setGalleryImageIds([]); setSeoTitle(''); setSeoDesc('')
    }
    setSaveState('saved')
  }, [projectId, project])

  const markDirty = () => setSaveState('unsaved')

  const blocksFromContent = (text: string) => text.split(/\n{2,}/).filter(Boolean).map((content: string) => ({ type: 'text', content }))

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload: any = { title, slug, excerpt, category, location, completionDate, blocks: blocksFromContent(content), projectStatus, coverImageId, galleryImageIds, seoTitle, seoDescription: seoDesc, status: publish ? 'PUBLISHED' : apiStatus(pubStatus) }
      if (isNew) { await api.createProject(siteId, payload); show(publish ? 'Project published' : 'Project saved') }
      else { await api.updateProject(siteId, project!.id, payload); show(publish ? 'Project updated' : 'Project saved') }
      await refresh(); onNavigate('projects')
    } catch (e: any) { show(e.message || 'Failed to save'); setSaveState('unsaved') }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (id: string) => void) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const { media } = await api.uploadMedia(siteId, file); setter(media.id); markDirty(); show('Image uploaded') } catch (e: any) { show(e.message) }
    setUploading(false)
  }

  const addGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const { media } = await api.uploadMedia(siteId, file); setGalleryImageIds(ids => [...ids, media.id]); markDirty(); show('Image added') } catch (e: any) { show(e.message) }
    setUploading(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate('projects')} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"><IconChevronLeft size={13} />Projects</button>
          <span className="text-gray-200">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New project'}</span>
          <span className="flex-shrink-0"><Badge variant={pubStatus} /></span>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => window.open(`/showcase/${site?.previewToken || ''}/projects/${slug}`, '_blank')}><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{pubStatus === 'published' ? 'Update' : 'Publish'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Project title" className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight" />
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[11px] text-gray-400 mono">{site?.domain || 'site'}/</span>
                <input value={slug} onChange={e => { setSlug(e.target.value); markDirty() }} placeholder="project-slug" className="flex-1 text-[11px] text-gray-500 mono bg-transparent border-0 focus:outline-none placeholder-gray-300 min-w-0" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Project status" value={projectStatus} onChange={v => { setProjectStatus(v as any); markDirty() }} options={[{ value: 'completed', label: 'Completed' }, { value: 'in-progress', label: 'In progress' }]} />
                <Input label="Completion date" type="date" value={completionDate} onChange={v => { setCompletionDate(v); markDirty() }} />
              </div>
              <Input label="Category" value={category} onChange={v => { setCategory(v); markDirty() }} placeholder="e.g. Industrial, Residential" />
              <Input label="Location" value={location} onChange={v => { setLocation(v); markDirty() }} placeholder="City, address" />
              <Textarea label="Short description" value={excerpt} onChange={v => { setExcerpt(v); markDirty() }} rows={2} placeholder="Shown in project cards and listings…" />
            </div>

            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3">
              <label className="text-[12px] font-medium text-gray-600">Full description</label>
              <textarea value={content} onChange={e => { setContent(e.target.value); markDirty() }} placeholder="Detailed description of the project — scope, technology, timeline, results…" rows={8} className="w-full border-0 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none resize-y leading-relaxed" />
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cover image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                {coverImageId && <p className="text-[12px] text-gray-600 mb-2 mono">{coverImageId} <button onClick={() => { setCoverImageId(''); markDirty() }} className="ml-2 text-red-500">Remove</button></p>}
                <label className="h-[120px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <input type="file" accept="image/*" onChange={e => upload(e, setCoverImageId)} className="hidden" />
                  {uploading ? 'Uploading…' : <><IconUpload size={18} /><span className="text-[12px]">Click to upload cover</span><span className="text-[11px] text-gray-300">JPG, PNG — recommended 1600×900</span></>}
                </label>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Gallery</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {galleryImageIds.map((id, i) => (
                    <div key={id} className="relative aspect-[4/3] rounded overflow-hidden bg-gray-100 group/img">
                      <img src={`/api/cms/sites/${siteId}/media`} alt="" className="w-full h-full object-cover" onError={() => undefined} />
                      <button onClick={() => { setGalleryImageIds(imgs => imgs.filter((_, j) => j !== i)); markDirty() }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><IconX size={9} /></button>
                    </div>
                  ))}
                  <label className="aspect-[4/3] rounded border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] hover:bg-emerald-50/20 transition-colors cursor-pointer">
                    <input type="file" accept="image/*" onChange={addGallery} className="hidden" />
                    <IconPlus size={14} /><span className="text-[11px]">Add photo</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication"><Select label="Status" value={pubStatus} onChange={v => { setPubStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]} /></SideSection>
          <SideSection title="SEO">
            <Input label="Title" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty() }} placeholder="Defaults to project title" />
            <div className="flex flex-col gap-1 mt-3"><label className="text-[12px] font-medium text-gray-600">Description</label><textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); markDirty() }} rows={3} placeholder="Brief description for search results" className="w-full border border-gray-300 rounded text-[12px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none leading-relaxed" /><p className="text-[10px] text-gray-400 text-right">{seoDesc.length}/160</p></div>
          </SideSection>
          {!isNew && (
            <SideSection title="Danger zone" noBorder>
              <button onClick={async () => { try { await api.deleteProject(siteId, project!.id); await refresh(); onNavigate('projects') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">Delete project</button>
            </SideSection>
          )}
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
