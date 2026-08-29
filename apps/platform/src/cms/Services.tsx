import { useState, useMemo, useEffect } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconGrip, IconCopy, IconX, IconCheck, IconUpload, IconEye } from './icons'
import { Badge, Button, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'

interface ServicesListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function ServicesList({ onNavigate }: ServicesListProps) {
  const { siteId, services, refresh } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await api.deleteService(siteId, deleteId); await refresh(); show('Service deleted') } catch (e: any) { show(e.message || 'Failed') }
    setDeleteId(null)
  }

  return (
    <div className="p-5 max-w-[760px]">
      <Toolbar title="Услуги" actions={<Button variant="primary" onClick={() => onNavigate('service-editor', 'new')}><IconPlus size={12} />Добавить услугу</Button>} />

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['', '#', 'Title', 'Status', 'Updated', ''].map((col, i) => <th key={i} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {services.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((item: any, idx: number) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                <td className="pl-4 py-2 pr-0 w-7"><span className="text-gray-300 hover:text-gray-400 cursor-grab"><IconGrip size={13} /></span></td>
                <td className="px-3 py-2 w-10 text-[11px] text-gray-400 mono">{String(idx + 1).padStart(2, '0')}</td>
                <td className="px-4 py-2"><button onClick={() => onNavigate('service-editor', item.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors">{item.title}</button></td>
                <td className="px-4 py-2"><Badge variant={uiStatus(item.status)} /></td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
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

      <ConfirmDelete open={!!deleteId} title="Удалить услугу?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
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

interface ServiceEditorProps {
  serviceId?: string | null
  onNavigate: (s: Screen) => void
}

export function ServiceEditor({ serviceId, onNavigate }: ServiceEditorProps) {
  const { siteId, services, refresh, site } = useStudio()
  const isNew = !serviceId || serviceId === 'new'
  const item = isNew ? null : services.find((s: any) => s.id === serviceId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [status, setStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [orderNum, setOrderNum] = useState('')
  const [content, setContent] = useState('')
  const [imageId, setImageId] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [uploading, setUploading] = useState(false)
  const { toast, show } = useToast()

  useEffect(() => {
    if (item) {
      setTitle(item.title || ''); setSlug(item.slug || ''); setShortDesc(item.shortDescription || ''); setStatus(uiStatus(item.status)); setOrderNum(String(item.sortOrder || 0))
      setContent((item.blocks || []).map((b: any) => b.content || '').join('\n\n'))
      setImageId(item.imageId || ''); setSeoTitle(item.seoTitle || ''); setSeoDesc(item.seoDescription || '')
    } else {
      setTitle(''); setSlug(''); setShortDesc(''); setStatus('draft'); setOrderNum(''); setContent(''); setImageId(''); setSeoTitle(''); setSeoDesc('')
    }
    setSaveState('saved')
  }, [serviceId, item])

  const markDirty = () => setSaveState('unsaved')

  const blocksFromContent = (text: string) => text.split(/\n{2,}/).filter(Boolean).map((content: string) => ({ type: 'text', content }))

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload: any = { title, slug, shortDescription: shortDesc, blocks: blocksFromContent(content), imageId, sortOrder: Number(orderNum) || 0, seoTitle, seoDescription: seoDesc, status: publish ? 'PUBLISHED' : apiStatus(status) }
      if (isNew) { await api.createService(siteId, payload); show(publish ? 'Service published' : 'Service saved') }
      else { await api.updateService(siteId, item!.id, payload); show(publish ? 'Service updated' : 'Service saved') }
      await refresh(); onNavigate('services')
    } catch (e: any) { show(e.message || 'Failed to save'); setSaveState('unsaved') }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const { media } = await api.uploadMedia(siteId, file); setImageId(media.id); markDirty(); show('Image uploaded') } catch (e: any) { show(e.message) }
    setUploading(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate('services')} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"><IconChevronLeft size={13} />Services</button>
          <span className="text-gray-200">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New service'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => window.open(`/showcase/${site?.previewToken || ''}/services`, '_blank')}><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Service title" className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight" />
              <div className="mt-3 pt-3 border-t border-gray-100">
                <textarea value={shortDesc} onChange={e => { setShortDesc(e.target.value); markDirty() }} placeholder="Short description — shown in service cards on the site" rows={2} className="w-full text-[13px] text-gray-600 placeholder-gray-300 bg-transparent border-0 focus:outline-none resize-none leading-relaxed" />
                <p className="text-[11px] text-gray-400 text-right mt-1">{shortDesc.length}/240</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Service image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                {imageId && <p className="text-[12px] text-gray-600 mb-2 mono">{imageId} <button onClick={() => { setImageId(''); markDirty() }} className="ml-2 text-red-500">Remove</button></p>}
                <label className="h-[120px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <input type="file" accept="image/*" onChange={upload} className="hidden" />
                  {uploading ? 'Uploading…' : <><IconUpload size={18} /><span className="text-[12px]">Click to upload or drag image here</span><span className="text-[11px] text-gray-300">JPG, PNG — recommended 800×600</span></>}
                </label>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3">
              <label className="text-[12px] font-medium text-gray-600">Full description</label>
              <textarea value={content} onChange={e => { setContent(e.target.value); markDirty() }} placeholder="Detailed description of the service…" rows={8} className="w-full border-0 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none resize-y leading-relaxed" />
            </div>
          </div>
        </div>

        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication"><Select label="Status" value={status} onChange={v => { setStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }]} /></SideSection>
          <SideSection title="Display order"><Input label="Order" type="number" value={orderNum} onChange={v => { setOrderNum(v); markDirty() }} placeholder="1" /></SideSection>
          <SideSection title="URL"><Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/" /></SideSection>
          <SideSection title="SEO">
            <Input label="Title" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty() }} placeholder="Defaults to service title" />
            <div className="flex flex-col gap-1 mt-3"><label className="text-[12px] font-medium text-gray-600">Description</label><textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); markDirty() }} rows={3} placeholder="Brief description for search results" className="w-full border border-gray-300 rounded text-[12px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none leading-relaxed" /><p className="text-[10px] text-gray-400 text-right">{seoDesc.length}/160</p></div>
          </SideSection>
          {!isNew && (
            <SideSection title="Danger zone" noBorder>
              <button onClick={async () => { try { await api.deleteService(siteId, item!.id); await refresh(); onNavigate('services') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">Delete service</button>
            </SideSection>
          )}
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
