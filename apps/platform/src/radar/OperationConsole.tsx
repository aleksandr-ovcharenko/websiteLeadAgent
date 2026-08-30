import { useEffect, useRef, useState, useMemo } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';

type OpStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

interface OperationEvent {
  id: string;
  level: string;
  stage: string | null;
  message: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface OperationRun {
  id: string;
  operationId: string;
  status: OpStatus;
  startedAt: string | null;
  finishedAt: string | null;
  result: any;
  error: any;
  events?: OperationEvent[];
}

function fmtTime(iso?: string | null) {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function elapsed(start?: string | null, end?: string | null) {
  const s = start ? new Date(start).getTime() : null;
  const e = end ? new Date(end).getTime() : Date.now();
  if (!s) return '0.0s';
  const sec = (e - s) / 1000;
  return `${sec.toFixed(1)}s`;
}

function levelColor(level: string) {
  switch (level) {
    case 'SUCCESS': return 'text-emerald-700';
    case 'WARN': return 'text-amber-700';
    case 'ERROR': return 'text-red-700';
    default: return 'text-[#57534e]';
  }
}

function statusColor(status: OpStatus) {
  switch (status) {
    case 'SUCCESS': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'FAILED': return 'text-red-700 bg-red-50 border-red-200';
    case 'CANCELLED': return 'text-gray-600 bg-gray-100 border-gray-200';
    case 'RUNNING': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    default: return 'text-amber-700 bg-amber-50 border-amber-200';
  }
}

export function OperationConsole({ runId, title, onClose }: { runId: string; title?: string; onClose?: () => void }) {
  const [run, setRun] = useState<OperationRun | null>(null);
  const [events, setEvents] = useState<OperationEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = useMemo(() => run?.status === 'PENDING' || run?.status === 'RUNNING', [run]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { run } = await api.getOperation(runId);
        const { events } = await api.getOperationEvents(runId);
        if (!mounted) return;
        setRun(run);
        setEvents(events ?? []);
        setLastError(null);
      } catch (e: any) {
        if (mounted) setLastError(e.message || 'Failed to load operation');
      }
    }
    load();
    intervalRef.current = setInterval(load, 1000);
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runId]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll, expanded]);

  const copyToClipboard = () => {
    const text = events.map((e) => `[${fmtTime(e.createdAt)}] ${e.level}${e.stage ? ` [${e.stage}]` : ''} ${e.message}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const output = events.map((e) => (
    <div key={e.id} className="flex gap-2 text-[12px] font-mono leading-5">
      <span className="text-[#a8a29e] shrink-0">{fmtTime(e.createdAt)}</span>
      <span className={`shrink-0 w-16 font-medium ${levelColor(e.level)}`}>{e.level}</span>
      {e.stage ? <span className="shrink-0 text-[#a8a29e] w-24 truncate">{e.stage}</span> : null}
      <span className={`break-words ${levelColor(e.level)}`}>{e.message}</span>
    </div>
  ));

  const errorBlock = run?.error ? (
    <div className="mt-3 p-3 rounded border bg-red-50 border-red-200 text-red-800 text-[12px] font-mono">
      <div className="font-semibold mb-1">Error</div>
      {run.error?.message || JSON.stringify(run.error)}
    </div>
  ) : null;

  const resultBlock = run?.result ? (
    <div className="mt-3 p-3 rounded border bg-emerald-50 border-emerald-200 text-emerald-900 text-[12px] font-mono">
      <div className="font-semibold mb-1">Result</div>
      <pre className="whitespace-pre-wrap">{JSON.stringify(run.result, null, 2)}</pre>
    </div>
  ) : null;

  const status = run?.status ?? 'PENDING';
  const label = title || (run ? run.operationId : 'Operation');

  return (
    <div className={`bg-white border border-[#e5e3df] rounded-[8px] shadow-sm overflow-hidden ${expanded ? '' : 'h-[54px]'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e3df] bg-[#fafaf9]">
        <div className="flex items-center gap-3">
          <button onClick={() => setExpanded(!expanded)} className="text-[#57534e] hover:text-[#1c1917] text-[13px] font-semibold">
            {expanded ? '−' : '+'} {label}
          </button>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${statusColor(status)}`}>
            {status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {status}
          </span>
          <span className="text-[11px] text-[#a8a29e]">
            {run?.startedAt ? `${fmtTime(run.startedAt)} — ${elapsed(run.startedAt, run.finishedAt)}` : 'starting...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-[#57534e] cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="rounded" />
            Auto-scroll
          </label>
          <Button size="sm" variant="secondary" onClick={() => setEvents([])}>Clear</Button>
          <Button size="sm" variant="secondary" onClick={copyToClipboard}>Copy</Button>
          {onClose && <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>}
        </div>
      </div>
      {expanded && (
        <div className="p-3 min-h-[120px]">
          {lastError && (
            <div className="mb-2 text-red-700 text-[12px]">{lastError}</div>
          )}
          <div ref={scrollRef} className="max-h-[360px] overflow-y-auto font-mono space-y-1 pr-2">
            {output.length ? output : <div className="text-[#a8a29e] text-[12px]">No output yet.</div>}
          </div>
          {resultBlock}
          {errorBlock}
        </div>
      )}
    </div>
  );
}
