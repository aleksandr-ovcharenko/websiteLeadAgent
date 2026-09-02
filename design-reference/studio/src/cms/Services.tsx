import { useState } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconGrip, IconCopy, IconX, IconCheck, IconUpload } from './icons'
import { Badge, Button, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'

interface ServiceItem {
  id: string; order: number; title: string; status: 'published' | 'draft'; updated: string
}

const SERVICES_DATA: ServiceItem[] = [
  { id: '1', order: 1, title: 'Земляные работы', status: 'published', updated: '22 Aug' },
  { id: '2', order: 2, title: 'Геодезические работы', status: 'published', updated: '20 Aug' },
  { id: '3', order: 3, title: 'Прокладка коммуникаций', status: 'published', updated: '20 Aug' },
  { id: '4', order: 4, title: 'Строительство фундаментов', status: 'published', updated: '18 Aug' },
  { id: '5', order: 5, title: 'Монолитные работы', status: 'published', updated: '18 Aug' },
  { id: '6', order: 6, title: 'Общестроительные работы', status: 'published', updated: '15 Aug' },
  { id: '7', order: 7, title: 'Благоустройство территорий', status: 'published', updated: '15 Aug' },
  { id: '8', order: 8, title: 'Демонтажные работы', status: 'draft', updated: '10 Aug' },
]

const CONTENT_BLOCK_TYPES = ['Text', 'Gallery', 'Features list', 'Equipment', 'FAQ', 'CTA']

interface ServicesListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function ServicesList({ onNavigate }: ServicesListProps) {
  const [items, setItems] = useState(SERVICES_DATA)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  return (
    <div className="p-5 max-w-[760px]">
      <Toolbar
        title="Услуги"
        actions={
          <Button variant="primary" onClick={() => onNavigate('service-editor', 'new')}>
            <IconPlus size={12} />
            Добавить услугу
          </Button>
        }
      />

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['', '#', 'Title', 'Status', 'Updated', ''].map((col, i) => (
                <th key={i} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                <td className="pl-4 py-2 pr-0 w-7">
                  <span className="text-gray-300 hover:text-gray-400 cursor-grab"><IconGrip size={13} /></span>
                </td>
                <td className="px-3 py-2 w-10 text-[11px] text-gray-400 mono">{String(item.order).padStart(2, '0')}</td>
                <td className="px-4 py-2">
                  <button onClick={() => onNavigate('service-editor', item.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors">{item.title}</button>
                </td>
                <td className="px-4 py-2"><Badge variant={item.status} /></td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{item.updated}</td>
                <td className="px-4 py-2 w-10 text-right">
                  <DropdownMenu
                    trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                    items={[
                      { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('service-editor', item.id) },
                      { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(item.id), danger: true, divider: true },
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
        title="Удалить услугу?"
        onConfirm={() => { setItems(s => s.filter(x => x.id !== deleteId)); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

// ─── Service Editor ───────────────────────────────────────────────────────────

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

interface ServiceEditorProps {
  serviceId?: string | null
  onNavigate: (s: Screen) => void
}

export function ServiceEditor({ serviceId, onNavigate }: ServiceEditorProps) {
  const isNew = !serviceId || serviceId === 'new'
  const item = isNew ? null : SERVICES_DATA.find(s => s.id === serviceId)

  const [title, setTitle] = useState(item?.title ?? '')
  const [slug, setSlug] = useState(isNew ? '' : `services/${serviceId}`)
  const [shortDesc, setShortDesc] = useState('')
  const [status, setStatus] = useState<'published' | 'draft'>(item?.status ?? 'draft')
  const [orderNum, setOrderNum] = useState(item?.order?.toString() ?? '')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [blocks, setBlocks] = useState<Array<{ id: string; type: string; summary: string }>>(
    isNew ? [] : [
      { id: 'sb1', type: 'Text', summary: 'Description and scope of work' },
      { id: 'sb2', type: 'Features list', summary: 'What is included' },
    ]
  )
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const { toast, show } = useToast()

  const markDirty = () => setSaveState('unsaved')

  const handleSave = () => {
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Service saved') }, 700)
  }

  const handlePublish = () => {
    setStatus('published')
    setSaveState('saving')
    setTimeout(() => { setSaveState('saved'); show('Service published') }, 700)
  }

  const removeBlock = (id: string) => { setBlocks(b => b.filter(x => x.id !== id)); markDirty() }
  const duplicateBlock = (id: string) => {
    const block = blocks.find(b => b.id === id)
    if (block) { setBlocks(b => [...b, { ...block, id: `sb${Date.now()}` }]); markDirty() }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => onNavigate('services')}
            className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <IconChevronLeft size={13} />
            Services
          </button>
          <span className="text-gray-200 flex-shrink-0">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New service'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <div className="flex items-center justify-center flex-shrink-0">
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm"><IconEdit size={12} />Preview</Button>
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

            {/* Title + description */}
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); markDirty() }}
                placeholder="Service title"
                className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight"
              />
              <div className="mt-3 pt-3 border-t border-gray-100">
                <textarea
                  value={shortDesc}
                  onChange={e => { setShortDesc(e.target.value); markDirty() }}
                  placeholder="Short description — shown in service cards on the site"
                  rows={2}
                  className="w-full text-[13px] text-gray-600 placeholder-gray-300 bg-transparent border-0 focus:outline-none resize-none leading-relaxed"
                />
                <p className="text-[11px] text-gray-400 text-right mt-1">{shortDesc.length}/240</p>
              </div>
            </div>

            {/* Service image */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Service image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="h-[120px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <IconUpload size={18} />
                  <span className="text-[12px]">Click to upload or drag image here</span>
                  <span className="text-[11px] text-gray-300">JPG, PNG — recommended 800×600</span>
                </div>
              </div>
            </div>

            {/* Content blocks */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Content</p>

              {blocks.length === 0 && !addOpen && (
                <div className="bg-white border border-dashed border-gray-300 rounded px-5 py-6 text-center mb-1">
                  <p className="text-[13px] text-gray-400 mb-3">Add content sections — descriptions, feature lists, galleries.</p>
                  <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                    <IconPlus size={12} />
                    Add section
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
                        <span className={`text-[10px] font-bold uppercase tracking-widest w-[72px] flex-shrink-0 ${isActive ? 'text-[#16a34a]' : 'text-gray-400'}`}>
                          {block.type}
                        </span>
                        <span className="flex-1 text-[13px] text-gray-600 truncate min-w-0">{block.summary}</span>
                        <div
                          className="flex items-center gap-px opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => duplicateBlock(block.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <IconCopy size={11} />
                          </button>
                          <button
                            onClick={() => removeBlock(block.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <IconX size={11} />
                          </button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-[#fafafa]">
                          <div className="pt-3 flex flex-col gap-2.5">
                            {block.type === 'Text' && (
                              <>
                                <Input label="Section heading" value="" onChange={markDirty} placeholder="Optional heading" />
                                <Textarea label="Content" value="" onChange={markDirty} rows={5} placeholder="Section text…" />
                              </>
                            )}
                            {block.type === 'Features list' && (
                              <Textarea label="Features" value="" onChange={markDirty} rows={4} placeholder={"One feature per line:\nFast delivery\nCertified staff\nGuaranteed quality"} />
                            )}
                            {block.type === 'Gallery' && (
                              <div className="h-20 border border-dashed border-gray-300 rounded flex items-center justify-center gap-2 text-[12px] text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors">
                                <IconPlus size={13} />
                                Add gallery images
                              </div>
                            )}
                            {block.type === 'FAQ' && (
                              <Textarea label="Questions & Answers" value="" onChange={markDirty} rows={4} placeholder={"Q: How long does it take?\nA: It depends on scope.\n\nQ: Do you work on weekends?\nA: Yes, by arrangement."} />
                            )}
                            {block.type === 'CTA' && (
                              <>
                                <Input label="Heading" value="" onChange={markDirty} placeholder="Call-to-action text" />
                                <div className="grid grid-cols-2 gap-2.5">
                                  <Input label="Button label" value="" onChange={markDirty} />
                                  <Input label="Button link" value="/contacts" onChange={markDirty} />
                                </div>
                              </>
                            )}
                            {block.type === 'Equipment' && (
                              <Textarea label="Equipment list" value="" onChange={markDirty} rows={4} placeholder="List your equipment or tools, one per line" />
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
                      <p className="text-[12px] font-semibold text-gray-800">Choose a content section</p>
                      <button
                        onClick={() => setAddOpen(false)}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CONTENT_BLOCK_TYPES.map(bt => (
                        <button
                          key={bt}
                          onClick={() => {
                            const newBlock = { id: `sb${Date.now()}`, type: bt, summary: '…' }
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
                    Add section
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication">
            <Select
              label="Status"
              value={status}
              onChange={v => { setStatus(v as 'published' | 'draft'); markDirty() }}
              options={[{value:'published',label:'Published'},{value:'draft',label:'Draft'}]}
            />
          </SideSection>

          <SideSection title="Display order">
            <Input
              label="Order"
              type="number"
              value={orderNum}
              onChange={v => { setOrderNum(v); markDirty() }}
              placeholder="1"
            />
            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              Lower numbers appear first in service listings.
            </p>
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
                placeholder="Defaults to service title"
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
                Delete service
              </button>
            </div>
          </SideSection>
        </aside>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
