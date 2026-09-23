// V3.6 deliverable generator: media suitability + source→graph→CMS→render comparison.
import { writeFile, readFile } from 'node:fs/promises';

const G = 'http://localhost:3000', SITE = 'cmuazd8v900011kiu4bp2hsnf', TOKEN = 'muazd8vjzv4j';
const login = await fetch(`${G}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: G }, body: JSON.stringify({ email: 'admin@minsk.local', password: 'admin123' }) });
const cookies = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const cms = await fetch(`${G}/api/cms/sites/${SITE}`, { headers: { Cookie: cookies } }).then((r) => r.json());

const dir = 'data/redesign/v36/pipeline-dry-run';
const graph = JSON.parse(await readFile(`${dir}/source-content-graph.json`, 'utf8'));
const docs = JSON.parse(await readFile(`${dir}/source-documents.json`, 'utf8'));
const prov = JSON.parse(await readFile(`${dir}/graph-import-provenance.json`, 'utf8'));
const content = JSON.parse(await readFile(`${dir}/content.json`, 'utf8'));

// ---------- media suitability ----------
const cmsMediaBySource = new Map(cms.media.filter((m) => m.sourceUrl).map((m) => [m.sourceUrl, m]));
const decisions = new Map(prov.media.map((d) => [d.src, d]));
const mediaReport = {
  at: new Date().toISOString(),
  site: SITE,
  totals: { graphMedia: graph.media.length, scored: prov.media.length, cmsMedia: cms.media.length, suitable: prov.media.filter((m) => m.suitable).length, rejected: prov.media.filter((m) => !m.suitable).length },
  items: graph.media.map((m) => ({
    src: m.src, role: m.role, width: m.width, height: m.height, alt: m.alt,
    sourceDocument: m.provenance?.sourceDocumentIds?.[0],
    decision: decisions.get(m.src) || null,
    cmsMediaId: cmsMediaBySource.get(m.src)?.id || null,
  })),
  rejectedRoles: prov.media.filter((m) => !m.suitable).map((m) => ({ src: m.src, role: m.role, reasons: m.reasons })),
};
await writeFile('data/redesign/v36/media-suitability-report.json', JSON.stringify(mediaReport, null, 2));

// ---------- source → graph → CMS → render comparison ----------
const cmsServiceBySource = new Map(cms.services.map((s) => [s.sourceUrl, s]));
const cmsProjectBySource = new Map(cms.projects.map((p) => [p.sourceUrl, p]));
const cmsPageBySource = new Map(cms.pages.map((p) => [p.sourceUrl, p]));
const classByDoc = new Map(graph.pages.map((p) => [p.sourceDocumentId, p.classification]));
const docById = new Map(docs.map((d) => [d.id, d]));

const mapEntity = (e, cmsRow) => {
  const doc = docById.get(e.sourceDocumentIds?.[0]);
  return {
    sourceUrl: doc?.url,
    classification: classByDoc.get(doc?.id)?.type,
    extracted: { title: e.title, hasDescription: !!e.description, imageIds: (e.imageIds || []).length, status: e.status, confidence: e.confidence },
    cms: cmsRow ? { id: cmsRow.id, slug: cmsRow.slug, title: cmsRow.title, manualModified: !!cmsRow.manualModifiedAt } : null,
    showcaseTarget: cmsRow ? `/showcase/${TOKEN}/${(docById.get(e.sourceDocumentIds[0])?.path || '').split('/').pop()}` : null,
  };
};
const comparison = {
  at: new Date().toISOString(),
  site: SITE, variant: 'cmuazd8vl00031kiuhyxlhbxt', token: TOKEN,
  services: graph.services.map((e) => mapEntity(e, cmsServiceBySource.get(docById.get(e.sourceDocumentIds?.[0])?.url))),
  projects: graph.projects.map((e) => mapEntity(e, cmsProjectBySource.get(docById.get(e.sourceDocumentIds?.[0])?.url))),
  droppedEntities: prov.droppedEntities,
  pages: docs.map((d) => ({
    sourceUrl: d.url,
    classification: classByDoc.get(d.id)?.type,
    cms: (() => { const r = cmsPageBySource.get(d.url); return r ? { id: r.id, slug: r.slug, isHomepage: r.isHomepage } : null; })(),
  })),
};
await writeFile('data/redesign/v36/source-graph-cms-render-comparison.json', JSON.stringify(comparison, null, 2));
console.log('media:', JSON.stringify(mediaReport.totals));
console.log('services mapped:', comparison.services.filter((s) => s.cms).length, '/', comparison.services.length);
console.log('projects mapped:', comparison.projects.filter((p) => p.cms).length, '/', comparison.projects.length);
console.log('pages mapped:', comparison.pages.filter((p) => p.cms).length, '/', comparison.pages.length);
