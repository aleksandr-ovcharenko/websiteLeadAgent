import { useEffect, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';

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

interface RadarHistoryProps {
  onNewDiscovery: (providerId?: string) => void;
  onDuplicate: (run: any) => void;
}

export default function RadarHistory({ onNewDiscovery, onDuplicate }: RadarHistoryProps) {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDiscoveryRuns(50, 0);
      setRuns(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  async function runAgain(id: string) {
    setBusy(id);
    try {
      await api.runDiscoveryAgain(id);
      await refresh();
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

  function statusClass(status: string) {
    const map: Record<string, string> = {
      PENDING: 'bg-surface-hover text-text-muted',
      RUNNING: 'bg-warning-subtle text-warning',
      DISCOVERING: 'bg-warning-subtle text-warning',
      ENRICHING: 'bg-info-subtle text-info',
      QUALIFYING: 'bg-info-subtle text-info',
      COMPLETED: 'bg-success-subtle text-success',
      FAILED: 'bg-danger-subtle text-danger',
    };
    return map[status] || 'bg-surface-hover text-text-muted';
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-surface border-b border-border px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-text">Discovery history</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onNewDiscovery(undefined)}>+ New discovery</Button>
          <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 text-[12px] text-danger bg-danger-subtle border border-danger-subtle rounded px-3 py-2">{error}</div>}
        {loading && <div className="text-[13px] text-text-subtle">Loading runs…</div>}
        {!loading && runs.length === 0 && <div className="text-[13px] text-text-subtle">No discovery runs yet</div>}

        {!loading && runs.length > 0 && (
          <div className="bg-surface border border-border rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-raised border-b border-border">
                <tr>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Provider</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Query</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Status</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Leads</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">When</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 text-[13px] font-medium text-text">{run.provider}</td>
                    <td className="py-2.5 px-3 text-[12px] text-text">
                      <div className="truncate max-w-[200px]">{run.query}</div>
                      {run.location && <div className="text-text-subtle">{run.location}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusClass(run.status)}`}>{run.status}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-text">
                      {run.collected} found · {run.createdCount} new leads · {run.duplicateCount} known
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-text-subtle">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => runAgain(run.id)} disabled={busy === run.id}>
                          {busy === run.id ? '…' : 'Run again'}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => duplicate(run.id)}>Duplicate</Button>
                        <Button variant="secondary" size="sm" onClick={() => onNewDiscovery(run.provider)}>New</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
