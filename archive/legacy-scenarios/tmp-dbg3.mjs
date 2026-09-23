import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json','utf8'));
const page = crawl.pages.find(p => p.url.includes('portfolio/basseyn'));
const $ = cheerio.load(page.html);
const clean = t => t.replace(/\s+/g,' ').trim();
const el = $('div.elementor-1476');
console.log('parents chain:');
el.parents().each((i,p)=>console.log('  ', p.tagName, (p.attribs?.class||'').slice(0,80), p.attribs?.id||''));
// body direct children
console.log('body children:');
$('body').children().each((i,c)=>console.log('  ', c.tagName, (c.attribs?.class||'').slice(0,80), 'textLen:', clean($(c).text()).length));
