import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { join } from 'node:path';

const base = 'https://proekt-m.by';
const html = await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/pages/index.html', 'utf8');
const $ = load(html);
const links = [];
$('a[href]').each((_, el) => {
  const href = $(el).attr('href');
  let u;
  try { u = new URL(href, base); } catch { return; }
  if (u.hostname !== 'proekt-m.by') return;
  if (u.pathname.match(/\.(jpg|jpeg|png|gif|webp|pdf|mp4|css|js|xml|json|zip|doc|docx)$/i)) return;
  links.push({ text: $(el).text().trim().slice(0, 80), url: u.toString().replace(/#.*$/, '').replace(/\?.*$/, '') });
});
const unique = [...new Map(links.map(l => [l.url, l])).values()].sort((a, b) => a.url.localeCompare(b.url));
await writeFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/links.json', JSON.stringify(unique, null, 2), 'utf8');
console.log('links', unique.length);
for (const l of unique.slice(0, 40)) console.log(l.url, '|', l.text);
