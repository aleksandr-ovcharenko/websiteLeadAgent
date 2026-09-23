import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json','utf8'));
const page = crawl.pages.find(p => p.url.includes('portfolio/basseyn'));
const $ = cheerio.load(page.html);
const clean = t => t.replace(/\s+/g,' ').trim();
// find deepest containers with large text
const cands = [];
$('div,section,main').each((i,el)=>{
  const l = clean($(el).text()).length;
  if (l>2000) cands.push([l, el.tagName, ($(el).attr('class')||'').slice(0,70), ($(el).attr('id')||'')]);
});
cands.sort((a,b)=>a[0]-b[0]);
for (const c of cands.slice(0,15)) console.log(c[0], c[1], c[2], c[3]);
console.log('---paragraphs---');
console.log('p count:', $('p').length, 'body p:', $('body p').length);
$('p').slice(0,10).each((i,el)=>console.log(' p:', clean($(el).text()).slice(0,90), '| parent:', $(el).parent().attr('class')?.slice(0,50)));
