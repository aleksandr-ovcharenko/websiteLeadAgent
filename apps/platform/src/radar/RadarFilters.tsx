import { Button } from '../cms/ui';

export interface Filters {
  q: string;
  sort: string;
  websiteStatus: string;
  auditStatus: string;
  manual: string;
}

const sorts = [
  { key: 'v2_desc', label: 'Lead score ↓' },
  { key: 'visual_desc', label: 'Visual ↓' },
  { key: 'tech_desc', label: 'Technical ↓' },
  { key: 'biz_desc', label: 'Business ↓' },
  { key: 'web_desc', label: 'Website ↓' },
  { key: 'discovered', label: 'Newest' },
];

export default function RadarFilters({ filters, onChange, quick, onQuick }: { filters: Filters; onChange: (f: Partial<Filters>) => void; quick: string; onQuick: (q: string) => void }) {
  const quicks = [
    { key: 'all', label: 'All eligible' },
    { key: 'qualification_pending', label: 'Qualification pending' },
    { key: 'ready_for_review', label: 'Ready for review' },
    { key: 'good', label: 'GOOD' },
    { key: 'unsure', label: 'UNSURE' },
    { key: 'bad', label: 'BAD' },
    { key: 'needs_audit', label: 'Needs audit' },
    { key: 'needs_ai', label: 'Needs AI' },
    { key: 'failed', label: 'Failed' },
    { key: 'no_website', label: 'No website' },
    { key: 'selected', label: 'Selected' },
    { key: 'generated', label: 'Generated' },
  ];

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2">
        {quicks.map((q) => (
          <Button key={q.key} size="sm" variant={quick === q.key ? 'secondary' : 'ghost'} onClick={() => onQuick(q.key)}>
            {q.label}
          </Button>
        ))}
      </div>
      <div className="bg-white border border-[#e5e3df] rounded-md px-4 py-2.5 flex items-center gap-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#c0bdb8]" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search leads…"
            className="h-[30px] pl-7 pr-3 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] font-mono w-44"
          />
        </div>
        <select value={filters.websiteStatus} onChange={(e) => onChange({ websiteStatus: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] font-mono">
          <option value="">All website statuses</option>
          <option value="FOUND">Has website</option>
          <option value="NOT_FOUND">No website</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
        <select value={filters.auditStatus} onChange={(e) => onChange({ auditStatus: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] font-mono">
          <option value="">All audit statuses</option>
          <option value="SUCCESS">Audited</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={filters.manual} onChange={(e) => onChange({ manual: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] font-mono">
          <option value="">All reviews</option>
          <option value="GOOD">GOOD</option>
          <option value="UNSURE">Unsure</option>
          <option value="BAD">Bad</option>
          <option value="UNREVIEWED">Unreviewed</option>
        </select>
        <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })}
          className="h-[30px] px-2 text-[12px] border border-[#e5e3df] rounded bg-[#fafaf9] font-mono ml-auto">
          {sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}
