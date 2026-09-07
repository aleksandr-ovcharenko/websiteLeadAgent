import { useState, useMemo, useEffect } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconEye, IconCheck } from './icons'
import { Badge, Button, SearchInput, FilterTabs, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'

interface VacanciesListProps {
  onNavigate: (s: Screen, id?: string) => void
}

function useVacancyFilters() {
  const { vacancies } = useStudio()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => {
    const c = { all: vacancies.length, published: 0, draft: 0, archived: 0 }
    vacancies.forEach((v: any) => { const s = uiStatus(v.status); if (s in c) (c as any)[s]++ })
    return c
  }, [vacancies])

  const visible = useMemo(() => vacancies.filter((v: any) => {
    const s = uiStatus(v.status)
    const matchFilter = filter === 'all' || s === filter
    const q = search.toLowerCase()
    return matchFilter && ((v.title || '').toLowerCase().includes(q) || (v.location || '').toLowerCase().includes(q))
  }), [vacancies, search, filter])

  const statusFilter = useMemo(() => [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Published', value: 'published', count: counts.published },
    { label: 'Draft', value: 'draft', count: counts.draft },
    { label: 'Archived', value: 'archived', count: counts.archived },
  ], [counts])

  return { search, setSearch, filter, setFilter, visible, statusFilter }
}

export function VacanciesList({ onNavigate }: VacanciesListProps) {
  const { siteId, vacancies, refresh } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { search, setSearch, filter, setFilter, visible, statusFilter } = useVacancyFilters()
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await api.deleteVacancy(siteId, deleteId); await refresh(); show('Vacancy deleted') } catch (e: any) { show(e.message || 'Failed') }
    setDeleteId(null)
  }

  return (
    <div className="p-5 max-w-[1060px]">
      <Toolbar
        title="Вакансии"
        actions={<Button variant="primary" onClick={() => onNavigate('vacancy-editor', 'new')}><IconPlus size={12} />Добавить вакансию</Button>}
        filters={<FilterTabs tabs={statusFilter} active={filter} onChange={setFilter} />}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search vacancies…" />}
      />

      {visible.length === 0 ? (
        <div className="bg-surface border border-border rounded p-12 text-center">
          <p className="text-[13px] text-text-subtle mb-3">No vacancies found.</p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('vacancy-editor', 'new')}>Add vacancy</Button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Title', 'Location', 'Status', 'Published', 'Updated', ''].map(col => <th key={col} className="text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-2 bg-surface-raised whitespace-nowrap">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((v: any) => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-surface-raised/60 transition-colors group">
                  <td className="px-4 py-2"><button onClick={() => onNavigate('vacancy-editor', v.id)} className="text-[13px] font-medium text-text hover:text-accent transition-colors text-left">{v.title}</button></td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle">{v.location}</td>
                  <td className="px-4 py-2"><Badge variant={uiStatus(v.status)} /></td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle whitespace-nowrap">{formatDate(v.publishedAt)}</td>
                  <td className="px-4 py-2 text-[12px] text-text-subtle whitespace-nowrap">{formatDate(v.updatedAt)}</td>
                  <td className="px-4 py-2 text-right w-10">
                    <DropdownMenu
                      trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:bg-surface-hover hover:text-text-muted transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                      items={[
                        { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('vacancy-editor', v.id) },
                        { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(v.id), danger: true, divider: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDelete open={!!deleteId} title="Удалить вакансию?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}

type SaveState = 'saved' | 'saving' | 'unsaved'
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-[12px] text-text-subtle"><span className="inline-block w-3 h-3 rounded-full border border-border border-t-gray-500 animate-spin" />Saving…</span>
  if (state === 'unsaved') return <span className="flex items-center gap-1.5 text-[12px] text-warning"><span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />Unsaved changes</span>
  return <span className="flex items-center gap-1.5 text-[12px] text-text-subtle"><IconCheck size={12} className="text-success flex-shrink-0" />Saved</span>
}

interface VacancyEditorProps {
  vacancyId?: string | null
  onNavigate: (s: Screen) => void
}

export function VacancyEditor({ vacancyId, onNavigate }: VacancyEditorProps) {
  const { siteId, vacancies, refresh } = useStudio()
  const isNew = !vacancyId || vacancyId === 'new'
  const item = isNew ? null : vacancies.find((v: any) => v.id === vacancyId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [conditions, setConditions] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const { toast, show } = useToast()

  useEffect(() => {
    if (item) { setTitle(item.title || ''); setSlug(item.slug || ''); setLocation(item.location || ''); setDescription(item.description || ''); setRequirements(item.requirements || ''); setConditions(item.conditions || ''); setContact(item.contact || ''); setStatus(uiStatus(item.status)) }
    else { setTitle(''); setSlug(''); setLocation(''); setDescription(''); setRequirements(''); setConditions(''); setContact(''); setStatus('draft') }
    setSaveState('saved')
  }, [vacancyId, item])

  const markDirty = () => setSaveState('unsaved')

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload: any = { title, slug, location, description, requirements, conditions, contact, status: publish ? 'PUBLISHED' : apiStatus(status) }
      if (isNew) { await api.createVacancy(siteId, payload); show(publish ? 'Vacancy published' : 'Vacancy saved') }
      else { await api.updateVacancy(siteId, item!.id, payload); show(publish ? 'Vacancy updated' : 'Vacancy saved') }
      await refresh(); onNavigate('vacancies')
    } catch (e: any) { show(e.message || 'Failed to save'); setSaveState('unsaved') }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-surface border-b border-border px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate('vacancies')} className="flex items-center gap-1 text-[12px] text-text-subtle hover:text-text transition-colors"><IconChevronLeft size={13} />Vacancies</button>
          <span className="text-text-subtle">/</span>
          <span className="text-[13px] font-medium text-text truncate">{title || 'New vacancy'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-bg p-6">
        <div className="max-w-[680px] mx-auto flex flex-col gap-5">
          <div className="bg-surface border border-border rounded px-5 py-4">
            <input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Vacancy title" className="w-full text-[20px] font-semibold text-text placeholder-text-subtle bg-transparent border-0 focus:outline-none leading-tight" />
          </div>

          <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} />
              <Input label="Location" value={location} onChange={v => { setLocation(v); markDirty() }} placeholder="City, office" />
            </div>
            <Select label="Status" value={status} onChange={v => { setStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]} />
            <Textarea label="Description" value={description} onChange={v => { setDescription(v); markDirty() }} rows={4} placeholder="About the position and responsibilities…" />
            <Textarea label="Requirements" value={requirements} onChange={v => { setRequirements(v); markDirty() }} rows={4} placeholder="Required skills, experience, education…" />
            <Textarea label="Conditions" value={conditions} onChange={v => { setConditions(v); markDirty() }} rows={3} placeholder="Salary, schedule, benefits…" />
            <Input label="Contact" value={contact} onChange={v => { setContact(v); markDirty() }} placeholder="Email or phone for applications" />
          </div>

          {!isNew && (
            <div className="bg-surface border border-border rounded p-4">
              <button onClick={async () => { try { await api.deleteVacancy(siteId, item!.id); await refresh(); onNavigate('vacancies') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-text-muted hover:text-danger transition-colors py-1.5">Delete vacancy</button>
            </div>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
