import { useEffect, useRef, useState } from 'react';
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

export default function RadarConfiguration() {
  const [view, setView] = useState(getView(window.location.pathname));
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setView(getView(window.location.pathname));
    window.addEventListener('popstate', update);
    window.addEventListener('pushstate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('pushstate', update);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!sidebarOpen) return;
      if (window.innerWidth < 1024 && sidebarRef.current && !sidebarRef.current.contains(target) && !(target as HTMLElement).closest?.('[data-sidebar-toggle]')) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [sidebarOpen]);

  const go = (path: string) => {
    window.history.pushState(null, '', path);
    setView(getView(path));
    setSidebarOpen(window.innerWidth >= 1024 ? sidebarOpen : false);
  };

  const openNew = (providerId?: string) => {
    setPrefill(providerId ? { provider: providerId } : null);
    setNewOpen(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const reload = () => {};

  return (
    <div className="min-h-full bg-surface-raised flex relative overflow-x-hidden">
      {/* Persistent toggle — same anchored control on all viewports */}
      <button
        data-sidebar-toggle
        onClick={() => setSidebarOpen((s) => !s)}
        className="fixed z-[60] left-3 top-3 w-7 h-7 rounded bg-surface-raised border border-border text-text-subtle hover:text-text hover:bg-surface flex items-center justify-center shadow-sm"
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {sidebarOpen ? '◀' : '▶'}
      </button>

      {/* Desktop sidebar — collapsible width */}
      <div
        className={`hidden lg:flex shrink-0 bg-surface border-r border-border flex-col overflow-hidden transition-[width] duration-200 ${sidebarOpen ? 'w-[216px]' : 'w-0'}`}
      >
        <div className="px-5 py-[18px] border-b border-border pl-12">
          <div className="text-[10px] font-mono font-medium text-text-subtle uppercase tracking-widest">WebsiteLeadAgent</div>
          <div className="text-[13px] font-semibold text-text mt-0.5">Super Admin</div>
        </div>
        <nav className="p-2.5 space-y-px min-w-[216px]">
          <NavItem label="← Back to leads" active={view === 'leads'} onClick={() => go('/radar')} />
          <div className="pt-2 pb-1 px-3 text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Discovery</div>
          <NavItem label="New discovery" active={false} onClick={() => openNew()} cta />
          <NavItem label="Discovery history" active={view === 'history'} onClick={() => go('/radar/discoveries')} />
          <NavItem label="Discovery providers" active={view === 'providers'} onClick={() => go('/radar/providers')} />
          <NavItem label="Search presets" active={view === 'presets'} onClick={() => go('/radar/presets')} />
        </nav>
        <div className="mt-auto p-4 border-t border-border min-w-[216px] space-y-2">
          <div className="text-[10px] font-mono text-text-subtle">WebsiteLeadAgent · Super Admin</div>
        </div>
      </div>

      {/* Mobile off-canvas drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            ref={sidebarRef}
            className="w-[260px] h-full bg-surface border-r border-border flex flex-col shadow-xl pl-10 pt-2"
          >
            <div className="px-5 py-[18px] border-b border-border">
              <div className="text-[10px] font-mono font-medium text-text-subtle uppercase tracking-widest">WebsiteLeadAgent</div>
              <div className="text-[13px] font-semibold text-text mt-0.5">Super Admin</div>
            </div>
            <nav className="p-2.5 space-y-px overflow-y-auto">
              <NavItem label="← Back to leads" active={view === 'leads'} onClick={() => go('/radar')} />
              <div className="pt-2 pb-1 px-3 text-[10px] font-mono font-medium text-text-subtle uppercase tracking-wider">Discovery</div>
              <NavItem label="New discovery" active={false} onClick={() => openNew()} cta />
              <NavItem label="Discovery history" active={view === 'history'} onClick={() => go('/radar/discoveries')} />
              <NavItem label="Discovery providers" active={view === 'providers'} onClick={() => go('/radar/providers')} />
              <NavItem label="Search presets" active={view === 'presets'} onClick={() => go('/radar/presets')} />
            </nav>
            <div className="mt-auto p-4 border-t border-border space-y-2">
              <div className="text-[10px] font-mono text-text-subtle">WebsiteLeadAgent · Super Admin</div>
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-full">
        {view === 'leads' && <RadarLeads mode="all" />}
        {view === 'providers' && <RadarProviders onNewDiscovery={openNew} onOpenPresets={() => go('/radar/presets')} />}
        {view === 'presets' && <RadarPresets onBack={() => go('/radar/providers')} />}
        {view === 'history' && <RadarHistory onNewDiscovery={openNew} onDuplicate={(run) => { setPrefill(run); setNewOpen(true); }} />}
      </div>
      <NewDiscovery open={newOpen} onClose={() => setNewOpen(false)} onStarted={reload} initialData={prefill} />
    </div>
  );
}
