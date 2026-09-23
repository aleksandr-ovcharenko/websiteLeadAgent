import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

const outDir = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/pages';
await mkdir(outDir, { recursive: true });

const links = JSON.parse(await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/links.json', 'utf8'));
const urls = [...new Set(links.map(l => l.url).filter(u => u.startsWith('https://atelit.by/')))];
const report = [];
for (const url of urls) {
  const u = new URL(url);
  const file = (u.pathname === '/' ? 'index' : u.pathname.replace(/\/$/, '').replace(/\//g, '-')) + '.html';
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
