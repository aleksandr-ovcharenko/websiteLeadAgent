import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json','utf8'));
const page = crawl.pages.find(p => p.url.includes('portfolio/basseyn'));
const $ = cheerio.load(page.html);
const clean = t => t.replace(/\s+/g,' ').trim();
console.log('h1:', $('h1').first().text().trim());
console.log('main tags:', $('main').length, 'role=main:', $('[role="main"]').length, 'article:', $('article').length);
// what matches [class*="content"]
$('[class*="content"]').each((i,el)=>{
  if(i>15)return;
  console.log('content-cand:', el.tagName, ($(el).attr('class')||'').slice(0,80), 'textLen:', clean($(el).text()).length);
});
// where does the real text live? find elements containing "бассейн" body text
const t = clean($('body').text());
console.log('body text len:', t.length);
console.log('elementor sections:', $('.elementor-section').length, 'containers:', $('.elementor-container').length);
const main = $('main').first();
if (main.length) console.log('main text len:', clean(main.text()).length, 'class:', main.attr('class'));
