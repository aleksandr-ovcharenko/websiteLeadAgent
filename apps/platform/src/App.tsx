import { useState, useMemo, useRef, useEffect } from "react";
import Studio from "./cms/Studio";
import ProductHeader from "./cms/ProductHeader";
import type { ProductArea } from "./cms/ProductHeader";
import Hub from "./Hub";
import Factory from "./Factory";
import RadarConfiguration from './radar/RadarConfiguration';
import { ActivityConsole } from './activity/ActivityConsole';

type Status =
  | "DRAFT"
  | "CONTENT_READY"
  | "DEMO_GENERATED"
  | "DEMO_APPROVED"
  | "ACTIVE"
  | "ARCHIVED";

type ViewMode = "table" | "visual";

interface DemoVariant {
  id: string;
  name: string;
  templateId: string;
  previewToken: string;
  isPreferred: boolean;
}

interface Site {
  id: string;
  name: string;
  domain: string;
  status: Status;
  template: string;
  pages: number;
  projects: number;
  news: number;
  lastUpdated: string;
  created: string;
  lastBuild: string;
  lastAudit: string;
  mediaCount: number;
  attention?: string;
  attentionAction?: "Fix" | "Retry" | "Open";
  stageLabel: string;
  previewToken: string;
  previewCaptured: string;
  previewOutdated?: boolean;
  image: string;
  demoVariants: DemoVariant[];
}

const IMG = (id: string, w = 800, h = 500) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;


const TEMPLATES = [
  "construction-modern-v1",
  "construction-industrial-v1",
  "construction-premium-v2",
  "roofing-clean-v1",
  "residential-warm-v1",
];

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-stone-100 text-stone-500 ring-stone-200" },
  CONTENT_READY: { label: "Content ready", cls: "bg-blue-50 text-blue-600 ring-blue-100" },
  DEMO_GENERATED: { label: "Demo generated", cls: "bg-amber-50 text-amber-700 ring-amber-100" },
  DEMO_APPROVED: { label: "Demo approved", cls: "bg-teal-50 text-teal-700 ring-teal-100" },
  ACTIVE: { label: "Active", cls: "bg-green-50 text-green-700 ring-green-100" },
  ARCHIVED: { label: "Archived", cls: "bg-stone-100 text-stone-400 ring-stone-200" },
};

type AppView = "dashboard" | "cms";
type SortKey = "lastUpdated" | "name" | "created";

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, label, sm }: { status: Status; label?: string; sm?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded ring-1 ring-inset font-mono font-medium ${
        sm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      } ${m.cls}`}
    >
      {label || m.label}
    </span>
  );
}

function SiteThumbnail({
  site,
  onPreview,
  onCMS,
  className = "",
}: {
  site: Site;
  onPreview?: () => void;
  onCMS?: () => void;
  className?: string;
}) {
  const isArchived = site.status === "ARCHIVED";
  const hasFailed = site.attention === "Preview build failed";

  return (
    <div className={`relative group overflow-hidden bg-stone-200 ${className}`}>
      <img
        src={site.image}
        alt={`${site.name} website preview`}
        className={`w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] ${
          isArchived ? "grayscale opacity-60" : ""
        }`}
      />

      {/* failed overlay */}
      {hasFailed && (
        <div className="absolute bottom-0 left-0 right-0 bg-amber-900/70 px-2 py-1 flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="#FCD34D">
            <path d="M5 1L0.5 9h9L5 1z" />
            <path d="M5 4.5v2M5 7.5v.5" stroke="#1C1917" strokeWidth="0.8" />
          </svg>
          <span className="text-[10px] font-mono text-amber-100">Preview build failed</span>
        </div>
      )}

      {/* hover overlay */}
      <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/40 transition-colors duration-200 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {onPreview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="flex items-center gap-1.5 bg-white/95 text-stone-900 text-xs font-medium px-3 py-1.5 rounded hover:bg-white transition-colors shadow-sm"
          >
            Open preview
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 5h6M5 2l3 3-3 3" />
            </svg>
          </button>
        )}
        {onCMS && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCMS();
            }}
            className="text-[11px] text-white/80 hover:text-white transition-colors underline underline-offset-2"
          >
            Open CMS
          </button>
        )}
      </div>

      {/* freshness badge */}
      {site.previewOutdated ? (
        <div className="absolute top-2 right-2 bg-amber-50/90 border border-amber-200 rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-700">
          Preview outdated
        </div>
      ) : null}
    </div>
  );
}

function MoreMenu({
  onSettings,
  onRebuild,
  onAudit,
  onArchive,
  onDelete,
}: {
  onSettings: () => void;
  onRebuild: () => void;
  onAudit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2.5" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="7" cy="11.5" r="1.2" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-stone-200 rounded-md shadow-lg py-1 text-sm">
            {[
              { label: "Site settings", action: onSettings },
              { label: "Rebuild", action: onRebuild },
              { label: "Audit", action: onAudit },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { setOpen(false); item.action(); }}
                className="w-full text-left px-3 py-1.5 text-stone-700 hover:bg-stone-50 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-stone-100 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); onArchive(); }}
                className="w-full text-left px-3 py-1.5 text-stone-400 hover:bg-stone-50 transition-colors"
              >
                Archive
              </button>
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  site,
  onClose,
  onOpenCMS,
  onOpenPreview,
  onOpenWebsite,
  onDelete,
}: {
  site: Site;
  onClose: () => void;
  onOpenCMS: () => void;
  onOpenPreview: () => void;
  onOpenWebsite: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/20" onClick={onClose} />
      <div
        ref={ref}
        className="relative w-[360px] bg-white border-l border-stone-200 shadow-xl flex flex-col overflow-y-auto"
      >
        {/* thumb */}
        <div className="relative">
          <SiteThumbnail
            site={site}
            className="w-full aspect-[16/10]"
            onPreview={onOpenPreview}
            onCMS={onOpenCMS}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 bg-white/90 rounded flex items-center justify-center text-stone-600 hover:text-stone-900 shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-3">
            <StatusBadge status={site.status} label={site.stageLabel} sm />
          </div>
        </div>

        {/* meta */}
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-900">{site.name}</h2>
          <p className="text-[11px] font-mono text-stone-400 mt-0.5">{site.domain}</p>
        </div>

        <div className="px-5 py-4 space-y-3 text-xs border-b border-stone-100">
          {[
            { label: "Template", value: <span className="font-mono">{site.template}</span> },
            { label: "Created", value: site.created },
            { label: "Last updated", value: site.lastUpdated },
            { label: "Last build", value: site.lastBuild },
            { label: "Last audit", value: site.lastAudit },
          ].map((r) => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="text-stone-500">{r.label}</span>
              <span className="text-stone-900 text-right">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-b border-stone-100">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-2">Content</p>
          <div className="flex gap-4 text-xs font-mono tabular-nums">
            <div className="text-center">
              <div className="text-base font-semibold text-stone-900">{site.pages}</div>
              <div className="text-stone-400">Pages</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-stone-900">{site.projects}</div>
              <div className="text-stone-400">Projects</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-stone-900">{site.news}</div>
              <div className="text-stone-400">News</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-stone-900">{site.mediaCount}</div>
              <div className="text-stone-400">Media</div>
            </div>
          </div>
        </div>

        {site.attention && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-xs text-amber-700">{site.attention}</span>
            </div>
          </div>
        )}

        {(site.demoVariants || []).length > 0 && (
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-2">Demo variants</p>
            <div className="flex flex-col gap-2">
              {site.demoVariants.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-stone-700 truncate">{v.name || v.templateId}</span>
                  <div className="flex items-center gap-2">
                    {v.isPreferred && <span className="text-[10px] text-amber-600">preferred</span>}
                    <button
                      onClick={() => window.open(`/showcase/${v.previewToken}`, '_blank')}
                      className="px-2 h-6 border border-stone-200 rounded hover:bg-stone-50"
                    >
                      Open
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete variant ${v.name || v.templateId}?`)) return;
                        const r = await fetch(`/api/platform/sites/${site.id}/variants/${v.id}`, { method: 'DELETE', credentials: 'include' });
                        if (!r.ok) { alert('Failed to delete variant'); return; }
                        window.location.reload();
                      }}
                      className="px-2 h-6 border border-red-200 text-red-600 rounded hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-4 mt-auto flex flex-col gap-2">
          <button
            onClick={onOpenCMS}
            className="w-full h-8 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
          >
            Open CMS
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenWebsite}
              className="h-8 border border-stone-200 text-stone-700 text-xs rounded hover:bg-stone-50 transition-colors"
            >
              Open website
            </button>
            <button
              onClick={onOpenPreview}
              className="h-8 border border-stone-200 text-stone-700 text-xs rounded hover:bg-stone-50 transition-colors"
            >
              Open preferred
            </button>
          </div>
          <button
            onClick={onDelete}
            className="w-full h-8 border border-red-200 text-red-600 text-xs font-medium rounded hover:bg-red-50 transition-colors"
          >
            Delete site
          </button>
        </div>

        <div className="px-5 pb-4 text-[10px] font-mono text-stone-400">
          Preview captured: {site.previewCaptured}
        </div>
      </div>
    </div>
  );
}

// ── Create Site Modal ─────────────────────────────────────────────────────────

function CreateSiteModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (site: Site) => void;
}) {
  const [form, setForm] = useState({ name: "", lead: "", slug: "", template: "construction-modern-v1" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    onCreate({
      id: String(Date.now()),
      name: form.name,
      domain: form.slug + ".websiteleadagent.com",
      status: "DRAFT",
      template: form.template,
      pages: 0,
      projects: 0,
      news: 0,
      lastUpdated: "Just now",
      created: new Date().toISOString().slice(0, 10),
      lastBuild: "—",
      lastAudit: "—",
      stageLabel: "Draft",
      previewToken: "",
      mediaCount: 0,
      previewCaptured: "—",
      image: IMG("1551038247-3d9af20df552"),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 border border-stone-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-900">Create site</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {[
            { key: "name", label: "Company / Site name", placeholder: "e.g. Строй Мастер", mono: false },
            { key: "lead", label: "Lead", placeholder: "Existing lead reference", mono: false, optional: true },
            { key: "slug", label: "Slug", placeholder: "e.g. stroy-master", mono: true },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {f.label}{" "}
                {f.optional && <span className="text-stone-400 font-normal">(optional)</span>}
              </label>
              <input
                type="text"
                value={(form as Record<string, string>)[f.key]}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [f.key]:
                      f.key === "slug"
                        ? e.target.value.toLowerCase().replace(/\s+/g, "-")
                        : e.target.value,
                  }))
                }
                placeholder={f.placeholder}
                required={f.key === "name" || f.key === "slug"}
                className={`w-full h-9 px-3 border border-stone-200 rounded text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 ${f.mono ? "font-mono" : ""}`}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Template</label>
            <select
              value={form.template}
              onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
              className="w-full h-9 px-3 border border-stone-200 rounded text-sm text-stone-900 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600"
            >
              {TEMPLATES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 text-sm text-stone-600 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
            >
              Create site
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CMS view ──────────────────────────────────────────────────────────────────

function CMSView({ site, onBack }: { site: Site; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#F4F4F3] font-sans">
      <header className="bg-white border-b border-stone-200 px-6 h-12 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2L4 6l4 4" />
          </svg>
          All sites
        </button>
        <div className="h-4 w-px bg-stone-200" />
        <span className="text-sm font-semibold text-stone-900">{site.name}</span>
        <span className="text-[11px] font-mono text-stone-400">{site.domain}</span>
        <StatusBadge status={site.status} label={site.stageLabel} sm />
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-white border border-stone-200 rounded-lg px-8 py-12">
          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#78716C" strokeWidth="1.5">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <path d="M7 8h6M7 11h4" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-stone-900 mb-1">Site CMS</h2>
          <p className="text-xs text-stone-500 mb-1">{site.name}</p>
          <p className="text-xs font-mono text-stone-400">{site.domain}</p>
          <p className="text-xs text-stone-400 mt-4">The existing CMS for this site would render here.</p>
        </div>
      </main>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

function ForgeView() {
  const [sites, setSites] = useState<Site[]>([]);
  const [appView, setAppView] = useState<AppView>("dashboard");
  const [cmsTarget, setCMSTarget] = useState<Site | null>(null);
  const [detailSite, setDetailSite] = useState<Site | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "ALL">("ALL");
  const [filterTemplate, setFilterTemplate] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [sitesLoaded, setSitesLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/platform/sites', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { setSites(data.sites || []); setSitesLoaded(true); })
      .catch(() => setSitesLoaded(true));
  }, []);

  const attentionSites = sites.filter((s) => s.attention && s.status !== "ARCHIVED");

  const filtered = useMemo(() => {
    let list = [...sites];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q));
    }
    if (filterStatus !== "ALL") list = list.filter((s) => s.status === filterStatus);
    if (filterTemplate !== "ALL") list = list.filter((s) => s.template === filterTemplate);
    if (sortKey === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === "created") list.sort((a, b) => b.created.localeCompare(a.created));
    return list;
  }, [sites, search, filterStatus, filterTemplate, sortKey]);

  const recentSites = useMemo(
    () =>
      [...sites]
        .filter((s) => s.status !== "ARCHIVED")
        .slice(0, 4),
    [sites]
  );

  const stats = {
    total: sites.length,
    active: sites.filter((s) => s.status === "ACTIVE").length,
    draft: sites.filter((s) => s.status === "DRAFT").length,
    attention: attentionSites.length,
  };

  function openCMS(site: Site) {
    window.open('/studio/' + site.id, '_blank');
  }

  function openPreview(site: Site) {
    window.open(`/showcase/${site.previewToken}`, '_blank');
  }

  async function deleteSite(id: string) {
    if (!confirm('Delete this site? This cannot be undone.')) return;
    const r = await fetch(`/api/platform/sites/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) {
      alert('Failed to delete site');
      return;
    }
    setSites((s) => s.filter((x) => x.id !== id));
    setDetailSite((current) => (current?.id === id ? null : current));
  }

  function archiveSite(id: string) {
    fetch(`/api/platform/sites/${id}/archive`, { method: 'POST', credentials: 'include' });
    setSites((s) => s.map((x) => (x.id === id ? { ...x, status: "ARCHIVED" } : x)));
  }

  if (appView === "cms" && cmsTarget) {
    return <CMSView site={cmsTarget} onBack={() => setAppView("dashboard")} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F3] font-sans text-stone-900">
      {showCreate && (
        <CreateSiteModal
          onClose={() => setShowCreate(false)}
          onCreate={(site) => setSites((s) => [site, ...s])}
        />
      )}
      {detailSite && (
        <DetailPanel
          site={detailSite}
          onClose={() => setDetailSite(null)}
          onOpenCMS={() => openCMS(detailSite)}
          onOpenPreview={() => openPreview(detailSite)}
          onOpenWebsite={() => detailSite.domain && window.open(`https://${detailSite.domain}`, '_blank')}
          onDelete={() => deleteSite(detailSite.id)}
        />
      )}

      {/* Topbar */}
      <header className="bg-white border-b border-stone-200 px-6 h-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-600 rounded-sm flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="white">
              <rect x="1" y="1" width="4" height="4" rx="0.5" />
              <rect x="6" y="1" width="4" height="4" rx="0.5" />
              <rect x="1" y="6" width="4" height="4" rx="0.5" />
              <rect x="6" y="6" width="4" height="4" rx="0.5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-stone-900 tracking-tight">WebsiteLeadAgent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 px-2 py-0.5 rounded">
            SUPER_ADMIN
          </span>
          <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-[11px] font-medium text-stone-600">
            A
          </div>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto px-6 py-6">
        {/* Page heading */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Forge</h1>
            <p className="text-sm text-stone-500 mt-0.5">Manage generated sites</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-8 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2v8M2 6h8" />
            </svg>
            Create site
          </button>
        </div>

        {/* Compact stat strip */}
        <div className="flex items-center gap-6 mb-5 bg-white border border-stone-200 rounded-lg px-5 py-3">
          {[
            { label: "Total sites", value: stats.total },
            { label: "Active", value: stats.active, accent: true },
            { label: "Draft", value: stats.draft },
            { label: "Needs attention", value: stats.attention, warn: stats.attention > 0 },
          ].map((item, i) => (
            <div key={item.label} className="flex items-baseline gap-2">
              {i > 0 && <div className="h-5 w-px bg-stone-100" />}
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-lg font-semibold font-mono tabular-nums ${
                    item.accent ? "text-green-600" : item.warn ? "text-amber-600" : "text-stone-900"
                  }`}
                >
                  {item.value}
                </span>
                <span className="text-xs text-stone-500">{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Attention */}
        {attentionSites.length > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="#D97706">
                <path d="M5.5 1L0.5 10h10L5.5 1z" />
                <path d="M5.5 4.5v2.5" stroke="white" strokeWidth="0.9" />
                <circle cx="5.5" cy="8.3" r="0.4" fill="white" />
              </svg>
              <span className="text-[11px] font-mono font-medium text-amber-700 uppercase tracking-wide">
                Needs attention
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attentionSites.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 bg-white border border-amber-100 rounded px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-stone-800">{s.name}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-amber-600">{s.attention}</span>
                  <button
                    onClick={() => setDetailSite(s)}
                    className="ml-1 text-[11px] text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 hover:bg-stone-50 hover:text-stone-800 transition-colors"
                  >
                    {s.attentionAction ?? "View"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently updated */}
        <div className="mb-6">
          <p className="text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider mb-3">
            Recently updated
          </p>
          <div className="grid grid-cols-4 gap-3">
            {recentSites.map((site) => (
              <div
                key={site.id}
                className="bg-white border border-stone-200 rounded-lg overflow-hidden"
              >
                <SiteThumbnail
                  site={site}
                  className="w-full aspect-[16/10]"
                  onPreview={() => openPreview(site)}
                  onCMS={() => openCMS(site)}
                />
                <div className="px-3 py-2.5">
                  <button
                    onClick={() => setDetailSite(site)}
                    className="text-xs font-semibold text-stone-900 hover:text-green-700 transition-colors text-left leading-snug block truncate w-full"
                  >
                    {site.name}
                  </button>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusBadge status={site.status} label={site.stageLabel} sm />
                    <span className="text-[10px] text-stone-400 truncate">{site.lastUpdated}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters + view toggle */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="5.5" cy="5.5" r="3.5" />
              <path d="M8 8l2.5 2.5" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sites…"
              className="w-full h-8 pl-7 pr-3 border border-stone-200 rounded text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as Status | "ALL")}
            className="h-8 px-2.5 border border-stone-200 rounded text-xs text-stone-700 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="ALL">All statuses</option>
            {(Object.keys(STATUS_META) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>

          <select
            value={filterTemplate}
            onChange={(e) => setFilterTemplate(e.target.value)}
            className="h-8 px-2.5 border border-stone-200 rounded text-xs text-stone-700 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="ALL">All templates</option>
            {TEMPLATES.map((t) => <option key={t}>{t}</option>)}
          </select>

          <div className="flex items-center gap-1 text-xs text-stone-500">
            <span className="text-stone-400">Sort:</span>
            {(
              [
                ["lastUpdated", "Recent"],
                ["name", "Name"],
                ["created", "Created"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`px-2 py-1 rounded transition-colors ${
                  sortKey === key
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center border border-stone-200 rounded overflow-hidden bg-white">
            {(["table", "visual"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`h-8 px-3 flex items-center gap-1.5 text-xs transition-colors ${
                  viewMode === m
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                }`}
              >
                {m === "table" ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="1" y="1" width="10" height="10" rx="1" />
                    <path d="M1 4h10M1 7h10M4 4v7" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="1" y="1" width="4" height="4" rx="0.5" />
                    <rect x="7" y="1" width="4" height="4" rx="0.5" />
                    <rect x="1" y="7" width="4" height="4" rx="0.5" />
                    <rect x="7" y="7" width="4" height="4" rx="0.5" />
                  </svg>
                )}
                {m === "table" ? "Table" : "Visual"}
              </button>
            ))}
          </div>
        </div>

        {/* ── TABLE VIEW ── */}
        {viewMode === "table" && (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  {["Site", "Status", "Template", "Content", "Last updated", "Actions"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-400">
                      No sites match your filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((site) => (
                    <tr
                      key={site.id}
                      className={`group hover:bg-stone-50/70 transition-colors ${
                        site.status === "ARCHIVED" ? "opacity-50" : ""
                      }`}
                    >
                      {/* Site cell with thumbnail */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0 w-[120px] rounded overflow-hidden border border-stone-100 bg-stone-100">
                            <SiteThumbnail
                              site={site}
                              className="w-full aspect-[16/10]"
                              onPreview={() => {}}
                              onCMS={() => openCMS(site)}
                            />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => setDetailSite(site)}
                              className="text-sm font-medium text-stone-900 hover:text-green-700 transition-colors text-left leading-snug block"
                            >
                              {site.name}
                            </button>
                            <p className="text-[11px] font-mono text-stone-400 mt-0.5 truncate">{site.domain}</p>
                            {site.attention && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                                <span className="text-[10px] text-amber-600 truncate">{site.attention}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={site.status} label={site.stageLabel} /></td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-stone-500">{site.template}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-stone-500 tabular-nums font-mono whitespace-nowrap">
                          Pg {site.pages} · Pr {site.projects} · N {site.news}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-stone-500 tabular-nums whitespace-nowrap">{site.lastUpdated}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <button
                            onClick={() => openCMS(site)}
                            className="h-7 px-2.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
                          >
                            Open CMS
                          </button>
                          <button
                            onClick={() => openPreview(site)}
                            className="h-7 px-2.5 text-xs border border-stone-200 text-stone-600 rounded hover:bg-stone-50 transition-colors"
                          >
                            Preview
                          </button>
                          <MoreMenu
                            onSettings={() => setDetailSite(site)}
                            onRebuild={() => {}}
                            onAudit={() => {}}
                            onArchive={() => archiveSite(site.id)}
                            onDelete={() => deleteSite(site.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] font-mono text-stone-400">
                {filtered.length} of {sites.length} sites
              </span>
              <span className="text-[11px] text-stone-400">WebsiteLeadAgent Platform v1</span>
            </div>
          </div>
        )}

        {/* ── VISUAL VIEW ── */}
        {viewMode === "visual" && (
          <>
            {filtered.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-lg py-16 text-center text-sm text-stone-400">
                No sites match your filters
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filtered.map((site) => (
                  <div
                    key={site.id}
                    className={`bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col ${
                      site.status === "ARCHIVED" ? "opacity-60" : ""
                    }`}
                  >
                    {/* screenshot — ~65% of card */}
                    <div
                      className="relative cursor-pointer"
                      onClick={() => setDetailSite(site)}
                    >
                      <SiteThumbnail
                        site={site}
                        className="w-full aspect-[16/10]"
                        onPreview={() => {}}
                        onCMS={() => openCMS(site)}
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <StatusBadge status={site.status} label={site.stageLabel} sm />
                      </div>
                    </div>

                    {/* metadata ~35% */}
                    <div className="px-4 py-3 flex flex-col gap-2 flex-1">
                      <div>
                        <button
                          onClick={() => setDetailSite(site)}
                          className="text-sm font-semibold text-stone-900 hover:text-green-700 transition-colors text-left leading-snug block"
                        >
                          {site.name}
                        </button>
                        <p className="text-[11px] font-mono text-stone-400 mt-0.5">{site.domain}</p>
                      </div>

                      <p className="text-[11px] font-mono text-stone-400 truncate">{site.template}</p>

                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span className="font-mono tabular-nums">
                          Pg {site.pages} · Pr {site.projects} · N {site.news}
                        </span>
                        <span className="truncate ml-2">{site.lastUpdated}</span>
                      </div>

                      {site.attention && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-[10px] text-amber-600">{site.attention}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-auto pt-1 border-t border-stone-50">
                        <button
                          onClick={() => openCMS(site)}
                          className="flex-1 h-7 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
                        >
                          Open CMS
                        </button>
                        <button
                          onClick={() => openPreview(site)}
                          className="h-7 px-2.5 text-xs border border-stone-200 text-stone-600 rounded hover:bg-stone-50 transition-colors"
                        >
                          Preview
                        </button>
                        <MoreMenu
                          onSettings={() => setDetailSite(site)}
                          onRebuild={() => {}}
                          onAudit={() => {}}
                          onArchive={() => archiveSite(site.id)}
                          onDelete={() => deleteSite(site.id)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-center text-[11px] font-mono text-stone-400">
              {filtered.length} of {sites.length} sites
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function viewPath(view: ProductArea, siteId?: string) {
  if (view === 'hub') return '/';
  if (view === 'studio' && siteId) return `/studio/${siteId}`;
  return `/${view}`;
}

export default function App({ user }: { user?: any }) {
  const parse = () => {
    const p = window.location.pathname.replace(/\/$/, '');
    if (p === '/radar' || p.startsWith('/radar/')) return { view: 'radar' as ProductArea };
    if (p === '/factory' || p.startsWith('/factory/')) return { view: 'factory' as ProductArea };
    if (p === '/forge' || p.startsWith('/forge/')) return { view: 'forge' as ProductArea };
    if (p.startsWith('/studio/')) return { view: 'studio' as ProductArea, siteId: p.split('/')[2] };
    return { view: 'hub' as ProductArea };
  };
  const initial = parse();
  const [view, setView] = useState<ProductArea>(initial.view);
  const [studioSiteId, setStudioSiteId] = useState<string | undefined>(initial.siteId);
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = consoleRef.current;
    if (!el) return;
    const setHeight = () => {
      const height = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--console-height', `${height}px`);
    };
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--console-height');
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      const v = parse();
      setView(v.view);
      setStudioSiteId(v.siteId);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(v: ProductArea, siteId?: string) {
    const url = viewPath(v, siteId);
    if (v === 'studio' && siteId) {
      window.location.href = url;
      return;
    }
    window.history.pushState(null, '', url);
    setView(v);
    if (siteId) setStudioSiteId(siteId);
  }

  useEffect(() => {
    const titles: Record<ProductArea, string> = {
      hub: 'WebsiteLeadAgent',
      radar: 'Radar — WebsiteLeadAgent',
      factory: 'Factory — WebsiteLeadAgent',
      forge: 'Forge — WebsiteLeadAgent',
      studio: 'Studio — WebsiteLeadAgent'
    };
    document.title = titles[view] || 'WebsiteLeadAgent';
  }, [view]);

  const renderContent = () => {
    const common = 'flex-1';
    switch (view) {
      case 'studio':
        return studioSiteId ? <Studio siteId={studioSiteId} user={user} /> : <div className={common} />;
      case 'radar':
        return <div className={`${common} overflow-y-auto`}><RadarConfiguration /></div>;
      case 'factory':
        return <div className={common}><Factory onNavigate={navigate} /></div>;
      case 'forge':
        return <div className={`${common} overflow-y-auto`}><ForgeView /></div>;
      case 'hub':
      default:
        return isSuperAdmin ? <div className={common}><Hub onNavigate={navigate} /></div> : <div className={`${common} overflow-y-auto`}><ForgeView /></div>;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f4f5f7]">
      <ProductHeader productArea={view} siteId={view === 'studio' ? studioSiteId : undefined} user={user} onNavigate={navigate} />
      {renderContent()}
      {isSuperAdmin && <div ref={consoleRef} className="shrink-0 w-full"><ActivityConsole /></div>}
    </div>
  );
}
