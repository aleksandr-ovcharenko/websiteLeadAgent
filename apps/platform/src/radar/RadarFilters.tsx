export type PrimaryView = 'all' | 'review' | 'generation';

export interface Filters {
  q: string;
  sort: string;
  websiteStatus: string;
  qualificationStatus: string; // ALL | PENDING | READY | FAILED
  manual: string;              // '' | UNREVIEWED | GOOD | UNSURE | BAD
  generationStatus: string;      // '' | NOT_SELECTED | SELECTED | GENERATING | GENERATED | FAILED | READY_FOR_GENERATION
}

export const defaultFilters: Record<PrimaryView, Filters> = {
  all: {
    q: '',
    sort: 'v2_desc',
    websiteStatus: '',
    qualificationStatus: 'ALL',
    manual: '',
    generationStatus: '',
  },
  review: {
    q: '',
    sort: 'v2_desc',
    websiteStatus: 'FOUND',
    qualificationStatus: 'READY',
    manual: 'UNREVIEWED',
    generationStatus: '',
  },
  generation: {
    q: '',
    sort: 'v2_desc',
    websiteStatus: 'FOUND',
    qualificationStatus: 'ALL',
    manual: 'GOOD',
    generationStatus: 'READY_FOR_GENERATION',
  },
};

const sorts = [
  { key: 'v2_desc', label: 'Lead score ↓' },
  { key: 'visual_desc', label: 'Visual ↓' },
  { key: 'tech_desc', label: 'Technical ↓' },
  { key: 'biz_desc', label: 'Business ↓' },
  { key: 'web_desc', label: 'Website ↓' },
  { key: 'discovered', label: 'Newest' },
];

interface ViewTab {
  key: PrimaryView;
  label: string;
  count: number;
}

export default function RadarFilters({
  filters,
  onChange,
  view,
  onView,
  counts,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  view: PrimaryView;
  onView: (v: PrimaryView) => void;
  counts: { all: number; review: number; generation: number };
}) {
  const tabs: ViewTab[] = [
    { key: 'all', label: 'All sites', count: counts.all },
    { key: 'review', label: 'Ready for review', count: counts.review },
    { key: 'generation', label: 'Ready for generation', count: counts.generation },
  ];

  const defaults = defaultFilters[view];
  const hasActiveFilters =
    filters.q !== defaults.q ||
    filters.websiteStatus !== defaults.websiteStatus ||
    filters.qualificationStatus !== defaults.qualificationStatus ||
    filters.manual !== defaults.manual ||
    filters.generationStatus !== defaults.generationStatus;

  const clearFilters = () => {
    onChange(defaultFilters[view]);
  };

  return (
    <div className="space-y-2 mb-4">
      {/* ── Primary business views ── */}
      <div className="flex items-center gap-2">
        {tabs.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onView(t.key)}
              className={`flex items-center gap-2 px-3 h-[32px] rounded-[5px] text-[12px] font-mono font-medium border transition-colors duration-150 ${
                active
                  ? 'bg-surface-inverse text-text-inverse border-surface-inverse'
                  : 'bg-surface text-text border-border hover:bg-surface-raised'
              }`}>
              <span>{t.label}</span>
              <span className={`tabular-nums text-[11px] px-1.5 py-0.5 rounded ${active ? 'bg-surface/20' : 'bg-surface-raised'}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Detail filters ── */}
      <div className="bg-surface border border-border rounded-md px-4 py-2.5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search leads…"
            className="h-[30px] pl-7 pr-3 text-[12px] border border-border rounded bg-surface-raised font-mono w-44 focus:outline-none focus:border-border"
          />
        </div>

        <select
          value={filters.websiteStatus}
          onChange={(e) => onChange({ websiteStatus: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-border rounded bg-surface-raised font-mono focus:outline-none focus:border-border">
          <option value="">All websites</option>
          <option value="FOUND">Has website</option>
          <option value="NOT_FOUND">No website</option>
          <option value="UNKNOWN">Unknown</option>
        </select>

        <select
          value={filters.qualificationStatus}
          onChange={(e) => onChange({ qualificationStatus: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-border rounded bg-surface-raised font-mono focus:outline-none focus:border-border">
          <option value="ALL">All qualification</option>
          <option value="PENDING">Pending</option>
          <option value="READY">Ready</option>
          <option value="FAILED">Failed</option>
        </select>

        <select
          value={filters.manual}
          onChange={(e) => onChange({ manual: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-border rounded bg-surface-raised font-mono focus:outline-none focus:border-border">
          <option value="">All reviews</option>
          <option value="UNREVIEWED">Unreviewed</option>
          <option value="GOOD">Good</option>
          <option value="UNSURE">Unsure</option>
          <option value="BAD">Bad</option>
        </select>

        <select
          value={filters.generationStatus}
          onChange={(e) => onChange({ generationStatus: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-border rounded bg-surface-raised font-mono focus:outline-none focus:border-border">
          <option value="">All generation</option>
          <option value="NOT_SELECTED">Not selected</option>
          <option value="SELECTED">Selected</option>
          <option value="GENERATING">Generating</option>
          <option value="GENERATED">Generated</option>
          <option value="FAILED">Failed</option>
        </select>

        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-border rounded bg-surface-raised font-mono ml-auto focus:outline-none focus:border-border">
          {sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[11px] font-mono text-danger hover:underline">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
