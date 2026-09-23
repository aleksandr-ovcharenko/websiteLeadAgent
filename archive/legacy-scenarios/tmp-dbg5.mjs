import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json','utf8'));
const page = crawl.pages.find(p => p.url.includes('portfolio/basseyn'));
const $ = cheerio.load(page.html);
$('.wpr-slider-content').first().parent().parent().each((i,el)=>console.log('slider parent:', el.tagName, (el.attribs?.class||'').slice(0,60), JSON.stringify(Object.keys(el.attribs||{}))));
$('.wpr-slider-content').each((i,el)=>{ if(i>3) return; console.log(i, JSON.stringify(el.attribs).slice(0,300)); });
// any data- attrs containing image urls anywhere
const found=new Set();
$('*').each((i,el)=>{ for(const [k,v] of Object.entries(el.attribs||{})) if(/\.(jpe?g|png|webp|avif)/i.test(v) && !/^(src|href|style)/.test(k)) found.add(`${k}=${v.slice(0,80)}`); });
console.log('attr urls:', [...found].slice(0,15));
