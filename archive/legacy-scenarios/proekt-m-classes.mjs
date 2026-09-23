import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
const $ = load(await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/pages/index.html', 'utf8'));
const set = new Set();
$('*').each((_, el) => {
  const cls = $(el).attr('class');
  if (cls) cls.split(/\s+/).filter(Boolean).forEach(c => set.add(c));
});
console.log([...set].sort().join('\n'));
