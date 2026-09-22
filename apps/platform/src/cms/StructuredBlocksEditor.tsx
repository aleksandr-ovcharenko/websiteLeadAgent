import { useEffect, useRef, useState } from 'react'
import { IconGrip, IconEye, IconCopy, IconX, IconPlus } from './icons'
import { Button, Input, Textarea } from './ui'

// ─── Shared structured blocks editor (V3.7.4 Phase 3) ───────────────────────
// One reusable editor for entity `blocks` across services, projects, products,
// news and vacancies. Replaces the destructive `blocksFromContent()` flattening
// that silently dropped block type, heading, items, CTA fields, media, enabled
// state and provenance.
//
// Contract:
// - every persisted block loads verbatim (raw is kept for round-trip);
// - supported fields get concrete controls with stable data-cms-control ids
//   (`block:<id>:field:<name>`) so the editability audit can verify coverage;
// - unsupported block types stay visible, read-only and are saved back
//   byte-for-byte — never flattened, never silently deleted.

/** Canonical entity block vocabulary — union of content-schema types that
 *  appear inside entity blocks (imported) plus page-level types. */
export const ENTITY_BLOCK_TYPES = [
  'richText', 'heading', 'list', 'features', 'processSteps', 'facts',
  'faq', 'cta', 'gallery', 'image', 'table', 'text', 'hero', 'about',
  'certificates', 'contacts',
] as const

const KNOWN = new Set<string>(ENTITY_BLOCK_TYPES as readonly string[])

interface BlockUi {
  id: string
  type: string
  summary: string
  fields: Record<string, any>
  enabled: boolean
  unsupported: boolean
  raw?: Record<string, any>
}

const newId = () => `b${Date.now()}_${Math.random().toString(36).slice(2, 5)}`

function toUi(raw: any): BlockUi {
  const type = typeof raw?.type === 'string' && raw.type ? raw.type : 'richText'
  const supported = KNOWN.has(type)
  return {
    id: raw?.id || newId(),
    type,
    summary: String(raw?.heading || raw?.title || raw?.content || (Array.isArray(raw?.items) ? `${raw.items.length} items` : '') || type).slice(0, 48),
    fields: supported ? { ...raw } : {},
    enabled: raw?.enabled !== false,
    unsupported: !supported,
    raw,
  }
}

function toApi(b: BlockUi): any {
  // Unsupported: verbatim (plus enabled) — byte-for-byte round-trip.
  if (b.unsupported || !KNOWN.has(b.type)) {
    return { ...(b.raw || {}), id: b.id, type: b.raw?.type || b.type, enabled: b.enabled }
  }
  return { ...(b.raw || {}), ...b.fields, id: b.id, type: b.type, enabled: b.enabled }
}

const C = (blockId: string, field: string) => `block:${blockId}:field:${field}`

function ItemsEditor({ block, onChange }: { block: BlockUi; onChange: (patch: Record<string, any>) => void }) {
  const items: any[] = Array.isArray(block.fields.items) ? block.fields.items : []
  const setItems = (next: any[]) => onChange({ items: next })
  const setItem = (i: number, patch: any) => setItems(items.map((it, x) => x === i ? { ...it, ...patch } : it))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]; [next[i], next[j]] = [next[j], next[i]]
    setItems(next)
  }
  const add = () => {
    const empty = block.type === 'faq' ? { question: '', answer: '' }
      : block.type === 'features' || block.type === 'processSteps' ? { title: '', text: '' }
      : ''
    setItems([...items, empty])
  }
  return (
    <div className="flex flex-col gap-2" data-cms-control={C(block.id, 'items')}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-text-muted">Items ({items.length})</span>
        <Button variant="secondary" size="sm" onClick={add}><IconPlus size={11} />Add item</Button>
      </div>
      {items.map((it, i) => {
        const isStr = typeof it === 'string'
        return (
          <div key={i} className="flex items-start gap-1.5 border border-border rounded px-2 py-1.5 bg-surface" data-cms-control={C(block.id, `items[${i}]`)}>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {isStr ? (
                <textarea value={it} rows={2} onChange={e => setItems(items.map((x, xi) => xi === i ? e.target.value : x))}
                  className="w-full border-0 text-[12px] text-text bg-transparent focus:outline-none resize-y leading-relaxed" />
              ) : block.type === 'faq' ? (
                <>
                  <input value={it.question || ''} placeholder="Question" onChange={e => setItem(i, { question: e.target.value })}
                    className="w-full h-6 px-1.5 border border-transparent hover:border-border focus:border-accent rounded text-[12px] text-text bg-transparent focus:outline-none" />
                  <textarea value={it.answer || ''} placeholder="Answer" rows={2} onChange={e => setItem(i, { answer: e.target.value })}
                    className="w-full border-0 text-[12px] text-text-muted bg-transparent focus:outline-none resize-y leading-relaxed" />
                </>
              ) : (
                <>
                  <input value={it.title ?? ''} placeholder="Item title" onChange={e => setItem(i, { title: e.target.value })}
                    className="w-full h-6 px-1.5 border border-transparent hover:border-border focus:border-accent rounded text-[12px] text-text bg-transparent focus:outline-none" />
                  <textarea value={it.text ?? ''} placeholder="Item text" rows={2} onChange={e => setItem(i, { text: e.target.value })}
                    className="w-full border-0 text-[12px] text-text-muted bg-transparent focus:outline-none resize-y leading-relaxed" />
                </>
              )}
            </div>
            <div className="flex items-center gap-px flex-shrink-0">
              <button aria-label="Move item up" disabled={i === 0} onClick={() => move(i, -1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover disabled:opacity-30">↑</button>
              <button aria-label="Move item down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover disabled:opacity-30">↓</button>
              <button aria-label="Remove item" onClick={() => setItems(items.filter((_, x) => x !== i))} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-danger hover:bg-danger-subtle"><IconX size={11} /></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Field set per type — every rendered structured field gets a control. */
function BlockFields({ block, onChange }: { block: BlockUi; onChange: (patch: Record<string, any>) => void }) {
  const f = block.fields
  const ctl = (name: string, el: React.ReactNode) => <div data-cms-control={C(block.id, name)}>{el}</div>
  switch (block.type) {
    case 'richText':
    case 'text':
    case 'about':
      return (
        <>
          {ctl('heading', <Input label="Heading" value={f.heading || ''} onChange={v => onChange({ heading: v })} />)}
          {ctl('content', <Textarea label="Content" value={f.content || ''} onChange={v => onChange({ content: v })} rows={4} />)}
          {(f.items !== undefined || block.type === 'richText') && <ItemsEditor block={block} onChange={onChange} />}
        </>
      )
    case 'heading':
      return ctl('content', <Input label="Heading text" value={f.content || f.text || f.heading || ''} onChange={v => onChange({ content: v })} />)
    case 'list':
      return (
        <>
          {ctl('heading', <Input label="Heading" value={f.heading || ''} onChange={v => onChange({ heading: v })} />)}
          <ItemsEditor block={block} onChange={onChange} />
        </>
      )
    case 'features':
    case 'processSteps':
    case 'facts':
      return (
        <>
          {ctl('heading', <Input label="Heading" value={f.heading || ''} onChange={v => onChange({ heading: v })} />)}
          <ItemsEditor block={block} onChange={onChange} />
        </>
      )
    case 'faq':
      return (
        <>
          {ctl('heading', <Input label="Heading" value={f.heading || ''} onChange={v => onChange({ heading: v })} />)}
          <ItemsEditor block={block} onChange={onChange} />
        </>
      )
    case 'cta':
      return (
        <>
          {ctl('title', <Input label="Title" value={f.title || ''} onChange={v => onChange({ title: v })} />)}
          {ctl('description', <Textarea label="Description" value={f.description || ''} onChange={v => onChange({ description: v })} rows={2} />)}
          <div className="grid grid-cols-2 gap-2.5">
            {ctl('buttonLabel', <Input label="Button label" value={f.buttonLabel || ''} onChange={v => onChange({ buttonLabel: v })} />)}
            {ctl('buttonUrl', <Input label="Button link" value={f.buttonUrl || ''} onChange={v => onChange({ buttonUrl: v })} />)}
          </div>
        </>
      )
    case 'image':
      return (
        <>
          {ctl('imageId', <Input label="Media ID or URL" value={f.imageId || ''} onChange={v => onChange({ imageId: v })} />)}
          {ctl('caption', <Input label="Caption" value={f.caption || ''} onChange={v => onChange({ caption: v })} />)}
        </>
      )
    case 'gallery':
      return ctl('imageIds', <Textarea label="Image IDs (one per line)" value={(f.imageIds || []).join('\n')} onChange={v => onChange({ imageIds: v.split('\n').map(s => s.trim()).filter(Boolean) })} rows={4} />)
    case 'hero':
      return (
        <>
          {ctl('title', <Input label="Title" value={f.title || ''} onChange={v => onChange({ title: v })} />)}
          {ctl('subtitle', <Textarea label="Subtitle" value={f.subtitle || f.body || ''} onChange={v => onChange({ subtitle: v })} rows={2} />)}
          <div className="grid grid-cols-2 gap-2.5">
            {ctl('buttonLabel', <Input label="Button label" value={f.buttonLabel || ''} onChange={v => onChange({ buttonLabel: v })} />)}
            {ctl('buttonUrl', <Input label="Button link" value={f.buttonUrl || ''} onChange={v => onChange({ buttonUrl: v })} />)}
          </div>
        </>
      )
    case 'contacts':
      return ctl('heading', <Input label="Heading" value={f.heading || 'Контакты'} onChange={v => onChange({ heading: v })} />)
    case 'table':
      return ctl('rows', <Textarea label="Rows (JSON)" value={typeof f.rows === 'string' ? f.rows : JSON.stringify(f.rows || [], null, 2)} onChange={v => { try { onChange({ rows: JSON.parse(v) }) } catch { onChange({ rows: v }) } }} rows={5} />)
    default:
      return ctl('content', <Textarea label="Content" value={f.content || ''} onChange={v => onChange({ content: v })} rows={4} />)
  }
}

export interface StructuredBlocksEditorProps {
  /** Raw API blocks (persisted JSON). */
  value: any[]
  onChange: (blocks: any[]) => void
  /** Editor control id prefix for the audit (e.g. 'service'). */
  entityKind?: string
}

export function StructuredBlocksEditor({ value, onChange, entityKind = 'entity' }: StructuredBlocksEditorProps) {
  const [blocks, setBlocks] = useState<BlockUi[]>(() => (value || []).map(toUi))
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Sync external loads: the parent's `blocks` state is populated by an async
  // effect after this component mounts. Re-initialize only when the incoming
  // value differs from what we last emitted, so edits are never clobbered.
  const lastEmit = useRef<string>(JSON.stringify(value || []))
  useEffect(() => {
    const incoming = JSON.stringify(value || [])
    if (incoming !== lastEmit.current) {
      lastEmit.current = incoming
      setBlocks((value || []).map(toUi))
    }
  }, [value])

  const commit = (next: BlockUi[]) => {
    const api = next.map(toApi)
    lastEmit.current = JSON.stringify(api)
    setBlocks(next); onChange(api)
  }
  const update = (id: string, patch: Record<string, any>) =>
    commit(blocks.map(b => b.id === id ? { ...b, fields: { ...b.fields, ...patch }, summary: String(patch.heading || patch.title || patch.content || b.summary).slice(0, 48) } : b))
  const move = (id: string, d: -1 | 1) => {
    const i = blocks.findIndex(b => b.id === id); const j = i + d
    if (i < 0 || j < 0 || j >= blocks.length) return
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  const toggle = (id: string) => commit(blocks.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b))
  const dup = (id: string) => {
    const b = blocks.find(x => x.id === id); if (!b) return
    commit([...blocks, { ...b, id: newId() }])
  }
  const remove = (id: string) => commit(blocks.filter(b => b.id !== id))
  const add = (type: string) => {
    // Required schema fields get explicit defaults so new blocks validate.
    const raw: any = { id: newId(), type, enabled: true }
    if (type === 'cta' || type === 'hero') { raw.title = ''; raw.description = ''; raw.buttonLabel = ''; raw.buttonUrl = '' }
    if (type === 'text' || type === 'richText' || type === 'heading' || type === 'about') raw.content = ''
    if (type === 'features' || type === 'processSteps' || type === 'faq' || type === 'list' || type === 'facts') raw.items = []
    if (type === 'gallery') raw.imageIds = []
    if (type === 'image') raw.imageId = ''
    const b = toUi(raw)
    commit([...blocks, b])
    setActiveBlock(b.id); setAddOpen(false)
  }

  return (
    <div className="flex flex-col gap-1" data-cms-control={`${entityKind}:blocks`}>
      {blocks.length === 0 && !addOpen && (
        <div className="bg-surface border border-dashed border-border rounded px-5 py-6 text-center">
          <p className="text-[13px] text-text-subtle mb-3">No content blocks yet.</p>
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}><IconPlus size={12} />Add first block</Button>
        </div>
      )}
      {blocks.map((block, bi) => {
        const isActive = activeBlock === block.id
        return (
          <div key={block.id} data-cms-block={block.id} className={`bg-surface border rounded overflow-hidden transition-all ${isActive ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border'} ${!block.enabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer group/row" onClick={() => setActiveBlock(isActive ? null : block.id)}>
              <span className="text-text-subtle hover:text-text-muted cursor-grab flex-shrink-0" onClick={e => e.stopPropagation()}><IconGrip size={13} /></span>
              <span className={`text-[10px] font-bold uppercase tracking-widest w-[76px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-text-subtle'}`}>{block.type}</span>
              <span className="flex-1 text-[13px] text-text-muted truncate min-w-0">{block.summary}{!block.enabled ? ' · hidden' : ''}</span>
              <div className="flex items-center gap-px opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button aria-label="Move block up" disabled={bi === 0} onClick={() => move(block.id, -1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover disabled:opacity-30">↑</button>
                <button aria-label="Move block down" disabled={bi === blocks.length - 1} onClick={() => move(block.id, 1)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover disabled:opacity-30">↓</button>
                <button aria-label={block.enabled ? 'Hide block' : 'Show block'} data-cms-control={`${entityKind}:block:${block.id}:enabled`} onClick={() => toggle(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover"><IconEye size={11} /></button>
                <button aria-label="Duplicate block" onClick={() => dup(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-text hover:bg-surface-hover"><IconCopy size={11} /></button>
                <button aria-label="Remove block" onClick={() => remove(block.id)} className="w-6 h-6 flex items-center justify-center rounded text-text-subtle hover:text-danger hover:bg-danger-subtle"><IconX size={11} /></button>
              </div>
            </div>
            {isActive && (
              <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-raised">
                {block.unsupported && (
                  <p className="text-[12px] text-warning py-2">Unsupported block type “{block.raw?.type || block.type}”. Read-only — preserved verbatim on save.</p>
                )}
                <div className="pt-3 flex flex-col gap-2.5" style={block.unsupported ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>
                  <BlockFields block={block} onChange={patch => update(block.id, patch)} />
                </div>
                {block.raw?.sourceUrl && (
                  <p className="text-[10px] text-text-subtle mono mt-2 truncate">source: {block.raw.sourceUrl}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
      <div className="mt-1">
        {addOpen ? (
          <div className="bg-surface border border-border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-text">Choose a block type</p>
              <button onClick={() => setAddOpen(false)} className="w-5 h-5 flex items-center justify-center rounded text-text-subtle hover:text-text-muted hover:bg-surface-hover"><IconX size={12} /></button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ENTITY_BLOCK_TYPES.map(bt => (
                <button key={bt} onClick={() => add(bt)} className="flex items-center justify-center h-8 px-2 rounded border border-border text-[11px] text-text-muted hover:border-accent hover:text-accent transition-colors">{bt}</button>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)} className="w-full flex items-center justify-center gap-2 h-9 rounded border border-dashed border-border text-[13px] text-text-subtle hover:border-accent hover:text-accent transition-colors"><IconPlus size={12} />Add block</button>
        )}
      </div>
    </div>
  )
}
