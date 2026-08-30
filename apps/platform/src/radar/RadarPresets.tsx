import { useEffect, useState } from 'react';
import { api } from '../cms/api';
import { Button } from '../cms/ui';

interface Preset {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  defaultProvider: string;
  defaultQuery: string;
  queries: string[];
  defaultLocation?: string;
  defaultLimit: number;
  defaultMaxPages: number;
}

interface RadarPresetsProps {
  onBack: () => void;
}

export default function RadarPresets({ onBack }: RadarPresetsProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Preset> | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDiscoveryPresets();
      setPresets(res.presets || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  async function savePreset(data: Partial<Preset>) {
    try {
      if (data.id) {
        await api.updateDiscoveryPreset(data.id, data);
      } else {
        await api.createDiscoveryPreset(data);
      }
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    }
  }

  async function deletePreset(id: string) {
    if (!confirm('Delete this preset?')) return;
    try {
      await api.deleteDiscoveryPreset(id);
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    }
  }

  function toggleEnabled(p: Preset) {
    savePreset({ ...p, enabled: !p.enabled });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-[#1c1917]">Search presets</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setEditing({})}>+ Create preset</Button>
          <Button variant="secondary" size="sm" onClick={onBack}>Back to providers</Button>
        </div>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        {loading && <div className="text-[13px] text-[#a8a29e]">Loading presets…</div>}
        {!loading && presets.length === 0 && <div className="text-[13px] text-[#a8a29e]">No presets found</div>}

        <div className="bg-white border border-[#e5e3df] rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#fafaf8] border-b border-[#e5e3df]">
              <tr>
                <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Name</th>
                <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Category</th>
                <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Default query</th>
                <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Provider</th>
                <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Enabled</th>
                <th className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id} className="border-b border-[#f0ede8] last:border-0">
                  <td className="py-2.5 px-3 text-[13px] font-medium text-[#1c1917]">{p.name}</td>
                  <td className="py-2.5 px-3 text-[12px] text-[#57534e]">{p.category}</td>
                  <td className="py-2.5 px-3 text-[12px] text-[#57534e]">{p.defaultQuery}</td>
                  <td className="py-2.5 px-3 text-[12px] text-[#57534e]">{p.defaultProvider}</td>
                  <td className="py-2.5 px-3 text-[12px]">
                    <input type="checkbox" checked={p.enabled} onChange={() => toggleEnabled(p)} />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => deletePreset(p.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PresetModal
          preset={editing}
          onClose={() => setEditing(null)}
          onSave={savePreset}
        />
      )}
    </div>
  );
}

function PresetModal({ preset, onClose, onSave }: { preset: Partial<Preset>; onClose: () => void; onSave: (p: Partial<Preset>) => void }) {
  const [form, setForm] = useState<Partial<Preset>>({
    name: '',
    category: '',
    enabled: true,
    defaultProvider: 'dgis',
    defaultQuery: '',
    queries: [],
    defaultLocation: '',
    defaultLimit: 50,
    defaultMaxPages: 5,
    ...preset,
  });

  function update(key: keyof Preset, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white border border-[#e5e3df] rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-[#1c1917]">{form.id ? 'Edit' : 'Create'} preset</h2>
          <button onClick={onClose} className="text-[#a8a29e] hover:text-[#1c1917]">×</button>
        </div>

        <div className="space-y-3">
          <label className="block text-[12px] font-medium text-[#57534e]">Name</label>
          <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded" />

          <label className="block text-[12px] font-medium text-[#57534e]">Category</label>
          <input type="text" value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded" />

          <label className="block text-[12px] font-medium text-[#57534e]">Default query</label>
          <input type="text" value={form.defaultQuery} onChange={(e) => update('defaultQuery', e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded" />

          <label className="block text-[12px] font-medium text-[#57534e]">Default provider</label>
          <select value={form.defaultProvider} onChange={(e) => update('defaultProvider', e.target.value)} className="w-full h-9 px-2 text-[13px] border border-[#e5e3df] rounded">
            <option value="dgis">2GIS</option>
            <option value="manual">Manual Import</option>
            <option value="osm">OSM / Overpass</option>
            <option value="ddg">DuckDuckGo</option>
            <option value="yandex">Yandex</option>
          </select>

          <label className="block text-[12px] font-medium text-[#57534e]">Default location</label>
          <input type="text" value={form.defaultLocation} onChange={(e) => update('defaultLocation', e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded" />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-[#57534e]">Limit</label>
              <input type="number" value={form.defaultLimit} onChange={(e) => update('defaultLimit', Number(e.target.value))} className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded" />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-[#57534e]">Max pages</label>
              <input type="number" value={form.defaultMaxPages} onChange={(e) => update('defaultMaxPages', Number(e.target.value))} className="w-full h-9 px-3 text-[13px] border border-[#e5e3df] rounded" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} id="preset-enabled" />
            <label htmlFor="preset-enabled" className="text-[12px] font-medium text-[#57534e]">Enabled</label>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <Button size="sm" onClick={() => onSave(form)}>{form.id ? 'Update' : 'Create'}</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
