import { useState, useMemo, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AppView = "hub" | "radar" | "factory" | "forge" | "studio";

type SiteStatus =
  | "DRAFT"
  | "CONTENT_READY"
  | "DEMO_GENERATED"
  | "DEMO_APPROVED"
  | "ACTIVE"
  | "ARCHIVED";

type RunStatus = "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
type LeadQuality = "GOOD" | "POTENTIAL" | "POOR";
type DiscoveryStatus = "RUNNING" | "COMPLETED" | "FAILED";

interface Site {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
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
  previewCaptured: string;
  previewOutdated?: boolean;
  image: string;
}

interface Lead {
  id: string;
  company: string;
  domain: string;
  city: string;
  category: string;
  quality: LeadQuality;
  score: number;
  employees?: string;
  factoryRunId?: string;
}

interface DiscoveryRun {
  id: string;
  city: string;
  query: string;
  date: string;
  leads: number;
  goodCount: number;
  status: DiscoveryStatus;
  progress?: { done: number; total: number; stage: string };
}

interface PipelineStage {
  name: string;
  status: "done" | "running" | "pending" | "failed";
  started?: string;
  duration?: string;
  error?: string;
}

interface FactoryRun {
  id: string;
  company: string;
  lead: string;
  status: RunStatus;
  currentStage: string;
  progress: { done: number; total: number };
  started: string;
  duration: string;
  stages: PipelineStage[];
  linkedSiteId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const IMG = (id: string, w = 800, h = 500) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

const SITES: Site[] = [
  { id: "1", name: "ГАРАНТ КАЧЕСТВА", domain: "garantk.by", status: "ACTIVE", template: "construction-modern-v1", pages: 8, projects: 14, news: 6, lastUpdated: "Today, 14:32", created: "2024-11-03", lastBuild: "Today, 14:35", lastAudit: "2025-08-20", mediaCount: 84, previewCaptured: "Today, 14:28", image: IMG("1479839672679-a46483c0e7c8") },
  { id: "2", name: "СтройМастер Плюс", domain: "stroymaster.ru", status: "CONTENT_READY", template: "construction-modern-v1", pages: 6, projects: 9, news: 0, lastUpdated: "Yesterday, 11:05", created: "2025-01-15", lastBuild: "2025-08-21", lastAudit: "—", mediaCount: 42, previewCaptured: "2025-08-21", previewOutdated: true, image: IMG("1518005020951-eccb494ad742") },
  { id: "3", name: "EuroBuild Group", domain: "—", status: "DRAFT", template: "construction-premium-v2", pages: 4, projects: 0, news: 0, lastUpdated: "3 days ago", created: "2025-07-30", lastBuild: "—", lastAudit: "—", mediaCount: 7, attention: "Missing domain", attentionAction: "Fix", previewCaptured: "2025-08-25", image: IMG("1551038247-3d9af20df552") },
  { id: "4", name: "АрхиСтрой", domain: "arhistroy.by", status: "DEMO_GENERATED", template: "construction-modern-v1", pages: 7, projects: 11, news: 3, lastUpdated: "2025-08-22", created: "2025-06-10", lastBuild: "2025-08-22", lastAudit: "2025-08-22", mediaCount: 61, attention: "Preview build failed", attentionAction: "Retry", previewCaptured: "2025-08-22", image: IMG("1567943183748-3a7542120c90") },
  { id: "5", name: "Кровля Профи", domain: "krovlya-profi.ru", status: "DEMO_APPROVED", template: "roofing-clean-v1", pages: 5, projects: 8, news: 2, lastUpdated: "2025-08-19", created: "2025-05-20", lastBuild: "2025-08-19", lastAudit: "2025-08-18", mediaCount: 38, previewCaptured: "2025-08-19", image: IMG("1601074231509-dce351c05199") },
  { id: "6", name: "ТеплоДом", domain: "teplodom.by", status: "ACTIVE", template: "residential-warm-v1", pages: 9, projects: 21, news: 12, lastUpdated: "2025-08-25", created: "2024-09-14", lastBuild: "2025-08-25", lastAudit: "2025-08-24", mediaCount: 156, previewCaptured: "2025-08-25", image: IMG("1774544368113-b66148dab467") },
  { id: "7", name: "ModuloFlex", domain: "moduloflex.com", status: "ARCHIVED", template: "construction-modern-v1", pages: 6, projects: 5, news: 1, lastUpdated: "2025-03-10", created: "2024-07-01", lastBuild: "2025-03-10", lastAudit: "2025-03-09", mediaCount: 29, previewCaptured: "2025-03-10", image: IMG("1483366774565-c783b9f70e2c") },
  { id: "8", name: "МегаСтрой Инжиниринг", domain: "megastroy-ing.ru", status: "CONTENT_READY", template: "construction-premium-v2", pages: 5, projects: 0, news: 0, lastUpdated: "2025-08-26", created: "2025-08-01", lastBuild: "—", lastAudit: "—", mediaCount: 14, attention: "CMS import incomplete", attentionAction: "Open", previewCaptured: "2025-08-26", image: IMG("1781692079653-7e8222a40bda") },
];

const DISCOVERY_RUNS: DiscoveryRun[] = [
  { id: "d1", city: "Minsk", query: "Construction", date: "29 Aug 2026", leads: 48, goodCount: 8, status: "COMPLETED" },
  { id: "d2", city: "Minsk", query: "Renovation", date: "28 Aug 2026", leads: 36, goodCount: 5, status: "COMPLETED" },
  { id: "d3", city: "Minsk", query: "Engineering", date: "27 Aug 2026", leads: 51, goodCount: 11, status: "COMPLETED" },
  { id: "d4", city: "Vitebsk", query: "Construction", date: "25 Aug 2026", leads: 29, goodCount: 4, status: "FAILED" },
  { id: "d5", city: "Brest", query: "Roofing", date: "22 Aug 2026", leads: 44, goodCount: 7, status: "COMPLETED" },
];

const LEADS_BY_RUN: Record<string, Lead[]> = {
  d1: [
    { id: "l1", company: "ГАРАНТ КАЧЕСТВА", domain: "garantk.by", city: "Minsk", category: "Construction", quality: "GOOD", score: 87, employees: "12–30", factoryRunId: "f1" },
    { id: "l2", company: "АрхиСтрой", domain: "arhistroy.by", city: "Minsk", category: "Architecture", quality: "GOOD", score: 81, employees: "5–12" },
    { id: "l3", company: "СтройМастер Плюс", domain: "stroymaster.ru", city: "Minsk", category: "Construction", quality: "GOOD", score: 78, employees: "20–50", factoryRunId: "f2" },
    { id: "l4", company: "EuroBuild Group", domain: "eurobuild.by", city: "Minsk", category: "Construction", quality: "POTENTIAL", score: 64, employees: "3–8" },
    { id: "l5", company: "БелСтрой Групп", domain: "belstroy.by", city: "Minsk", category: "Construction", quality: "POTENTIAL", score: 55, employees: "8–20" },
    { id: "l6", company: "Мастер Кровли", domain: "masterkrovli.by", city: "Minsk", category: "Roofing", quality: "POOR", score: 31, employees: "1–3" },
    { id: "l7", company: "ПрофСтрой Инвест", domain: "profstroy-invest.ru", city: "Minsk", category: "Investment", quality: "POOR", score: 22 },
    { id: "l8", company: "ТехноДом", domain: "technodome.by", city: "Minsk", category: "Construction", quality: "POTENTIAL", score: 59, employees: "10–25" },
  ],
  d2: [
    { id: "l9", company: "РеноМастер", domain: "renomaster.by", city: "Minsk", category: "Renovation", quality: "GOOD", score: 82, employees: "6–15" },
    { id: "l10", company: "ЕвроРемонт", domain: "eurorement.by", city: "Minsk", category: "Renovation", quality: "GOOD", score: 76, employees: "4–10" },
    { id: "l11", company: "КапРем Строй", domain: "kaprem.by", city: "Minsk", category: "Renovation", quality: "POTENTIAL", score: 61 },
  ],
};

const PIPELINE_STAGES_COMPLETED: PipelineStage[] = [
  { name: "Lead selected", status: "done", started: "12:40", duration: "0:02" },
  { name: "Content extraction", status: "done", started: "12:42", duration: "1:14" },
  { name: "Content transformation", status: "done", started: "13:56", duration: "0:47" },
  { name: "CMS import", status: "done", started: "14:43", duration: "0:31" },
  { name: "Website generation", status: "done", started: "15:14", duration: "2:08" },
  { name: "Screenshot", status: "done", started: "17:22", duration: "0:18" },
  { name: "Audit", status: "done", started: "17:40", duration: "0:52" },
];

const PIPELINE_STAGES_RUNNING: PipelineStage[] = [
  { name: "Lead selected", status: "done", started: "12:40", duration: "0:02" },
  { name: "Content extraction", status: "done", started: "12:42", duration: "1:14" },
  { name: "Content transformation", status: "done", started: "13:56", duration: "0:47" },
  { name: "CMS import", status: "done", started: "14:43", duration: "0:31" },
  { name: "Website generation", status: "running", started: "15:14" },
  { name: "Screenshot", status: "pending" },
  { name: "Audit", status: "pending" },
];

const PIPELINE_STAGES_FAILED: PipelineStage[] = [
  { name: "Lead selected", status: "done", started: "09:10", duration: "0:01" },
  { name: "Content extraction", status: "done", started: "09:11", duration: "1:02" },
  { name: "Content transformation", status: "failed", started: "10:13", error: "AI service timeout after 3 retries" },
  { name: "CMS import", status: "pending" },
  { name: "Website generation", status: "pending" },
  { name: "Screenshot", status: "pending" },
  { name: "Audit", status: "pending" },
];

const FACTORY_RUNS: FactoryRun[] = [
  { id: "f1", company: "ГАРАНТ КАЧЕСТВА", lead: "l1", status: "COMPLETED", currentStage: "Demo ready", progress: { done: 7, total: 7 }, started: "Today, 12:40", duration: "5:12", stages: PIPELINE_STAGES_COMPLETED, linkedSiteId: "1" },
  { id: "f2", company: "СтройМастер Плюс", lead: "l3", status: "RUNNING", currentStage: "Website generation", progress: { done: 4, total: 7 }, started: "Today, 15:14", duration: "02:31", stages: PIPELINE_STAGES_RUNNING },
  { id: "f3", company: "ТехноДом", lead: "l8", status: "QUEUED", currentStage: "Waiting", progress: { done: 0, total: 7 }, started: "Today, 17:50", duration: "—", stages: PIPELINE_STAGES_RUNNING.map(s => ({ ...s, status: "pending" as const })) },
  { id: "f4", company: "КапРем Строй", lead: "l11", status: "FAILED", currentStage: "Content transformation", progress: { done: 2, total: 7 }, started: "Today, 09:10", duration: "1:03", stages: PIPELINE_STAGES_FAILED },
  { id: "f5", company: "РеноМастер", lead: "l9", status: "COMPLETED", currentStage: "Demo ready", progress: { done: 7, total: 7 }, started: "Yesterday, 14:22", duration: "4:48", stages: PIPELINE_STAGES_COMPLETED, linkedSiteId: "2" },
];

const TEMPLATES = ["construction-modern-v1", "construction-premium-v2", "roofing-clean-v1", "residential-warm-v1"];

const SITE_STATUS_META: Record<SiteStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-stone-100 text-stone-500 ring-stone-200" },
  CONTENT_READY: { label: "Content ready", cls: "bg-blue-50 text-blue-600 ring-blue-100" },
  DEMO_GENERATED: { label: "Demo generated", cls: "bg-amber-50 text-amber-700 ring-amber-100" },
  DEMO_APPROVED: { label: "Demo approved", cls: "bg-teal-50 text-teal-700 ring-teal-100" },
  ACTIVE: { label: "Active", cls: "bg-green-50 text-green-700 ring-green-100" },
  ARCHIVED: { label: "Archived", cls: "bg-stone-100 text-stone-400 ring-stone-200" },
};

const RUN_STATUS_META: Record<RunStatus, { label: string; cls: string }> = {
  QUEUED: { label: "Queued", cls: "bg-stone-100 text-stone-500 ring-stone-200" },
  RUNNING: { label: "Running", cls: "bg-blue-50 text-blue-600 ring-blue-100" },
  FAILED: { label: "Failed", cls: "bg-red-50 text-red-600 ring-red-100" },
  COMPLETED: { label: "Completed", cls: "bg-green-50 text-green-700 ring-green-100" },
};

const LEAD_QUALITY_META: Record<LeadQuality, { label: string; cls: string }> = {
  GOOD: { label: "Good", cls: "bg-green-50 text-green-700 ring-green-100" },
  POTENTIAL: { label: "Potential", cls: "bg-amber-50 text-amber-700 ring-amber-100" },
  POOR: { label: "Poor", cls: "bg-stone-100 text-stone-400 ring-stone-200" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ label, cls, sm }: { label: string; cls: string; sm?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded ring-1 ring-inset font-mono font-medium ${sm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"} ${cls}`}>
      {label}
    </span>
  );
}

function SiteThumbnail({ site, onPreview, onCMS, className = "" }: { site: Site; onPreview?: () => void; onCMS?: () => void; className?: string }) {
  const isArchived = site.status === "ARCHIVED";
  const hasFailed = site.attention === "Preview build failed";
  return (
    <div className={`relative group overflow-hidden bg-stone-200 ${className}`}>
      <img src={site.image} alt={`${site.name} website preview`} className={`w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] ${isArchived ? "grayscale opacity-60" : ""}`} />
      {hasFailed && (
        <div className="absolute bottom-0 left-0 right-0 bg-amber-900/70 px-2 py-1 flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="#FCD34D"><path d="M5 1L0.5 9h9L5 1z" /><path d="M5 4.5v2M5 7.5v.5" stroke="#1C1917" strokeWidth="0.8" /></svg>
          <span className="text-[10px] font-mono text-amber-100">Preview build failed</span>
        </div>
      )}
      <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/40 transition-all duration-200 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {onPreview && (
          <button onClick={(e) => { e.stopPropagation(); onPreview(); }} className="flex items-center gap-1.5 bg-white/95 text-stone-900 text-xs font-medium px-3 py-1.5 rounded hover:bg-white transition-colors shadow-sm">
            Open preview <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5h6M5 2l3 3-3 3" /></svg>
          </button>
        )}
        {onCMS && (
          <button onClick={(e) => { e.stopPropagation(); onCMS(); }} className="text-[11px] text-white/80 hover:text-white transition-colors underline underline-offset-2">Open Studio</button>
        )}
      </div>
      {site.previewOutdated && <div className="absolute top-2 right-2 bg-amber-50/90 border border-amber-200 rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-700">Preview outdated</div>}
    </div>
  );
}

function MoreMenu({ items }: { items: { label: string; action: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="w-7 h-7 flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="7" cy="2.5" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="7" cy="11.5" r="1.2" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-stone-200 rounded-md shadow-lg py-1 text-sm">
            {items.map((item, i) => (
              <button key={i} onClick={() => { setOpen(false); item.action(); }} className={`w-full text-left px-3 py-1.5 hover:bg-stone-50 transition-colors ${item.danger ? "text-stone-400" : "text-stone-700"}`}>{item.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT HEADER
// ─────────────────────────────────────────────────────────────────────────────

function ProductHeader({
  currentView,
  studioSite,
  onNavigate,
}: {
  currentView: AppView;
  studioSite?: Site | null;
  onNavigate: (view: AppView) => void;
}) {
  const navItems: { key: AppView; label: string }[] = [
    { key: "radar", label: "Radar" },
    { key: "factory", label: "Factory" },
    { key: "forge", label: "Forge" },
  ];

  return (
    <header className="bg-white border-b border-stone-200 h-12 flex items-center px-5 gap-4 sticky top-0 z-30 flex-shrink-0">
      {/* Logo */}
      <button onClick={() => onNavigate("hub")} className="flex items-center gap-2 group flex-shrink-0">
        <div className="w-6 h-6 bg-stone-900 rounded flex items-center justify-center">
          <span className="text-[9px] font-mono font-bold text-white tracking-tight leading-none">WLA</span>
        </div>
        <span className="text-sm font-semibold text-stone-900 tracking-tight group-hover:text-stone-600 transition-colors">
          WebsiteLeadAgent
        </span>
      </button>

      {/* Studio breadcrumb or global nav */}
      {currentView === "studio" && studioSite ? (
        <>
          <div className="h-4 w-px bg-stone-200" />
          <button
            onClick={() => onNavigate("forge")}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2L4 6l4 4" /></svg>
            Forge
          </button>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-stone-900 truncate">{studioSite.name}</span>
            <span className="text-[11px] font-mono text-stone-400 flex-shrink-0">{studioSite.domain}</span>
            <Badge label={SITE_STATUS_META[studioSite.status].label} cls={SITE_STATUS_META[studioSite.status].cls} sm />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="h-7 px-3 text-xs border border-stone-200 text-stone-600 rounded hover:bg-stone-50 transition-colors flex items-center gap-1.5">
              Open Showcase
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8L8 2M5 2h3v3" /></svg>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="h-4 w-px bg-stone-200" />
          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`px-3 h-8 text-sm rounded transition-colors ${
                  currentView === item.key
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-500 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 px-2 py-0.5 rounded">SUPER_ADMIN</span>
            <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-[11px] font-medium text-stone-600">A</div>
          </div>
        </>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HUB
// ─────────────────────────────────────────────────────────────────────────────

function HubView({ onNavigate, factoryRuns, sites }: { onNavigate: (v: AppView) => void; factoryRuns: FactoryRun[]; sites: Site[] }) {
  const running = factoryRuns.filter(r => r.status === "RUNNING").length;
  const modules = [
    {
      key: "radar" as AppView,
      label: "Radar",
      desc: "Discover & qualify leads",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="10" cy="10" r="8" /><circle cx="10" cy="10" r="4" /><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2" />
        </svg>
      ),
      status: "1 discovery running",
      statusColor: "text-blue-600",
    },
    {
      key: "factory" as AppView,
      label: "Factory",
      desc: "Generation pipeline",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M3 14V9l4-3 4 3 4-4v9H3z" /><path d="M3 17h14" />
        </svg>
      ),
      status: running > 0 ? `${running} site${running > 1 ? "s" : ""} processing` : "Idle",
      statusColor: running > 0 ? "text-blue-600" : "text-stone-400",
    },
    {
      key: "forge" as AppView,
      label: "Forge",
      desc: "Generated websites",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="2" y="4" width="16" height="12" rx="1.5" />
          <path d="M2 7h16M6 4v3" />
        </svg>
      ),
      status: `${sites.filter(s => s.status !== "ARCHIVED").length} generated sites`,
      statusColor: "text-stone-500",
    },
  ];

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">WebsiteLeadAgent</h1>
          <p className="text-sm text-stone-400 mt-1">Platform administration</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {modules.map((mod) => (
            <button
              key={mod.key}
              onClick={() => onNavigate(mod.key)}
              className="group bg-white border border-stone-200 rounded-lg px-5 py-6 text-left hover:border-stone-300 hover:shadow-sm transition-all"
            >
              <div className="text-stone-400 group-hover:text-stone-700 transition-colors mb-3">{mod.icon}</div>
              <div className="text-sm font-semibold text-stone-900 mb-1">{mod.label}</div>
              <div className="text-xs text-stone-500 mb-4">{mod.desc}</div>
              <div className={`text-[11px] font-mono ${mod.statusColor}`}>{mod.status}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RADAR
// ─────────────────────────────────────────────────────────────────────────────

function NewDiscoveryModal({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const [form, setForm] = useState({ city: "", query: "", limit: "50" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 border border-stone-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-900">New discovery</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">City</label>
            <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Minsk" className="w-full h-9 px-3 border border-stone-200 rounded text-sm placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Business category</label>
            <input value={form.query} onChange={e => setForm(f => ({ ...f, query: e.target.value }))} placeholder="e.g. Construction, Roofing" className="w-full h-9 px-3 border border-stone-200 rounded text-sm placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Lead limit</label>
            <select value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} className="w-full h-9 px-3 border border-stone-200 rounded text-sm bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600">
              {["25", "50", "100", "200"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button onClick={onClose} className="h-8 px-4 text-sm text-stone-600 border border-stone-200 rounded hover:bg-stone-50 transition-colors">Cancel</button>
            <button onClick={() => { onStart(); onClose(); }} className="h-8 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium">Start discovery</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RadarView({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [runs] = useState<DiscoveryRun[]>(DISCOVERY_RUNS);
  const [activeRunId, setActiveRunId] = useState("d1");
  const [showHistory, setShowHistory] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [filterQuality, setFilterQuality] = useState<LeadQuality | "ALL">("ALL");

  const activeRun = runs.find(r => r.id === activeRunId) ?? runs[0];
  const leads = (LEADS_BY_RUN[activeRunId] ?? []).filter(l => filterQuality === "ALL" || l.quality === filterQuality);

  return (
    <div className="flex-1 overflow-y-auto">
      {showNew && <NewDiscoveryModal onClose={() => setShowNew(false)} onStart={() => {}} />}
      <div className="max-w-[1200px] mx-auto px-6 py-6">

        {/* Page heading */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Radar</h1>
            <p className="text-sm text-stone-500 mt-0.5">Lead discovery and qualification</p>
          </div>
          <button onClick={() => setShowNew(true)} className="h-8 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
            New discovery
          </button>
        </div>

        {/* Current run + history */}
        <div className="bg-white border border-stone-200 rounded-lg px-5 py-3 mb-5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-stone-900">{activeRun.city} · {activeRun.query}</span>
              <Badge
                label={activeRun.status}
                cls={activeRun.status === "COMPLETED" ? "bg-green-50 text-green-700 ring-green-100" : activeRun.status === "FAILED" ? "bg-red-50 text-red-600 ring-red-100" : "bg-blue-50 text-blue-600 ring-blue-100"}
                sm
              />
            </div>
            <p className="text-xs text-stone-400 mt-0.5 font-mono">
              {activeRun.date} · {activeRun.leads} leads · <span className="text-green-600">{activeRun.goodCount} GOOD</span>
            </p>
          </div>
          <div className="relative">
            <button onClick={() => setShowHistory(v => !v)} className="h-7 px-3 text-xs border border-stone-200 text-stone-600 rounded hover:bg-stone-50 transition-colors flex items-center gap-1.5">
              History
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l3 3 3-3" /></svg>
            </button>
            {showHistory && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
                <div className="absolute right-0 top-9 z-20 w-72 bg-white border border-stone-200 rounded-lg shadow-lg py-1 text-sm">
                  {runs.map(run => (
                    <button
                      key={run.id}
                      onClick={() => { setActiveRunId(run.id); setShowHistory(false); }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 ${activeRunId === run.id ? "bg-stone-50" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-stone-900 text-xs">{run.city} · {run.query}</span>
                        <Badge
                          label={run.status}
                          cls={run.status === "COMPLETED" ? "bg-green-50 text-green-700 ring-green-100" : run.status === "FAILED" ? "bg-red-50 text-red-600 ring-red-100" : "bg-blue-50 text-blue-600 ring-blue-100"}
                          sm
                        />
                      </div>
                      <p className="text-[11px] font-mono text-stone-400">
                        {run.date} · {run.leads} leads · {run.goodCount} GOOD
                        {run.status === "FAILED" && " · "}
                        {run.status === "FAILED" && <span className="text-red-500">Retry</span>}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lead list */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Leads</span>
          <div className="flex gap-1 ml-2">
            {(["ALL", "GOOD", "POTENTIAL", "POOR"] as const).map(q => (
              <button
                key={q}
                onClick={() => setFilterQuality(q)}
                className={`px-2 py-0.5 text-xs rounded transition-colors font-mono ${filterQuality === q ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60">
                {["Company", "Domain", "Category", "Quality", "Score", ""].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-400">No leads</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className="group hover:bg-stone-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-stone-900">{lead.company}</div>
                    {lead.employees && <div className="text-[11px] text-stone-400 mt-0.5">{lead.employees} employees</div>}
                  </td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-stone-500">{lead.domain}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-stone-500">{lead.category}</span></td>
                  <td className="px-4 py-3"><Badge label={LEAD_QUALITY_META[lead.quality].label} cls={LEAD_QUALITY_META[lead.quality].cls} /></td>
                  <td className="px-4 py-3"><span className="font-mono text-sm font-semibold text-stone-700">{lead.score}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.factoryRunId ? (
                        <button onClick={() => onNavigate("factory")} className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                          Open Factory <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4.5h6M4.5 1.5l3 3-3 3" /></svg>
                        </button>
                      ) : lead.quality === "GOOD" ? (
                        <button className="h-7 px-2.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium">Generate Demo</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-stone-100">
            <span className="text-[11px] font-mono text-stone-400">{leads.length} leads shown</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function RunDetailPanel({ run, onClose, onOpenForge }: { run: FactoryRun; onClose: () => void; onOpenForge: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const stageIcon = (s: PipelineStage["status"]) => {
    if (s === "done") return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#16A34A" /><path d="M4 7l2 2 4-4" stroke="#16A34A" strokeWidth="1.3" /></svg>;
    if (s === "running") return <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />;
    if (s === "failed") return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#DC2626" /><path d="M5 5l4 4M9 5l-4 4" stroke="#DC2626" strokeWidth="1.3" /></svg>;
    return <div className="w-3.5 h-3.5 rounded-full border border-stone-300" />;
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/20" onClick={onClose} />
      <div ref={ref} className="relative w-[360px] bg-white border-l border-stone-200 shadow-xl flex flex-col overflow-y-auto">
        <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">{run.company}</h2>
            <p className="text-[11px] font-mono text-stone-400 mt-0.5">Generation run #{run.id.replace("f", "")}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors mt-0.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
          <Badge label={RUN_STATUS_META[run.status].label} cls={RUN_STATUS_META[run.status].cls} />
          <span className="text-xs text-stone-400 font-mono">Started {run.started}</span>
        </div>

        {run.status === "FAILED" && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <p className="text-[11px] font-mono font-medium text-red-600 mb-1">Failed stage</p>
            <p className="text-xs text-red-700">{run.currentStage}</p>
            {run.stages.find(s => s.status === "failed")?.error && (
              <p className="text-[11px] text-red-500 mt-1">{run.stages.find(s => s.status === "failed")?.error}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button className="h-7 px-3 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium">Retry</button>
              <button className="h-7 px-3 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors">Details</button>
            </div>
          </div>
        )}

        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider mb-3">Pipeline</p>
          {run.stages.map((stage, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{stageIcon(stage.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${stage.status === "pending" ? "text-stone-400" : stage.status === "failed" ? "text-red-600" : "text-stone-900"}`}>
                    {stage.name}
                  </span>
                  {stage.duration && <span className="text-[11px] font-mono text-stone-400">{stage.duration}</span>}
                </div>
                {stage.started && <p className="text-[10px] font-mono text-stone-400 mt-0.5">Started {stage.started}</p>}
                {stage.error && <p className="text-[11px] text-red-500 mt-1">{stage.error}</p>}
              </div>
            </div>
          ))}
        </div>

        {run.status === "COMPLETED" && run.linkedSiteId && (
          <div className="px-5 py-4 border-t border-stone-100 mt-auto">
            <button onClick={onOpenForge} className="w-full h-8 text-xs bg-stone-900 text-white rounded hover:bg-stone-800 transition-colors font-medium flex items-center justify-center gap-1.5">
              Open in Forge <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 5h7M5 2l3 3-3 3" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FactoryView({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [runs] = useState<FactoryRun[]>(FACTORY_RUNS);
  const [detailRun, setDetailRun] = useState<FactoryRun | null>(null);

  const active = runs.filter(r => r.status === "RUNNING" || r.status === "QUEUED").length;
  const failed = runs.filter(r => r.status === "FAILED").length;

  return (
    <div className="flex-1 overflow-y-auto">
      {detailRun && <RunDetailPanel run={detailRun} onClose={() => setDetailRun(null)} onOpenForge={() => { setDetailRun(null); onNavigate("forge"); }} />}
      <div className="max-w-[1200px] mx-auto px-6 py-6">

        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Factory</h1>
            <p className="text-sm text-stone-500 mt-0.5">Generation pipeline runs</p>
          </div>
        </div>

        {/* Compact status */}
        <div className="flex items-center gap-6 mb-5 bg-white border border-stone-200 rounded-lg px-5 py-3">
          {[
            { label: "Total runs", value: runs.length },
            { label: "Processing", value: active, accent: active > 0 },
            { label: "Failed", value: failed, warn: failed > 0 },
            { label: "Completed", value: runs.filter(r => r.status === "COMPLETED").length },
          ].map((item, i) => (
            <div key={item.label} className="flex items-center gap-5">
              {i > 0 && <div className="h-5 w-px bg-stone-100" />}
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-semibold font-mono tabular-nums ${item.accent ? "text-blue-600" : item.warn ? "text-red-500" : "text-stone-900"}`}>{item.value}</span>
                <span className="text-xs text-stone-500">{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60">
                {["Company / Lead", "Status", "Current stage", "Progress", "Started", "Duration", ""].map(col => (
                  <th key={col} className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {runs.map(run => (
                <tr key={run.id} className="group hover:bg-stone-50/70 transition-colors cursor-pointer" onClick={() => setDetailRun(run)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-stone-900">{run.company}</div>
                    <div className="text-[11px] font-mono text-stone-400 mt-0.5">run #{run.id.replace("f", "")}</div>
                  </td>
                  <td className="px-4 py-3"><Badge label={RUN_STATUS_META[run.status].label} cls={RUN_STATUS_META[run.status].cls} /></td>
                  <td className="px-4 py-3"><span className="text-xs text-stone-600">{run.currentStage}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${run.status === "FAILED" ? "bg-red-400" : run.status === "COMPLETED" ? "bg-green-500" : "bg-blue-400"}`}
                          style={{ width: `${(run.progress.done / run.progress.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-stone-500 tabular-nums">{run.progress.done}/{run.progress.total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-xs text-stone-500 tabular-nums">{run.started}</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-mono text-stone-500 tabular-nums">{run.duration}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {run.status === "FAILED" && (
                        <button onClick={e => { e.stopPropagation(); }} className="text-xs text-red-600 hover:text-red-800 font-medium">Retry</button>
                      )}
                      {run.status === "COMPLETED" && run.linkedSiteId && (
                        <button onClick={e => { e.stopPropagation(); onNavigate("forge"); }} className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1">
                          Forge <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4.5h6M4.5 1.5l3 3-3 3" /></svg>
                        </button>
                      )}
                      <span className="text-xs text-stone-400">View</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-stone-100">
            <span className="text-[11px] font-mono text-stone-400">{runs.length} runs total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORGE (Sites dashboard)
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = "lastUpdated" | "name" | "created";
type ViewMode = "table" | "visual";

function ForgeDetailPanel({ site, onClose, onOpenStudio }: { site: Site; onClose: () => void; onOpenStudio: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/20" onClick={onClose} />
      <div ref={ref} className="relative w-[360px] bg-white border-l border-stone-200 shadow-xl flex flex-col overflow-y-auto">
        <div className="relative">
          <SiteThumbnail site={site} className="w-full aspect-[16/10]" onPreview={() => {}} onCMS={onOpenStudio} />
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 bg-white/90 rounded flex items-center justify-center text-stone-600 hover:text-stone-900 shadow-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
          </button>
          <div className="absolute bottom-3 left-3"><Badge label={SITE_STATUS_META[site.status].label} cls={SITE_STATUS_META[site.status].cls} sm /></div>
        </div>
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
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="text-stone-500">{r.label}</span>
              <span className="text-stone-900 text-right">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-b border-stone-100">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-2">Content</p>
          <div className="flex gap-4 text-xs font-mono tabular-nums">
            {[{ n: site.pages, l: "Pages" }, { n: site.projects, l: "Projects" }, { n: site.news, l: "News" }, { n: site.mediaCount, l: "Media" }].map(x => (
              <div key={x.l} className="text-center">
                <div className="text-base font-semibold text-stone-900">{x.n}</div>
                <div className="text-stone-400">{x.l}</div>
              </div>
            ))}
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
        <div className="px-5 py-4 mt-auto flex flex-col gap-2">
          <button onClick={onOpenStudio} className="w-full h-8 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors">Open Studio</button>
          <div className="grid grid-cols-2 gap-2">
            <button className="h-8 border border-stone-200 text-stone-700 text-xs rounded hover:bg-stone-50 transition-colors">Open website</button>
            <button className="h-8 border border-stone-200 text-stone-700 text-xs rounded hover:bg-stone-50 transition-colors">Open Showcase</button>
          </div>
        </div>
        <div className="px-5 pb-4 text-[10px] font-mono text-stone-400">Preview captured: {site.previewCaptured}</div>
      </div>
    </div>
  );
}

function ForgeView({ sites, setSites, onOpenStudio }: { sites: Site[]; setSites: React.Dispatch<React.SetStateAction<Site[]>>; onOpenStudio: (site: Site) => void }) {
  const [detailSite, setDetailSite] = useState<Site | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<SiteStatus | "ALL">("ALL");
  const [filterTemplate, setFilterTemplate] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");

  const attentionSites = sites.filter(s => s.attention && s.status !== "ARCHIVED");

  const filtered = useMemo(() => {
    let list = [...sites];
    if (search) { const q = search.toLowerCase(); list = list.filter(s => s.name.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q)); }
    if (filterStatus !== "ALL") list = list.filter(s => s.status === filterStatus);
    if (filterTemplate !== "ALL") list = list.filter(s => s.template === filterTemplate);
    if (sortKey === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === "created") list.sort((a, b) => b.created.localeCompare(a.created));
    return list;
  }, [sites, search, filterStatus, filterTemplate, sortKey]);

  const recentSites = useMemo(() => [...sites].filter(s => s.status !== "ARCHIVED").slice(0, 4), [sites]);
  const stats = { total: sites.length, active: sites.filter(s => s.status === "ACTIVE").length, draft: sites.filter(s => s.status === "DRAFT").length, attention: attentionSites.length };

  function archiveSite(id: string) { setSites(s => s.map(x => x.id === id ? { ...x, status: "ARCHIVED" } : x)); }

  return (
    <div className="flex-1 overflow-y-auto">
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Create site</h2>
              <button onClick={() => setShowCreate(false)} className="text-stone-400 hover:text-stone-700">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <input placeholder="Company / Site name" className="w-full h-9 px-3 border border-stone-200 rounded text-sm placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-green-600" />
              <input placeholder="Slug" className="w-full h-9 px-3 border border-stone-200 rounded text-sm font-mono placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-green-600" />
              <select className="w-full h-9 px-3 border border-stone-200 rounded text-sm bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600">
                {TEMPLATES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="h-8 px-4 text-sm border border-stone-200 rounded hover:bg-stone-50">Cancel</button>
              <button onClick={() => setShowCreate(false)} className="h-8 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium">Create site</button>
            </div>
          </div>
        </div>
      )}
      {detailSite && <ForgeDetailPanel site={detailSite} onClose={() => setDetailSite(null)} onOpenStudio={() => { onOpenStudio(detailSite); setDetailSite(null); }} />}

      <div className="max-w-[1320px] mx-auto px-6 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Forge</h1>
            <p className="text-sm text-stone-500 mt-0.5">Manage generated customer websites</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="h-8 px-4 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
            Create site
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mb-5 bg-white border border-stone-200 rounded-lg px-5 py-3">
          {[{ label: "Total sites", value: stats.total }, { label: "Active", value: stats.active, accent: true }, { label: "Draft", value: stats.draft }, { label: "Needs attention", value: stats.attention, warn: stats.attention > 0 }].map((item, i) => (
            <div key={item.label} className="flex items-center gap-5">
              {i > 0 && <div className="h-5 w-px bg-stone-100" />}
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-semibold font-mono tabular-nums ${(item as { accent?: boolean }).accent ? "text-green-600" : (item as { warn?: boolean }).warn ? "text-amber-600" : "text-stone-900"}`}>{item.value}</span>
                <span className="text-xs text-stone-500">{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Attention */}
        {attentionSites.length > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="#D97706"><path d="M5.5 1L0.5 10h10L5.5 1z" /><path d="M5.5 4.5v2.5" stroke="white" strokeWidth="0.9" /><circle cx="5.5" cy="8.3" r="0.4" fill="white" /></svg>
              <span className="text-[11px] font-mono font-medium text-amber-700 uppercase tracking-wide">Needs attention</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attentionSites.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-white border border-amber-100 rounded px-3 py-1.5 text-xs">
                  <span className="font-medium text-stone-800">{s.name}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-amber-600">{s.attention}</span>
                  <button onClick={() => setDetailSite(s)} className="ml-1 text-[11px] text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 hover:bg-stone-50 hover:text-stone-800 transition-colors">{s.attentionAction ?? "View"}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently updated */}
        <div className="mb-6">
          <p className="text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider mb-3">Recently updated</p>
          <div className="grid grid-cols-4 gap-3">
            {recentSites.map(site => (
              <div key={site.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                <SiteThumbnail site={site} className="w-full aspect-[16/10]" onPreview={() => {}} onCMS={() => onOpenStudio(site)} />
                <div className="px-3 py-2.5">
                  <button onClick={() => setDetailSite(site)} className="text-xs font-semibold text-stone-900 hover:text-green-700 transition-colors text-left leading-snug block truncate w-full">{site.name}</button>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge label={SITE_STATUS_META[site.status].label} cls={SITE_STATUS_META[site.status].cls} sm />
                    <span className="text-[10px] text-stone-400 truncate">{site.lastUpdated}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters + view toggle */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5.5" cy="5.5" r="3.5" /><path d="M8 8l2.5 2.5" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites…" className="w-full h-8 pl-7 pr-3 border border-stone-200 rounded text-sm placeholder-stone-400 bg-white focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as SiteStatus | "ALL")} className="h-8 px-2.5 border border-stone-200 rounded text-xs text-stone-700 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600">
            <option value="ALL">All statuses</option>
            {(Object.keys(SITE_STATUS_META) as SiteStatus[]).map(s => <option key={s} value={s}>{SITE_STATUS_META[s].label}</option>)}
          </select>
          <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)} className="h-8 px-2.5 border border-stone-200 rounded text-xs text-stone-700 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-green-600">
            <option value="ALL">All templates</option>
            {TEMPLATES.map(t => <option key={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <span className="text-stone-400">Sort:</span>
            {([["lastUpdated", "Recent"], ["name", "Name"], ["created", "Created"]] as [SortKey, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setSortKey(key)} className={`px-2 py-1 rounded transition-colors ${sortKey === key ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"}`}>{label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center border border-stone-200 rounded overflow-hidden bg-white">
            {(["table", "visual"] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)} className={`h-8 px-3 flex items-center gap-1.5 text-xs transition-colors ${viewMode === m ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"}`}>
                {m === "table" ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="10" height="10" rx="1" /><path d="M1 4h10M1 7h10M4 4v7" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="4" height="4" rx="0.5" /><rect x="7" y="1" width="4" height="4" rx="0.5" /><rect x="1" y="7" width="4" height="4" rx="0.5" /><rect x="7" y="7" width="4" height="4" rx="0.5" /></svg>
                )}
                {m === "table" ? "Table" : "Visual"}
              </button>
            ))}
          </div>
        </div>

        {/* Table view */}
        {viewMode === "table" && (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  {["Site", "Status", "Template", "Content", "Last updated", "Actions"].map(col => (
                    <th key={col} className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-400">No sites match your filters</td></tr>
                ) : filtered.map(site => (
                  <tr key={site.id} className={`group hover:bg-stone-50/70 transition-colors ${site.status === "ARCHIVED" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0 w-[120px] rounded overflow-hidden border border-stone-100 bg-stone-100">
                          <SiteThumbnail site={site} className="w-full aspect-[16/10]" onPreview={() => {}} onCMS={() => onOpenStudio(site)} />
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => setDetailSite(site)} className="text-sm font-medium text-stone-900 hover:text-green-700 transition-colors text-left leading-snug block">{site.name}</button>
                          <p className="text-[11px] font-mono text-stone-400 mt-0.5 truncate">{site.domain}</p>
                          {site.attention && <div className="flex items-center gap-1 mt-1"><span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" /><span className="text-[10px] text-amber-600 truncate">{site.attention}</span></div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><Badge label={SITE_STATUS_META[site.status].label} cls={SITE_STATUS_META[site.status].cls} /></td>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs text-stone-500">{site.template}</span></td>
                    <td className="px-4 py-2.5"><span className="text-xs text-stone-500 tabular-nums font-mono whitespace-nowrap">Pg {site.pages} · Pr {site.projects} · N {site.news}</span></td>
                    <td className="px-4 py-2.5"><span className="text-xs text-stone-500 tabular-nums whitespace-nowrap">{site.lastUpdated}</span></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button onClick={() => onOpenStudio(site)} className="h-7 px-2.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium">Open Studio</button>
                        <button className="h-7 px-2.5 text-xs border border-stone-200 text-stone-600 rounded hover:bg-stone-50 transition-colors">Showcase</button>
                        <MoreMenu items={[{ label: "Site settings", action: () => setDetailSite(site) }, { label: "Rebuild", action: () => {} }, { label: "Audit", action: () => {} }, { label: "Archive", action: () => archiveSite(site.id), danger: true }]} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] font-mono text-stone-400">{filtered.length} of {sites.length} sites</span>
              <span className="text-[11px] text-stone-400">WebsiteLeadAgent Platform v1</span>
            </div>
          </div>
        )}

        {/* Visual view */}
        {viewMode === "visual" && (
          <>
            {filtered.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-lg py-16 text-center text-sm text-stone-400">No sites match your filters</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filtered.map(site => (
                  <div key={site.id} className={`bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col ${site.status === "ARCHIVED" ? "opacity-60" : ""}`}>
                    <div className="relative cursor-pointer" onClick={() => setDetailSite(site)}>
                      <SiteThumbnail site={site} className="w-full aspect-[16/10]" onPreview={() => {}} onCMS={() => onOpenStudio(site)} />
                      <div className="absolute top-2.5 left-2.5"><Badge label={SITE_STATUS_META[site.status].label} cls={SITE_STATUS_META[site.status].cls} sm /></div>
                    </div>
                    <div className="px-4 py-3 flex flex-col gap-2 flex-1">
                      <div>
                        <button onClick={() => setDetailSite(site)} className="text-sm font-semibold text-stone-900 hover:text-green-700 transition-colors text-left leading-snug block">{site.name}</button>
                        <p className="text-[11px] font-mono text-stone-400 mt-0.5">{site.domain}</p>
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 truncate">{site.template}</p>
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span className="font-mono tabular-nums">Pg {site.pages} · Pr {site.projects} · N {site.news}</span>
                        <span className="truncate ml-2">{site.lastUpdated}</span>
                      </div>
                      {site.attention && <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" /><span className="text-[10px] text-amber-600">{site.attention}</span></div>}
                      <div className="flex items-center gap-1.5 mt-auto pt-1 border-t border-stone-50">
                        <button onClick={() => onOpenStudio(site)} className="flex-1 h-7 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium">Open Studio</button>
                        <button className="h-7 px-2.5 text-xs border border-stone-200 text-stone-600 rounded hover:bg-stone-50 transition-colors">Showcase</button>
                        <MoreMenu items={[{ label: "Site settings", action: () => setDetailSite(site) }, { label: "Rebuild", action: () => {} }, { label: "Archive", action: () => archiveSite(site.id), danger: true }]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-center text-[11px] font-mono text-stone-400">{filtered.length} of {sites.length} sites</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO (CMS shell)
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_NAV = ["Dashboard", "Pages", "News", "Projects", "Services", "Vacancies", "Media", "Navigation", "Contacts", "Site Settings", "Users"];

function StudioView({ site }: { site: Site }) {
  const [activeSection, setActiveSection] = useState("Dashboard");
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 bg-stone-900 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-stone-800">
          <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-0.5">Studio</p>
          <p className="text-xs font-semibold text-stone-100 truncate">{site.name}</p>
          <p className="text-[10px] font-mono text-stone-500 truncate">{site.domain}</p>
        </div>
        <nav className="flex-1 py-2">
          {STUDIO_NAV.map(item => (
            <button
              key={item}
              onClick={() => setActiveSection(item)}
              className={`w-full text-left px-4 py-2 text-xs transition-colors ${activeSection === item ? "bg-stone-800 text-stone-100 font-medium" : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/50"}`}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
      {/* Main */}
      <main className="flex-1 bg-[#F4F4F3] overflow-y-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-stone-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#78716C" strokeWidth="1.3"><rect x="2" y="2" width="14" height="14" rx="2" /><path d="M6 7h6M6 10h4" /></svg>
          </div>
          <p className="text-sm font-semibold text-stone-700">{activeSection}</p>
          <p className="text-xs text-stone-400 mt-1">{site.name}</p>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("hub");
  const [sites, setSites] = useState<Site[]>(SITES);
  const [studioSite, setStudioSite] = useState<Site | null>(null);
  const [factoryRuns] = useState<FactoryRun[]>(FACTORY_RUNS);

  function navigate(view: AppView) {
    setCurrentView(view);
    if (view !== "studio") setStudioSite(null);
  }

  function openStudio(site: Site) {
    setStudioSite(site);
    setCurrentView("studio");
  }

  return (
    <div className="h-full flex flex-col bg-[#F4F4F3] font-sans text-stone-900">
      <ProductHeader currentView={currentView} studioSite={studioSite} onNavigate={navigate} />
      {currentView === "hub" && <HubView onNavigate={navigate} factoryRuns={factoryRuns} sites={sites} />}
      {currentView === "radar" && <RadarView onNavigate={navigate} />}
      {currentView === "factory" && <FactoryView onNavigate={navigate} />}
      {currentView === "forge" && <ForgeView sites={sites} setSites={setSites} onOpenStudio={openStudio} />}
      {currentView === "studio" && studioSite && <StudioView site={studioSite} />}
    </div>
  );
}
