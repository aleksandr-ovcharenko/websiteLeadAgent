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

  useEffect(() => { refresh(); }, []);

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
      PENDING: 'bg-gray-100 text-gray-500',
      RUNNING: 'bg-amber-50 text-amber-700',
      COMPLETED: 'bg-emerald-50 text-emerald-700',
      FAILED: 'bg-red-50 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-500';
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">Discovery history</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onNewDiscovery(undefined)}>+ New discovery</Button>
          <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        {loading && <div className="text-[13px] text-[#a8a29e]">Loading runs…</div>}
        {!loading && runs.length === 0 && <div className="text-[13px] text-[#a8a29e]">No discovery runs yet</div>}

        {!loading && runs.length > 0 && (
          <div className="bg-white border border-[#e5e3df] rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#fafaf8] border-b border-[#e5e3df]">
                <tr>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Provider</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Query</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Status</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Leads</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">When</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-[#f0ede8] last:border-0">
                    <td className="py-2.5 px-3 text-[13px] font-medium text-[#1c1917]">{run.provider}</td>
                    <td className="py-2.5 px-3 text-[12px] text-[#57534e]">
                      <div className="truncate max-w-[200px]">{run.query}</div>
                      {run.location && <div className="text-[#a8a29e]">{run.location}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusClass(run.status)}`}>{run.status}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-[#57534e]">
                      {run.createdCount} new · {run.duplicateCount} dup
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-[#a8a29e]">
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
