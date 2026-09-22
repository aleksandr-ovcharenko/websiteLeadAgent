import { useEffect, useState } from 'react'
import { api } from './api'
import { useStudio, formatDate } from './context'
import { Button, useToast, Toast } from './ui'
import { IconCheck } from './icons'

interface RevisionShot {
  id: string
  route: string
  viewport: string
  capturedAt: string
  current: boolean
  url: string
}

interface Revision {
  id: string
  version: number
  status: 'GENERATING' | 'QA_FAILED' | 'REVIEW_READY' | 'PUBLISHED' | 'ARCHIVED'
  templateId: string
  contentHash?: string | null
  generatedByRunId?: string | null
  failureReason?: string | null
  startedAt: string
  completedAt?: string | null
  durationMs?: number | null
  active: boolean
  screenshots: RevisionShot[]
}

interface Variant {
  id: string
  name: string
  templateId: string
  isPreferred: boolean
  activeRevisionId: string | null
  revisions: Revision[]
}

const STATUS_STYLE: Record<string, string> = {
  GENERATING: 'text-warning bg-surface-hover border-border',
  QA_FAILED: 'text-danger bg-danger-subtle border-danger-subtle',
  REVIEW_READY: 'text-success bg-success-subtle border-success-subtle',
  PUBLISHED: 'text-success bg-success-subtle border-success-subtle',
  ARCHIVED: 'text-text-subtle bg-surface-hover border-border',
}

function fmtDuration(ms?: number | null) {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function ShotThumb({ shot }: { shot: RevisionShot }) {
  return (
    <a href={shot.url} target="_blank" rel="noreferrer" className="block group" title={`${shot.route} · ${shot.viewport} · ${formatDate(shot.capturedAt)}`}>
      <div className={`border rounded overflow-hidden bg-surface-raised ${shot.current ? 'border-border' : 'border-dashed border-border opacity-60'}`}>
        <img src={shot.url} alt={`${shot.route} ${shot.viewport}`} loading="lazy" className="w-full h-[68px] object-cover object-top" />
      </div>
      <p className="text-[9px] text-text-subtle mono mt-0.5 truncate">{shot.route === '/' ? 'homepage' : shot.route} · {shot.viewport}</p>
    </a>
  )
}

function RevisionCard({ siteId, revision, onPromoted, show }: { siteId: string; revision: Revision; onPromoted: () => void; show: (m: string, t?: 'success' | 'error') => void }) {
  const [open, setOpen] = useState(revision.active)
  const [promoting, setPromoting] = useState(false)
  const promotable = ['REVIEW_READY', 'PUBLISHED'].includes(revision.status) && !revision.active

  const promote = async () => {
    setPromoting(true)
    try {
      await api.promoteRevision(siteId, revision.id)
      show(`v${revision.version} promoted to active`)
      onPromoted()
    } catch (e: any) {
      show(e.message || 'Promote failed', 'error')
    } finally {
      setPromoting(false)
    }
  }

  return (
    <div className={`border rounded ${revision.active ? 'border-accent' : 'border-border'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-raised/60 transition-colors">
        <span className="text-[12px] font-semibold text-text mono">v{revision.version}</span>
        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLE[revision.status] || STATUS_STYLE.ARCHIVED}`}>
          {revision.status}
        </span>
        {revision.active && (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent text-text-inverse">ACTIVE</span>
        )}
        <span className="flex-1" />
        <span className="text-[10px] text-text-subtle mono">{fmtDuration(revision.durationMs)}</span>
        <span className="text-[10px] text-text-subtle">{formatDate(revision.startedAt)}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border">
          {revision.failureReason && (
            <p className="text-[11px] text-danger leading-snug mb-2">{revision.failureReason}</p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-text-subtle mono mb-2">
            <span>{revision.screenshots.length} screenshots</span>
            {revision.generatedByRunId && <span>run {revision.generatedByRunId.slice(-8)}</span>}
            {revision.contentHash && <span>hash {revision.contentHash.slice(0, 10)}</span>}
          </div>
          {revision.screenshots.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {revision.screenshots.slice(0, 9).map((s) => <ShotThumb key={s.id} shot={s} />)}
            </div>
          )}
          {revision.screenshots.length > 9 && (
            <p className="text-[10px] text-text-subtle mb-2">+{revision.screenshots.length - 9} more</p>
          )}
          {promotable && (
            <Button variant="secondary" size="sm" disabled={promoting} onClick={promote}>
              {promoting ? 'Promoting…' : <><IconCheck size={11} />Promote to active</>}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function RevisionHistory({ siteId }: { siteId: string }) {
  const [variants, setVariants] = useState<Variant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast, show } = useToast()

  const load = () => {
    api.getRevisions(siteId)
      .then((r) => setVariants(r.variants || []))
      .catch((e: any) => setError(e.message || 'Failed to load revisions'))
  }
  useEffect(load, [siteId])

  if (error) return <p className="text-[12px] text-danger">{error}</p>
  if (!variants) return <p className="text-[12px] text-text-subtle">Loading version history…</p>
  if (!variants.length) return <p className="text-[12px] text-text-subtle">No design variants yet.</p>

  return (
    <div className="flex flex-col gap-4">
      {variants.map((v) => (
        <div key={v.id}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[12px] font-semibold text-text">{v.name || v.templateId}</p>
            {v.isPreferred && <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-success-subtle border border-success-subtle text-success">PREFERRED</span>}
            <span className="text-[10px] text-text-subtle mono">{v.revisions.length} revision{v.revisions.length === 1 ? '' : 's'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[...v.revisions].reverse().map((r) => (
              <RevisionCard key={r.id} siteId={siteId} revision={r} onPromoted={load} show={show} />
            ))}
          </div>
        </div>
      ))}
      <Toast toast={toast} />
    </div>
  )
}

// Studio screen wrapper.
export default function Versions() {
  const { siteId } = useStudio()
  return (
    <div className="p-5 max-w-[760px]">
      <h1 className="text-[15px] font-semibold text-text mb-1">Version history</h1>
      <p className="text-[12px] text-text-subtle mb-4">
        Immutable build revisions of each design variant. CMS content is shared across variants — a revision snapshots the content state used for its build.
      </p>
      <RevisionHistory siteId={siteId} />
    </div>
  )
}
