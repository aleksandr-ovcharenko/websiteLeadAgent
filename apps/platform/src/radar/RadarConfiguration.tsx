import { useEffect, useState } from 'react';
import RadarProviders from './RadarProviders';
import RadarPresets from './RadarPresets';
import RadarHistory from './RadarHistory';
import RadarLeads from './RadarLeads';
import NewDiscovery from './NewDiscovery';

function getView(path: string) {
  if (path === '/radar' || path === '/radar/leads') return 'leads';
  if (path === '/radar/providers') return 'providers';
  if (path === '/radar/presets') return 'presets';
  if (path === '/radar/discoveries' || path === '/radar/history') return 'history';
  if (path === '/radar/audit-queue') return 'audit';
  if (path === '/radar/selected') return 'selected';
  return 'leads';
}

function NavItem({ label, active, onClick, cta }: { label: string; active: boolean; onClick: () => void; cta?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-[5px] text-[13px] transition-colors duration-150 ${active ? "bg-success-subtle text-accent font-medium" : cta ? "bg-accent text-text-inverse hover:bg-accent-hover" : "text-text hover:bg-surface-raised"}`}>
      {label}
    </button>
  );
}

function Sidebar({ view, onNew, go }: { view: string; onNew: (p?: string) => void; go: (path: string) => void }) {
  return (
    <div className="w-[216px] shrink-0 bg-surface border-r border-border flex flex-col">
      <div className="px-5 py-[18px] border-b border-border">
        <div className="text-[10px] font-mono font-medium text-text-subtle uppercase tracking-widest">WebsiteLeadAgent</div>
        <div className="text-[13px] font-semibold text-text mt-0.5">Super Admin</div>
      </div>
      <nav className="p-2.5 space-y-px">
        <NavItem label="Leads" active={view === 'leads'} onClick={() => go('/radar')} />
        <NavItem label="New discovery" active={false} onClick={() => onNew()} cta />
        <NavItem label="Discovery history" active={view === 'history'} onClick={() => go('/radar/discoveries')} />
        <NavItem label="Audit queue" active={view === 'audit'} onClick={() => go('/radar/audit-queue')} />
        <NavItem label="Selected" active={view === 'selected'} onClick={() => go('/radar/selected')} />
        <NavItem label="Discovery providers" active={view === 'providers'} onClick={() => go('/radar/providers')} />
        <NavItem label="Search presets" active={view === 'presets'} onClick={() => go('/radar/presets')} />
      </nav>
      <div className="mt-auto p-4 border-t border-border space-y-2">
        <div className="text-[10px] font-mono text-text-subtle">admin@system.internal</div>
        <div className="text-[10px] font-mono text-text-subtle">g · u · b · j · k</div>
      </div>
    </div>
  );
}

export default function RadarConfiguration() {
  const [view, setView] = useState(getView(window.location.pathname));
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<any>(null);

  useEffect(() => {
    const onPop = () => setView(getView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (path: string) => {
    window.history.pushState(null, '', path);
    setView(getView(path));
  };

  const openNew = (providerId?: string) => {
    setPrefill(providerId ? { provider: providerId } : null);
    setNewOpen(true);
  };

  const reload = () => {};

  return (
    <div className="min-h-full bg-surface-raised flex">
      <Sidebar view={view} onNew={openNew} go={go} />
      {view === 'leads' && <RadarLeads mode="all" />}
      {view === 'audit' && <RadarLeads mode="audit" />}
      {view === 'selected' && <RadarLeads mode="selected" />}
      {view === 'providers' && <RadarProviders onNewDiscovery={openNew} onOpenPresets={() => go('/radar/presets')} />}
      {view === 'presets' && <RadarPresets onBack={() => go('/radar/providers')} />}
      {view === 'history' && <RadarHistory onNewDiscovery={openNew} onDuplicate={(run) => { setPrefill(run); setNewOpen(true); }} />}
      <NewDiscovery open={newOpen} onClose={() => setNewOpen(false)} onStarted={reload} initialData={prefill} />
    </div>
  );
}
