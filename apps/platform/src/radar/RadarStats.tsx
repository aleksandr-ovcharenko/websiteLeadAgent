export interface RadarStatsData {
  total: number;
  withWebsite: number;
  withoutWebsite: number;
  enriched: number;
  audited: number;
  lighthoused: number;
  aiAnalyzed: number;
  scored: number;
  readyForReview: number;
  qualificationPending: number;
  qualificationFailed: number;
  good: number;
  selected: number;
  generated: number;
  readyForGeneration: number;
  failed: number;
}

interface RadarStatsProps {
  stats: Partial<RadarStatsData> | null;
  runs: any[];
  discoveryRunId: string;
  onRunChange: (id: string) => void;
  onQualify?: () => void;
  qualifying?: boolean;
}

// Presentational only — data ownership lives in the parent (single stats/run
// state, updated by activity events, explicit refresh, or a run-scoped
// watcher). This component issues zero requests of its own.
export default function RadarStats({ stats, runs, discoveryRunId, onRunChange, onQualify, qualifying }: RadarStatsProps) {
  const cards: { label: string; value: keyof RadarStatsData; positive?: boolean; warn?: boolean }[] = [
    { label: 'Total', value: 'total' },
    { label: 'With website', value: 'withWebsite' },
    { label: 'Ready for review', value: 'readyForReview', positive: true },
    { label: 'Ready for generation', value: 'readyForGeneration', positive: true },
    { label: 'Pending', value: 'qualificationPending' },
    { label: 'Failed', value: 'qualificationFailed', warn: true },
    { label: 'GOOD', value: 'good', positive: true },
    { label: 'Selected', value: 'selected', positive: true },
    { label: 'Generated', value: 'generated', positive: true },
  ];

  return (
    <div className="bg-surface border border-border rounded-md p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <label className="text-[11px] font-mono text-text">Discovery</label>
        <select
          value={discoveryRunId}
          onChange={(e) => onRunChange(e.target.value)}
          className="h-[30px] px-2 text-[12px] border border-border rounded bg-surface-raised font-mono"
        >
          <option value="">All discoveries</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {new Date(r.createdAt).toLocaleDateString('ru-RU')} — {r.query} — {r.provider} ({r.createdCount})
            </option>
          ))}
        </select>
        {discoveryRunId && onQualify && (
          <button
            onClick={onQualify}
            disabled={qualifying}
            className="h-[30px] px-3 text-[12px] font-mono text-text-inverse bg-accent rounded hover:bg-accent-hover disabled:opacity-50"
          >
            {qualifying ? 'Qualifying…' : 'Qualify eligible'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-10 gap-2 min-h-[60px]">
        {cards.map(({ label, value, positive, warn }) => (
          <div key={label} className="bg-surface-raised border border-border rounded p-2 text-center">
            <div className={`text-[16px] font-mono font-semibold tabular-nums ${positive ? 'text-accent' : warn ? 'text-danger' : 'text-text'}`}>
              {stats && value in (stats as any) ? (stats as any)[value] : '—'}
            </div>
            <div className="text-[9px] font-mono text-text-subtle uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {stats && (
        <div data-testid="stats-timestamp" className="sr-only" aria-live="polite">Stats updated</div>
      )}
    </div>
  );
}
