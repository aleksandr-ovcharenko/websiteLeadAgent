import { readFile, writeFile } from 'node:fs/promises';

const html = await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c25-creative-breakout/selected/render/c25-selected.html', 'utf8');

// Replace .jpg asset references with webp/ versions; leave SVG and CSS untouched
const updated = html.replace(/(src=\"|src='|url\(')(assets\/)?([^\"'\s)]+\.jpg)/g, (m, p1, p2, p3) => {
  return `${p1}assets/webp/${p3.replace(/\.jpg$/i, '.webp')}`;
});

await writeFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c25-creative-breakout/selected/render/c25-selected.html', updated, 'utf8');
console.log('updated to webp');
