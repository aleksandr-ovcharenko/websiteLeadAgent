import { useState } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconEye, IconX, IconCheck, IconUpload } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'

interface ProjectItem {
  id: string; title: string; location: string; projectStatus: 'completed' | 'in-progress'; pubStatus: 'published' | 'draft' | 'archived'; updated: string
}

const PROJECTS: ProjectItem[] = [
  { id: '1', title: 'Производственный комплекс', location: 'Минск, ул. Промышленная 12', projectStatus: 'completed', pubStatus: 'published', updated: 'Today, 14:32' },
  { id: '2', title: 'Жилой комплекс «Зеленый берег»', location: 'Брест, ул. Набережная 5', projectStatus: 'completed', pubStatus: 'published', updated: 'Yesterday' },
  { id: '3', title: 'Офисный центр Бизнес-Парк', location: 'Гомель, пр. Независимости 44', projectStatus: 'in-progress', pubStatus: 'published', updated: '22 Aug' },
  { id: '4', title: 'Складской комплекс логистика', location: 'Минск, ул. Аэродромная 8', projectStatus: 'in-progress', pubStatus: 'draft', updated: '20 Aug' },
  { id: '5', title: 'Торговый центр «Меркурий»', location: 'Витебск, пл. Победы 1', projectStatus: 'completed', pubStatus: 'published', updated: '18 Aug' },
  { id: '6', title: 'Геодезические работы, микрорайон Запад-1', location: 'Гродно', projectStatus: 'completed', pubStatus: 'published', updated: '15 Aug' },
]

const FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'In progress', value: 'in-progress' },
  { label: 'Draft', value: 'draft' },
]

const THUMB_IDS = ['1486325212027-8081e485255e','1504307651254-35680f356dfd','1541888946425-d81bb19240f5','1558618666-fcd25c85cd64','1486406146926-c627a92ad1ab','1503594384566-461ead0a48b5']

interface ProjectsListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function ProjectsList({ onNavigate }: ProjectsListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [projects, setProjects] = useState(PROJECTS)

  const visible = projects.filter(p => {
    const matchFilter = filter === 'all'
      || (filter === 'draft' && p.pubStatus === 'draft')
      || (filter === 'completed' && p.projectStatus === 'completed')
      || (filter === 'in-progress' && p.projectStatus === 'in-progress')
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Объекты"
        actions={
          <Button variant="primary" onClick={() => onNavigate('project-editor', 'new')}>
            <IconPlus size={12} />
            Добавить объект
          </Button>
        }
        filters={<FilterTabs tabs={FILTER_TABS} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />}
      />

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['Project', 'Location', 'Project status', 'Published', 'Updated', ''].map(col => (
                <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((project, idx) => (
              <tr key={project.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                      <img
                        src={`https://images.unsplash.com/photo-${THUMB_IDS[idx % THUMB_IDS.length]}?w=64&h=64&fit=crop&auto=format`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button onClick={() => onNavigate('project-editor', project.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors text-left">{project.title}</button>
                  </div>
                </td>
                <td className="px-4 py-2 text-[12px] text-gray-400 max-w-[180px] truncate">{project.location}</td>
                <td className="px-4 py-2"><Badge variant={project.projectStatus} /></td>
                <td className="px-4 py-2"><Badge variant={project.pubStatus} /></td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{project.updated}</td>
                <td className="px-4 py-2 w-10 text-right">
                  <DropdownMenu
                    trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                    items={[
                      { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('project-editor', project.id) },
                      { label: 'Preview', icon: <IconEye size={12} />, onClick: () => {} },
                      { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(project.id), danger: true, divider: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDelete
        open={!!deleteId}
        title="Удалить объект?"
        onConfirm={() => { setProjects(p => p.filter(x => x.id !== deleteId)); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

// ─── Project Editor ───────────────────────────────────────────────────────────

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

interface ProjectEditorProps {
  projectId?: string | null
  onNavigate: (s: Screen) => void
}

export function ProjectEditor({ projectId, onNavigate }: ProjectEditorProps) {
  const isNew = !projectId || projectId === 'new'
  const project = isNew ? null : PROJECTS.find(p => p.id === projectId)

  const [title, setTitle] = useState(project?.title ?? '')
  const [slug, setSlug] = useState(isNew ? '' : `projects/${project?.id}`)
  const [location, setLocation] = useState(project?.location ?? '')
  const [projectStatus, setProjectStatus] = useState<'completed' | 'in-progress'>(project?.projectStatus ?? 'completed')
  const [pubStatus, setPubStatus] = useState<'published' | 'draft' | 'archived'>(project?.pubStatus ?? 'draft')
  const [completionDate, setCompletionDate] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [galleryImages, setGalleryImages] = useState<string[]>(
    isNew ? [] : [THUMB_IDS[0], THUMB_IDS[1], THUMB_IDS[2]]
  )
  const { toast, show } = useToast()

  const markDirty = () => setSaveState('unsaved')

  const handleSave = () => {
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Project saved') }, 700)
  }

  const handlePublish = () => {
    setPubStatus('published')
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Project published') }, 700)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => onNavigate('projects')}
            className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <IconChevronLeft size={13} />
            Projects
          </button>
          <span className="text-gray-200 flex-shrink-0">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New project'}</span>
          <span className="flex-shrink-0"><Badge variant={pubStatus} /></span>
        </div>
        <div className="flex items-center justify-center flex-shrink-0">
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm"><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={handleSave}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={handlePublish}>
            {pubStatus === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">

            {/* Title + Slug */}
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); markDirty() }}
                placeholder="Project title"
                className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight"
              />
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[11px] text-gray-400 mono">garantk.by/</span>
                <input
                  value={slug}
                  onChange={e => { setSlug(e.target.value); markDirty() }}
                  placeholder="project-slug"
                  className="flex-1 text-[11px] text-gray-500 mono bg-transparent border-0 focus:outline-none placeholder-gray-300 min-w-0"
                />
              </div>
            </div>

            {/* Project information */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Project information</p>
              <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Project status"
                    value={projectStatus}
                    onChange={v => { setProjectStatus(v as 'completed' | 'in-progress'); markDirty() }}
                    options={[{value:'completed',label:'Completed'},{value:'in-progress',label:'In progress'}]}
                  />
                  <Input
                    label="Completion date"
                    type="date"
                    value={completionDate}
                    onChange={v => { setCompletionDate(v); markDirty() }}
                  />
                </div>
                <Input
                  label="Location"
                  value={location}
                  onChange={v => { setLocation(v); markDirty() }}
                  placeholder="City, address"
                />
                <Textarea
                  label="Short description"
                  value={excerpt}
                  onChange={v => { setExcerpt(v); markDirty() }}
                  rows={2}
                  placeholder="Shown in project cards and listings…"
                />
              </div>
            </div>

            {/* Cover image */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cover image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="h-[144px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <IconUpload size={18} />
                  <span className="text-[12px]">Click to upload or drag image here</span>
                  <span className="text-[11px] text-gray-300">JPG, PNG — recommended 1600×900</span>
                </div>
              </div>
            </div>

            {/* Gallery */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Gallery</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="grid grid-cols-4 gap-2">
                  {galleryImages.map((id, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded overflow-hidden bg-gray-100 group/img">
                      <img
                        src={`https://images.unsplash.com/photo-${id}?w=200&h=150&fit=crop&auto=format`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => { setGalleryImages(imgs => imgs.filter((_,j) => j !== i)); markDirty() }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <IconX size={9} />
                      </button>
                      <div className="absolute bottom-1 left-1 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-grab">
                        <div className="w-5 h-5 rounded bg-black/40 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                            <circle cx="3" cy="3" r="1"/><circle cx="7" cy="3" r="1"/>
                            <circle cx="3" cy="7" r="1"/><circle cx="7" cy="7" r="1"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setGalleryImages(imgs => [...imgs, THUMB_IDS[(imgs.length + 3) % THUMB_IDS.length]])
                      markDirty()
                    }}
                    className="aspect-[4/3] rounded border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] hover:bg-emerald-50/20 transition-colors"
                  >
                    <IconPlus size={14} />
                    <span className="text-[11px]">Add photo</span>
                  </button>
                </div>
                {galleryImages.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-2">Drag to reorder. First image appears as the gallery cover.</p>
                )}
              </div>
            </div>

            {/* Full description */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Full description</p>
              <div className="bg-white border border-gray-200 rounded overflow-hidden">
                <div className="flex items-center gap-px px-3 py-1.5 border-b border-gray-100 bg-gray-50">
                  <button className="flex items-center justify-center w-7 h-7 rounded text-[12px] font-bold text-gray-500 hover:bg-white hover:shadow-sm transition-all">B</button>
                  <button className="flex items-center justify-center w-7 h-7 rounded text-[12px] italic font-serif text-gray-500 hover:bg-white hover:shadow-sm transition-all">I</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] font-semibold text-gray-500 hover:bg-white hover:shadow-sm transition-all">H2</button>
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] font-semibold text-gray-500 hover:bg-white hover:shadow-sm transition-all">H3</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] text-gray-500 hover:bg-white hover:shadow-sm transition-all">Link</button>
                  <button className="flex items-center justify-center h-7 px-2 rounded text-[11px] text-gray-500 hover:bg-white hover:shadow-sm transition-all">List</button>
                </div>
                <textarea
                  value={description}
                  onChange={e => { setDescription(e.target.value); markDirty() }}
                  placeholder="Detailed description of the project — scope, technology, timeline, results…"
                  rows={8}
                  className="w-full border-0 px-4 py-3 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none resize-y leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication">
            <Select
              label="Status"
              value={pubStatus}
              onChange={v => { setPubStatus(v as 'published' | 'draft' | 'archived'); markDirty() }}
              options={[{value:'published',label:'Published'},{value:'draft',label:'Draft'},{value:'archived',label:'Archived'}]}
            />
          </SideSection>

          <SideSection title="Category">
            <Input
              label="Category"
              value={category}
              onChange={v => { setCategory(v); markDirty() }}
              placeholder="e.g. Industrial, Residential"
            />
          </SideSection>

          <SideSection title="SEO">
            <div className="flex flex-col gap-3">
              <Input
                label="Title"
                value={seoTitle}
                onChange={v => { setSeoTitle(v); markDirty() }}
                placeholder="Defaults to project title"
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
            </div>
          </SideSection>

          <SideSection title="Danger zone" noBorder>
            <div className="flex flex-col gap-0.5">
              <button className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">
                Delete project
              </button>
            </div>
          </SideSection>
        </aside>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
