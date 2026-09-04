import { readFile } from 'node:fs/promises';

const [path] = process.argv.slice(2);
const v2 = JSON.parse(await readFile(path, 'utf8'));

console.log('| Site | Pages | Services | Projects | News | Products | Vacancies | UnknownColl | Warnings |');
console.log('|------|-------|----------|----------|------|----------|-----------|-------------|----------|');
for (const r of v2) {
  if (!r.ok) continue;
  const s = r.summary;
  const unk = s.collectionTypes.UNKNOWN || 0;
  console.log(`| ${r.name} | ${s.pages} | ${s.services} | ${s.projects} | ${s.news} | ${s.products} | ${s.vacancies} | ${unk} | ${s.warnings} |`);
}

console.log('\n\nPage type distributions:');
for (const r of v2) {
  if (!r.ok) continue;
  console.log(`--- ${r.name}`);
  console.log(JSON.stringify(r.summary.pageTypes));
  console.log('collection types:', JSON.stringify(r.summary.collectionTypes));
}
