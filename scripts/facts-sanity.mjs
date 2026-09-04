#!/usr/bin/env node
import fs from 'node:fs';

const matrixFile = process.argv[2] || process.env.MATRIX || ('data/redesign/' + fs.readdirSync('data/redesign').filter((f) => f.startsWith('semantic-rerun-v2-') && f.endsWith('.json')).sort().pop());
const matrix = JSON.parse(fs.readFileSync(matrixFile, 'utf8'));

const rows = [];
for (const entry of matrix) {
  const graph = JSON.parse(fs.readFileSync(entry.graphPath, 'utf8'));
  const facts = graph.facts || [];
  const company = graph.company;
  const contacts = graph.contacts;
  const row = {
    name: entry.name,
    url: entry.url,
    companyTitle: company?.title || null,
    displayName: company?.displayName || null,
    shortName: company?.shortName || null,
    legalName: company?.legalName || null,
    founded: facts.find((f) => f.type === 'FOUNDING_DATE')?.value || null,
    employees: facts.find((f) => f.type === 'EMPLOYEE_COUNT')?.value || null,
    unp: facts.find((f) => f.type === 'UNP')?.value || null,
    phones: (contacts?.phones || []).map((p) => p.value).slice(0, 3),
    emails: (contacts?.emails || []).map((e) => e.value).slice(0, 3),
    addresses: (contacts?.addresses || []).map((a) => a.value).slice(0, 3),
  };
  rows.push(row);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outJson = `data/redesign/facts-sanity-${timestamp}.json`;
fs.writeFileSync(outJson, JSON.stringify(rows, null, 2));

let md = '# Facts Extraction Sanity Sample\n\n';
md += `* Matrix: ${matrixFile}\n`;
md += `* Generated: ${new Date().toISOString()}\n\n`;
md += '| Site | Company | Founded | Employees | UNP | Phones | Emails | Addresses |\n';
md += '|---|---|---|---|---|---|---|---|\n';
for (const r of rows) {
  md += `| ${r.name} | ${r.displayName || r.companyTitle || '—'} | ${r.founded || '—'} | ${r.employees || '—'} | ${r.unp || '—'} | ${r.phones.join(', ') || '—'} | ${r.emails.join(', ') || '—'} | ${r.addresses.join('; ') || '—'} |\n`;
}

md += '\n## Detailed per-site facts\n\n';
for (const r of rows) {
  md += `### ${r.name} (${r.url})\n\n`;
  md += `- **Company title:** ${r.companyTitle || '—'}\n`;
  md += `- **Display name:** ${r.displayName || '—'}\n`;
  md += `- **Short name:** ${r.shortName || '—'}\n`;
  md += `- **Legal name:** ${r.legalName || '—'}\n`;
  md += `- **Founded:** ${r.founded || '—'}\n`;
  md += `- **Employees:** ${r.employees || '—'}\n`;
  md += `- **UNP:** ${r.unp || '—'}\n`;
  md += `- **Phones:** ${r.phones.join(', ') || '—'}\n`;
  md += `- **Emails:** ${r.emails.join(', ') || '—'}\n`;
  md += `- **Addresses:** ${r.addresses.join('; ') || '—'}\n\n`;
}

const outMd = `data/redesign/facts-sanity-${timestamp}.md`;
fs.writeFileSync(outMd, md);

console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outMd}`);
