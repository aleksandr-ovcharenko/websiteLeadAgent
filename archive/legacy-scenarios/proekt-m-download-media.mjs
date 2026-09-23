import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const src = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source';
const out = join(src, 'images');
await mkdir(out, { recursive: true });

const extracted = JSON.parse(await readFile(join(src, 'extracted.json'), 'utf8'));
const toDownload = [];

if (extracted.hero?.poster) toDownload.push({ key: 'hero-poster', url: extracted.hero.poster });
for (const p of extracted.projects) {
  if (p.cover && !p.cover.includes('imageffsfsdfsd')) toDownload.push({ key: p.title, url: p.cover });
}
for (const part of extracted.partners) {
  if (part.src) toDownload.push({ key: part.alt || 'partner', url: part.src });
}

const report = [];
const map = [];
for (const item of toDownload) {
  const ext = extname(new URL(item.url).pathname) || '.jpg';
  const name = createHash('sha256').update(item.url).digest('hex').slice(0, 8) + '-' + (item.key ? item.key.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9а-яА-Я-]/g, '').slice(0, 40) : 'media') + ext;
  try {
    const resp = await fetch(item.url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    await writeFile(join(out, name), buf);
    report.push({ url: item.url, file: name, size: buf.length, status: 'ok' });
    map.push({ sourceUrl: item.url, filename: name, size: buf.length });
    console.log('ok', name, buf.length);
  } catch (e) {
    report.push({ url: item.url, error: e.message, status: 'fail' });
    console.error('fail', item.url, e.message);
  }
}
await writeFile(join(src, 'media-map.json'), JSON.stringify(map, null, 2), 'utf8');
await writeFile(join(src, 'download-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('downloaded', map.length, 'failed', report.filter(r => r.error).length);
