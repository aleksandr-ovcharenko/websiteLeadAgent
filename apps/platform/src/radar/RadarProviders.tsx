import { useEffect, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';

interface Provider {
  id: string;
  name: string;
  capabilities: Record<string, boolean>;
  config?: { credentialEnv?: string; helpText?: string };
  enabled: boolean;
  status: 'READY' | 'NOT_CONFIGURED' | 'DISABLED' | 'ERROR' | 'UNAVAILABLE';
  configured: boolean;
  defaults: Record<string, any>;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  recentRunsCount: number;
}

interface RadarProvidersProps {
  onNewDiscovery: (providerId?: string) => void;
  onOpenPresets: () => void;
}

export default function RadarProviders({ onNewDiscovery, onOpenPresets }: RadarProvidersProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDiscoveryProviders();
      setProviders(res.providers || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  async function toggleEnabled(p: Provider) {
    try {
      await api.updateDiscoveryProviderConfig(p.id, { enabled: !p.enabled });
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    }
  }

  async function testProvider(id: string) {
    setTesting(id);
    try {
      await api.testDiscoveryProvider(id);
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Test failed');
    } finally {
      setTesting(null);
    }
  }

  function capabilityList(capabilities?: Record<string, boolean>) {
    const map: Record<string, string> = {
      supportsTextQuery: 'Text search',
      supportsLocation: 'Location',
      supportsPagination: 'Pagination',
      supportsCategories: 'Categories',
      supportsCoordinates: 'Coordinates',
      supportsRadius: 'Radius',
      supportsManualInput: 'Manual input',
      requiresCredentials: 'Requires credentials',
    };
    return Object.entries(capabilities || {})
      .filter(([, v]) => v)
      .map(([k]) => map[k] || k);
  }

  function statusDot(status?: string) {
    const colors: Record<string, string> = {
      READY: 'bg-emerald-500',
      NOT_CONFIGURED: 'bg-amber-500',
      DISABLED: 'bg-gray-400',
      ERROR: 'bg-red-500',
      UNAVAILABLE: 'bg-stone-400',
    };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[(status || '') as string] || 'bg-gray-400'}`} />;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">Discovery providers</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onOpenPresets}>Search presets</Button>
          <Button size="sm" onClick={() => onNewDiscovery(undefined)}>+ New discovery</Button>
          <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        {loading && <div className="text-[13px] text-[#a8a29e]">Loading providers…</div>}
        {!loading && providers.length === 0 && <div className="text-[13px] text-[#a8a29e]">No providers found</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="bg-white border border-[#e5e3df] rounded-md p-4 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[14px] font-semibold text-[#1c1917]">{p.name}</div>
                  <div className="text-[11px] text-[#a8a29e] font-mono mt-0.5">{p.id}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#57534e]">
                  {statusDot(p.status)}
                  {(p.status || 'UNKNOWN').replace(/_/g, ' ')}
                </div>
              </div>

              <div className="text-[12px] text-[#57534e] mb-3 min-h-[40px]">
                {capabilityList(p.capabilities).join(' · ')}
              </div>

              <div className="text-[11px] text-[#a8a29e] mb-3 space-y-1">
                {p.config?.credentialEnv && (
                  <div>Env binding: <span className="font-mono text-[#78716c]">{p.config.credentialEnv}</span></div>
                )}
                {!p.config?.credentialEnv && p.capabilities?.requiresCredentials === false && (
                  <div>No API key required</div>
                )}
                {p.lastTestAt && (
                  <div>Last test: <span className={p.lastTestStatus === 'SUCCESS' ? 'text-emerald-600' : 'text-amber-600'}>{p.lastTestStatus}</span> · {new Date(p.lastTestAt).toLocaleString()}</div>
                )}
                {p.recentRunsCount > 0 && <div>Recent runs: {p.recentRunsCount}</div>}
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setSelected(p)}>Configure</Button>
                <Button variant="secondary" size="sm" onClick={() => testProvider(p.id)} disabled={testing === p.id}>
                  {testing === p.id ? '…' : 'Test'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onNewDiscovery(p.id)} disabled={!p.configured || p.status === 'DISABLED'}>
                  New discovery
                </Button>
                <Button variant={p.enabled ? 'ghost' : 'secondary'} size="sm" onClick={() => toggleEnabled(p)}>
                  {p.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <ProviderConfigModal
          provider={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ProviderConfigModal({ provider, onClose, onSaved }: { provider: Provider; onClose: () => void; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(provider.enabled);
  const [defaults, setDefaults] = useState<Record<string, any>>(provider.defaults || {});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      await api.updateDiscoveryProviderConfig(provider.id, { enabled, defaults });
      onSaved();
    } catch (e: any) {
      setMessage(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await api.testDiscoveryProvider(provider.id);
      setMessage(`${res.status}: ${res.message}`);
    } catch (e: any) {
      setMessage(e.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  function setDefault(key: string, value: any) {
    setDefaults((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white border border-[#e5e3df] rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-[#1c1917]">Configure {provider.name}</h2>
          <button onClick={onClose} className="text-[#a8a29e] hover:text-[#1c1917]">×</button>
        </div>

        {message && <div className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{message}</div>}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[#57534e]">Enabled</label>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#57534e] mb-1">Default location</label>
            <input
              type="text"
              value={defaults.defaultLocation ?? ''}
              onChange={(e) => setDefault('defaultLocation', e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#57534e] mb-1">Default limit</label>
            <input
              type="number"
              value={defaults.defaultLimit ?? 50}
              onChange={(e) => setDefault('defaultLimit', Number(e.target.value))}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#57534e] mb-1">Default max pages</label>
            <input
              type="number"
              value={defaults.defaultMaxPages ?? 5}
              onChange={(e) => setDefault('defaultMaxPages', Number(e.target.value))}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded"
            />
          </div>

          {provider.config?.credentialEnv && (
            <div className="text-[11px] text-[#a8a29e] bg-[#fafaf8] border border-[#e5e3df] rounded p-3">
              <div className="font-medium text-[#57534e] mb-1">Credentials</div>
              <div>Environment binding: <span className="font-mono">{provider.config.credentialEnv}</span></div>
              <div className="mt-1">Status: {provider.configured ? 'Configured' : 'Not configured'}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-6">
          <Button size="sm" onClick={save} disabled={saving}>{saving ? '…' : 'Save'}</Button>
          <Button variant="secondary" size="sm" onClick={test} disabled={testing}>{testing ? '…' : 'Test / Recheck'}</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
