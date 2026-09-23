import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
const $ = load(await readFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/pages/index.html', 'utf8'));
const items = [];
$('#menu-glavnoe-menyu a, .main-navigation a, .menu-item a').each((_, el) => {
  items.push({ text: $(el).text().trim().slice(0,40), href: $(el).attr('href'), class: $(el).parent().attr('class') });
});
console.log(JSON.stringify(items, null, 2));
