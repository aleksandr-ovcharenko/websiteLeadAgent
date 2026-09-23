// V3.7.1 Phase 6 — media suitability report + contact sheet.
// Reads graph-import-provenance.json media decisions and emits:
//   media-suitability-report.json  (per-asset role/score/reason + entity use)
//   media-contact-sheet/index.html (thumbnail grid, filterable)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const PROV = arg('prov', path.join(ROOT, 'data/redesign/v37/nexttrade/graph-import-provenance.json'));
const CONTENT = arg('content', path.join(ROOT, 'data/redesign/v37/nexttrade/import-content.json'));
const DOCS = arg('docs', path.join(ROOT, 'data/redesign/cmtnjmlpp003p99lgysdt7w7h/runs/cmubn42pi00018as62td6dd6s/source-documents.json'));
const OUTDIR = arg('out', path.join(ROOT, 'data/redesign/v371'));

const prov = JSON.parse(await readFile(PROV, 'utf8'));
const content = JSON.parse(await readFile(CONTENT, 'utf8'));
const docsRaw = JSON.parse(await readFile(DOCS, 'utf8'));
const docs = Array.isArray(docsRaw) ? docsRaw : docsRaw.documents || [];
const docById = new Map(docs.map((d) => [d.id, d]));

// Which entity/page uses each media src (hero / cover / gallery / inline).
const usage = new Map(); // src → [{entity, as}]
const mark = (src, entity, as) => {
  if (!src) return;
  const s = typeof src === 'string' ? src : src.src || src.sourceUrl;
  if (!s) return;
  if (!usage.has(s)) usage.set(s, []);
  usage.get(s).push({ entity, as });
};
if (content.hero?.media) mark(content.hero.media.src || content.hero.media, 'homepage-hero', 'hero');
for (const kind of ['services', 'projects', 'news', 'products']) {
  for (const e of content[kind] || []) {
    mark(e.image || e.coverImage, `${kind}:${e.slug}`, 'cover');
    for (const g of e.gallery || []) mark(g, `${kind}:${e.slug}`, 'gallery');
  }
}
for (const p of content.pages || []) {
  for (const b of p.blocks || []) {
    if (b.type === 'gallery') for (const g of b.images || b.items || []) mark(g, `page:${p.slug}`, 'gallery');
    if (b.image) mark(b.image, `page:${p.slug}`, 'inline');
  }
}
for (const m of content.media || []) mark(m.src || m.sourceUrl, 'cms-media', m.usedAs || 'media');

const entries = (prov.media || []).map((m) => {
  const doc = docById.get(m.sourceDocumentId);
  return {
    src: m.src,
    role: m.role || 'UNKNOWN',
    suitable: !!m.suitable,
    suitabilityScore: m.suitabilityScore ?? null,
    reasons: m.reasons || [],
    usedAs: m.usedAs || undefined,
    sourceDocumentId: m.sourceDocumentId,
    sourcePage: doc?.path || m.sourceDocumentId,
    sourceUrl: doc?.url,
    assignedTo: usage.get(m.src) || [],
    width: m.width, height: m.height, alt: m.alt,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    assets: entries.length,
    suitable: entries.filter((e) => e.suitable).length,
    rejected: entries.filter((e) => !e.suitable).length,
    assigned: entries.filter((e) => e.assignedTo.length).length,
  },
  byRole: {},
  rejectionReasons: {},
  heroCandidates: entries.filter((e) => e.usedAs === 'hero' || e.assignedTo.some((a) => a.as === 'hero')),
  entries,
};
for (const e of entries) {
  report.byRole[e.role] = (report.byRole[e.role] || 0) + 1;
  for (const r of e.reasons) report.rejectionReasons[r] = (report.rejectionReasons[r] || 0) + 1;
}

await mkdir(path.join(OUTDIR, 'media-contact-sheet'), { recursive: true });
await writeFile(path.join(OUTDIR, 'media-suitability-report.json'), JSON.stringify(report, null, 2));

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const cards = entries.map((e) => `
<figure class="card ${e.suitable ? 'ok' : 'no'}">
  <div class="thumb"><img src="${esc(e.src)}" loading="lazy" alt="" onerror="this.closest('.thumb').classList.add('broken')"></div>
  <figcaption>
    <code>${esc(e.src.split('/').pop())}</code>
    <div class="meta">${e.width || '?'}×${e.height || '?'} · ${esc(e.role)}${e.usedAs ? ' · <b>' + esc(e.usedAs) + '</b>' : ''}</div>
    <div class="meta">score ${e.suitabilityScore ?? '—'} · ${esc(e.sourcePage)}</div>
    ${e.assignedTo.length ? `<div class="meta use">→ ${esc(e.assignedTo.map((a) => `${a.as}:${a.entity}`).join(', '))}</div>` : ''}
    ${e.reasons.length ? `<div class="meta why">${esc(e.reasons.join('; '))}</div>` : ''}
  </figcaption>
</figure>`).join('\n');

await writeFile(path.join(OUTDIR, 'media-contact-sheet/index.html'), `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Media contact sheet — NextTrade</title>
<style>
body{font:13px/1.4 system-ui;margin:20px;background:#f5f5f5}
h1{font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.card{background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden;margin:0}
.card.no{border-color:#e0a0a0}.card.ok{border-color:#a0d0a0}
.thumb{height:120px;display:flex;align-items:center;justify-content:center;background:#eee}
.thumb img{max-width:100%;max-height:100%;object-fit:contain}
.thumb.broken::after{content:'BROKEN';color:#c00;font-weight:700}
figcaption{padding:8px}.meta{color:#555;margin-top:4px}.why{color:#a33}.use{color:#273}
code{font-size:11px;word-break:break-all}
</style></head><body>
<h1>Media contact sheet — ${report.totals.assets} assets (${report.totals.suitable} suitable / ${report.totals.rejected} rejected)</h1>
<div class="grid">${cards}
</div></body></html>`);

console.log(JSON.stringify({ ...report.totals, byRole: report.byRole }, null, 2));
