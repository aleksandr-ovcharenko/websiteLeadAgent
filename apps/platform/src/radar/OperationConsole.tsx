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
    case 'SUCCESS': return 'text-success';
    case 'WARN': return 'text-warning';
    case 'ERROR': return 'text-danger';
    default: return 'text-text';
  }
}

function statusColor(status: OpStatus) {
  switch (status) {
    case 'SUCCESS': return 'text-success bg-success-subtle border-success-subtle';
    case 'FAILED': return 'text-danger bg-danger-subtle border-danger-subtle';
    case 'CANCELLED': return 'text-text-muted bg-surface-hover border-border';
    case 'RUNNING': return 'text-success bg-success-subtle border-success-subtle';
    default: return 'text-warning bg-warning-subtle border-warning-subtle';
  }
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*[mK]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
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
    const lines = events.map((e) => `[${fmtTime(e.createdAt)}] ${e.level}${e.stage ? ` [${e.stage}]` : ''} ${stripAnsi(e.message)}`);
    if (run?.status === 'FAILED' && run?.error) {
      lines.push('');
      lines.push('--- Error ---');
      lines.push(stripAnsi(run.error?.message || JSON.stringify(run.error, null, 2)));
    }
    if (run?.result) {
      lines.push('');
      lines.push('--- Result ---');
      lines.push(JSON.stringify(run.result, null, 2));
    }
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  const output = events.map((e) => (
    <div key={e.id} className="flex gap-2 text-[12px] font-mono leading-5">
      <span className="text-text-subtle shrink-0">{fmtTime(e.createdAt)}</span>
      <span className={`shrink-0 w-16 font-medium ${levelColor(e.level)}`}>{e.level}</span>
      {e.stage ? <span className="shrink-0 text-text-subtle w-24 truncate">{e.stage}</span> : null}
      <span className={`break-words ${levelColor(e.level)}`}>{stripAnsi(e.message)}</span>
    </div>
  ));

  const errorBlock = run?.error ? (
    <div className="mt-3 p-3 rounded border bg-danger-subtle border-danger-subtle text-danger text-[12px] font-mono">
      <div className="font-semibold mb-1">Error</div>
      <pre className="whitespace-pre-wrap break-words overflow-auto max-h-60">
        {stripAnsi(run.error?.message || JSON.stringify(run.error, null, 2))}
      </pre>
      {run.error?.code && <div className="mt-1 text-danger">code: {run.error.code}</div>}
    </div>
  ) : null;

  const resultBlock = run?.result ? (
    <div className="mt-3 p-3 rounded border bg-success-subtle border-success-subtle text-success text-[12px] font-mono">
      <div className="font-semibold mb-1">Result</div>
      <pre className="whitespace-pre-wrap">{JSON.stringify(run.result, null, 2)}</pre>
    </div>
  ) : null;

  const status = run?.status ?? 'PENDING';
  const label = title || (run ? run.operationId : 'Operation');

  return (
    <div data-testid="operation-console" className={`bg-surface border border-border rounded-[8px] shadow-sm overflow-hidden ${expanded ? '' : 'h-[54px]'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
        <div className="flex items-center gap-3">
          <button onClick={() => setExpanded(!expanded)} className="text-text hover:text-text text-[13px] font-semibold">
            {expanded ? '−' : '+'} {label}
          </button>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${statusColor(status)}`}>
            {status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
            {status}
          </span>
          <span className="text-[11px] text-text-subtle">
            {run?.startedAt ? `${fmtTime(run.startedAt)} — ${elapsed(run.startedAt, run.finishedAt)}` : 'starting...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-text cursor-pointer">
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
            <div className="mb-2 text-danger text-[12px]">{lastError}</div>
          )}
          <div ref={scrollRef} className="max-h-[360px] overflow-y-auto font-mono space-y-1 pr-2">
            {output.length ? output : <div className="text-text-subtle text-[12px]">No output yet.</div>}
          </div>
          {resultBlock}
          {errorBlock}
        </div>
      )}
    </div>
  );
}
