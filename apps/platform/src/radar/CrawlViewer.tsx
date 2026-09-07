import { useEffect, useState } from 'react';
import { api } from '../cms/api';

interface CrawlRun {
  id: string;
  stage?: string;
  crawlJsonPath?: string;
  homepage?: any;
  createdAt?: string;
}

export function CrawlViewer({ run, onClose }: { run: CrawlRun; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getCrawlArtifact(run.id)
      .then((d) => { if (mounted) { setData(d); setError(null); } })
      .catch((e) => { if (mounted) { setError(e?.message || 'Failed to load crawl'); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [run.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/40" onClick={onClose}>
      <div className="w-[900px] max-w-[95vw] max-h-[90vh] bg-surface rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="font-semibold text-text">Crawl artifact</h3>
            <p className="text-[10px] font-mono text-text-subtle">run {run.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRaw((v) => !v)}
              className={`text-[11px] font-mono px-2 py-1 rounded border ${raw ? 'bg-surface-inverse text-text-inverse' : 'hover:bg-surface-raised'}`}
            >
              {raw ? 'Parsed' : 'Raw JSON'}
            </button>
            <button onClick={onClose} className="text-text-subtle hover:text-text text-lg">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && <div className="text-[12px] font-mono text-text-subtle">Loading crawl.json…</div>}
          {error && <div className="p-3 bg-danger-subtle border border-danger-subtle rounded text-[12px] font-mono text-danger">{error}</div>}
          {!loading && !error && data && (
            raw ? (
              <pre className="text-[11px] font-mono text-text whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>
            ) : (
              <div className="space-y-4">
                <section className="p-3 bg-surface-raised border border-border rounded">
                  <div className="text-[10px] font-mono text-text-subtle uppercase mb-2">Homepage candidate</div>
                  <div className="text-[12px] font-mono text-text">
                    <div><span className="text-text-muted">URL:</span> {data.homepage?.url ?? '—'}</div>
                    <div><span className="text-text-muted">Confidence:</span> {data.homepage?.confidence ?? '—'}</div>
                    <div><span className="text-text-muted">Reason:</span> {data.homepage?.reason ?? '—'}</div>
                  </div>
                </section>

                <section className="p-3 bg-surface-raised border border-border rounded">
                  <div className="text-[10px] font-mono text-text-subtle uppercase mb-2">Pages crawled ({data.pages?.length ?? 0})</div>
                  <ul className="space-y-1">
                    {(data.pages || []).slice(0, 100).map((p: any, i: number) => (
                      <li key={i} className="text-[11px] font-mono text-text truncate">
                        <span className="text-text-subtle mr-2">{i + 1}.</span>
                        {p.title ? <span className="font-medium">{p.title}</span> : <span className="text-text-subtle">Untitled</span>}
                        <span className="text-text-subtle mx-2">—</span>
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{p.url}</a>
                      </li>
                    ))}
                    {(data.pages || []).length > 100 && (
                      <li className="text-[11px] font-mono text-text-subtle">…and {data.pages.length - 100} more</li>
                    )}
                  </ul>
                </section>

                {data.warnings?.length > 0 && (
                  <section className="p-3 bg-warning-subtle border border-warning-subtle rounded">
                    <div className="text-[10px] font-mono text-warning uppercase mb-2">Warnings ({data.warnings.length})</div>
                    <ul className="list-disc ml-4 space-y-1">
                      {data.warnings.map((w: string, i: number) => (
                        <li key={i} className="text-[11px] font-mono text-warning">{w}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {data.skipped?.length > 0 && (
                  <section className="p-3 bg-surface-raised border border-border rounded">
                    <div className="text-[10px] font-mono text-text-subtle uppercase mb-2">Skipped ({data.skipped.length})</div>
                    <ul className="list-disc ml-4 space-y-1">
                      {data.skipped.slice(0, 50).map((s: any, i: number) => (
                        <li key={i} className="text-[11px] font-mono text-text truncate">{s.url} <span className="text-text-subtle">({s.reason})</span></li>
                      ))}
                      {data.skipped.length > 50 && (
                        <li className="text-[11px] font-mono text-text-subtle">…and {data.skipped.length - 50} more</li>
                      )}
                    </ul>
                  </section>
                )}

                <section className="p-3 bg-surface-raised border border-border rounded">
                  <div className="text-[10px] font-mono text-text-subtle uppercase mb-2">Meta</div>
                  <pre className="text-[11px] font-mono text-text whitespace-pre-wrap">{JSON.stringify(data.meta, null, 2)}</pre>
                </section>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
