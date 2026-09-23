import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../cms/api';

// V3.7.5 Part A — single owner of the discovery-run list.
//
// Update mechanisms, in priority order:
//   1. /api/activity/stream events (terminal events refresh the list once,
//      active-run events arm a watcher)
//   2. explicit refresh() — user action
//   3. a bounded exponential-backoff watcher per unfinished run — patches
//      only that run's row, never reloads the list, and stops at the first
//      terminal status
//
// There is deliberately no interval: an idle Radar issues zero repeated
// requests.

export const ACTIVE_RUN_STATUSES = new Set(['PENDING', 'RUNNING', 'DISCOVERING', 'ENRICHING', 'QUALIFYING']);
const RUN_TERMINAL_EVENTS = new Set(['DISCOVERY_RUN_COMPLETED', 'DISCOVERY_RUN_FAILED']);
const RUN_PROGRESS_EVENTS = new Set(['DISCOVERY_RUN_STARTED', 'DISCOVERY_RUN_GATED', 'DISCOVERY_PROVIDER_WARNING']);

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface UseDiscoveryRunsOptions {
  /** Called once per terminal run event (COMPLETED/FAILED) — e.g. reload stats. */
  onTerminal?: (runId: string) => void;
  limit?: number;
}

export function useDiscoveryRuns(opts?: UseDiscoveryRunsOptions) {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchersRef = useRef(new Map<string, { stop: boolean }>());
  const mountedRef = useRef(true);
  const onTerminalRef = useRef(opts?.onTerminal);
  onTerminalRef.current = opts?.onTerminal;

  const refresh = useCallback(async () => {
    try {
      const res = await api.getDiscoveryRuns(opts?.limit ?? 50, 0);
      if (mountedRef.current) {
        setRuns(res.items || []);
        setError(null);
      }
      return res.items || [];
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message || 'Failed to load discovery runs');
      return [];
    }
  }, [opts?.limit]);

  /** Patch one run in place — never rebuilds the list. */
  const patchRun = useCallback((run: any) => {
    if (!run?.id) return;
    setRuns((prev) => {
      const idx = prev.findIndex((r) => r.id === run.id);
      if (idx < 0) return [run, ...prev];
      const next = prev.slice();
      next[idx] = { ...prev[idx], ...run };
      return next;
    });
  }, []);

  /**
   * Run-scoped progress watcher: bounded exponential backoff while the run
   * is unfinished. Patches only this run — no list reload, no table touch —
   * and stops immediately on the first terminal status.
   */
  const startProgressWatcher = useCallback((runId: string) => {
    if (!runId || watchersRef.current.has(runId)) return;
    const ctl = { stop: false };
    watchersRef.current.set(runId, ctl);
    void (async () => {
      let delay = 2000;
      try {
        while (!ctl.stop && mountedRef.current) {
          await sleep(delay);
          if (ctl.stop || !mountedRef.current) break;
          let run: any = null;
          try {
            const res = await api.getDiscoveryRun(runId);
            run = res?.run ?? res;
          } catch {
            break;
          }
          if (!run) break;
          patchRun(run);
          if (!ACTIVE_RUN_STATUSES.has(run.status)) {
            onTerminalRef.current?.(runId);
            break;
          }
          delay = Math.min(delay * 2, 30000);
        }
      } finally {
        watchersRef.current.delete(runId);
      }
    })();
  }, [patchRun]);

  const stopAllWatchers = useCallback(() => {
    watchersRef.current.forEach((w) => { w.stop = true; });
    watchersRef.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;
    const seenEventIds = new Set<string>();

    // Initial load; unfinished runs each get their own watcher.
    refresh()
      .then((items) => items.forEach((r) => ACTIVE_RUN_STATUSES.has(r.status) && startProgressWatcher(r.id)))
      .finally(() => { if (mountedRef.current) setLoading(false); });

    // Activity stream: run events only. Each terminal event refreshes the
    // list exactly once (deduped by event id); progress events arm the
    // run's watcher if it isn't already running.
    try {
      es = new EventSource('/api/activity/stream', { withCredentials: true });
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (ev?.module !== 'DISCOVERY' || typeof ev?.eventType !== 'string') return;
          const eventKey = ev?.id ? String(ev.id) : `${ev.eventType}:${ev.discoveryRunId ?? ''}`;
          if (seenEventIds.has(eventKey)) return;
          seenEventIds.add(eventKey);
          const runId = ev?.discoveryRunId;
          if (RUN_TERMINAL_EVENTS.has(ev.eventType)) {
            void refresh();
            if (runId) onTerminalRef.current?.(runId);
          } else if (RUN_PROGRESS_EVENTS.has(ev.eventType) && runId) {
            if (!watchersRef.current.has(runId)) {
              // New or progressed run — one targeted fetch for its row, then watch.
              api.getDiscoveryRun(runId)
                .then((res) => patchRun(res?.run ?? res))
                .catch(() => undefined);
              startProgressWatcher(runId);
            }
          }
        } catch { /* malformed event */ }
      };
    } catch { /* stream unsupported — explicit refresh still works */ }

    return () => {
      mountedRef.current = false;
      es?.close();
      stopAllWatchers();
    };
  }, [refresh, patchRun, startProgressWatcher, stopAllWatchers]);

  return { runs, loading, error, refresh, startProgressWatcher, patchRun };
}
