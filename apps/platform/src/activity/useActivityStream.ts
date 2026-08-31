import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../cms/api';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  level: string;
  module: string;
  eventType: string | null;
  message: string;
  stage: string | null;
  runId: string | null;
  leadId: string | null;
  siteId: string | null;
  demoVariantId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawError: string | null;
  details: Record<string, any>;
}

export interface ActivityFilter {
  module?: string;
  levelGte?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  runId?: string;
  leadId?: string;
  siteId?: string;
  demoVariantId?: string;
}

const LEVEL_ORDER = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

function matchesFilter(event: ActivityEvent, filter: ActivityFilter, search: string) {
  if (filter.module && event.module !== filter.module) return false;
  if (filter.levelGte && LEVEL_ORDER[event.level as keyof typeof LEVEL_ORDER] < LEVEL_ORDER[filter.levelGte]) return false;
  if (filter.runId && event.runId !== filter.runId) return false;
  if (filter.leadId && event.leadId !== filter.leadId) return false;
  if (filter.siteId && event.siteId !== filter.siteId) return false;
  if (filter.demoVariantId && event.demoVariantId !== filter.demoVariantId) return false;
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    event.message.toLowerCase().includes(s) ||
    event.module.toLowerCase().includes(s) ||
    (event.eventType || '').toLowerCase().includes(s)
  );
}

export function useActivityStream(filter: ActivityFilter = {}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<'LIVE' | 'RECONNECTING' | 'OFFLINE'>('OFFLINE');
  const [visible, setVisible] = useState<ActivityEvent[]>([]);
  const [search, setSearch] = useState('');
  const bufferRef = useRef<ActivityEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const truncate = useCallback((buf: ActivityEvent[]) => {
    return buf.length > 1000 ? buf.slice(buf.length - 1000) : buf;
  }, []);

  const apply = useCallback(() => {
    const filtered = bufferRef.current.filter(e => matchesFilter(e, filter, search));
    setVisible(filtered.slice(-500));
    setEvents(bufferRef.current);
  }, [filter, search]);

  useEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      try {
        const { items } = await api.getActivityHistory({ limit: 200 });
        if (!mounted) return;
        bufferRef.current = truncate(items);
        apply();
      } catch {
        setStatus('OFFLINE');
      }
    }

    function connect() {
      if (!mounted) return;
      setStatus('RECONNECTING');

      const es = new EventSource('/api/activity/stream', { withCredentials: true });
      eventSourceRef.current = es;

      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data);
          bufferRef.current = truncate([...bufferRef.current, event]);
          apply();
        } catch {}
      };

      es.onopen = () => setStatus('LIVE');
      es.onerror = () => setStatus('OFFLINE');
    }

    loadHistory().then(connect);

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [apply, truncate]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    apply();
  }, [apply]);

  return { events, visible, status, search, setSearch, clear };
}
