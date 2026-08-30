import { useState, useMemo, useEffect } from 'react'
import { Screen } from './types'
import { IconPlus, IconTrash, IconEye, IconEyeOff, IconChevronRight, IconChevronDown } from './icons'
import { Button, Input, useToast, Toast } from './ui'
import { useStudio, formatDate } from './context'
import { api } from './api'

interface NavEditorProps {
  onNavigate: (s: Screen) => void
}

const SECTION_KEYS = ['ABOUT', 'SERVICES', 'PROJECTS', 'NEWS', 'VACANCIES', 'CONTACTS']

interface MenuTreeItem {
  id: string
  title: string
  url: string
  targetType: 'HOME' | 'HOME_SECTION' | 'COLLECTION' | 'PAGE' | 'CONTENT_DETAIL' | 'CUSTOM_URL' | 'EXTERNAL_URL'
  target: string
  pageId: string
  isVisible: boolean
  showInHeader: boolean
  showInFooter: boolean
  showOnHomepage: boolean
  order: number
  children: MenuTreeItem[]
}

function flatToTree(flat: any[]): MenuTreeItem[] {
  const map: Record<string, MenuTreeItem> = {}
  const roots: MenuTreeItem[] = []
  const sorted = [...flat].sort((a, b) => (a.order || 0) - (b.order || 0))
  sorted.forEach(item => {
    const targetType = (item.targetType || item.type || 'PAGE') as MenuTreeItem['targetType']
    const isSectionLike = targetType === 'HOME_SECTION' || targetType === 'COLLECTION'
    const node: MenuTreeItem = {
      id: item.id,
      title: item.label || item.title || '',
      url: item.url || '',
      targetType,
      target: item.target || (isSectionLike ? (item.url || '').replace(/^#/, '').toUpperCase() : (item.url || '')),
      pageId: item.pageId || '',
      isVisible: item.isVisible !== false,
      showInHeader: item.showInHeader !== false,
      showInFooter: item.showInFooter !== false,
      showOnHomepage: item.showOnHomepage !== false,
      order: item.sortOrder || item.order || 0,
      children: []
    }
    map[node.id] = node
  })
  sorted.forEach(item => {
    const parentId = item.parentId || item.menuId
    if (parentId && map[parentId]) map[parentId].children.push(map[item.id])
    else roots.push(map[item.id])
  })
  return roots
}

function treeToFlat(tree: MenuTreeItem[], parentId: string | null = null, orderStart = 0): any[] {
  const out: any[] = []
  tree.forEach((node, i) => {
    const { children, ...rest } = node
    out.push({ ...rest, parentId, order: orderStart + i })
    out.push(...treeToFlat(children, node.id, 0))
  })
  return out
}

function generateId() {
  return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
}

interface TreeRowProps {
  item: MenuTreeItem
  depth: number
  onChange: (id: string, patch: Partial<MenuTreeItem>) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
  onMove: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void
}

function TreeRow({ item, depth, onChange, onToggle, onDelete, onAddChild, onMove }: TreeRowProps) {
  const [expanded, setExpanded] = useState(true)
  const { pages } = useStudio()

  const onTypeChange = (type: MenuTreeItem['targetType']) => {
    const patch: Partial<MenuTreeItem> = { targetType: type }
    if (type === 'HOME') { patch.target = ''; patch.url = ''; patch.pageId = '' }
    if (type === 'HOME_SECTION') { patch.target = 'ABOUT'; patch.url = ''; patch.pageId = '' }
    if (type === 'COLLECTION') { patch.target = 'SERVICES'; patch.url = ''; patch.pageId = '' }
    if (type === 'PAGE') { patch.target = ''; patch.pageId = pages[0]?.id || ''; patch.url = '' }
    if (type === 'CUSTOM_URL' || type === 'EXTERNAL_URL') { patch.url = item.url || ''; patch.target = ''; patch.pageId = '' }
    onChange(item.id, patch)
  }

  const onPageChange = (pageId: string) => {
    const page = pages.find((p: any) => p.id === pageId)
    onChange(item.id, { pageId, target: page?.slug || '', url: '' })
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 hover:bg-gray-50/60" style={{ paddingLeft: `${16 + depth * 24}px` }}>
        {item.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">{expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}</button>
        ) : <span className="w-4" />}
        <Input value={item.title} onChange={v => onChange(item.id, { title: v })} placeholder="Label" className="flex-1 min-w-0" />
        <select value={item.targetType} onChange={e => onTypeChange(e.target.value as MenuTreeItem['targetType'])} className="h-8 px-2 border border-gray-300 rounded text-[12px] bg-white w-[120px]">
          <option value="HOME">Home</option>
          <option value="HOME_SECTION">Section</option>
          <option value="COLLECTION">Collection</option>
          <option value="PAGE">Page</option>
          <option value="CONTENT_DETAIL">Detail</option>
          <option value="CUSTOM_URL">Custom</option>
          <option value="EXTERNAL_URL">External</option>
        </select>
        {item.targetType === 'HOME_SECTION' || item.targetType === 'COLLECTION' ? (
          <select value={item.target} onChange={e => onChange(item.id, { target: e.target.value })} className="h-8 px-2 border border-gray-300 rounded text-[12px] bg-white w-[120px]">
            {SECTION_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        ) : item.targetType === 'PAGE' ? (
          <select value={item.pageId} onChange={e => onPageChange(e.target.value)} className="h-8 px-2 border border-gray-300 rounded text-[12px] bg-white w-[120px]">
            {pages.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        ) : item.targetType === 'CUSTOM_URL' || item.targetType === 'EXTERNAL_URL' ? (
          <Input value={item.url} onChange={v => onChange(item.id, { url: v })} placeholder={item.targetType === 'EXTERNAL_URL' ? 'https://...' : '/path'} className="w-40" />
        ) : item.targetType === 'CONTENT_DETAIL' ? (
          <Input value={item.target} onChange={v => onChange(item.id, { target: v })} placeholder="news:slug" className="w-40" />
        ) : (
          <span className="w-40" />
        )}
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <label className="cursor-pointer" title="Header"><input type="checkbox" checked={item.showInHeader} onChange={e => onChange(item.id, { showInHeader: e.target.checked })} className="mr-0.5" />H</label>
          <label className="cursor-pointer" title="Footer"><input type="checkbox" checked={item.showInFooter} onChange={e => onChange(item.id, { showInFooter: e.target.checked })} className="mr-0.5" />F</label>
          <label className="cursor-pointer" title="Homepage"><input type="checkbox" checked={item.showOnHomepage} onChange={e => onChange(item.id, { showOnHomepage: e.target.checked })} className="mr-0.5" />HP</label>
        </div>
        <button onClick={() => onToggle(item.id)} className="text-gray-400 hover:text-gray-700">{item.isVisible ? <IconEye size={14} /> : <IconEyeOff size={14} />}</button>
        <button onClick={() => onMove(item.id, 'up')} className="text-gray-400 hover:text-gray-700 text-[10px]">▲</button>
        <button onClick={() => onMove(item.id, 'down')} className="text-gray-400 hover:text-gray-700 text-[10px]">▼</button>
        <button onClick={() => onMove(item.id, 'left')} className="text-gray-400 hover:text-gray-700 text-[10px]">←</button>
        <button onClick={() => onMove(item.id, 'right')} className="text-gray-400 hover:text-gray-700 text-[10px]">→</button>
        <button onClick={() => onAddChild(item.id)} className="text-gray-400 hover:text-[#16a34a]"><IconPlus size={14} /></button>
        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500"><IconTrash size={14} /></button>
      </div>
      {expanded && item.children.map(child => (
        <TreeRow key={child.id} item={child} depth={depth + 1} onChange={onChange} onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild} onMove={onMove} />
      ))}
    </div>
  )
}

export default function NavEditor({ onNavigate }: NavEditorProps) {
  const { siteId, menu, refresh } = useStudio()
  const [items, setItems] = useState<MenuTreeItem[]>([])
  const [saving, setSaving] = useState(false)
  const { toast, show } = useToast()

  useEffect(() => { setItems(flatToTree(menu || [])) }, [menu])

  const updateTree = (tree: MenuTreeItem[], id: string, patch: Partial<MenuTreeItem>): MenuTreeItem[] => tree.map(node => {
    if (node.id === id) return { ...node, ...patch }
    if (node.children.length) return { ...node, children: updateTree(node.children, id, patch) }
    return node
  })

  const removeFromTree = (tree: MenuTreeItem[], id: string): MenuTreeItem[] => tree.filter(node => node.id !== id).map(node => ({ ...node, children: removeFromTree(node.children, id) }))

  const addToTree = (tree: MenuTreeItem[], parentId: string | null, newItem: MenuTreeItem): MenuTreeItem[] => {
    if (!parentId) return [...tree, newItem]
    return tree.map(node => {
      if (node.id === parentId) return { ...node, children: [...node.children, newItem] }
      if (node.children.length) return { ...node, children: addToTree(node.children, parentId, newItem) }
      return node
    })
  }

  const findNode = (tree: MenuTreeItem[], id: string): MenuTreeItem | null => {
    for (const node of tree) { if (node.id === id) return node; const found = findNode(node.children, id); if (found) return found }
    return null
  }

  const findParent = (tree: MenuTreeItem[], id: string): { parent: MenuTreeItem[]; index: number; list: MenuTreeItem[] } | null => {
    for (let i = 0; i < tree.length; i++) if (tree[i].id === id) return { parent: tree, index: i, list: tree }
    for (const node of tree) { const found = findParent(node.children, id); if (found) return found }
    return null
  }

  const handleChange = (id: string, patch: Partial<MenuTreeItem>) => setItems(tree => updateTree(tree, id, patch))
  const handleToggle = (id: string) => {
    const node = findNode(items, id)
    if (node) handleChange(id, { isVisible: !node.isVisible })
  }
  const handleDelete = (id: string) => setItems(tree => removeFromTree(tree, id))
  const handleAddRoot = () => setItems(tree => [...tree, { id: generateId(), title: 'New item', url: '', targetType: 'HOME_SECTION', target: 'ABOUT', pageId: '', isVisible: true, showInHeader: true, showInFooter: true, showOnHomepage: true, order: tree.length, children: [] }])
  const handleAddChild = (parentId: string) => setItems(tree => addToTree(tree, parentId, { id: generateId(), title: 'New item', url: '', targetType: 'HOME_SECTION', target: 'ABOUT', pageId: '', isVisible: true, showInHeader: true, showInFooter: true, showOnHomepage: true, order: 0, children: [] }))

  const updateTreeParents = (tree: MenuTreeItem[], oldList: MenuTreeItem[], newList: MenuTreeItem[]): MenuTreeItem[] => {
    if (tree === oldList) return newList
    return tree.map(node => ({ ...node, children: updateTreeParents(node.children, oldList, newList) }))
  }

  const handleMove = (id: string, direction: 'up' | 'down' | 'left' | 'right') => {
    setItems(tree => {
      const loc = findParent(tree, id)
      if (!loc) return tree
      const { list, index } = loc
      const clone = [...list]
      if (direction === 'up' && index > 0) { [clone[index - 1], clone[index]] = [clone[index], clone[index - 1]] }
      if (direction === 'down' && index < list.length - 1) { [clone[index], clone[index + 1]] = [clone[index + 1], clone[index]] }
      return updateTreeParents(tree, list, clone)
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const flat = treeToFlat(items)
      await api.saveMenu(siteId, flat)
      await refresh()
      show('Navigation saved')
    } catch (e: any) { show(e.message || 'Failed to save navigation') }
    setSaving(false)
  }

  return (
    <div className="p-5 max-w-[900px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Navigation</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Manage site menu and submenus</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleAddRoot}><IconPlus size={12} />Add menu item</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save menu'}</Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_100px_120px] gap-2 px-4 py-2 bg-gray-50 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">
          <span>Label</span>
          <span>Type</span>
          <span>Target / URL</span>
          <span>Page</span>
          <span className="text-right">Actions</span>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-gray-400">No menu items yet. <button onClick={handleAddRoot} className="text-[#16a34a] underline">Add first item</button></div>
        ) : (
          items.map(item => <TreeRow key={item.id} item={item} depth={0} onChange={handleChange} onToggle={handleToggle} onDelete={handleDelete} onAddChild={handleAddChild} onMove={handleMove} />)
        )}
      </div>

      <Toast toast={toast} />
    </div>
  )
}
