import { useState } from 'react'
import { Screen } from './types'
import { IconGrid, IconList, IconUpload, IconX, IconTrash } from './icons'
import { Button, SearchInput } from './ui'

const MEDIA_ITEMS = [
  { id: '1', name: 'hero-main.jpg', type: 'image', size: '248 KB', dims: '1920×1080', uses: 3, url: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=300&fit=crop&auto=format' },
  { id: '2', name: 'production-complex.jpg', type: 'image', size: '312 KB', dims: '1600×900', uses: 1, url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop&auto=format' },
  { id: '3', name: 'office-building.jpg', type: 'image', size: '196 KB', dims: '1200×800', uses: 2, url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=300&fit=crop&auto=format' },
  { id: '4', name: 'construction-site.jpg', type: 'image', size: '421 KB', dims: '2000×1333', uses: 4, url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format' },
  { id: '5', name: 'team-photo.jpg', type: 'image', size: '183 KB', dims: '1600×900', uses: 1, url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop&auto=format' },
  { id: '6', name: 'geodesy-work.jpg', type: 'image', size: '267 KB', dims: '1400×933', uses: 2, url: 'https://images.unsplash.com/photo-1503594384566-461ead0a48b5?w=400&h=300&fit=crop&auto=format' },
  { id: '7', name: 'company-logo.png', type: 'image', size: '42 KB', dims: '400×120', uses: 8, url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop&auto=format' },
  { id: '8', name: 'services-bg.jpg', type: 'image', size: '380 KB', dims: '1920×600', uses: 1, url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format' },
  { id: '9', name: 'license-2024.pdf', type: 'document', size: '1.2 MB', dims: '—', uses: 0, url: '' },
  { id: '10', name: 'certificate-iso.pdf', type: 'document', size: '845 KB', dims: '—', uses: 1, url: '' },
  { id: '11', name: 'project-brochure.pdf', type: 'document', size: '3.4 MB', dims: '—', uses: 0, url: '' },
]

const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
)

interface MediaProps {
  onNavigate: (s: Screen) => void
}

export default function Media({ onNavigate }: MediaProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'images' | 'documents'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [altText, setAltText] = useState('')
  const [dragging, setDragging] = useState(false)

  const selectedItem = MEDIA_ITEMS.find(m => m.id === selected)

  const visible = MEDIA_ITEMS.filter(m => {
    const matchType = typeFilter === 'all' || (typeFilter === 'images' && m.type === 'image') || (typeFilter === 'documents' && m.type === 'document')
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 h-[46px] flex items-center gap-3">
          <h1 className="text-[14px] font-semibold text-gray-900">Media library</h1>
          <div className="flex-1" />

          <div className="flex gap-px">
            {(['all', 'images', 'documents'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 h-[26px] text-[12px] font-medium rounded capitalize transition-colors ${typeFilter === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <SearchInput value={search} onChange={setSearch} placeholder="Search files…" />

          <div className="flex border border-gray-200 rounded overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`w-7 h-[26px] flex items-center justify-center transition-colors ${view === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <IconGrid size={12} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`w-7 h-[26px] flex items-center justify-center transition-colors ${view === 'list' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <IconList size={12} />
            </button>
          </div>

          <Button variant="primary" size="sm">
            <IconUpload size={12} />
            Upload
          </Button>
        </div>

        {/* Drop zone */}
        <div
          className={`mx-4 mt-3 mb-1 flex-shrink-0 border border-dashed rounded flex items-center justify-center gap-2.5 h-10 transition-colors cursor-pointer text-[12px] ${dragging ? 'border-[#16a34a] bg-emerald-50 text-[#16a34a]' : 'border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400 hover:text-gray-600'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={() => setDragging(false)}
        >
          <IconUpload size={13} />
          Drop files to upload, or <span className="font-medium text-[#16a34a]">browse</span>
        </div>

        {/* Media grid/list */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
              {visible.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id === selected ? null : item.id)}
                  className={`group flex flex-col overflow-hidden rounded border transition-all ${selected === item.id ? 'border-[#16a34a] ring-1 ring-[#16a34a]/20' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="w-full aspect-video bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><DocIcon /></div>
                    )}
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
                    {['File', 'Type', 'Dimensions', 'Size', 'Used in', ''].map(col => (
                      <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(item => (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item.id === selected ? null : item.id)}
                      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer ${selected === item.id ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          {item.type === 'image' ? (
                            <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                              <img src={item.url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><DocIcon /></div>
                          )}
                          <span className="text-[13px] font-medium text-gray-800">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-[12px] text-gray-400 capitalize">{item.type}</td>
                      <td className="px-4 py-2 text-[12px] text-gray-400 mono">{item.dims}</td>
                      <td className="px-4 py-2 text-[12px] text-gray-400">{item.size}</td>
                      <td className="px-4 py-2 text-[12px] text-gray-400">{item.uses > 0 ? `${item.uses} place${item.uses !== 1 ? 's' : ''}` : '—'}</td>
                      <td className="px-4 py-2 w-10 text-right">
                        <button className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <IconTrash size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <aside className="w-[260px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <p className="text-[12px] font-semibold text-gray-700">File details</p>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><IconX size={14} /></button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {selectedItem.type === 'image' ? (
              <div className="rounded border border-gray-200 overflow-hidden">
                <img src={selectedItem.url} alt={selectedItem.name} className="w-full object-cover" />
              </div>
            ) : (
              <div className="h-24 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {[
                { label: 'Filename', value: selectedItem.name },
                { label: 'Type', value: selectedItem.type },
                { label: 'Dimensions', value: selectedItem.dims },
                { label: 'File size', value: selectedItem.size },
                { label: 'Usage', value: selectedItem.uses > 0 ? `${selectedItem.uses} place${selectedItem.uses !== 1 ? 's' : ''}` : 'Not used' },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-2 items-baseline">
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{row.label}</span>
                  <span className="text-[12px] text-gray-700 text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3.5 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-gray-600">Alt text</label>
                <input
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  placeholder="Describe this image…"
                  className="h-[30px] w-full border border-gray-300 rounded text-[13px] text-gray-900 placeholder-gray-400 px-2.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-gray-600">Caption</label>
                <input
                  placeholder="Optional caption…"
                  className="h-[30px] w-full border border-gray-300 rounded text-[13px] text-gray-900 placeholder-gray-400 px-2.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                />
              </div>
            </div>

            <button className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-600 transition-colors">
              <IconTrash size={12} />
              Delete file
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
