import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const file = process.argv[2] || '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/pages/index.html';
const html = await readFile(file, 'utf8');
const $ = load(html);
const set = new Set();
$('*').each((_, el) => {
  const cls = $(el).attr('class');
  if (cls) cls.split(/\s+/).filter(Boolean).forEach(c => set.add(c));
});
const arr = [...set].sort();
await writeFile('/tmp/atelit-classes.json', JSON.stringify(arr, null, 2));
console.log(arr.join('\n'));
