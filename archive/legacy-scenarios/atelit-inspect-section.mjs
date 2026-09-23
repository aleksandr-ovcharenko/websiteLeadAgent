import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const $ = load(await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/pages/index.html', 'utf8'));

function dump(sel) {
  const html = $(sel).first().html();
  console.log('\n---', sel, '---');
  console.log(html?.slice(0, 2000));
}

dump('.our-akcii');
dump('.our-videos');
dump('.main-works');

await writeFile('/tmp/atelit-main-works.html', $('.main-works').first().html() || '', 'utf8');
