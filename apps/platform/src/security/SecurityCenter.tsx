import { useEffect, useMemo, useState } from 'react'
import { api } from '../cms/api'
import { hasPermission } from '../auth/permissions'

type Tab = 'overview' | 'findings' | 'dependencies' | 'events' | 'audits'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'findings', label: 'Findings' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'events', label: 'Events' },
  { key: 'audits', label: 'Audit history' },
]

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
const STATUSES = ['OPEN', 'FIXING', 'RESOLVED', 'FALSEPOSITIVE', 'ACCEPTEDRISK']
const PAGE = 25

const SEV_CLS: Record<string, string> = {
  CRITICAL: 'bg-danger-subtle text-danger ring-danger-subtle',
  HIGH: 'bg-warning-subtle text-warning ring-warning-subtle',
  MEDIUM: 'bg-info-subtle text-info ring-info-subtle',
  LOW: 'bg-surface-hover text-text-muted ring-border',
  INFO: 'bg-surface-hover text-text-subtle ring-border',
}

const GATE_CLS: Record<string, string> = {
  HEALTHY: 'bg-success-subtle text-success ring-success',
  ATTENTION: 'bg-warning-subtle text-warning ring-warning-subtle',
  HIGH_RISK: 'bg-danger-subtle text-danger ring-danger-subtle',
  BLOCKED: 'bg-danger text-text-inverse ring-danger',
}

const ENV_CLS: Record<string, string> = {
  RUNTIME: 'bg-danger-subtle text-danger ring-danger-subtle',
  DEV: 'bg-warning-subtle text-warning ring-warning-subtle',
  BUILD: 'bg-info-subtle text-info ring-info-subtle',
  UNKNOWN: 'bg-surface-hover text-text-muted ring-border',
}

const REACH_CLS: Record<string, string> = {
  REACHABLE: 'bg-danger-subtle text-danger ring-danger-subtle',
  NOT_REACHABLE: 'bg-success-subtle text-success ring-success',
  UNKNOWN: 'bg-surface-hover text-text-muted ring-border',
}

const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-danger-subtle text-danger ring-danger-subtle',
  FIXING: 'bg-warning-subtle text-warning ring-warning-subtle',
  RESOLVED: 'bg-success-subtle text-success ring-success',
  FALSEPOSITIVE: 'bg-surface-hover text-text-muted ring-border',
  ACCEPTEDRISK: 'bg-info-subtle text-info ring-info-subtle',
  SUCCESS: 'bg-success-subtle text-success ring-success',
  FAILED: 'bg-danger-subtle text-danger ring-danger-subtle',
  PENDING: 'bg-surface-hover text-text-muted ring-border',
  RUNNING: 'bg-info-subtle text-info ring-info-subtle',
}

function Badge({ v, map }: { v?: string | null; map: Record<string, string> }) {
  if (!v) return <span className="text-text-subtle">—</span>
  return (
    <span className={`inline-flex items-center rounded ring-1 ring-inset font-mono font-medium px-1.5 py-0.5 text-[10px] ${map[v] || 'bg-surface-hover text-text-muted ring-border'}`}>
      {v}
    </span>
  )
}

function fmt(d?: string | null) {
  if (!d) return '—'
  const t = new Date(d)
  return isNaN(t.getTime()) ? '—' : t.toLocaleString()
}

const SECRET_RE = /(secret|token|password|passwd|api[_-]?key|private[_-]?key|bearer|authorization|credential|AKIA[0-9A-Z]{16}|-----BEGIN|ghp_[A-Za-z0-9]|sk-[A-Za-z0-9])/i

function redact(value: any): any {
  if (value == null) return value
  if (typeof value === 'string') return SECRET_RE.test(value) ? '[redacted — possible secret]' : value
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_RE.test(k) ? '[redacted]' : redact(v)
    }
    return out
  }
  return value
}

const th = 'px-3 py-2 text-left text-[11px] font-mono font-medium text-text-subtle uppercase tracking-wider'
const td = 'px-3 py-2 text-xs text-text align-top'
const inputCls = 'h-8 px-2.5 border border-border rounded text-xs text-text bg-surface focus:outline-none focus:ring-1 focus:ring-success'
const selectCls = `${inputCls} font-mono`

function Pager({ total, offset, onPage }: { total: number; offset: number; onPage: (o: number) => void }) {
  if (total <= PAGE) return null
  return (
    <div className="px-3 py-2 border-t border-border flex items-center justify-between">
      <span className="text-[11px] font-mono text-text-subtle">
        {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
      </span>
      <div className="flex gap-1.5">
        <button disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - PAGE))} className="h-7 px-2.5 text-xs border border-border rounded text-text-muted hover:bg-surface-raised disabled:opacity-40">Prev</button>
        <button disabled={offset + PAGE >= total} onClick={() => onPage(offset + PAGE)} className="h-7 px-2.5 text-xs border border-border rounded text-text-muted hover:bg-surface-raised disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-raised/60">{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview({ onGoFindings }: { onGoFindings: (sev?: string) => void }) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.getSecurityOverview().then(setData).catch((e) => setErr(e.message))
  }, [])

  if (err) return <div className="text-xs text-danger">{err}</div>
  if (!data) return <div className="text-xs text-text-subtle">Loading…</div>

  const gate = data.gate
  const openBySev: Record<string, number> = {}
  for (const c of data.counts || []) {
    if (c.status === 'OPEN' || c.status === 'FIXING') openBySev[c.severity] = (openBySev[c.severity] || 0) + c._count.id
  }
  const products = (data.products || []).filter((p: any) => p.product)

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-lg px-5 py-4 flex items-center gap-4">
        <Badge v={gate?.status || 'HEALTHY'} map={GATE_CLS} />
        <div className="text-xs text-text-muted">
          Security gate · evaluated {fmt(gate?.evaluatedAt)}
          {gate?.blockedReason && <span className="ml-2 text-danger">{gate.blockedReason}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg px-5 py-3 flex items-center gap-6">
          <span className="text-[11px] font-mono font-medium text-text-subtle uppercase tracking-wider">Open findings</span>
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => onGoFindings(s)} className="flex items-baseline gap-1.5 group">
              <span className={`text-base font-semibold font-mono tabular-nums ${s === 'CRITICAL' || s === 'HIGH' ? 'text-danger' : s === 'MEDIUM' ? 'text-warning' : 'text-text'}`}>
                {openBySev[s] || 0}
              </span>
              <span className="text-[11px] text-text-subtle group-hover:text-text">{s}</span>
            </button>
          ))}
        </div>
        <div className="bg-surface border border-border rounded-lg px-5 py-3 flex items-center gap-6">
          <span className="text-[11px] font-mono font-medium text-text-subtle uppercase tracking-wider">Production impact</span>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
            <button key={s} onClick={() => onGoFindings(s)} className="flex items-baseline gap-1.5 group">
              <span className={`text-base font-semibold font-mono tabular-nums ${s === 'CRITICAL' || s === 'HIGH' ? 'text-danger' : s === 'MEDIUM' ? 'text-warning' : 'text-text'}`}>
                {(gate as any)?.[`production${s}`] ?? 0}
              </span>
              <span className="text-[11px] text-text-subtle group-hover:text-text">{s}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-2.5 border-b border-border text-[11px] font-mono font-medium text-text-subtle uppercase tracking-wider">Recent audits</div>
          {(data.recentAudits || []).length === 0 ? (
            <div className="px-4 py-6 text-xs text-text-subtle">No audits yet</div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentAudits.map((a: any) => (
                <div key={a.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <span className="font-mono text-text">{a.scanner}</span>
                  <Badge v={a.status} map={STATUS_CLS} />
                  <span className="ml-auto text-[11px] text-text-subtle font-mono">{fmt(a.startedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-surface border border-border rounded-lg">
          <div className="px-4 py-2.5 border-b border-border text-[11px] font-mono font-medium text-text-subtle uppercase tracking-wider">Products with findings</div>
          {products.length === 0 ? (
            <div className="px-4 py-6 text-xs text-text-subtle">None</div>
          ) : (
            <div className="divide-y divide-border">
              {products.map((p: any) => (
                <button key={p.product} onClick={() => onGoFindings()} className="w-full px-4 py-2 flex items-center gap-3 text-xs hover:bg-surface-raised text-left">
                  <span className="font-mono text-text truncate">{p.product}</span>
                  <span className="ml-auto font-mono tabular-nums text-text-muted">{p._count.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Findings ─────────────────────────────────────────────────────────────────

function Findings({ initialSeverity }: { initialSeverity?: string }) {
  const [filters, setFilters] = useState({ severity: initialSeverity || '', status: 'OPEN', product: '', scanner: '' })
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [detail, setDetail] = useState<any | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getSecurityFindings({ ...filters, limit: PAGE, offset })
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false))
  }, [filters, offset])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    api.getSecurityFinding(selected.id).then(setDetail).catch(() => setDetail(selected))
  }, [selected])

  const scanners = useMemo(() => [...new Set(data.items.map((f) => f.scanner))], [data.items])
  const products = useMemo(() => [...new Set(data.items.map((f) => f.product))], [data.items])
  const set = (k: string, v: string) => { setOffset(0); setFilters((f) => ({ ...f, [k]: v })) }

  const evidence = detail?.evidence ? redact(detail.evidence) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filters.severity} onChange={(e) => set('severity', e.target.value)} className={selectCls}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={filters.product} onChange={(e) => set('product', e.target.value)} placeholder="Product" list="sec-products" className={inputCls} />
        <datalist id="sec-products">{products.map((p) => <option key={p} value={p} />)}</datalist>
        <input value={filters.scanner} onChange={(e) => set('scanner', e.target.value)} placeholder="Scanner" list="sec-scanners" className={inputCls} />
        <datalist id="sec-scanners">{scanners.map((s) => <option key={s} value={s} />)}</datalist>
        <span className="text-[11px] font-mono text-text-subtle ml-auto">{data.total} findings</span>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <Table head={['Severity', 'Title', 'Env', 'Reach', 'Product', 'Scanner', 'Status', 'Last seen']}>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-text-subtle">Loading…</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-text-subtle">No findings</td></tr>
            ) : data.items.map((f) => (
              <tr key={f.id} onClick={() => setSelected(f)} className={`cursor-pointer hover:bg-surface-raised/70 transition-colors ${selected?.id === f.id ? 'bg-surface-raised' : ''}`}>
                <td className={td}><Badge v={f.severity} map={SEV_CLS} /></td>
                <td className={`${td} max-w-[240px]`}>
                  <div className="text-text font-medium truncate">{f.title}</div>
                  {f.cve && <div className="text-[10px] font-mono text-text-subtle">{f.cve}</div>}
                </td>
                <td className={td}><Badge v={f.environment} map={ENV_CLS} /></td>
                <td className={td}><Badge v={f.reachability} map={REACH_CLS} /></td>
                <td className={`${td} font-mono text-text-muted`}>{f.product}</td>
                <td className={`${td} font-mono text-text-muted`}>{f.scanner}</td>
                <td className={td}><Badge v={f.status} map={STATUS_CLS} /></td>
                <td className={`${td} font-mono text-text-subtle whitespace-nowrap`}>{fmt(f.lastDetectedAt)}</td>
              </tr>
            ))}
          </Table>
          <Pager total={data.total} offset={offset} onPage={setOffset} />
        </div>

        {selected && (
          <div className="w-[340px] flex-shrink-0 bg-surface border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text leading-snug">{selected.title}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge v={selected.severity} map={SEV_CLS} />
                  <Badge v={detail?.status || selected.status} map={STATUS_CLS} />
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-text-subtle hover:text-text text-sm leading-none">×</button>
            </div>
            <div className="px-4 py-3 space-y-2 text-[11px] border-b border-border">
              {[
                ['Scanner', detail?.scanner || selected.scanner],
                ['Category', detail?.category || selected.category],
                ['Environment', detail?.environment || selected.environment],
                ['Reachability', detail?.reachability || selected.reachability],
                ['Product', detail?.product || selected.product],
                ['Rule', detail?.ruleId],
                ['CWE', detail?.cwe],
                ['CVE', detail?.cve],
                ['Fixed in', detail?.fixedVersion],
                ['First seen', fmt(detail?.firstDetectedAt || selected.firstDetectedAt)],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-2">
                  <span className="text-text-subtle">{k}</span>
                  <span className="font-mono text-text text-right truncate">{v}</span>
                </div>
              ))}
            </div>
            {detail?.dependency && (
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-1.5">Dependency</div>
                <div className="text-[11px] font-mono text-text">{detail.dependency.name}@{detail.dependency.version}</div>
                <div className="text-[10px] text-text-subtle">{detail.dependency.ecosystem}{detail.dependency.isDev ? ' · dev' : ''}</div>
              </div>
            )}
            {(detail?.affects || selected.affects || []).length > 0 && (
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-1.5">Affected assets</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(detail?.affects || selected.affects).map((a: any) => (
                    <div key={a.id} className="text-[11px] font-mono text-text-muted truncate">
                      <span className="text-text-subtle">{a.assetType}</span> {a.assetName || a.assetId}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {evidence && (
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[10px] font-mono text-text-subtle uppercase tracking-wider mb-1.5">Evidence</div>
                <pre className="text-[10px] font-mono text-text-muted whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-surface-raised rounded p-2">
                  {JSON.stringify(evidence, null, 1)}
                </pre>
              </div>
            )}
            {detail?.description && <div className="px-4 py-3 text-[11px] text-text-muted leading-relaxed border-b border-border">{detail.description}</div>}
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
              {STATUSES.filter((s) => s !== (detail?.status || selected.status)).map((s) => (
                <button
                  key={s}
                  onClick={async () => {
                    const updated = await api.updateSecurityFinding(selected.id, { status: s }).catch(() => null)
                    if (updated) {
                      setDetail(updated)
                      setData((d) => ({ ...d, items: d.items.map((i) => (i.id === selected.id ? { ...i, status: s } : i)) }))
                    }
                  }}
                  className="h-7 px-2 text-[10px] border border-border rounded text-text-muted hover:bg-surface-raised hover:text-text transition-colors"
                >
                  Mark {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dependencies ─────────────────────────────────────────────────────────────

function Dependencies() {
  const [name, setName] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getSecurityDependencies({ name: name || undefined, limit: PAGE, offset })
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false))
  }, [name, offset])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => { setOffset(0); setName(e.target.value) }} placeholder="Filter by package name…" className={`${inputCls} w-64`} />
        <span className="text-[11px] font-mono text-text-subtle ml-auto">{data.total} dependencies</span>
      </div>
      <Table head={['Package', 'Version', 'Ecosystem', 'CVEs', 'Findings', 'Flags', 'Last checked']}>
        {loading ? (
          <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-text-subtle">Loading…</td></tr>
        ) : data.items.length === 0 ? (
          <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-text-subtle">No dependencies</td></tr>
        ) : data.items.map((d) => {
          const cves: string[] = Array.isArray(d.cves) ? d.cves : []
          return (
            <tr key={d.id} className="hover:bg-surface-raised/70 transition-colors">
              <td className={`${td} font-mono text-text`}>{d.name}{d.alias ? <span className="text-text-subtle"> ({d.alias})</span> : null}</td>
              <td className={`${td} font-mono text-text-muted`}>{d.version}</td>
              <td className={`${td} font-mono text-text-muted`}>{d.ecosystem}</td>
              <td className={`${td} max-w-[260px]`}>
                {cves.length === 0 ? <span className="text-text-subtle">—</span> : (
                  <div className="flex flex-wrap gap-1">
                    {cves.slice(0, 5).map((c) => (
                      <span key={c} className="text-[10px] font-mono px-1 py-0.5 rounded bg-danger-subtle text-danger">{String(c)}</span>
                    ))}
                    {cves.length > 5 && <span className="text-[10px] text-text-subtle">+{cves.length - 5}</span>}
                  </div>
                )}
              </td>
              <td className={`${td} font-mono tabular-nums ${d._count?.findings ? 'text-danger' : 'text-text-subtle'}`}>{d._count?.findings ?? 0}</td>
              <td className={`${td} text-[10px] font-mono text-text-subtle`}>{[d.isDev && 'dev', d.isDirect && 'direct'].filter(Boolean).join(' · ') || '—'}</td>
              <td className={`${td} font-mono text-text-subtle whitespace-nowrap`}>{fmt(d.lastCheckedAt)}</td>
            </tr>
          )
        })}
      </Table>
      <Pager total={data.total} offset={offset} onPage={setOffset} />
    </div>
  )
}

// ── Events ───────────────────────────────────────────────────────────────────

const LEVEL_CLS: Record<string, string> = {
  CRITICAL: 'bg-danger-subtle text-danger ring-danger-subtle',
  HIGH: 'bg-warning-subtle text-warning ring-warning-subtle',
  MEDIUM: 'bg-info-subtle text-info ring-info-subtle',
  LOW: 'bg-surface-hover text-text-muted ring-border',
}

function Events() {
  const [filters, setFilters] = useState({ level: '', category: '' })
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getSecurityEvents({ ...filters, limit: PAGE, offset })
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false))
  }, [filters, offset])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filters.level} onChange={(e) => { setOffset(0); setFilters((f) => ({ ...f, level: e.target.value })) }} className={selectCls}>
          <option value="">All levels</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input value={filters.category} onChange={(e) => { setOffset(0); setFilters((f) => ({ ...f, category: e.target.value })) }} placeholder="Category" className={inputCls} />
        <span className="text-[11px] font-mono text-text-subtle ml-auto">{data.total} events</span>
      </div>
      <Table head={['Level', 'Category', 'Message', 'Source', 'Actor', 'Time']}>
        {loading ? (
          <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-text-subtle">Loading…</td></tr>
        ) : data.items.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-text-subtle">No events</td></tr>
        ) : data.items.map((e) => (
          <tr key={e.id} className="hover:bg-surface-raised/70 transition-colors">
            <td className={td}><Badge v={e.level} map={LEVEL_CLS} /></td>
            <td className={`${td} font-mono text-text-muted`}>{e.category}</td>
            <td className={`${td} max-w-[360px]`}><div className="truncate text-text">{e.message}</div></td>
            <td className={`${td} font-mono text-text-muted`}>{e.source}</td>
            <td className={`${td} font-mono text-text-subtle`}>{e.actorType || '—'}</td>
            <td className={`${td} font-mono text-text-subtle whitespace-nowrap`}>{fmt(e.timestamp)}</td>
          </tr>
        ))}
      </Table>
      <Pager total={data.total} offset={offset} onPage={setOffset} />
    </div>
  )
}

// ── Audits ───────────────────────────────────────────────────────────────────

function Audits() {
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getSecurityAudits({ limit: PAGE, offset })
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false))
  }, [offset])

  const summary = (a: any) => {
    const s = a.summary as any
    if (!s) return null
    const parts: string[] = []
    if (typeof s.findings === 'number') parts.push(`${s.findings} findings`)
    if (typeof s.total === 'number') parts.push(`${s.total} total`)
    for (const k of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (typeof s[k] === 'number' && s[k] > 0) parts.push(`${s[k]} ${k}`)
    }
    return parts.join(' · ') || null
  }

  return (
    <div className="space-y-3">
      <Table head={['Scanner', 'Category', 'Status', 'Summary', 'Started', 'Completed']}>
        {loading ? (
          <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-text-subtle">Loading…</td></tr>
        ) : data.items.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-text-subtle">No audits</td></tr>
        ) : data.items.map((a) => (
          <tr key={a.id} className="hover:bg-surface-raised/70 transition-colors">
            <td className={`${td} font-mono text-text`}>{a.scanner}</td>
            <td className={`${td} font-mono text-text-muted`}>{a.category}</td>
            <td className={td}>
              <Badge v={a.status} map={STATUS_CLS} />
              {a.status === 'FAILED' && a.statusMessage && <div className="text-[10px] text-danger mt-0.5 max-w-[240px] truncate">{a.statusMessage}</div>}
            </td>
            <td className={`${td} font-mono text-text-muted`}>{summary(a) || <span className="text-text-subtle">—</span>}</td>
            <td className={`${td} font-mono text-text-subtle whitespace-nowrap`}>{fmt(a.startedAt)}</td>
            <td className={`${td} font-mono text-text-subtle whitespace-nowrap`}>{fmt(a.completedAt)}</td>
          </tr>
        ))}
      </Table>
      <Pager total={data.total} offset={offset} onPage={setOffset} />
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function SecurityCenter({ user }: { user?: any }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [findSev, setFindSev] = useState<string | undefined>()
  const canReadSecurity = hasPermission(user?.permissions, 'security.read')

  if (!canReadSecurity) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="bg-surface border border-border rounded-lg px-8 py-10 text-center">
          <div className="text-sm font-semibold text-text">Forbidden</div>
          <p className="text-xs text-text-muted mt-1">Security Center is restricted to super admins.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <div className="max-w-[1320px] mx-auto px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-text">Security Center</h1>
          <p className="text-sm text-text-muted mt-0.5">Findings, dependencies, events and audit history</p>
        </div>

        <div className="flex items-center gap-0.5 mb-4 border-b border-border">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-8 px-3 text-[13px] font-medium transition-colors select-none border-b-2 -mb-px ${
                tab === key ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <Overview onGoFindings={(sev) => { setFindSev(sev); setTab('findings') }} />
        )}
        {tab === 'findings' && <Findings key={findSev || 'all'} initialSeverity={findSev} />}
        {tab === 'dependencies' && <Dependencies />}
        {tab === 'events' && <Events />}
        {tab === 'audits' && <Audits />}
      </div>
    </div>
  )
}
