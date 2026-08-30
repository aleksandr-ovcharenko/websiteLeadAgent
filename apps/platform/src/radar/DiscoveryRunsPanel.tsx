import { useEffect, useState } from 'react';
import { Button } from '../cms/ui';
import { api } from '../cms/api';

interface DiscoveryRun {
  id: string;
  provider: string;
  query: string;
  location?: string;
  limit: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  collected: number;
  createdCount: number;
  duplicateCount: number;
  errorMessage?: string;
  createdAt: string;
}

interface DiscoveryRunsPanelProps {
  open: boolean;
  onReloadLeads: () => void;
  onDuplicate: (run: any) => void;
}

export default function DiscoveryRunsPanel({ open, onReloadLeads, onDuplicate }: DiscoveryRunsPanelProps) {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDiscoveryRuns(50, 0);
      setRuns(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load discovery runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [open]);

  async function runAgain(id: string) {
    setBusy(id);
    try {
      await api.runDiscoveryAgain(id);
      await refresh();
      setTimeout(onReloadLeads, 1500);
    } catch (e: any) {
      setError(e.message || 'Run again failed');
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(id: string) {
    try {
      const res = await api.duplicateDiscoveryRun(id);
      onDuplicate(res);
    } catch (e: any) {
      setError(e.message || 'Duplicate failed');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed right-4 top-[100px] z-50 w-[400px] max-h-[calc(100vh-120px)] overflow-y-auto bg-white border border-[#e5e3df] rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-[#1c1917]">Discovery history</h3>
        <button onClick={refresh} className="text-[12px] text-[#276749] hover:underline">Refresh</button>
      </div>
      {error && <div className="text-[11px] text-red-600 mb-2">{error}</div>}
      {loading && runs.length === 0 && <div className="text-[12px] text-[#a8a29e]">Loading…</div>}
      {!loading && runs.length === 0 && <div className="text-[12px] text-[#a8a29e]">No discovery runs yet</div>}
      <div className="space-y-2">
        {runs.map((run) => (
          <div key={run.id} className="border border-[#e5e3df] rounded p-2.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-medium">{run.provider}</span>
              <StatusBadge status={run.status} />
            </div>
            <div className="text-[#57534e] mt-1 truncate">{run.query}</div>
            {run.location && <div className="text-[#a8a29e]">{run.location}</div>}
            <div className="text-[#a8a29e] mt-1">Limit: {run.limit} · {run.createdCount} new / {run.duplicateCount} dup</div>
            {run.errorMessage && <div className="text-red-600 text-[11px] mt-1 truncate">{run.errorMessage}</div>}
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => runAgain(run.id)} disabled={busy === run.id}>
                {busy === run.id ? '…' : 'Run again'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => duplicate(run.id)}>
                Duplicate
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-500',
    RUNNING: 'bg-amber-50 text-amber-700',
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    FAILED: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}
