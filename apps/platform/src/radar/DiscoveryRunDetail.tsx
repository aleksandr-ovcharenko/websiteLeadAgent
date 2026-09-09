import { useEffect, useState } from 'react';
import { api } from '../cms/api';

interface CandidateGroupItem {
  id: string;
  companyName: string;
  canonicalUrl: string | null;
  canonicalDomain: string | null;
  reason: string | null;
  leadId?: string | null;
  lead?: { id: string; companyName: string; websiteDomain: string } | null;
}

interface DiscoveryRunDetailData {
  runId: string;
  query: string;
  location?: string;
  intent?: string;
  counts: {
    found: number;
    added: number;
    duplicates: number;
    filtered: number;
    uncertain: number;
  };
  added: CandidateGroupItem[];
  filtered: CandidateGroupItem[];
  duplicates: CandidateGroupItem[];
  uncertain: CandidateGroupItem[];
}

function Section({ title, items, testId }: { title: string; items: CandidateGroupItem[]; testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border" data-testid={testId}>
      <button onClick={() => setOpen(!open)} className="w-full py-2.5 px-3 flex items-center justify-between text-[12px] text-text hover:bg-surface-raised">
        <span className="font-medium">{title} — {items.length}</span>
        <span className="text-text-subtle">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {items.length === 0 && <div className="text-[11px] text-text-subtle">No items</div>}
          {items.map((item) => (
            <div key={item.id} className="py-1.5 border-b border-border last:border-0 text-[11px]">
              <div className="text-text font-medium truncate">{item.companyName}</div>
              <div className="text-text-subtle flex gap-2 flex-wrap">
                <span>{item.canonicalDomain || item.canonicalUrl || '—'}</span>
                {item.reason && <span className="text-warning">{item.reason}</span>}
                {item.leadId && <span className="text-accent">lead {item.leadId.slice(-8)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiscoveryRunDetail({ runId }: { runId: string }) {
  const [data, setData] = useState<DiscoveryRunDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDiscoveryRunCandidates(runId)
      .then((d) => setData(d as DiscoveryRunDetailData))
      .catch((e: any) => setError(e.message || 'Failed to load'));
  }, [runId]);

  if (error) return <div className="p-3 text-[12px] text-danger">{error}</div>;
  if (!data) return <div className="p-3 text-[12px] text-text-subtle">Loading details…</div>;

  return (
    <div className="bg-surface border border-border rounded-md mt-2" data-testid="discovery-run-detail">
      <div className="px-3 py-2 border-b border-border">
        <div className="text-[12px] font-medium text-text">{data.query}{data.location ? ` · ${data.location}` : ''}</div>
        <div className="text-[11px] text-text-subtle">{data.intent || data.query}</div>
        <div className="text-[11px] text-text mt-1" data-testid="discovery-counts">
          {data.counts.found} found · {data.counts.added} added · {data.counts.duplicates} duplicates · {data.counts.filtered} filtered · {data.counts.uncertain} uncertain
        </div>
      </div>
      <Section title="Added to Leads" items={data.added} testId="discovery-added" />
      <Section title="Filtered out" items={data.filtered} testId="discovery-filtered" />
      <Section title="Duplicates" items={data.duplicates} testId="discovery-duplicates" />
      <Section title="Uncertain" items={data.uncertain} testId="discovery-uncertain" />
    </div>
  );
}
