import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const dataDir = new URL('../data/redesign', import.meta.url).pathname;

async function latestRerun() {
  const files = await readdir(dataDir);
  const rerun = files
    .filter((f) => f.startsWith('semantic-rerun-v2-') && f.endsWith('.json'))
    .sort()
    .pop();
  if (!rerun) throw new Error('No semantic-rerun-v2 file found in ' + dataDir);
  return join(dataDir, rerun);
}

function escapeMd(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .trim();
}

function short(text, len = 120) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

function formatDate(d) {
  if (d === null || d === undefined || d === '') return '—';
  return String(d);
}

async function main() {
  const rerunPath = await latestRerun();
  const matrix = JSON.parse(await readFile(rerunPath, 'utf8'));

  const rows = [];
  for (const site of matrix) {
    const graph = JSON.parse(await readFile(site.graphPath, 'utf8'));
    const docById = new Map(graph.pages.map((p) => [p.sourceDocumentId, p]));

    for (const n of graph.news || []) {
      const sourceDocIds = n.sourceDocumentIds || [];
      const sourceCollIds = n.sourceCollectionIds || [];
      const sourceSecIds = n.sourceSectionIds || [];

      const pageLabels = [];
      const collectionLabels = [];
      const sectionLabels = [];

      for (const docId of sourceDocIds) {
        const page = docById.get(docId);
        if (!page) continue;
        pageLabels.push(`${page.classification.type}(${page.classification.confidence.toFixed(2)})`);

        for (const c of page.collections || []) {
          if (sourceCollIds.includes(c.collectionId)) {
            collectionLabels.push(`${c.contentSubtype || c.type}(${c.confidence.toFixed(2)}):${short(c.reason, 40)}`);
          }
        }
        for (const s of page.sections || []) {
          if (sourceSecIds.includes(s.sectionId)) {
            sectionLabels.push(`${s.type}(${s.confidence.toFixed(2)})`);
          }
        }
      }

      const canonicalUrl = n.evidence?.[0]?.sourceUrl || n.evidence?.[0]?.value || '';
      const mergedFrom = (n.sourceDocumentIds?.length || 0) + (n.sourceCollectionIds?.length || 0) + (n.sourceSectionIds?.length || 0);

      rows.push({
        site: site.name,
        title: n.title,
        description: n.description,
        url: canonicalUrl,
        sourcePage: pageLabels.join('; ') || '—',
        sourceColl: collectionLabels.join('; ') || '—',
        sourceSec: sectionLabels.join('; ') || '—',
        date: formatDate(n.date),
        confidence: n.confidence,
        status: n.status,
        mergedFrom,
      });
    }
  }

  const md = [
    '# News Audit — Phase 2A.2',
    `Generated from: ${basename(rerunPath)}`,
    `Total News entities: ${rows.length}`,
    '',
    '| Site | Title | URL | SourcePage | SourceCollection | SourceSection | Date | Conf | Status | Merged |',
    '|------|-------|-----|------------|------------------|---------------|------|------|--------|--------|',
  ];

  for (const r of rows) {
    md.push(`| ${escapeMd(r.site)} | ${escapeMd(short(r.title, 80))} | ${escapeMd(r.url)} | ${escapeMd(r.sourcePage)} | ${escapeMd(r.sourceColl)} | ${escapeMd(r.sourceSec)} | ${escapeMd(r.date)} | ${r.confidence.toFixed(3)} | ${r.status} | ${r.mergedFrom} |`);
  }

  md.push('', '# Full descriptions');
  for (const r of rows) {
    md.push(`## ${escapeMd(r.site)} — ${escapeMd(short(r.title, 60))}`);
    md.push(`- **URL:** ${escapeMd(r.url)}`);
    md.push(`- **Date:** ${escapeMd(r.date)}  **Confidence:** ${r.confidence.toFixed(3)}  **Status:** ${r.status}`);
    md.push(`- **SourcePage:** ${escapeMd(r.sourcePage)}`);
    md.push(`- **SourceCollection:** ${escapeMd(r.sourceColl)}`);
    md.push(`- **SourceSection:** ${escapeMd(r.sourceSec)}`);
    md.push(`- **Description:** ${escapeMd(r.description)}`);
    md.push('');
  }

  const outPath = join(dataDir, `news-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  await writeFile(outPath, md.join('\n'), 'utf8');
  console.log(`Wrote ${rows.length} news audit rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
