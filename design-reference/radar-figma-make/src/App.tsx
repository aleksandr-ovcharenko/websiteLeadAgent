import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = "UNREVIEWED" | "GOOD" | "BAD" | "UNSURE";
type ViewMode = "review" | "table";
type SortKey = "lead_score" | "redesign" | "discovered" | "reviewed";

interface Toast {
  id: string;
  message: string;
  undoFn?: () => void;
}

interface AiAnalysis {
  summary: string;
  modernity: number;
  visualQuality: number;
  mobileUx: number;
  trust: number;
  ctaQuality: number;
  contentStructure: number;
  redesignPotential: number;
  problems: string[];
  strengths: string[];
}

interface Lead {
  id: string;
  company: string;
  domain: string;
  category: string;
  screenshotUrl: string;
  screenshotMobileUrl?: string;
  leadScore: number;
  businessScore: number;
  technicalScore: number;
  visualScore: number;
  redesignScore: number;
  reviewStatus: ReviewStatus;
  auditStatus: "pending" | "complete" | "failed";
  lighthousePerf: number;
  lighthouseA11y: number;
  lighthouseSeo: number;
  discoveredAt: string;
  reviewedAt?: string;
  selectedForRedesign: boolean;
  demoGenerated: boolean;
  ai: AiAnalysis;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const LEADS: Lead[] = [
  {
    id: "1",
    company: "СтройМастер",
    domain: "stroymaster.by",
    category: "Строительство",
    screenshotUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&h=400&fit=crop&auto=format",
    screenshotMobileUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=360&fit=crop&auto=format",
    leadScore: 82,
    businessScore: 85,
    technicalScore: 44,
    visualScore: 32,
    redesignScore: 9,
    reviewStatus: "GOOD",
    auditStatus: "complete",
    lighthousePerf: 38,
    lighthouseA11y: 71,
    lighthouseSeo: 84,
    discoveredAt: "2026-08-20",
    reviewedAt: "2026-08-22",
    selectedForRedesign: false,
    demoGenerated: false,
    ai: {
      summary: "Сайт устарел визуально, слабая мобильная версия, бизнес выглядит активным.",
      modernity: 28, visualQuality: 32, mobileUx: 24, trust: 78, ctaQuality: 41, contentStructure: 55, redesignPotential: 91,
      problems: ["No clear CTA above fold", "Typography inconsistency", "Mobile nav broken"],
      strengths: ["Established brand presence", "Detailed service pages", "Strong local SEO signals"],
    },
  },
  {
    id: "2",
    company: "АвтоЦентр Плюс",
    domain: "autocenter-plus.by",
    category: "Автосервис",
    screenshotUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=640&h=400&fit=crop&auto=format",
    screenshotMobileUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200&h=360&fit=crop&auto=format",
    leadScore: 74,
    businessScore: 78,
    technicalScore: 51,
    visualScore: 48,
    redesignScore: 7,
    reviewStatus: "UNREVIEWED",
    auditStatus: "complete",
    lighthousePerf: 54,
    lighthouseA11y: 68,
    lighthouseSeo: 79,
    discoveredAt: "2026-08-23",
    selectedForRedesign: false,
    demoGenerated: false,
    ai: {
      summary: "Функциональный, визуально устаревший, хорошая глубина контента, умеренный потенциал редизайна.",
      modernity: 42, visualQuality: 48, mobileUx: 51, trust: 72, ctaQuality: 55, contentStructure: 62, redesignPotential: 72,
      problems: ["Generic stock imagery", "Cluttered navigation"],
      strengths: ["Clear pricing", "Good service catalog", "Active reviews section"],
    },
  },
  {
    id: "3",
    company: "МедЦентр Здоровье",
    domain: "zdravie-med.by",
    category: "Медицина",
    screenshotUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=640&h=400&fit=crop&auto=format",
    leadScore: 91,
    businessScore: 92,
    technicalScore: 29,
    visualScore: 21,
    redesignScore: 10,
    reviewStatus: "GOOD",
    auditStatus: "complete",
    lighthousePerf: 22,
    lighthouseA11y: 48,
    lighthouseSeo: 88,
    discoveredAt: "2026-08-18",
    reviewedAt: "2026-08-19",
    selectedForRedesign: true,
    demoGenerated: true,
    ai: {
      summary: "Высокодоверенный бизнес с устаревшим сайтом — максимальный потенциал редизайна.",
      modernity: 18, visualQuality: 21, mobileUx: 19, trust: 89, ctaQuality: 31, contentStructure: 44, redesignPotential: 97,
      problems: ["2008-era layout", "No mobile optimization", "Flash-era elements remain"],
      strengths: ["High domain authority", "Extensive doctor profiles", "Long operational history"],
    },
  },
  {
    id: "4",
    company: "БелЮрист",
    domain: "belyurist.com",
    category: "Юридические услуги",
    screenshotUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=640&h=400&fit=crop&auto=format",
    leadScore: 58,
    businessScore: 64,
    technicalScore: 67,
    visualScore: 71,
    redesignScore: 4,
    reviewStatus: "UNSURE",
    auditStatus: "complete",
    lighthousePerf: 71,
    lighthouseA11y: 83,
    lighthouseSeo: 76,
    discoveredAt: "2026-08-21",
    reviewedAt: "2026-08-24",
    selectedForRedesign: false,
    demoGenerated: false,
    ai: {
      summary: "Современный дизайн, слабые сигналы доверия, низкая ценность редизайна.",
      modernity: 68, visualQuality: 71, mobileUx: 74, trust: 61, ctaQuality: 59, contentStructure: 67, redesignPotential: 38,
      problems: ["Thin content", "No client testimonials"],
      strengths: ["Clean layout", "Mobile-friendly", "Clear contact info"],
    },
  },
  {
    id: "5",
    company: "РесторанГрупп",
    domain: "restoran-grp.by",
    category: "Общепит",
    screenshotUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=640&h=400&fit=crop&auto=format",
    leadScore: 38,
    businessScore: 42,
    technicalScore: 88,
    visualScore: 82,
    redesignScore: 2,
    reviewStatus: "BAD",
    auditStatus: "complete",
    lighthousePerf: 89,
    lighthouseA11y: 91,
    lighthouseSeo: 85,
    discoveredAt: "2026-08-22",
    reviewedAt: "2026-08-25",
    selectedForRedesign: false,
    demoGenerated: false,
    ai: {
      summary: "Современный сайт с хорошей производительностью — низкий потенциал редизайна.",
      modernity: 84, visualQuality: 82, mobileUx: 87, trust: 76, ctaQuality: 79, contentStructure: 81, redesignPotential: 18,
      problems: ["Already well-designed"],
      strengths: ["Fast load time", "Great imagery", "Clear menu structure"],
    },
  },
  {
    id: "6",
    company: "ТехноСервис",
    domain: "technoserv.by",
    category: "IT / Техника",
    screenshotUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=640&h=400&fit=crop&auto=format",
    leadScore: 67,
    businessScore: 71,
    technicalScore: 38,
    visualScore: 41,
    redesignScore: 6,
    reviewStatus: "UNREVIEWED",
    auditStatus: "failed",
    lighthousePerf: 0,
    lighthouseA11y: 0,
    lighthouseSeo: 0,
    discoveredAt: "2026-08-26",
    selectedForRedesign: false,
    demoGenerated: false,
    ai: {
      summary: "Средний IT-бизнес, устаревшая визуальная подача, умеренный потенциал редизайна.",
      modernity: 39, visualQuality: 41, mobileUx: 44, trust: 66, ctaQuality: 48, contentStructure: 52, redesignPotential: 63,
      problems: ["Audit failed — manual check needed", "Inconsistent branding"],
      strengths: ["Clear service list", "Contact form present"],
    },
  },
];

// ─── Design tokens (single source of truth) ───────────────────────────────────

const STATUS_CONFIG: Record<ReviewStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  hoverBg: string;
}> = {
  GOOD:       { label: "Good",       bg: "#f0f9f4", text: "#276749", border: "#c3dece", activeBg: "#276749", activeText: "#fff", activeBorder: "#276749", hoverBg: "#e6f5ed" },
  UNSURE:     { label: "Unsure",     bg: "#fdf8ee", text: "#92600a", border: "#e8d5a3", activeBg: "#92600a", activeText: "#fff", activeBorder: "#92600a", hoverBg: "#fdf3de" },
  BAD:        { label: "Bad",        bg: "#fdf2f2", text: "#9b1c1c", border: "#f0b8b8", activeBg: "#9b1c1c", activeText: "#fff", activeBorder: "#9b1c1c", hoverBg: "#fde8e8" },
  UNREVIEWED: { label: "Unreviewed", bg: "#f5f4f2", text: "#78716c", border: "#ddd9d4", activeBg: "#44403c", activeText: "#fff", activeBorder: "#44403c", hoverBg: "#efede9" },
};

function scoreHue(score: number) {
  if (score >= 75) return { text: "#276749", ring: "#52b788" };
  if (score >= 50) return { text: "#57534e", ring: "#a8a29e" };
  return { text: "#92600a", ring: "#d4a847" };
}

// ─── Primitive UI ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span style={{ background: c.bg, color: c.text, borderColor: c.border }}
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border leading-none">
      {c.label}
    </span>
  );
}

function ScorePill({ value, max = 100 }: { value: number; max?: number }) {
  const pct = max === 10 ? value * 10 : value;
  const { text } = scoreHue(pct);
  return (
    <span style={{ color: text }} className="font-mono text-[11px] font-medium tabular-nums">
      {max === 10 ? `${value}/10` : value}
    </span>
  );
}

function ScoreRow({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = max === 10 ? value * 10 : value;
  const { ring } = scoreHue(pct);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono text-[#a8a29e] w-[72px] shrink-0">{label}</span>
      <div className="flex-1 h-[2px] rounded-full bg-[#ebe9e5] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: ring }} />
      </div>
      <ScorePill value={value} max={max} />
    </div>
  );
}

// SVG arc ring — dominant lead score indicator
function LeadScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const { ring, text } = scoreHue(score);
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="22" cy="22" r={r} stroke="#ebe9e5" strokeWidth="3" fill="none" />
        <circle cx="22" cy="22" r={r} stroke={ring} strokeWidth="3" fill="none"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.35s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ color: text }} className="text-[12px] font-mono font-semibold tabular-nums">{score}</span>
      </div>
    </div>
  );
}

// Review decision — segmented control
function ReviewButtons({
  status, leadId, onReview, showLabels = true, keyHints = false,
}: {
  status: ReviewStatus; leadId: string;
  onReview: (id: string, s: ReviewStatus) => void;
  showLabels?: boolean; keyHints?: boolean;
}) {
  const opts: { s: ReviewStatus; icon: string; key: string }[] = [
    { s: "GOOD",  icon: "✓", key: "G" },
    { s: "UNSURE", icon: "?", key: "U" },
    { s: "BAD",   icon: "×", key: "B" },
  ];
  return (
    <div className="flex rounded-[5px] overflow-hidden border border-[#ddd9d4] divide-x divide-[#ddd9d4]">
      {opts.map(({ s, icon, key }) => {
        const active = status === s;
        const c = STATUS_CONFIG[s];
        return (
          <button key={s}
            title={keyHints ? `${c.label} (${key})` : c.label}
            onClick={e => { e.stopPropagation(); onReview(leadId, s); }}
            style={active
              ? { background: c.activeBg, color: c.activeText, borderColor: c.activeBorder }
              : { background: "transparent", color: "#78716c" }}
            className={`flex items-center gap-1 px-2.5 py-[5px] text-[11px] font-mono transition-colors duration-150 ${!active ? "hover:bg-[#f5f4f2]" : ""}`}>
            <span>{icon}</span>
            {showLabels && <span>{c.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Screenshot with hover overlay ───────────────────────────────────────────

function Screenshot({ url, domain, auditFailed, aspectClass = "aspect-[16/10]" }: {
  url: string; domain: string; auditFailed?: boolean; aspectClass?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-[#f0ede8] ${aspectClass}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <img src={url} alt={`${domain} screenshot`}
        className="w-full h-full object-cover object-top" />
      {/* Hover overlay */}
      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.15s ease" }}
        className="absolute inset-0 flex items-center justify-center bg-[#1c1917]/60">
        <span className="text-white text-[11px] font-mono px-3 py-1.5 rounded border border-white/30 bg-white/10 backdrop-blur-sm">
          Open original site ↗
        </span>
      </a>
      {auditFailed && (
        <div className="absolute bottom-0 left-0 right-0 bg-[#92600a]/90 text-white text-[10px] font-mono px-2 py-1 text-center">
          Audit failed
        </div>
      )}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const CATEGORIES = ["All categories", "Строительство", "Автосервис", "Медицина", "Юридические услуги", "Общепит", "IT / Техника"];
const STATUSES: (ReviewStatus | "ALL")[] = ["ALL", "UNREVIEWED", "GOOD", "BAD", "UNSURE"];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "lead_score",  label: "Highest lead score" },
  { key: "redesign",    label: "Highest redesign potential" },
  { key: "discovered",  label: "Recently discovered" },
  { key: "reviewed",    label: "Recently reviewed" },
];

function FilterBar({
  search, onSearch,
  filterStatus, onStatus,
  filterCategory, onCategory,
  filterAudit, onAudit,
  minScore, onMinScore,
  sortKey, onSort,
  count,
}: {
  search: string; onSearch: (v: string) => void;
  filterStatus: ReviewStatus | "ALL"; onStatus: (v: ReviewStatus | "ALL") => void;
  filterCategory: string; onCategory: (v: string) => void;
  filterAudit: string; onAudit: (v: string) => void;
  minScore: number; onMinScore: (v: number) => void;
  sortKey: SortKey; onSort: (v: SortKey) => void;
  count: number;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setFiltersOpen(false);
    }
    if (filtersOpen) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [filtersOpen]);

  const hasActiveFilters = filterStatus !== "ALL" || filterCategory !== "All categories"
    || filterAudit !== "all" || minScore > 0;

  return (
    <div className="bg-white border border-[#e5e3df] rounded-md px-4 py-2.5 flex items-center gap-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#c0bdb8]" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search leads…"
          className="h-[30px] pl-7 pr-3 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] text-[#1c1917] placeholder-[#c0bdb8] focus:outline-none focus:border-[#a8a29e] font-mono w-44 transition-colors duration-150" />
      </div>

      {/* Status tabs */}
      <div className="flex border border-[#e5e3df] rounded-[5px] overflow-hidden divide-x divide-[#e5e3df]">
        {(["ALL", "UNREVIEWED", "GOOD", "BAD"] as (ReviewStatus | "ALL")[]).map(s => {
          const active = filterStatus === s;
          const label = s === "ALL" ? "All" : STATUS_CONFIG[s as ReviewStatus].label;
          return (
            <button key={s} onClick={() => onStatus(s)}
              className={`px-2.5 h-[30px] text-[11px] font-mono transition-colors duration-150 ${active ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:bg-[#f5f4f2]"}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters popover */}
      <div className="relative" ref={popRef}>
        <button onClick={() => setFiltersOpen(v => !v)}
          className={`flex items-center gap-1.5 h-[30px] px-3 text-[11px] font-mono border rounded-[5px] transition-colors duration-150 ${hasActiveFilters ? "border-[#276749] text-[#276749] bg-[#f0f9f4]" : "border-[#e5e3df] text-[#78716c] hover:bg-[#f5f4f2]"}`}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 2.5h9M2.5 5.5h6M4 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#276749]" />}
        </button>
        {filtersOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-[#e5e3df] rounded-md shadow-lg z-30 p-4 space-y-4"
            style={{ animation: "popIn 0.12s ease" }}>
            <div>
              <label className="block text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider mb-1.5">Category</label>
              <select value={filterCategory} onChange={e => onCategory(e.target.value)}
                className="w-full h-[30px] px-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] text-[#57534e] focus:outline-none font-mono">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider mb-1.5">Audit</label>
              <select value={filterAudit} onChange={e => onAudit(e.target.value)}
                className="w-full h-[30px] px-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] text-[#57534e] focus:outline-none font-mono">
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider mb-1.5">
                Min lead score — <span className="text-[#57534e]">{minScore}</span>
              </label>
              <input type="range" min={0} max={100} step={5} value={minScore} onChange={e => onMinScore(Number(e.target.value))}
                className="w-full accent-[#276749]" />
            </div>
            {hasActiveFilters && (
              <button onClick={() => { onStatus("ALL"); onCategory("All categories"); onAudit("all"); onMinScore(0); }}
                className="text-[11px] font-mono text-[#9b1c1c] hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sort + count */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[11px] font-mono text-[#c0bdb8] tabular-nums">{count}</span>
        <select value={sortKey} onChange={e => onSort(e.target.value as SortKey)}
          className="h-[30px] px-2 text-[11px] border border-[#e5e3df] rounded-[5px] bg-[#fafaf9] text-[#78716c] focus:outline-none font-mono">
          {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="pointer-events-auto flex items-center gap-3 bg-[#1c1917] text-white text-[12px] font-mono px-4 py-2.5 rounded-md shadow-lg"
          style={{ animation: "toastIn 0.18s ease" }}>
          <span className="text-[#e7e5e4]">{t.message}</span>
          {t.undoFn && (
            <button onClick={() => { t.undoFn!(); onDismiss(t.id); }}
              className="text-[#52b788] hover:text-white underline underline-offset-2 transition-colors duration-150">
              Undo
            </button>
          )}
          <button onClick={() => onDismiss(t.id)} className="text-[#78716c] hover:text-[#a8a29e] ml-1 transition-colors duration-150">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function Collapsible({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#f0ede8]">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#fafaf8] transition-colors duration-150">
        <span className="text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">{title}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
          <path d="M2 3.5l3 3 3-3" stroke="#c0bdb8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4" style={{ animation: "fadeIn 0.15s ease" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SidePanel({ lead, onClose, onReview, onNavigate, hasPrev, hasNext }: {
  lead: Lead; onClose: () => void; onReview: (id: string, s: ReviewStatus) => void;
  onNavigate: (dir: "prev" | "next") => void; hasPrev: boolean; hasNext: boolean;
}) {
  const [screenshotTab, setScreenshotTab] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => { setScreenshotTab("desktop"); }, [lead.id]);

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-[#e5e3df] flex flex-col z-40"
      style={{ boxShadow: "-4px 0 24px rgba(28,25,23,0.07)", animation: "drawerIn 0.18s ease" }}>

      {/* ── Narrow nav bar ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#f0ede8] shrink-0">
        {[
          { dir: "prev" as const, enabled: hasPrev, d: "M6.5 1.5L3 5l3.5 3.5", hint: "Previous (K)" },
          { dir: "next" as const, enabled: hasNext, d: "M3.5 1.5L7 5l-3.5 3.5", hint: "Next (J)" },
        ].map(({ dir, enabled, d, hint }) => (
          <button key={dir} onClick={() => onNavigate(dir)} disabled={!enabled} title={hint}
            className="w-6 h-6 flex items-center justify-center rounded text-[#c0bdb8] disabled:opacity-25 hover:bg-[#f5f4f2] hover:text-[#57534e] transition-colors duration-150">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <a href={`https://${lead.domain}`} target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-mono text-[#a8a29e] hover:text-[#276749] transition-colors duration-150">
            {lead.domain} ↗
          </a>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f5f4f2] text-[#a8a29e] transition-colors duration-150">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* 1. Screenshot — full width, no padding, tabs float above */}
        <div className="relative bg-[#f0ede8]">
          {lead.screenshotMobileUrl && (
            <div className="absolute top-3 left-3 z-10 flex rounded-[4px] overflow-hidden border border-white/30 shadow-sm">
              {(["desktop", "mobile"] as const).map(t => (
                <button key={t} onClick={() => setScreenshotTab(t)}
                  className={`px-2.5 py-1 text-[10px] font-mono capitalize transition-colors duration-150 ${screenshotTab === t ? "bg-[#1c1917] text-white" : "bg-white/80 text-[#57534e] hover:bg-white"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="aspect-[16/10] relative overflow-hidden">
            <img
              src={screenshotTab === "mobile" && lead.screenshotMobileUrl ? lead.screenshotMobileUrl : lead.screenshotUrl}
              alt={`${lead.company} website`}
              className="w-full h-full object-cover object-top"
            />
            {lead.auditStatus === "failed" && (
              <div className="absolute bottom-0 left-0 right-0 bg-[#92600a]/90 text-white text-[10px] font-mono px-3 py-1.5 text-center">
                Audit failed — screenshot may be outdated
              </div>
            )}
          </div>
        </div>

        {/* 2. Identity + lead score */}
        <div className="px-5 pt-5 pb-4 border-b border-[#f0ede8]">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-[16px] text-[#1c1917] leading-tight">{lead.company}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[12px] font-mono text-[#276749]">{lead.domain}</span>
                <span className="text-[#ddd9d4]">·</span>
                <span className="text-[12px] font-mono text-[#a8a29e]">{lead.category}</span>
              </div>
            </div>
            {/* Lead score — prominent */}
            <div className="flex flex-col items-center shrink-0">
              <LeadScoreRing score={lead.leadScore} />
              <span className="text-[10px] font-mono text-[#a8a29e] mt-1">Lead score</span>
            </div>
          </div>

          {/* Redesign potential — the key signal, shown prominently */}
          <div className="mt-4 flex items-center gap-3 bg-[#f5f4f2] rounded-[6px] px-4 py-3">
            <div className="flex-1">
              <div className="text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider mb-1">Redesign potential</div>
              <div className="h-[3px] rounded-full bg-[#e5e3df] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${lead.ai.redesignPotential}%`, background: scoreHue(lead.ai.redesignPotential).ring }} />
              </div>
            </div>
            <span style={{ color: scoreHue(lead.ai.redesignPotential).text }}
              className="text-[18px] font-mono font-semibold tabular-nums shrink-0">
              {lead.ai.redesignPotential}
            </span>
          </div>
        </div>

        {/* 3. AI verdict — the core decision input */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f0ede8]">
          <div className="text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider mb-2">AI Assessment</div>
          <p className="text-[13px] text-[#44403c] leading-[1.6]">{lead.ai.summary}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Problems */}
            <div>
              <div className="text-[10px] font-mono text-[#a8a29e] mb-2 flex items-center gap-1">
                <span className="w-3 h-px bg-[#e0a0a0] inline-block" />
                Problems
              </div>
              <div className="space-y-1.5">
                {lead.ai.problems.map(p => (
                  <div key={p} className="flex items-start gap-1.5">
                    <span className="text-[#c0807e] text-[11px] shrink-0 mt-[1px]">—</span>
                    <span className="text-[12px] text-[#57534e] leading-[1.4]">{p}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Strengths */}
            <div>
              <div className="text-[10px] font-mono text-[#a8a29e] mb-2 flex items-center gap-1">
                <span className="w-3 h-px bg-[#7cc4a4] inline-block" />
                Strengths
              </div>
              <div className="space-y-1.5">
                {lead.ai.strengths.map(s => (
                  <div key={s} className="flex items-start gap-1.5">
                    <span className="text-[#52b788] text-[11px] shrink-0 mt-[1px]">+</span>
                    <span className="text-[12px] text-[#57534e] leading-[1.4]">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Technical — collapsible */}
        <Collapsible title="Technical details">
          <div className="space-y-3">
            <div className="space-y-2">
              <ScoreRow label="Business" value={lead.businessScore} />
              <ScoreRow label="Visual" value={lead.visualScore} />
              <ScoreRow label="Technical" value={lead.technicalScore} />
            </div>

            <div className="pt-2 border-t border-[#f0ede8]">
              <div className="text-[10px] font-mono text-[#a8a29e] mb-2">Lighthouse</div>
              {lead.auditStatus === "failed" ? (
                <div className="text-[12px] font-mono text-[#92600a]">Audit failed</div>
              ) : (
                <div className="flex gap-5">
                  {[["Perf", lead.lighthousePerf], ["A11y", lead.lighthouseA11y], ["SEO", lead.lighthouseSeo]].map(([l, v]) => (
                    <div key={l as string} className="text-center">
                      <div style={{ color: scoreHue(v as number).text }}
                        className="text-[15px] font-mono font-semibold tabular-nums">{v}</div>
                      <div className="text-[10px] font-mono text-[#a8a29e]">{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#f0ede8]">
              <div className="text-[10px] font-mono text-[#a8a29e] mb-2">AI sub-scores</div>
              <div className="space-y-1.5">
                {[
                  ["Modernity", lead.ai.modernity], ["Visual quality", lead.ai.visualQuality],
                  ["Mobile UX", lead.ai.mobileUx], ["Trust", lead.ai.trust],
                  ["CTA quality", lead.ai.ctaQuality], ["Content", lead.ai.contentStructure],
                ].map(([l, v]) => <ScoreRow key={l as string} label={l as string} value={v as number} />)}
              </div>
            </div>

            <div className="pt-2 border-t border-[#f0ede8] flex gap-2">
              <a href={`https://${lead.domain}`} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-[11px] font-mono text-[#57534e] border border-[#e5e3df] rounded-[5px] hover:bg-[#f5f4f2] transition-colors duration-150">
                Open original site ↗
              </a>
              {lead.auditStatus === "complete" && (
                <button className="px-3 py-1.5 text-[11px] font-mono text-[#57534e] border border-[#e5e3df] rounded-[5px] hover:bg-[#f5f4f2] transition-colors duration-150">
                  View audit
                </button>
              )}
            </div>
          </div>
        </Collapsible>

        {/* Spacer so content clears sticky footer */}
        <div className="h-2" />
      </div>

      {/* ── Sticky footer: single question, clear actions ── */}
      <div className="shrink-0 border-t border-[#e5e3df] bg-white">
        {/* Current status indicator */}
        {lead.reviewStatus !== "UNREVIEWED" && (
          <div className="px-5 pt-3 pb-0">
            <StatusBadge status={lead.reviewStatus} />
          </div>
        )}

        {/* Decision buttons — Bad / Unsure / Good order (left=reject, right=accept) */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-[#c0bdb8] uppercase tracking-wider">Decision</span>
            <span className="text-[10px] font-mono text-[#ddd9d4]">B · U · G</span>
          </div>
          <div className="flex rounded-[5px] overflow-hidden border border-[#ddd9d4] divide-x divide-[#ddd9d4]">
            {([
              { s: "BAD"   as ReviewStatus, icon: "×", key: "B" },
              { s: "UNSURE" as ReviewStatus, icon: "?", key: "U" },
              { s: "GOOD"  as ReviewStatus, icon: "✓", key: "G" },
            ]).map(({ s, icon, key }) => {
              const active = lead.reviewStatus === s;
              const c = STATUS_CONFIG[s];
              return (
                <button key={s} title={`${c.label} (${key})`}
                  onClick={() => onReview(lead.id, s)}
                  style={active
                    ? { background: c.activeBg, color: c.activeText }
                    : { background: "transparent", color: "#78716c" }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-mono font-medium transition-colors duration-150 ${!active ? "hover:bg-[#f5f4f2]" : ""}`}>
                  <span>{icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary action — only shown when it makes sense */}
        <div className="px-5 pb-4">
          {lead.reviewStatus === "GOOD" && !lead.demoGenerated ? (
            <button className="w-full py-2.5 bg-[#276749] text-white text-[13px] font-semibold rounded-[5px] hover:bg-[#1f5238] transition-colors duration-150">
              Generate demo
            </button>
          ) : lead.demoGenerated ? (
            <button className="w-full py-2.5 bg-[#1c1917] text-white text-[13px] font-medium rounded-[5px] hover:bg-[#292524] transition-colors duration-150">
              View generated demo
            </button>
          ) : (
            <div className="text-[11px] font-mono text-[#c0bdb8] text-center py-1">
              Mark as Good to generate demo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review Row ───────────────────────────────────────────────────────────────

function ReviewRow({ lead, onSelect, onReview, selected, checked, onCheck, isFocused }: {
  lead: Lead; onSelect: () => void; onReview: (id: string, s: ReviewStatus) => void;
  selected: boolean; checked: boolean; onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFocused: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isFocused]);

  return (
    <div ref={rowRef} onClick={onSelect}
      className={`flex border rounded-md overflow-hidden cursor-pointer bg-white transition-all duration-150
        ${selected
          ? "border-[#276749] shadow-[0_0_0_1px_#276749]"
          : isFocused
            ? "border-[#a8a29e]"
            : "border-[#e5e3df] hover:border-[#d1cdc7] hover:shadow-sm"}`}>

      {/* Checkbox strip */}
      <div className="w-8 shrink-0 flex items-start justify-center pt-4 border-r border-[#f0ede8] bg-[#fafaf9]"
        onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onCheck}
          className="w-3 h-3 accent-[#276749] cursor-pointer mt-0.5" />
      </div>

      {/* Screenshot — fixed aspect, consistent width */}
      <div className="w-[200px] shrink-0 border-r border-[#f0ede8]" style={{ minHeight: 140 }}>
        <Screenshot url={lead.screenshotUrl} domain={lead.domain}
          auditFailed={lead.auditStatus === "failed"} aspectClass="h-full w-full" />
      </div>

      {/* Company + AI — flex-1, primary info at top */}
      <div className="flex-1 px-5 py-4 border-r border-[#f0ede8] min-w-0 flex flex-col justify-between">
        {/* PRIMARY */}
        <div>
          <div className="font-semibold text-[14px] text-[#1c1917] truncate leading-tight">{lead.company}</div>
          {/* SECONDARY */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-mono text-[#276749]">{lead.domain}</span>
            <span className="text-[#ddd9d4]">·</span>
            <span className="text-[11px] font-mono text-[#a8a29e]">{lead.category}</span>
          </div>
        </div>
        {/* AI summary */}
        <p className="text-[12px] text-[#57534e] leading-[1.5] mt-3 line-clamp-2">{lead.ai.summary}</p>
        {/* TERTIARY */}
        <div className="flex items-center gap-2 mt-3">
          <button onClick={e => { e.stopPropagation(); onSelect(); }}
            className="text-[11px] font-mono text-[#c0bdb8] hover:text-[#276749] transition-colors duration-150">
            View analysis →
          </button>
          {lead.selectedForRedesign && (
            <span className="text-[10px] font-mono text-[#276749] bg-[#f0f9f4] border border-[#c3dece] px-1.5 py-0.5 rounded">
              ✓ Queued
            </span>
          )}
          {lead.discoveredAt && (
            <span className="text-[10px] font-mono text-[#c0bdb8] ml-auto">{lead.discoveredAt}</span>
          )}
        </div>
      </div>

      {/* Scores — lead score dominant, rest tertiary */}
      <div className="w-[148px] shrink-0 px-4 py-4 border-r border-[#f0ede8] flex flex-col justify-center gap-3">
        {/* PRIMARY: score ring */}
        <div className="flex items-center gap-3">
          <LeadScoreRing score={lead.leadScore} />
          <div className="text-[10px] font-mono text-[#a8a29e] leading-snug">Lead<br/>score</div>
        </div>
        {/* TERTIARY: secondary scores */}
        <div className="space-y-1.5 pt-1">
          {[
            { l: "Business", v: lead.businessScore },
            { l: "Visual", v: lead.visualScore },
            { l: "Redesign", v: lead.redesignScore, max: 10 },
          ].map(({ l, v, max }) => (
            <div key={l} className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono text-[#c0bdb8]">{l}</span>
              <ScorePill value={v} max={max} />
            </div>
          ))}
        </div>
      </div>

      {/* Decision + action */}
      <div className="w-[172px] shrink-0 px-4 py-4 flex flex-col justify-between"
        onClick={e => e.stopPropagation()}>
        <div className="space-y-2">
          <StatusBadge status={lead.reviewStatus} />
          <ReviewButtons status={lead.reviewStatus} leadId={lead.id} onReview={onReview} showLabels={false} keyHints />
        </div>
        <div>
          {lead.reviewStatus === "GOOD" && !lead.demoGenerated ? (
            <button className="w-full py-1.5 bg-[#276749] text-white text-[11px] font-medium rounded-[5px] hover:bg-[#1f5238] transition-colors duration-150">
              Generate demo
            </button>
          ) : lead.demoGenerated ? (
            <button className="w-full py-1.5 bg-[#1c1917] text-white text-[11px] font-medium rounded-[5px] hover:bg-[#292524] transition-colors duration-150">
              View demo
            </button>
          ) : (
            <a href={`https://${lead.domain}`} target="_blank" rel="noopener noreferrer"
              className="block w-full py-1.5 text-center text-[11px] font-mono text-[#78716c] border border-[#e5e3df] rounded-[5px] hover:bg-[#f5f4f2] transition-colors duration-150">
              Open site ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({ lead, onSelect, onReview, selected, checked, onCheck }: {
  lead: Lead; onSelect: () => void; onReview: (id: string, s: ReviewStatus) => void;
  selected: boolean; checked: boolean; onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <tr className={`border-b border-[#f0ede8] cursor-pointer transition-colors duration-150 ${selected ? "bg-[#f5fbf7]" : "hover:bg-[#fafaf8]"}`}>
      <td className="py-2.5 pl-4 pr-2" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onCheck} className="w-3 h-3 accent-[#276749]" />
      </td>
      <td className="py-2.5 px-3" onClick={onSelect}>
        <div className="w-14 h-9 rounded-[3px] overflow-hidden bg-[#f0ede8] border border-[#e5e3df]">
          <img src={lead.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
        </div>
      </td>
      <td className="py-2.5 px-3" onClick={onSelect}>
        <div className="font-medium text-[13px] text-[#1c1917]">{lead.company}</div>
        <div className="text-[11px] font-mono text-[#a8a29e]">{lead.domain}</div>
      </td>
      <td className="py-2.5 px-3 text-[12px] text-[#78716c]" onClick={onSelect}>{lead.category}</td>
      <td className="py-2.5 px-3" onClick={onSelect}>
        <LeadScoreRing score={lead.leadScore} />
      </td>
      <td className="py-2.5 px-3" onClick={onSelect}>
        <ScorePill value={lead.redesignScore} max={10} />
      </td>
      <td className="py-2.5 px-3" onClick={onSelect}>
        <StatusBadge status={lead.reviewStatus} />
      </td>
      <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
        <ReviewButtons status={lead.reviewStatus} leadId={lead.id} onReview={onReview} showLabels={false} keyHints />
      </td>
      <td className="py-2.5 px-4" onClick={e => e.stopPropagation()}>
        {lead.reviewStatus === "GOOD" && !lead.demoGenerated ? (
          <button className="px-3 py-1 bg-[#276749] text-white text-[11px] font-medium rounded-[5px] hover:bg-[#1f5238] transition-colors duration-150 whitespace-nowrap">
            Generate
          </button>
        ) : lead.demoGenerated ? (
          <button className="px-3 py-1 bg-[#1c1917] text-white text-[11px] font-medium rounded-[5px] hover:bg-[#292524] transition-colors duration-150 whitespace-nowrap">
            View demo
          </button>
        ) : (
          <a href={`https://${lead.domain}`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1 text-[11px] font-mono text-[#78716c] border border-[#e5e3df] rounded-[5px] hover:bg-[#f5f4f2] transition-colors duration-150 whitespace-nowrap">
            Open ↗
          </a>
        )}
      </td>
    </tr>
  );
}

// ─── Bulk Bar ─────────────────────────────────────────────────────────────────

function BulkBar({ count, onMarkBad, onMarkUnsure, onQueueRedesign, onClear }: {
  count: number; onMarkBad: () => void; onMarkUnsure: () => void;
  onQueueRedesign: () => void; onClear: () => void;
}) {
  return (
    <div className="bg-[#1c1917] text-white rounded-md px-4 py-2.5 flex items-center gap-3"
      style={{ animation: "fadeIn 0.15s ease" }}>
      <span className="text-[11px] font-mono text-[#a8a29e]">{count} selected</span>
      <div className="h-3 w-px bg-[#44403c]" />
      <button onClick={onMarkBad} className="text-[11px] font-mono text-[#f0b8b8] hover:text-white transition-colors duration-150">× Mark bad</button>
      <button onClick={onMarkUnsure} className="text-[11px] font-mono text-[#e8d5a3] hover:text-white transition-colors duration-150">? Mark unsure</button>
      <button onClick={onQueueRedesign} className="text-[11px] font-mono text-[#8ecdb0] hover:text-white transition-colors duration-150">↑ Queue for redesign</button>
      <button onClick={onClear} className="ml-auto text-[11px] font-mono text-[#78716c] hover:text-[#a8a29e] transition-colors duration-150">Clear</button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [leads, setLeads] = useState<Lead[]>(LEADS);
  const [viewMode, setViewMode] = useState<ViewMode>("review");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "ALL">("ALL");
  const [filterCategory, setFilterCategory] = useState("All categories");
  const [filterAudit, setFilterAudit] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("lead_score");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null;

  const pushToast = useCallback((message: string, undoFn?: () => void) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-2), { id, message, undoFn }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const handleReview = useCallback((id: string, status: ReviewStatus) => {
    setLeads(prev => {
      const snapshot = prev;
      const old = prev.find(l => l.id === id);
      if (!old) return prev;
      const next = old.reviewStatus === status ? "UNREVIEWED" : status;
      pushToast(
        next === "UNREVIEWED" ? "Status cleared" : `Marked as ${next}`,
        () => setLeads(snapshot),
      );
      return prev.map(l => l.id === id
        ? { ...l, reviewStatus: next, reviewedAt: new Date().toISOString().slice(0, 10) }
        : l
      );
    });
  }, [pushToast]);

  const filtered = useMemo(() => leads
    .filter(l => {
      if (search && !l.company.toLowerCase().includes(search.toLowerCase()) && !l.domain.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== "ALL" && l.reviewStatus !== filterStatus) return false;
      if (filterCategory !== "All categories" && l.category !== filterCategory) return false;
      if (filterAudit !== "all" && l.auditStatus !== filterAudit) return false;
      if (l.leadScore < minScore) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "lead_score") return b.leadScore - a.leadScore;
      if (sortKey === "redesign") return b.redesignScore - a.redesignScore;
      if (sortKey === "discovered") return b.discoveredAt.localeCompare(a.discoveredAt);
      return (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? "");
    }), [leads, search, filterStatus, filterCategory, filterAudit, minScore, sortKey]);

  useEffect(() => {
    setFocusedIndex(i => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const stats = useMemo(() => ({
    total: leads.length,
    unreviewed: leads.filter(l => l.reviewStatus === "UNREVIEWED").length,
    good: leads.filter(l => l.reviewStatus === "GOOD").length,
    unsure: leads.filter(l => l.reviewStatus === "UNSURE").length,
    selected: leads.filter(l => l.selectedForRedesign).length,
  }), [leads]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const lead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) : filtered[focusedIndex];
      if (!lead) return;
      if (e.key === "g") { e.preventDefault(); handleReview(lead.id, "GOOD"); }
      if (e.key === "u") { e.preventDefault(); handleReview(lead.id, "UNSURE"); }
      if (e.key === "b") { e.preventDefault(); handleReview(lead.id, "BAD"); }
      if (e.key === "Escape" && selectedLeadId) { e.preventDefault(); setSelectedLeadId(null); }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedLeadId) {
          const i = filtered.findIndex(l => l.id === selectedLeadId);
          if (i < filtered.length - 1) setSelectedLeadId(filtered[i + 1].id);
        } else setFocusedIndex(i => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedLeadId) {
          const i = filtered.findIndex(l => l.id === selectedLeadId);
          if (i > 0) setSelectedLeadId(filtered[i - 1].id);
        } else setFocusedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedLeadId) setSelectedLeadId(null);
        else if (filtered[focusedIndex]) setSelectedLeadId(filtered[focusedIndex].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leads, filtered, focusedIndex, selectedLeadId, handleReview]);

  function handlePanelNavigate(dir: "prev" | "next") {
    if (!selectedLeadId) return;
    const i = filtered.findIndex(l => l.id === selectedLeadId);
    if (dir === "prev" && i > 0) setSelectedLeadId(filtered[i - 1].id);
    if (dir === "next" && i < filtered.length - 1) setSelectedLeadId(filtered[i + 1].id);
  }

  function bulkSetStatus(status: ReviewStatus) {
    const snapshot = leads;
    setLeads(prev => prev.map(l => checkedIds.has(l.id) ? { ...l, reviewStatus: status } : l));
    pushToast(`${checkedIds.size} leads marked as ${status}`, () => setLeads(snapshot));
    setCheckedIds(new Set());
  }
  function bulkQueueRedesign() {
    const snapshot = leads;
    setLeads(prev => prev.map(l => checkedIds.has(l.id) ? { ...l, selectedForRedesign: true } : l));
    pushToast(`${checkedIds.size} leads queued`, () => setLeads(snapshot));
    setCheckedIds(new Set());
  }
  function toggleCheck(id: string) {
    setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const panelIdx = selectedLeadId ? filtered.findIndex(l => l.id === selectedLeadId) : -1;

  return (
    <div className="min-h-full bg-[#f5f4f2] flex">
      {/* Sidebar */}
      <div className="w-[216px] shrink-0 bg-white border-r border-[#e5e3df] flex flex-col">
        <div className="px-5 py-[18px] border-b border-[#e5e3df]">
          <div className="text-[10px] font-mono font-medium text-[#c0bdb8] uppercase tracking-widest">WebsiteLeadAgent</div>
          <div className="text-[13px] font-semibold text-[#1c1917] mt-0.5">Super Admin</div>
        </div>
        <nav className="p-2.5 space-y-px">
          {[["Sites", false], ["Leads", true], ["Pipeline", false], ["Audit queue", false], ["Generated", false]].map(([label, active]) => (
            <div key={label as string}
              className={`px-3 py-2 rounded-[5px] text-[13px] cursor-pointer transition-colors duration-150 ${active ? "bg-[#f0f9f4] text-[#276749] font-medium" : "text-[#57534e] hover:bg-[#f5f4f2]"}`}>
              {label}
            </div>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-[#e5e3df] space-y-2">
          <div className="text-[10px] font-mono text-[#a8a29e]">admin@system.internal</div>
          <div className="text-[10px] font-mono text-[#ddd9d4]">g · u · b · j · k</div>
        </div>
      </div>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${selectedLead ? "mr-[388px]" : ""}`}>
        {/* Top bar */}
        <div className="bg-white border-b border-[#e5e3df] px-6 h-[52px] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-[14px] font-semibold text-[#1c1917]">Leads</h1>
            {/* Stat pills — clickable shortcut to filter */}
            <div className="flex items-center gap-2">
              {[
                { label: "Total", value: stats.total, status: "ALL" as const },
                { label: "Unreviewed", value: stats.unreviewed, status: "UNREVIEWED" as const, warn: stats.unreviewed > 0 },
                { label: "Good", value: stats.good, status: "GOOD" as const, positive: true },
              ].map(({ label, value, status, warn, positive }) => (
                <button key={label} onClick={() => setFilterStatus(status)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-mono transition-colors duration-150
                    ${filterStatus === status ? "bg-[#f0ede8] text-[#1c1917]" : "text-[#a8a29e] hover:bg-[#f5f4f2]"}`}>
                  <span className={`font-semibold tabular-nums ${positive ? "text-[#276749]" : warn ? "text-[#92600a]" : ""}`}>{value}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex border border-[#e5e3df] rounded-[5px] overflow-hidden">
            {(["review", "table"] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 h-[30px] text-[11px] font-mono transition-colors duration-150 capitalize ${viewMode === m ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:bg-[#f5f4f2]"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Sticky controls */}
        <div className="sticky top-0 z-20 bg-[#f5f4f2] px-6 pt-4 pb-3 space-y-2.5">
          <FilterBar
            search={search} onSearch={setSearch}
            filterStatus={filterStatus} onStatus={setFilterStatus}
            filterCategory={filterCategory} onCategory={setFilterCategory}
            filterAudit={filterAudit} onAudit={setFilterAudit}
            minScore={minScore} onMinScore={setMinScore}
            sortKey={sortKey} onSort={setSortKey}
            count={filtered.length}
          />
          {checkedIds.size > 0 && (
            <BulkBar count={checkedIds.size}
              onMarkBad={() => bulkSetStatus("BAD")}
              onMarkUnsure={() => bulkSetStatus("UNSURE")}
              onQueueRedesign={bulkQueueRedesign}
              onClear={() => setCheckedIds(new Set())} />
          )}
        </div>

        {/* Lead list */}
        <div className="flex-1 px-6 pb-8">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-md border border-[#e5e3df] px-6 py-14 text-center">
              <div className="text-[13px] font-mono text-[#a8a29e]">No leads found</div>
            </div>
          ) : viewMode === "review" ? (
            <div className="space-y-2">
              {filtered.map((lead, idx) => (
                <ReviewRow key={lead.id} lead={lead}
                  selected={selectedLeadId === lead.id}
                  isFocused={!selectedLeadId && focusedIndex === idx}
                  checked={checkedIds.has(lead.id)}
                  onCheck={e => { e.stopPropagation(); toggleCheck(lead.id); }}
                  onSelect={() => setSelectedLeadId(selectedLeadId === lead.id ? null : lead.id)}
                  onReview={handleReview} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-md border border-[#e5e3df] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e3df] bg-[#fafaf8]">
                    <th className="py-2.5 pl-4 pr-2">
                      <input type="checkbox"
                        checked={checkedIds.size === filtered.length && filtered.length > 0}
                        onChange={e => setCheckedIds(e.target.checked ? new Set(filtered.map(l => l.id)) : new Set())}
                        className="w-3 h-3 accent-[#276749]" />
                    </th>
                    {["", "Company", "Category", "Lead", "Redesign", "Status", "Review", "Action"].map(h => (
                      <th key={h} className="py-2.5 px-3 text-left text-[10px] font-mono font-medium text-[#a8a29e] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (
                    <TableRow key={lead.id} lead={lead}
                      selected={selectedLeadId === lead.id}
                      checked={checkedIds.has(lead.id)}
                      onCheck={e => { e.stopPropagation(); toggleCheck(lead.id); }}
                      onSelect={() => setSelectedLeadId(selectedLeadId === lead.id ? null : lead.id)}
                      onReview={handleReview} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedLead && (
        <SidePanel lead={selectedLead} onClose={() => setSelectedLeadId(null)}
          onReview={handleReview} onNavigate={handlePanelNavigate}
          hasPrev={panelIdx > 0} hasNext={panelIdx < filtered.length - 1} />
      )}

      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      <style>{`
        @keyframes toastIn   { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @keyframes drawerIn  { from { opacity:0; transform:translateX(8px) } to { opacity:1; transform:none } }
        @keyframes popIn     { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }
        @keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  );
}
