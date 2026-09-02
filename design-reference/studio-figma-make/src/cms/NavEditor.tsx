import { useState } from 'react'
import { Screen } from './types'
import { IconGrip, IconEdit, IconTrash, IconPlus, IconChevronRight } from './icons'
import { Button, Input, Select, useToast, Toast } from './ui'

interface NavItem {
  id: string; label: string; url: string; type: 'page' | 'custom'; hidden: boolean; children?: NavItem[]
}

const INITIAL_NAV: NavItem[] = [
  { id: '1', label: 'Главная', url: '/', type: 'page', hidden: false },
  {
    id: '2', label: 'Услуги', url: '/services', type: 'page', hidden: false, children: [
      { id: '2a', label: 'Земляные работы', url: '/services/earthworks', type: 'page', hidden: false },
      { id: '2b', label: 'Геодезические работы', url: '/services/geodesy', type: 'page', hidden: false },
    ]
  },
  { id: '3', label: 'Объекты', url: '/projects', type: 'page', hidden: false },
  { id: '4', label: 'О компании', url: '/about', type: 'page', hidden: false },
  { id: '5', label: 'Новости', url: '/news', type: 'page', hidden: false },
  { id: '6', label: 'Контакты', url: '/contacts', type: 'page', hidden: false },
]

interface NavRowProps {
  item: NavItem; depth?: number; onDelete: (id: string) => void
}

function NavRow({ item, depth = 0, onDelete }: NavRowProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 hover:bg-gray-50 group transition-colors ${item.hidden ? 'opacity-40' : ''}`}
        style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '12px' }}
      >
        <span className="text-gray-300 hover:text-gray-400 cursor-grab flex-shrink-0"><IconGrip size={12} /></span>

        {hasChildren ? (
          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <IconChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="text-[13px] font-medium text-gray-800 truncate">{item.label}</span>
          <span className="text-[11px] text-gray-400 mono truncate">{item.url}</span>
          {item.hidden && <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-px rounded">hidden</span>}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><IconEdit size={11} /></button>
          <button onClick={() => onDelete(item.id)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><IconTrash size={11} /></button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="border-l border-gray-100 ml-[22px]">
          {item.children!.map(child => (
            <NavRow key={child.id} item={child} depth={depth + 1} onDelete={onDelete} />
          ))}
          <button
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#16a34a] transition-colors py-1.5"
            style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}
          >
            <IconPlus size={10} />
            Add nested item
          </button>
        </div>
      )}
    </div>
  )
}

interface NavEditorProps {
  onNavigate: (s: Screen) => void
}

export default function NavEditor({ onNavigate }: NavEditorProps) {
  const [nav, setNav] = useState(INITIAL_NAV)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newType, setNewType] = useState('page')
  const { toast, show } = useToast()

  const handleDelete = (id: string) => {
    setNav(n => n.filter(x => x.id !== id).map(x => ({ ...x, children: x.children?.filter(c => c.id !== id) })))
  }

  const handleSave = () => show('Navigation saved')

  const handleAdd = () => {
    if (!newLabel) return
    setNav(n => [...n, { id: `nav-${Date.now()}`, label: newLabel, url: newUrl || '/', type: newType as 'page' | 'custom', hidden: false }])
    setNewLabel('')
    setNewUrl('')
  }

  return (
    <div className="p-5 max-w-[720px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Navigation</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Main site menu — drag to reorder</p>
        </div>
        <Button variant="primary" onClick={handleSave}>Save navigation</Button>
      </div>

      {/* Nav tree */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Main navigation</p>
          <span className="text-[11px] text-gray-400">{nav.length} items</span>
        </div>
        <div className="divide-y divide-gray-50">
          {nav.map(item => (
            <NavRow key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {/* Add item */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Add item</p>
        <div className="flex gap-2 items-end">
          <Input label="Label" value={newLabel} onChange={setNewLabel} placeholder="Menu label" className="flex-1" />
          <Input label="URL" value={newUrl} onChange={setNewUrl} placeholder="/slug" className="flex-1" />
          <Select label="Type" value={newType} onChange={setNewType} options={[{value:'page',label:'Page'},{value:'custom',label:'Custom URL'}]} className="w-28" />
          <Button variant="primary" onClick={handleAdd}>
            <IconPlus size={12} />
            Add
          </Button>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
