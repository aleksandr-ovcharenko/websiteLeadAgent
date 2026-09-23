import { load } from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const html = await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/pages/index.html', 'utf8');
const $ = load(html);
const base = 'https://atelit.by';
const links = [];
$('a[href]').each((_, el) => {
  const href = $(el).attr('href');
  let u;
  try { u = new URL(href, base); } catch { return; }
  if (u.hostname !== 'atelit.by') return;
  if (u.pathname.match(/\.(jpg|jpeg|png|gif|webp|pdf|mp4|css|js|xml|json|zip)$/i)) return;
  links.push({ text: $(el).text().trim().slice(0, 80), url: u.toString().replace(/#.*$/, '') });
});
const unique = new Map();
for (const l of links) {
  if (!unique.has(l.url)) unique.set(l.url, l);
}
const out = [...unique.values()].sort((a, b) => a.url.localeCompare(b.url));
await writeFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/links.json', JSON.stringify(out, null, 2), 'utf8');
console.log('links', out.length);
for (const l of out.slice(0, 50)) console.log(l.url, '|', l.text);
