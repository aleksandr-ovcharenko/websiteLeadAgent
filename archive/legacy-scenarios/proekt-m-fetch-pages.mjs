import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/pages';
await mkdir(outDir, { recursive: true });

const links = JSON.parse(await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/links.json', 'utf8'));
// fetch only a curated subset to avoid bloat
const fetchUrls = [
  'https://proekt-m.by/',
  'https://proekt-m.by/proekty/',
  'https://proekt-m.by/uslugi/',
  'https://proekt-m.by/o-kompanii.html',
  'https://proekt-m.by/kontakty.html',
  'https://proekt-m.by/arhitekturnoe-proektirovanie-zdanij.html',
  'https://proekt-m.by/generalnoe-proektirovanie-zdanij.html',
  'https://proekt-m.by/stroitelnoe-proektirovanie-zdanij.html',
  'https://proekt-m.by/novosti/',
  'https://proekt-m.by/stati/',
  'https://proekt-m.by/menu.html',
  'https://proekt-m.by/kariera/',
  ...links.filter(l => l.url.startsWith('https://proekt-m.by/proekty/') && l.url.split('/').length > 4).slice(0, 12).map(l => l.url)
];

const report = [];
for (const url of fetchUrls) {
  const u = new URL(url);
  const path = u.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-');
  const file = (path || 'index') + '.html';
  try {
    const cmd = `curl -L --connect-timeout 20 -m 120 -A "Mozilla/5.0" "${url}" -o "${join(outDir, file)}" -w "%{http_code} %{time_total} %{size_download} %{url_effective}\n"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 140000 });
    report.push({ url, file, result: result.trim() });
    console.log(result.trim());
  } catch (e) {
    report.push({ url, file, error: e.message });
    console.error('failed', url, e.message);
  }
}
await writeFile(join(outDir, '..', 'fetch-report.json'), JSON.stringify(report, null, 2), 'utf8');
