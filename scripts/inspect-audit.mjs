import { readFile } from 'node:fs/promises';

const [path] = process.argv.slice(2);
const audit = JSON.parse(await readFile(path, 'utf8'));

for (const site of ['mapid', 'savit', 'northwaterfront', 'a100', 'radlen', 'minskdsk']) {
  const s = audit.find((x) => x.site === site);
  if (!s || !s.ok) { console.log(`--- ${site} FAILED ---`); continue; }
  console.log(`\n=== ${site} ===`);
  console.log('pages:', JSON.stringify(s.pages.types));
  console.log('services:', s.services.count, 'dupGroups:', s.services.duplicateGroups, 'withDesc:', s.services.details.filter((x) => x.hasDescription).length);
  console.log('projects:', s.projects.count, 'dupGroups:', s.projects.duplicateGroups);
  console.log('news:', s.news.count, 'dupGroups:', s.news.duplicateGroups, 'indexDetailOverlap:', s.news.indexDetailOverlap.length);
  console.log('products:', s.products.count, 'dupGroups:', s.products.duplicateGroups);
}

console.log('\n\n=== MAPID first 40 services ===');
const mapid = audit.find((x) => x.site === 'mapid');
for (const s of mapid.services.details.slice(0, 40)) {
  console.log(`${s.title} | ${s.sourceUrl} | conf=${s.confidence.toFixed(2)} | desc=${s.hasDescription} | ev=${s.evidenceCount} | ${s.evidenceTypes.join(',')} | group=${s.duplicateGroup}`);
}

console.log('\n\n=== SAVIT projects (first 20) ===');
const savit = audit.find((x) => x.site === 'savit');
for (const s of savit.projects.details.slice(0, 20)) {
  console.log(`PROJECT ${s.title} | ${s.sourceUrl} | conf=${s.confidence.toFixed(2)} | desc=${s.hasDescription} | ev=${s.evidenceCount}`);
}
console.log('\n=== SAVIT products (first 20) ===');
for (const s of savit.products.details.slice(0, 20)) {
  console.log(`PRODUCT ${s.title} | ${s.sourceUrl} | conf=${s.confidence.toFixed(2)} | desc=${s.hasDescription} | ev=${s.evidenceCount}`);
}

console.log('\n\n=== MAPID/NWF news index/detail overlap samples ===');
for (const site of ['mapid', 'northwaterfront']) {
  const s = audit.find((x) => x.site === site);
  if (!s || !s.ok) continue;
  console.log(`--- ${site} overlap ---`);
  for (const o of s.news.indexDetailOverlap.slice(0, 6)) {
    console.log(o);
  }
}
