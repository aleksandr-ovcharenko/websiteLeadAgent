import { useEffect, useState } from "react";

interface Lead {
  id: string;
  companyName: string;
  website: string | null;
  websiteDomain: string | null;
  leadScore: number | null;
  leadScoreV2: number | null;
  manualReviewStatus: string;
  city: string;
  site?: { previewToken: string } | null;
}

export default function RadarView({ onForge }: { onForge: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads?limit=100", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function generate(lead: Lead) {
    if (!lead.website || lead.manualReviewStatus !== "GOOD") return;
    setRunning((s) => new Set(s).add(lead.id));
    try {
      const r = await fetch(`/api/leads/${lead.id}/generate`, {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        const j = await r.json();
        setMessage(`Factory started for ${lead.companyName}${j.siteId ? ` → site ${j.siteId}` : ""}`);
      } else {
        const j = await r.json().catch(() => ({}));
        setMessage(`Factory error: ${j.error || r.statusText}`);
      }
    } catch (e: any) {
      setMessage(`Factory error: ${e?.message || "network"}`);
    } finally {
      setRunning((s) => {
        const n = new Set(s);
        n.delete(lead.id);
        return n;
      });
    }
  }

  const goodLeads = leads.filter((l) => l.manualReviewStatus === "GOOD" && l.website);

  return (
    <div className="min-h-screen bg-[#F4F4F3] font-sans text-stone-900">
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
          <button onClick={onForge} className="text-xs text-stone-600 hover:text-stone-900 px-2 py-1">
            → Forge
          </button>
          <span className="text-[10px] font-mono bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 px-2 py-0.5 rounded">
            SUPER_ADMIN
          </span>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto px-6 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Radar</h1>
            <p className="text-sm text-stone-500 mt-0.5">Find and qualify leads</p>
          </div>
          <div className="text-xs text-stone-500">
            {goodLeads.length} of {leads.length} leads ready for Factory
          </div>
        </div>

        {message && (
          <div className="mb-4 bg-green-50 border border-green-100 rounded px-3 py-2 text-xs text-green-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-stone-400">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-sm text-stone-400">
            No leads found. Run the collector first.
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">Website</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">Score</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono font-medium text-stone-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-900">{l.companyName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{l.city}</div>
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 text-xs font-mono truncate max-w-[200px]">
                      {l.websiteDomain || l.website || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {l.leadScoreV2 ?? l.leadScore ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ring-inset font-mono ${
                          l.manualReviewStatus === "GOOD"
                            ? "bg-green-50 text-green-700 ring-green-100"
                            : l.manualReviewStatus === "BAD"
                            ? "bg-red-50 text-red-700 ring-red-100"
                            : "bg-stone-50 text-stone-600 ring-stone-100"
                        }`}
                      >
                        {l.manualReviewStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {l.manualReviewStatus === "GOOD" && l.website ? (
                        l.site ? (
                          <a
                            href={`/showcase/${l.site.previewToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 items-center px-2.5 text-xs bg-stone-800 text-white rounded hover:bg-stone-900 transition-colors font-medium"
                          >
                            Open showcase
                          </a>
                        ) : (
                          <button
                            onClick={() => generate(l)}
                            disabled={running.has(l.id)}
                            className="h-7 px-2.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                          >
                            {running.has(l.id) ? "Factory…" : "Generate"}
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
