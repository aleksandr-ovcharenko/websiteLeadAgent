import { useEffect, useRef, useState, useMemo } from 'react';
import { useActivityStream, type ActivityEvent } from './useActivityStream';
import { Button } from '../cms/ui';

const MODULES = ['All', 'RADAR', 'DISCOVERY', 'AUDIT', 'LIGHTHOUSE', 'AI', 'SCORING', 'FACTORY', 'CRAWLER', 'CMS', 'MEDIA', 'RENDERER', 'FORGE', 'STUDIO', 'SHOWCASE', 'SYSTEM'];
const LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*[mK]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function levelColor(level: string) {
  switch (level) {
    case 'ERROR': return 'text-red-700 bg-red-50 border-red-200';
    case 'WARN': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'INFO': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    default: return 'text-stone-600 bg-stone-50 border-stone-200';
  }
}

function StatusDot({ status }: { status: string }) {
  if (status === 'LIVE') return <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>;
  if (status === 'RECONNECTING') return <span className="flex items-center gap-1 text-[10px] font-mono text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500" />RECONNECTING</span>;
  return <span className="flex items-center gap-1 text-[10px] font-mono text-red-700"><span className="w-2 h-2 rounded-full bg-red-500" />OFFLINE</span>;
}

function ContextChips({ event }: { event: ActivityEvent }) {
  const chips: { label: string; href?: string }[] = [];
  if (event.details.leadName) chips.push({ label: `Lead: ${event.details.leadName}`, href: `/radar` });
  else if (event.leadId) chips.push({ label: `Lead: ${event.leadId.slice(0, 8)}...` });
  if (event.details.siteName) chips.push({ label: `Site: ${event.details.siteName}`, href: `/forge` });
  else if (event.siteId) chips.push({ label: `Site: ${event.siteId.slice(0, 8)}...` });
  if (event.details.demoVariantName) chips.push({ label: `Variant: ${event.details.demoVariantName}` });
  else if (event.demoVariantId) chips.push({ label: `Variant: ${event.demoVariantId.slice(0, 8)}...` });
  if (event.runId) chips.push({ label: `Run: ${event.runId.slice(0, 8)}...` });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map((c, i) => c.href ? (
        <a key={i} href={c.href} onClick={(e) => { e.stopPropagation(); }} className="text-[10px] font-mono text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded hover:bg-stone-200">{c.label}</a>
      ) : (
        <span key={i} className="text-[10px] font-mono text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">{c.label}</span>
      ))}
    </div>
  );
}

function EventRow({ event, onToggle }: { event: ActivityEvent; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasDetails = event.errorCode || event.rawError || Object.keys(event.details || {}).length > 0;
  return (
    <div className={`border-b border-stone-100 last:border-0 ${event.level === 'ERROR' ? 'bg-red-50/30' : ''}`}>
      <div
        className="flex items-start gap-3 px-4 py-2 text-[12px] font-mono cursor-pointer hover:bg-stone-50"
        onClick={() => { setOpen(!open); onToggle(event.id); }}
      >
        <span className="shrink-0 text-stone-400 w-16 pt-0.5">{fmtTime(event.timestamp)}</span>
        <span className={`shrink-0 w-16 text-center px-1 py-0.5 rounded border text-[10px] font-semibold ${levelColor(event.level)}`}>{event.level}</span>
        <span className="shrink-0 w-20 text-stone-500 text-[10px] pt-0.5">{event.module}</span>
        <span className={`flex-1 break-words pt-0.5 ${event.level === 'ERROR' ? 'text-red-800' : 'text-stone-700'}`}>
          {stripAnsi(event.errorMessage || event.message)}
          {hasDetails && <span className="ml-2 text-stone-400 text-[10px]">[Details]</span>}
          <ContextChips event={event} />
        </span>
      </div>
      {open && hasDetails && (
        <div className="px-4 pb-3 pl-28 text-[11px] font-mono text-stone-600 space-y-1">
          {event.eventType && <div className="text-stone-400">eventType: {event.eventType}</div>}
          {event.stage && <div className="text-stone-400">stage: {event.stage}</div>}
          {event.errorCode && <div className="text-red-700">errorCode: {event.errorCode}</div>}
          {event.message !== event.errorMessage && <div>message: {stripAnsi(event.message)}</div>}
          {Object.keys(event.details || {}).length > 0 && (
            <pre className="mt-2 p-2 bg-stone-50 border border-stone-200 rounded overflow-auto max-h-48">{JSON.stringify(event.details, null, 2)}</pre>
          )}
          {event.rawError && (
            <pre className="mt-2 p-2 bg-red-50 border border-red-100 rounded overflow-auto max-h-48 text-red-800">{stripAnsi(event.rawError)}</pre>
          )}
          <div className="text-stone-400">id: {event.id}</div>
        </div>
      )}
    </div>
  );
}

export function ActivityConsole() {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('activityConsoleExpanded') === 'true'; } catch { return false; }
  });
  const [module, setModule] = useState('All');
  const [levelGte, setLevelGte] = useState('INFO');
  const [autoScroll, setAutoScroll] = useState(() => {
    try { return localStorage.getItem('activityConsoleAutoScroll') !== 'false'; } catch { return true; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);

  const filter = useMemo(() => ({
    module: module === 'All' ? undefined : module,
    levelGte: levelGte as any,
  }), [module, levelGte]);

  const { visible, status, search, setSearch, clear } = useActivityStream(filter);

  useEffect(() => {
    try { localStorage.setItem('activityConsoleExpanded', String(expanded)); } catch {}
  }, [expanded]);

  useEffect(() => {
    try { localStorage.setItem('activityConsoleAutoScroll', String(autoScroll)); } catch {}
  }, [autoScroll]);

  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visible, expanded, autoScroll, paused]);

  const toggleDetail = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const errorCount = useMemo(() => visible.filter(e => e.level === 'ERROR').length, [visible]);

  return (
    <div data-testid="activity-console" className={`shrink-0 w-full z-50 bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(28,25,23,0.07)] transition-all duration-200 ${expanded ? 'h-[45vh]' : 'h-10'}`}>
      <div className="flex items-center justify-between px-4 h-10 border-b border-stone-200 bg-stone-50">
        <div className="flex items-center gap-3">
          <button data-testid="activity-console-toggle" onClick={() => setExpanded(!expanded)} className="text-[13px] font-semibold text-stone-700 hover:text-stone-900">
            {expanded ? '−' : '+'} Activity Console
          </button>
          <StatusDot status={status} />
          {errorCount > 0 && <span className="text-[10px] font-mono text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">{errorCount} errors</span>}
        </div>
        {!expanded && (
          <span className="text-[10px] text-stone-400 font-mono">{visible.length} events</span>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col h-[calc(45vh-2.5rem)]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-200 bg-white">
            <select value={module} onChange={(e) => setModule(e.target.value)} className="text-[11px] font-mono border border-stone-200 rounded px-2 py-1">
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={levelGte} onChange={(e) => setLevelGte(e.target.value)} className="text-[11px] font-mono border border-stone-200 rounded px-2 py-1">
              {LEVELS.map(l => <option key={l} value={l}>{l}+</option>)}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="text-[11px] font-mono border border-stone-200 rounded px-2 py-1 flex-1"
            />
            <label className="flex items-center gap-1 text-[11px] font-mono text-stone-600">
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll
            </label>
            <Button size="sm" variant="secondary" onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</Button>
            <Button size="sm" variant="secondary" onClick={clear}>Clear</Button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono">
            {visible.length ? visible.map(e => <EventRow key={e.id} event={e} onToggle={toggleDetail} />) : (
              <div className="p-6 text-center text-[12px] text-stone-400 font-mono">No activity yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
