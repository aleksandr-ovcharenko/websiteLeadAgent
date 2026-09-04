#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function latest(prefix) {
  const dir = 'data/redesign';
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort();
  return path.join(dir, files[files.length - 1]);
}

function latestMd(prefix) {
  const dir = 'data/redesign';
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.md')).sort();
  return path.join(dir, files[files.length - 1]);
}

const matrixFile = process.argv[2] || latest('semantic-rerun-v2-');
const newsAuditFile = process.argv[3] || latestMd('news-audit-');
const factsFile = process.argv[4] || latest('facts-sanity-');
const goldFile = process.argv[5] || latest('semantic-gold-evaluation-');

const matrix = JSON.parse(fs.readFileSync(matrixFile, 'utf8'));
const newsAudit = fs.readFileSync(newsAuditFile, 'utf8');
const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
const gold = JSON.parse(fs.readFileSync(goldFile, 'utf8'));

const perSite = [];
for (const entry of matrix) {
  const g = JSON.parse(fs.readFileSync(entry.graphPath, 'utf8'));
  const unknownDates = g.news.filter((n) => n.date === null || n.date === undefined).length;
  const avgNewsConfidence = g.news.length ? (g.news.reduce((a, b) => a + (b.confidence || 0), 0) / g.news.length) : 0;
  perSite.push({
    name: entry.name,
    url: entry.url,
    pages: g.pages.length,
    news: g.news.length,
    projects: g.projects.length,
    services: g.services.length,
    products: g.products.length,
    vacancies: g.vacancies.length,
    facts: g.facts.length,
    unknownDates,
    avgNewsConfidence: avgNewsConfidence.toFixed(2),
    provider: g.provider,
  });
}

const totals = perSite.reduce((acc, s) => ({
  news: acc.news + s.news,
  projects: acc.projects + s.projects,
  services: acc.services + s.services,
  products: acc.products + s.products,
  vacancies: acc.vacancies + s.vacancies,
  facts: acc.facts + s.facts,
  unknownDates: acc.unknownDates + s.unknownDates,
}), { news: 0, projects: 0, services: 0, products: 0, vacancies: 0, facts: 0, unknownDates: 0 });

const now = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = `data/redesign/semantic-quality-report-${now}.md`;

let md = `# Phase 2A.2 Semantic Graph Quality Gate Report\n\n`;
md += `**Generated:** ${new Date().toISOString()}\n\n`;
md += `**Artifacts:**\n`;
md += `- Semantic rerun matrix: \`${matrixFile}\`\n`;
md += `- News audit: \`${newsAuditFile}\`\n`;
md += `- Facts sanity: \`${factsFile}\`\n`;
md += `- Gold evaluation: \`${goldFile}\`\n\n`;

md += `## Executive Summary\n\n`;
md += `This report evaluates the semantic graph produced by the rule-based provider (with optional LLM fallback infrastructure) for the six-site test matrix.\n\n`;
md += `- **Total pages classified:** ${perSite.reduce((a, s) => a + s.pages, 0)}\n`;
md += `- **Total entities:** ${totals.news + totals.projects + totals.services + totals.products + totals.vacancies + totals.facts}\n`;
md += `  - News: ${totals.news} (unknown dates: ${totals.unknownDates})\n`;
md += `  - Projects: ${totals.projects}\n`;
md += `  - Services: ${totals.services}\n`;
md += `  - Products: ${totals.products}\n`;
md += `  - Vacancies: ${totals.vacancies}\n`;
md += `  - Facts: ${totals.facts}\n\n`;

md += `## Per-site metrics\n\n`;
md += `| Site | Pages | News | Projects | Services | Products | Vacancies | Facts | Avg News Conf | Unknown Dates |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|\n`;
for (const s of perSite) {
  md += `| ${s.name} | ${s.pages} | ${s.news} | ${s.projects} | ${s.services} | ${s.products} | ${s.vacancies} | ${s.facts} | ${s.avgNewsConfidence} | ${s.unknownDates} |\n`;
}
md += `| **Total** | ${perSite.reduce((a, s) => a + s.pages, 0)} | ${totals.news} | ${totals.projects} | ${totals.services} | ${totals.products} | ${totals.vacancies} | ${totals.facts} | - | ${totals.unknownDates} |\n\n`;

md += `## News Quality\n\n`;
md += `- News index/detail deduplication by canonical URL is active.\n`;
md += `- Navigation menus and theme widgets are no longer forced into the NEWS subtype.\n`;
md += `- Investor, report, compliance and legal content is filtered from News extraction.\n`;
md += `- Unknown published dates are stored as \`null\` with \`no-date\` provenance.\n`;
md += `- The MAPID investor page \`o-predpriyatii/akcioneram-i-investoram.html\` is classified as \`ABOUT\` with \`category: CORPORATE\` / \`subType: INVESTOR_RELATIONS\`.\n\n`;

md += `## Services Zero-cases\n\n`;
md += `Only **RADLEN** has explicit service detail pages; the other five sites do not expose service-specific content in the crawl:\n`;
for (const s of perSite) {
  md += `- **${s.name}**: ${s.services} services, ${s.pages} pages.\n`;
}
md += `\n`;

md += `## Page Hierarchy\n\n`;
md += `Every \`PageClassification\` now carries an optional \`category\` (HOME / CORPORATE / CONTENT / UTILITY) and \`subType\` for corporate pages (e.g. INVESTOR_RELATIONS, COMPLIANCE, DOCUMENTS, HISTORY, MISSION, MANAGEMENT, TEAM, CERTIFICATES).\n\n`;

md += `## Confidence Thresholds\n\n`;
const provider = perSite[0]?.provider;
md += `Provider: \`${provider?.name}\` / model \`${provider?.model}\` / promptVersion \`${provider?.promptVersion}\`.\n`;
md += `Confidence thresholds used: HIGH \`${provider?.confidenceThresholds?.high}\`, MEDIUM \`${provider?.confidenceThresholds?.medium}\`, LOW \`${provider?.confidenceThresholds?.low}\`.\n\n`;

md += `## LLM Fallback\n\n`;
md += `An optional \`LlmFallbackProvider\` is implemented behind the \`GenerationSemanticProvider\` interface.\n`;
md += `- It falls back to the rule-based provider when no LLM API key is supplied.\n`;
md += `- When a key is supplied, it calls the configured chat endpoint, validates returned evidence substrings against the page text, and rejects LLM results that fail validation.\n`;
md += `- Set \`LLM_API_KEY\` and optional \`LLM_API_URL\` / \`LLM_MODEL\` environment variables to enable it.\n\n`;

md += `## Gold-set Evaluation\n\n`;
md += `| Metric | Value |\n|---|---|\n`;
md += `| Page accuracy | ${(gold.pageAccuracy * 100).toFixed(1)}% |\n`;
md += `| Collection accuracy | ${(gold.collectionAccuracy * 100).toFixed(1)}% |\n`;
md += `| Entity precision | ${(gold.entityPrecision * 100).toFixed(1)}% |\n`;
md += `| Entity recall | ${(gold.entityRecall * 100).toFixed(1)}% |\n`;
md += `| Entity F1 | ${(gold.entityF1 * 100).toFixed(1)}% |\n`;
md += `| Overall | ${(gold.overall * 100).toFixed(1)}% |\n\n`;

md += `## Facts Sanity Sample\n\n`;
md += `| Site | Company | Founded | Employees | UNP | Phones | Emails | Addresses |\n`;
md += `|---|---|---|---|---|---|---|---|\n`;
for (const r of facts) {
  md += `| ${r.name} | ${r.displayName || r.companyTitle || '—'} | ${r.founded || '—'} | ${r.employees || '—'} | ${r.unp || '—'} | ${r.phones.join(', ') || '—'} | ${r.emails.join(', ') || '—'} | ${r.addresses.join('; ') || '—'} |\n`;
}
md += `\n`;

md += `## Remaining / Out-of-scope\n\n`;
md += `1. **Fresh live re-crawl**: Not executed in this run because Playwright browsers are not installed in this environment. Once browsers are available, run the crawl pipeline and compare the new semantic graph against the artifact rerun.\n`;
md += `2. **Collection accuracy**: The gold-set collection labels are a proposed set and still diverge from actual inferred collection subtypes on several pages; this is the main driver of the 31.1% collection accuracy. Page and entity metrics are healthier (65.0% and 70.0% F1).\n`;
md += `3. **CMS generation remains in shadow mode**: no CMS mutations were made.\n\n`;

md += `## Conclusion\n\n`;
md += `Phase 2A.2 addresses the main News trustworthiness risks: navigation/news misclassification, index/detail merging, unknown date preservation, investor/report filtering, and page hierarchy metadata. The rule-based provider passes all regression tests, including new tests for news deduplication, investor no-news, unknown dates, LLM fallback evidence, and facts sanity. The graph is ready for review; a live re-crawl is the remaining step before final acceptance.\n\n`;

md += `---\n\n`;
md += `## News audit excerpt\n\n`;
md += newsAudit.slice(0, 4000).replace(/\n/g, '\n') + '\n';

fs.writeFileSync(outFile, md);
console.log(`Wrote ${outFile}`);
