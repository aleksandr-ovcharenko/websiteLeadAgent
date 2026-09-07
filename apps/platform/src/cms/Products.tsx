import { useState, useEffect } from 'react'
import { Screen } from './types'
import { IconEdit, IconTrash, IconMore, IconChevronLeft, IconPlus, IconGrip, IconCheck, IconUpload, IconEye, IconX } from './icons'
import { Badge, Button, DropdownMenu, ConfirmDelete, Input, Textarea, Select, useToast, Toast, Toolbar } from './ui'
import { useStudio, formatDate } from './context'
import { api, uiStatus, apiStatus } from './api'

interface ProductsListProps {
  onNavigate: (s: Screen, id?: string) => void
}

export function ProductsList({ onNavigate }: ProductsListProps) {
  const { siteId, products, refresh } = useStudio()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { show } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await api.deleteProduct(siteId, deleteId); await refresh(); show('Product deleted') } catch (e: any) { show(e.message || 'Failed') }
    setDeleteId(null)
  }

  return (
    <div className="p-5 max-w-[760px]">
      <Toolbar title="Товары" actions={<Button variant="primary" onClick={() => onNavigate('product-editor', 'new')}><IconPlus size={12} />Добавить товар</Button>} />

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['', '#', 'Title', 'Category', 'Status', 'Updated', ''].map((col, i) => <th key={i} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {products.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((item: any, idx: number) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                <td className="pl-4 py-2 pr-0 w-7"><span className="text-gray-300 hover:text-gray-400 cursor-grab"><IconGrip size={13} /></span></td>
                <td className="px-3 py-2 w-10 text-[11px] text-gray-400 mono">{String(idx + 1).padStart(2, '0')}</td>
                <td className="px-4 py-2"><button onClick={() => onNavigate('product-editor', item.id)} className="text-[13px] font-medium text-gray-900 hover:text-[#16a34a] transition-colors">{item.title}</button></td>
                <td className="px-4 py-2 text-[12px] text-gray-500">{item.category || '—'}</td>
                <td className="px-4 py-2"><Badge variant={uiStatus(item.status)} /></td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-2 w-10 text-right">
                  <DropdownMenu
                    trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                    items={[
                      { label: 'Edit', icon: <IconEdit size={12} />, onClick: () => onNavigate('product-editor', item.id) },
                      { label: 'Delete', icon: <IconTrash size={12} />, onClick: () => setDeleteId(item.id), danger: true, divider: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDelete open={!!deleteId} title="Удалить товар?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
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

const attrsToText = (attrs: any) => Object.entries(attrs || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
const textToAttrs = (t: string) => {
  const out: Record<string, string> = {}
  for (const line of t.split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) { const k = line.slice(0, i).trim(); const v = line.slice(i + 1).trim(); if (k && v) out[k] = v }
  }
  return out
}

interface ProductEditorProps {
  productId?: string | null
  onNavigate: (s: Screen) => void
}

const mediaUrlOf = (siteId: string, m: any) => m ? `/site-media/${siteId}/${m.filename}` : ''

export function ProductEditor({ productId, onNavigate }: ProductEditorProps) {
  const { siteId, products, refresh, site, media } = useStudio()
  const isNew = !productId || productId === 'new'
  const item = isNew ? null : products.find((p: any) => p.id === productId)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [attrs, setAttrs] = useState('')
  const [status, setStatus] = useState<ReturnType<typeof uiStatus>>('draft')
  const [orderNum, setOrderNum] = useState('')
  const [content, setContent] = useState('')
  const [imageId, setImageId] = useState('')
  const [galleryIds, setGalleryIds] = useState<string[]>([])
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [uploading, setUploading] = useState(false)
  const { toast, show } = useToast()

  useEffect(() => {
    if (item) {
      setTitle(item.title || ''); setSlug(item.slug || ''); setSummary(item.summary || ''); setCategory(item.category || ''); setPrice(item.price || '')
      setAttrs(attrsToText(item.attributes)); setStatus(uiStatus(item.status)); setOrderNum(String(item.sortOrder || 0))
      setContent((item.blocks || []).map((b: any) => b.content || '').join('\n\n'))
      setImageId(item.coverImageId || ''); setSeoTitle(item.seoTitle || ''); setSeoDesc(item.seoDescription || '')
      setGalleryIds(((item.productMedia || []).map((pm: any) => pm.mediaId || pm.media?.id).filter(Boolean)))
    } else {
      setTitle(''); setSlug(''); setSummary(''); setCategory(''); setPrice(''); setAttrs(''); setStatus('draft'); setOrderNum(''); setContent(''); setImageId(''); setGalleryIds([]); setSeoTitle(''); setSeoDesc('')
    }
    setSaveState('saved')
  }, [productId, item])

  const markDirty = () => setSaveState('unsaved')

  const blocksFromContent = (text: string) => text.split(/\n{2,}/).filter(Boolean).map((content: string) => ({ type: 'text', content }))

  const handleSave = async (publish = false) => {
    setSaveState('saving')
    try {
      const payload: any = { title, slug, summary, category, price, attributes: textToAttrs(attrs), blocks: blocksFromContent(content), coverImageId: imageId || null, gallery: galleryIds, sortOrder: Number(orderNum) || 0, seoTitle, seoDescription: seoDesc, status: publish ? 'PUBLISHED' : apiStatus(status) }
      if (isNew) { await api.createProduct(siteId, payload); show(publish ? 'Product published' : 'Product saved') }
      else { await api.updateProduct(siteId, item!.id, payload); show(publish ? 'Product updated' : 'Product saved') }
      await refresh(); onNavigate('products')
    } catch (e: any) { show(e.message || 'Failed to save'); setSaveState('unsaved') }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cover' | 'gallery' = 'cover') => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const { media: m } = await api.uploadMedia(siteId, file)
      if (target === 'cover') setImageId(m.id)
      else setGalleryIds(g => [...g, m.id])
      markDirty(); show('Image uploaded')
    } catch (e: any) { show(e.message) }
    setUploading(false)
  }

  const coverMedia = (media || []).find((m: any) => m.id === imageId)
  const galleryMedia = galleryIds.map((id) => (media || []).find((m: any) => m.id === id)).filter(Boolean)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate('products')} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"><IconChevronLeft size={13} />Products</button>
          <span className="text-gray-200">/</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{title || 'New product'}</span>
          <span className="flex-shrink-0"><Badge variant={status} /></span>
        </div>
        <SaveIndicator state={saveState} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => window.open(`/showcase/${site?.previewToken || ''}/products`, '_blank')}><IconEye size={12} />Preview</Button>
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save draft</Button>
          <Button variant="primary" size="sm" onClick={() => handleSave(true)}>{status === 'published' ? 'Update' : 'Publish'}</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="max-w-[680px] mx-auto flex flex-col gap-5">
            <div className="bg-white border border-gray-200 rounded px-5 py-4">
              <input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} placeholder="Product title" className="w-full text-[20px] font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 focus:outline-none leading-tight" />
              <div className="mt-3 pt-3 border-t border-gray-100">
                <textarea value={summary} onChange={e => { setSummary(e.target.value); markDirty() }} placeholder="Short summary — shown on product cards" rows={2} className="w-full text-[13px] text-gray-600 placeholder-gray-300 bg-transparent border-0 focus:outline-none resize-none leading-relaxed" />
                <p className="text-[11px] text-gray-400 text-right mt-1">{summary.length}/240</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cover image</p>
              <div className="bg-white border border-gray-200 rounded p-4">
                {coverMedia ? (
                  <div className="mb-3">
                    <img src={mediaUrlOf(siteId, coverMedia)} alt={coverMedia.alt || title} className="w-full max-h-[220px] object-cover rounded border border-gray-100" />
                    <div className="flex items-center gap-3 mt-2">
                      <label className="text-[12px] text-[#16a34a] font-medium cursor-pointer hover:underline">
                        <input type="file" accept="image/*" onChange={(e) => upload(e, 'cover')} className="hidden" />Replace
                      </label>
                      <button onClick={() => { setImageId(''); markDirty() }} className="text-[12px] text-red-500 hover:underline">Remove</button>
                    </div>
                  </div>
                ) : (
                  <label className="h-[120px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                    <input type="file" accept="image/*" onChange={(e) => upload(e, 'cover')} className="hidden" />
                    {uploading ? 'Uploading…' : <><IconUpload size={18} /><span className="text-[12px]">Click to upload or drag image here</span><span className="text-[11px] text-gray-300">JPG, PNG — recommended 800×600</span></>}
                  </label>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Gallery <span className="text-gray-300 normal-case">({galleryMedia.length})</span></p>
              <div className="bg-white border border-gray-200 rounded p-4">
                {galleryMedia.length ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {galleryMedia.map((m: any, i: number) => (
                      <div key={m.id} className="relative group/g">
                        <img src={mediaUrlOf(siteId, m)} alt={m.alt || `${title} ${i + 1}`} className="w-full h-20 object-cover rounded border border-gray-100" />
                        <button
                          onClick={() => { setGalleryIds(g => g.filter((_, j) => j !== i)); markDirty() }}
                          className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full text-gray-500 hover:text-red-500 opacity-0 group-hover/g:opacity-100 transition-opacity flex items-center justify-center"
                          title="Remove from gallery"
                        ><IconX size={11} /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <label className="h-[64px] border border-dashed border-gray-300 rounded flex items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer transition-colors">
                  <input type="file" accept="image/*" onChange={(e) => upload(e, 'gallery')} className="hidden" />
                  {uploading ? 'Uploading…' : <><IconUpload size={14} /><span className="text-[12px]">{galleryMedia.length ? 'Add image' : 'Click to add gallery images'}</span></>}
                </label>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3">
              <label className="text-[12px] font-medium text-gray-600">Specifications (one per line: "Key: Value")</label>
              <textarea value={attrs} onChange={e => { setAttrs(e.target.value); markDirty() }} placeholder={'Площадь: 120 м²\nЭтажность: 1\nКомплектация: Box · Grey box'} rows={4} className="w-full border-0 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none resize-y leading-relaxed font-mono" />
            </div>

            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col gap-3">
              <label className="text-[12px] font-medium text-gray-600">Full description</label>
              <textarea value={content} onChange={e => { setContent(e.target.value); markDirty() }} placeholder="Detailed description of the product…" rows={8} className="w-full border-0 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none resize-y leading-relaxed" />
            </div>
          </div>
        </div>

        <aside className="w-[272px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <SideSection title="Publication"><Select label="Status" value={status} onChange={v => { setStatus(v as any); markDirty() }} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }]} /></SideSection>
          <SideSection title="Catalogue">
            <Input label="Category" value={category} onChange={v => { setCategory(v); markDirty() }} placeholder="Модели домов" />
            <div className="mt-3"><Input label="Price" value={price} onChange={v => { setPrice(v); markDirty() }} placeholder="от 120 000 руб." /></div>
          </SideSection>
          <SideSection title="Display order"><Input label="Order" type="number" value={orderNum} onChange={v => { setOrderNum(v); markDirty() }} placeholder="1" /></SideSection>
          <SideSection title="URL"><Input label="Slug" value={slug} onChange={v => { setSlug(v); markDirty() }} prefix="/products/" /></SideSection>
          <SideSection title="SEO">
            <Input label="Title" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty() }} placeholder="Defaults to product title" />
            <div className="flex flex-col gap-1 mt-3"><label className="text-[12px] font-medium text-gray-600">Description</label><textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); markDirty() }} rows={3} placeholder="Brief description for search results" className="w-full border border-gray-300 rounded text-[12px] text-gray-900 placeholder-gray-400 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none leading-relaxed" /><p className="text-[10px] text-gray-400 text-right">{seoDesc.length}/160</p></div>
          </SideSection>
          {!isNew && (
            <SideSection title="Danger zone" noBorder>
              <button onClick={async () => { try { await api.deleteProduct(siteId, item!.id); await refresh(); onNavigate('products') } catch (e: any) { show(e.message) } }} className="text-left text-[12px] text-gray-500 hover:text-red-600 transition-colors py-1.5">Delete product</button>
            </SideSection>
          )}
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
