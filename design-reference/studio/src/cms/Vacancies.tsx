import { useState } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus } from './icons'
import { Badge, Button, DropdownMenu, ConfirmDelete, Tabs, Input, Textarea, Select, UnsavedBar, useToast, Toast, Toolbar } from './ui'

interface VacancyItem {
  id: string; title: string; status: 'published' | 'draft'; location: string; updated: string
}

const VACANCIES_DATA: VacancyItem[] = [
  { id: '1', title: 'Инженер-строитель', status: 'published', location: 'Минск', updated: '20 Aug' },
  { id: '2', title: 'Геодезист', status: 'draft', location: 'Гомель', updated: '15 Aug' },
]

interface VacanciesListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function VacanciesList({ onNavigate }: VacanciesListProps) {
  const [items, setItems] = useState(VACANCIES_DATA)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  return (
    <div className="p-5 max-w-[760px]">
      <Toolbar
        title="Вакансии"
        actions={
          <Button variant="primary" onClick={() => onNavigate('vacancy-editor', 'new')}>
            <IconPlus size={12} />
            Добавить вакансию
          </Button>
        }
      />

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-10 text-center">
          <p className="text-[13px] text-gray-400 mb-3">No vacancies posted yet.</p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('vacancy-editor', 'new')}><IconPlus size={12} /> Add vacancy</Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Title', 'Location', 'Status', 'Updated', ''].map(col => (
                  <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                  <td className="px-4 py-2">
                    <button onClick={() => onNavigate('vacancy-editor', item.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors">{item.title}</button>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-gray-400">{item.location}</td>
                  <td className="px-4 py-2"><Badge variant={item.status} /></td>
                  <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{item.updated}</td>
                  <td className="px-4 py-2 w-10 text-right">
                    <DropdownMenu
                      trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                      items={[
                        { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('vacancy-editor', item.id) },
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
        title="Удалить вакансию?"
        onConfirm={() => { setItems(v => v.filter(x => x.id !== deleteId)); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

// ─── Vacancy Editor ───────────────────────────────────────────────────────────

interface VacancyEditorProps {
  vacancyId?: string | null
  onNavigate: (s: Screen) => void
}

export function VacancyEditor({ vacancyId, onNavigate }: VacancyEditorProps) {
  const isNew = !vacancyId || vacancyId === 'new'
  const item = isNew ? null : VACANCIES_DATA.find(v => v.id === vacancyId)

  const [title, setTitle] = useState(item?.title ?? '')
  const [location, setLocation] = useState(item?.location ?? '')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [conditions, setConditions] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState<'published' | 'draft'>(item?.status ?? 'draft')
  const [publishDate, setPublishDate] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast, show } = useToast()

  const markDirty = () => setDirty(true)
  const handleSave = () => {
    setSaving(true)
    setTimeout(() => { setSaving(false); setDirty(false); show('Vacancy saved') }, 700)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-2">
        <button onClick={() => onNavigate('vacancies')} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors mr-1">
          <IconChevronLeft size={13} />
          Vacancies
        </button>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-[13px] font-medium text-gray-800">{title || 'New vacancy'}</span>
        <Badge variant={status} />
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleSave}>Save draft</Button>
        <Button variant="primary" size="sm" onClick={() => { setStatus('published'); handleSave() }}>Publish</Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-5">
        <div className="max-w-[640px] mx-auto bg-white border border-gray-200 rounded p-5 flex flex-col gap-3.5">
          <Input label="Position title" value={title} onChange={v => { setTitle(v); markDirty() }} placeholder="e.g. Инженер-строитель" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Location" value={location} onChange={v => { setLocation(v); markDirty() }} placeholder="City" />
            <Select
              label="Status"
              value={status}
              onChange={v => { setStatus(v as 'published' | 'draft'); markDirty() }}
              options={[{value:'published',label:'Published'},{value:'draft',label:'Draft'}]}
            />
          </div>
          <Input label="Publish date" type="date" value={publishDate} onChange={v => { setPublishDate(v); markDirty() }} />

          <div className="border-t border-gray-100 pt-3.5 flex flex-col gap-3.5">
            <Textarea label="Description" value={description} onChange={v => { setDescription(v); markDirty() }} rows={4} placeholder="What will the employee do?" />
            <Textarea label="Requirements" value={requirements} onChange={v => { setRequirements(v); markDirty() }} rows={4} placeholder="Required qualifications and experience…" />
            <Textarea label="Conditions" value={conditions} onChange={v => { setConditions(v); markDirty() }} rows={3} placeholder="Salary, schedule, benefits…" />
            <Input label="Contact for applications" value={contact} onChange={v => { setContact(v); markDirty() }} placeholder="Email or phone" />
          </div>
        </div>
      </div>

      <UnsavedBar dirty={dirty} saving={saving} onSave={handleSave} />
      <Toast toast={toast} />
    </div>
  )
}
