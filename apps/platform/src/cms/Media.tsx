import { useState, useMemo } from 'react'
import { Screen } from './types'
import { IconGrid, IconList, IconUpload, IconX, IconTrash } from './icons'
import { Button, Input, SearchInput, useToast, Toast } from './ui'
import { useStudio, formatBytes } from './context'
import { api } from './api'

interface MediaProps {
  onNavigate: (s: Screen) => void
}

const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
)

export default function Media({ onNavigate }: MediaProps) {
  const { siteId, media, refresh } = useStudio()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'images' | 'documents'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [edit, setEdit] = useState<{ alt?: string; caption?: string }>({})
  const { toast, show } = useToast()

  const items = useMemo(() => media.map((m: any) => ({
    ...m,
    type: (m.mimeType || '').startsWith('image/') ? 'image' : 'document',
    name: m.originalFilename || m.filename,
    size: formatBytes(m.size),
    url: m.sourceUrl || '',
    dims: m.width && m.height ? `${m.width}×${m.height}` : '—',
    uses: 0,
  })), [media])

  const visible = useMemo(() => items.filter(m => {
    const matchType = typeFilter === 'all' || (typeFilter === 'images' && m.type === 'image') || (typeFilter === 'documents' && m.type === 'document')
    return matchType && m.name.toLowerCase().includes(search.toLowerCase())
  }), [items, search, typeFilter])

  const selectedItem = items.find((m: any) => m.id === selected)

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try { await api.uploadMedia(siteId, file); show(`Uploaded ${file.name}`) } catch (e: any) { show(e.message || 'Upload failed') }
    }
    await refresh()
    setUploading(false); setDragging(false)
  }

  const handleUpdate = async () => {
    if (!selected) return
    try { await api.updateMedia(siteId, selected, edit); await refresh(); show('Updated') } catch (e: any) { show(e.message) }
  }

  const handleDelete = async () => {
    if (!selected) return
    try { await api.deleteMedia(siteId, selected); setSelected(null); await refresh(); show('File deleted') } catch (e: any) { show(e.message) }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
          <h1 className="text-[14px] font-semibold text-gray-900">Media library</h1>
          <div className="flex-1" />

          <div className="flex gap-px">
            {(['all', 'images', 'documents'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`px-2.5 h-[26px] text-[12px] font-medium rounded capitalize transition-colors ${typeFilter === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{t}</button>
            ))}
          </div>

          <SearchInput value={search} onChange={setSearch} placeholder="Search files…" />

          <div className="flex border border-gray-200 rounded overflow-hidden">
            <button onClick={() => setView('grid')} className={`w-7 h-[26px] flex items-center justify-center transition-colors ${view === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'}`}><IconGrid size={12} /></button>
            <button onClick={() => setView('list')} className={`w-7 h-[26px] flex items-center justify-center transition-colors ${view === 'list' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'}`}><IconList size={12} /></button>
          </div>

          <label className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 h-7 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors cursor-pointer">
            <IconUpload size={12} />
            Upload
            <input type="file" multiple accept="image/*,application/pdf" onChange={e => handleUpload(e.target.files)} className="hidden" />
          </label>
        </div>

        <div
          className={`mx-4 mt-3 mb-1 flex-shrink-0 border border-dashed rounded flex items-center justify-center gap-2.5 h-10 transition-colors cursor-pointer text-[12px] ${dragging ? 'border-[#16a34a] bg-emerald-50 text-[#16a34a]' : 'border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400 hover:text-gray-600'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
        >
          <IconUpload size={13} />
          {uploading ? 'Uploading…' : <>Drop files to upload, or <span className="font-medium text-[#16a34a]">browse</span></>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {view === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
              {visible.map((item: any) => (
                <button key={item.id} onClick={() => { setSelected(item.id === selected ? null : item.id); setEdit({ alt: item.alt || '', caption: item.caption || '' }) }} className={`group flex flex-col overflow-hidden rounded border transition-all ${selected === item.id ? 'border-[#16a34a] ring-1 ring-[#16a34a]/20' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="w-full aspect-video bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.type === 'image' ? <img src={item.url} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><DocIcon /></div>}
                  </div>
                  <div className="px-2 py-1.5 bg-white text-left">
                    <p className="text-[11px] text-gray-700 truncate leading-tight">{item.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.size}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['File', 'Type', 'Dimensions', 'Size', ''].map(col => <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50">{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item: any) => (
                    <tr key={item.id} onClick={() => { setSelected(item.id === selected ? null : item.id); setEdit({ alt: item.alt || '', caption: item.caption || '' }) }} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer ${selected === item.id ? 'bg-emerald-50/40' : ''}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          {item.type === 'image' ? <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden flex-shrink-0"><img src={item.url} alt="" className="w-full h-full object-cover" /></div> : <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><DocIcon /></div>}
                          <span className="text-[13px] font-medium text-gray-800">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-[12px] text-gray-400 capitalize">{item.type}</td>
                      <td className="px-4 py-2 text-[12px] text-gray-400 mono">{item.dims}</td>
                      <td className="px-4 py-2 text-[12px] text-gray-400">{item.size}</td>
                      <td className="px-4 py-2 w-10 text-right"><button onClick={e => { e.stopPropagation(); handleDelete() }} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><IconTrash size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedItem && (
        <aside className="w-[260px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <p className="text-[12px] font-semibold text-gray-700">File details</p>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><IconX size={14} /></button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {selectedItem.type === 'image' ? (
              <div className="rounded border border-gray-200 overflow-hidden"><img src={selectedItem.url} alt={selectedItem.name} className="w-full object-cover" /></div>
            ) : (
              <div className="h-24 rounded border border-gray-200 bg-gray-50 flex items-center justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
            )}

            <div className="flex flex-col gap-2">
              {[{ label: 'Filename', value: selectedItem.name }, { label: 'Type', value: selectedItem.type }, { label: 'Dimensions', value: selectedItem.dims }, { label: 'File size', value: selectedItem.size }].map(row => (
                <div key={row.label} className="flex justify-between gap-2 items-baseline">
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{row.label}</span>
                  <span className="text-[12px] text-gray-700 text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3.5 flex flex-col gap-3">
              <Input label="Alt text" value={edit.alt || ''} onChange={v => setEdit(s => ({ ...s, alt: v }))} />
              <Input label="Caption" value={edit.caption || ''} onChange={v => setEdit(s => ({ ...s, caption: v }))} />
              <Button variant="secondary" size="sm" onClick={handleUpdate}>Update</Button>
            </div>

            <button onClick={handleDelete} className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-600 transition-colors"><IconTrash size={12} />Delete file</button>
          </div>
        </aside>
      )}
      <Toast toast={toast} />
    </div>
  )
}
