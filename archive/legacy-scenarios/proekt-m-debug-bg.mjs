import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
const $ = load(await readFile('data/experiments/proekt-m/c2-transformation/source/pages/index.html', 'utf8'));
$('.projects_block .item .responsive-image').each((i, el) => {
  console.log(i, $(el).attr('style'));
});
