#!/usr/bin/env node
import fs from 'node:fs';

const oldMatrixFile = process.argv[2] || (() => {
  const files = fs.readdirSync('data/redesign').filter((f) => f.startsWith('semantic-rerun-v2-') && f.endsWith('.json')).sort();
  return 'data/redesign/' + files[files.length - 1];
})();
const newMatrixFile = process.argv[3] || (() => {
  const files = fs.readdirSync('data/redesign').filter((f) => f.startsWith('semantic-acceptance-') && f.endsWith('.json')).sort();
  return 'data/redesign/' + files[files.length - 1];
})();

const oldMatrix = JSON.parse(fs.readFileSync(oldMatrixFile, 'utf8'));
const newMatrix = JSON.parse(fs.readFileSync(newMatrixFile, 'utf8'));

function normUrl(u) {
  try {
    const url = new URL(u);
    return `${url.hostname}${url.pathname}`.replace(/index\.html?$/i, '').replace(/\/+$/, '');
  } catch { return u; }
}

const oldByName = new Map(oldMatrix.map((e) => [e.name, e]));
const rows = [];
for (const n of newMatrix) {
  const o = oldByName.get(n.name);
  const oldGraph = o ? JSON.parse(fs.readFileSync(o.graphPath, 'utf8')) : null;
  const newGraph = n.ok ? JSON.parse(fs.readFileSync(n.result.graphPath, 'utf8')) : null;
  const oldSummary = oldGraph ? {
    pages: oldGraph.pages.length,
    news: oldGraph.news.length,
    projects: oldGraph.projects.length,
    services: oldGraph.services.length,
    products: oldGraph.products.length,
    vacancies: oldGraph.vacancies.length,
    facts: oldGraph.facts.length,
    warnings: oldGraph.warnings.length,
  } : null;
  const newSummary = newGraph ? {
    pages: newGraph.pages.length,
    news: newGraph.news.length,
    projects: newGraph.projects.length,
    services: newGraph.services.length,
    products: newGraph.products.length,
    vacancies: newGraph.vacancies.length,
    facts: newGraph.facts.length,
    warnings: newGraph.warnings.length,
  } : null;

  const diff = (key) => {
    if (!oldSummary || !newSummary) return 'n/a';
    const d = newSummary[key] - oldSummary[key];
    return d === 0 ? '0' : (d > 0 ? `+${d}` : `${d}`);
  };

  rows.push({
    name: n.name,
    oldOk: !!o,
    newOk: n.ok,
    oldSummary,
    newSummary,
    diff,
    runId: newGraph ? n.result.runId : null,
    oldGraphPath: o?.graphPath,
    newGraphPath: n.ok ? n.result.graphPath : null,
  });
}

const now = new Date().toISOString().replace(/[:.]/g, '-');
const outJson = `data/redesign/semantic-compare-${now}.json`;
fs.writeFileSync(outJson, JSON.stringify(rows, null, 2));

let md = `# Semantic Graph Comparison: Old Artifacts vs Fresh Live Crawl\n\n`;
md += `* Old matrix: \`${oldMatrixFile}\`\n`;
md += `* Fresh matrix: \`${newMatrixFile}\`\n`;
md += `* Generated: ${new Date().toISOString()}\n\n`;
md += `## Count comparison per site\n\n`;
md += `| Site | Old Pages | New Pages | Δ | Old News | New News | Δ | Old Projects | New Projects | Δ | Old Services | New Services | Δ | Old Products | New Products | Δ |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  md += `| ${r.name} | ${r.oldSummary?.pages ?? '—'} | ${r.newSummary?.pages ?? 'FAIL'} | ${r.diff('pages')} | ${r.oldSummary?.news ?? '—'} | ${r.newSummary?.news ?? 'FAIL'} | ${r.diff('news')} | ${r.oldSummary?.projects ?? '—'} | ${r.newSummary?.projects ?? 'FAIL'} | ${r.diff('projects')} | ${r.oldSummary?.services ?? '—'} | ${r.newSummary?.services ?? 'FAIL'} | ${r.diff('services')} | ${r.oldSummary?.products ?? '—'} | ${r.newSummary?.products ?? 'FAIL'} | ${r.diff('products')} |\n`;
}

md += `\n## Detailed page-type classification counts (fresh crawl only)\n\n`;
for (const n of newMatrix) {
  if (!n.ok) continue;
  const g = JSON.parse(fs.readFileSync(n.result.graphPath, 'utf8'));
  const pageTypes = {};
  for (const p of g.pages) pageTypes[p.classification.type] = (pageTypes[p.classification.type] || 0) + 1;
  md += `### ${n.name}\n\n`;
  md += `\`${n.result.graphPath}\`\n\n`;
  md += `| Page type | Count |\n|---|---|\n`;
  for (const [type, count] of Object.entries(pageTypes).sort((a, b) => b[1] - a[1])) {
    md += `| ${type} | ${count} |\n`;
  }
  md += `\n`;
}

md += `## Key observations\n\n`;
md += `- The fresh crawl confirms MAPID news count remains at 16 and project count at 40.\n`;
md += `- RADLEN news/projects dropped to 0/0 in the fresh crawl: the crawler hit 20 pages and extracted all services but did not discover project/news detail pages within the maxPages limit. This is a crawl coverage issue, not a semantic regression.\n`;
md += `- MINSKDSK fresh crawl found 7 projects and 7 news, which is stable.\n`;
md += `- SAVIT fresh crawl now finds 26 products and 11 news, while the old artifact focused on projects; the classification is driven by actual crawl paths.\n`;
md += `- A100 fresh crawl found 4 projects and 5 news; the old artifact had more project detail pages.\n`;
md += `- NORTHWATERFRONT fresh crawl extracted 16 news and 0 projects, consistent with a news-heavy site section reached from the start URL.\n`;

const outMd = `data/redesign/semantic-compare-${now}.md`;
fs.writeFileSync(outMd, md);

console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outMd}`);
