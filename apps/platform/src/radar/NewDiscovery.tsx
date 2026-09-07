import { useEffect, useMemo, useState } from 'react';
import { Button } from '../cms/ui';
import { api } from '../cms/api';
import { OperationConsole } from './OperationConsole';

interface NewDiscoveryProps {
  open: boolean;
  onClose: () => void;
  onStarted: (runId?: string) => void;
  initialData?: any;
}

interface Provider {
  id: string;
  name: string;
  configured: boolean;
  capabilities: Record<string, boolean>;
  config?: { helpText?: string };
}

interface Preset {
  id: string;
  name: string;
  category: string;
  defaultQuery: string;
  defaultProvider: string;
  defaultLimit: number;
}

export default function NewDiscovery({ open, onClose, onStarted, initialData }: NewDiscoveryProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [provider, setProvider] = useState('dgis');
  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('Минск');
  const [limit, setLimit] = useState(50);
  const [maxPages, setMaxPages] = useState(5);
  const [manualEntries, setManualEntries] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationRunId, setOperationRunId] = useState<string | null>(null);

  const selectedProvider = useMemo(() => providers.find((p) => p.id === provider), [providers, provider]);
  const selectedPreset = useMemo(() => presets.find((p) => p.id === topic), [presets, topic]);

  useEffect(() => {
    if (open && initialData) {
      setProvider(initialData.provider || 'dgis');
      setTopic(initialData.topic || '');
      setQuery(initialData.query || '');
      setLocation(initialData.location || 'Минск');
      setLimit(initialData.limit || 50);
      setMaxPages(initialData.maxPages || 5);
      setManualEntries('');
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return;
    setLoadingProviders(true);
    Promise.all([api.getDiscoveryProviders(), api.getDiscoveryPresets()])
      .then(([p, s]) => {
        setProviders(p.providers || []);
        setPresets(s.presets || []);
        if (!provider && p.providers?.[0]) setProvider(p.providers[0].id);
      })
      .catch(() => setError('Failed to load discovery options'))
      .finally(() => setLoadingProviders(false));
  }, [open]);

  useEffect(() => {
    if (selectedPreset) {
      setQuery(selectedPreset.defaultQuery);
      if (!provider || provider === 'dgis') setProvider(selectedPreset.defaultProvider);
      setLimit(selectedPreset.defaultLimit);
    }
  }, [selectedPreset]);

  async function handleSubmit() {
    if (!selectedProvider || !selectedProvider.configured) {
      setError(`${selectedProvider?.name || 'Provider'} is not configured`);
      return;
    }
    if (provider !== 'manual' && !query.trim()) {
      setError('Enter a search query');
      return;
    }
    if (provider === 'manual' && !manualEntries.trim()) {
      setError('Paste at least one website or company|website');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        provider,
        query: query.trim(),
        location: location.trim() || undefined,
        limit,
        maxPages,
      };
      if (topic) payload.topic = topic;
      if (provider === 'manual') payload.manualEntries = manualEntries.trim();

      const { run } = await api.startOperation({
        operationId: 'DISCOVER_BUSINESSES',
        input: payload,
        entityType: 'DiscoveryRun',
      });
      setOperationRunId(run.id);
      onStarted(run.id);
    } catch (e: any) {
      setError(e.message || 'Discovery failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const handleClose = () => {
    setOperationRunId(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/30">
      <div className={`bg-surface rounded-lg shadow-xl w-full mx-4 p-5 ${operationRunId ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-text">New discovery</h2>
          <button onClick={handleClose} className="text-text-subtle hover:text-text">×</button>
        </div>

        {error && <div className="mb-3 text-[12px] text-danger bg-danger-subtle border border-danger-subtle rounded px-3 py-2">{error}</div>}

        {operationRunId ? (
          <OperationConsole runId={operationRunId} title="Discovery run" onClose={handleClose} />
        ) : loadingProviders ? (
          <div className="text-[13px] text-text-subtle py-6 text-center">Loading discovery options…</div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[12px] font-medium text-text">Source</label>
            <select
              name="provider"
              className="w-full h-9 px-2 text-[13px] border border-border rounded"
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setError(null); }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.configured ? '● Ready' : '○ Not configured'}
                </option>
              ))}
            </select>

            {selectedProvider && !selectedProvider.configured && (
              <div className="text-[12px] text-warning bg-warning-subtle border border-warning-subtle rounded px-3 py-2 space-y-2">
                <div>{selectedProvider.config?.helpText || `${selectedProvider.name} is not configured`}</div>
                <a
                  href="/radar/providers"
                  onClick={(e) => { e.preventDefault(); window.location.href = '/radar/providers'; }}
                  className="inline-flex items-center px-2.5 py-1 bg-surface border border-warning-subtle rounded text-[11px] font-medium text-warning hover:bg-warning-subtle"
                >
                  Configure provider
                </a>
              </div>
            )}

            {provider !== 'manual' && (
              <>
                <label className="block text-[12px] font-medium text-text">Topic preset</label>
                <select
                  name="topic"
                  className="w-full h-9 px-2 text-[13px] border border-border rounded"
                  value={topic}
                  onChange={(e) => { setTopic(e.target.value); }}
                >
                  <option value="">— none —</option>
                  {presets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <label className="block text-[12px] font-medium text-text">Search query</label>
                <input
                  type="text"
                  name="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-9 px-3 text-[13px] border border-border rounded"
                  placeholder="строительные компании"
                />

                <label className="block text-[12px] font-medium text-text">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-9 px-3 text-[13px] border border-border rounded"
                  placeholder="Минск"
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-medium text-text">Limit</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={limit}
                      onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-medium text-text">Max pages</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={maxPages}
                      onChange={(e) => setMaxPages(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded"
                    />
                  </div>
                </div>
              </>
            )}

            {provider === 'manual' && (
              <>
                <label className="block text-[12px] font-medium text-text">Websites / domains (one per line)</label>
                <textarea
                  name="manualEntries"
                  rows={5}
                  value={manualEntries}
                  onChange={(e) => setManualEntries(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-border rounded"
                  placeholder="garantk.by&#10;Company Name;https://example.by&#10;company2.by"
                />
                <p className="text-[11px] text-text-subtle">Each line may be a domain, a full URL, or `Company Name;https://website`.</p>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          {!operationRunId && <Button variant="secondary" onClick={handleClose}>Cancel</Button>}
          {!operationRunId && (
            <Button
              variant="primary"
              disabled={!selectedProvider?.configured || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Starting…' : 'Start discovery'}
            </Button>
          )}
          {operationRunId && <Button variant="secondary" onClick={handleClose}>Close</Button>}
        </div>
      </div>
    </div>
  );
}
