import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json','utf8'));
const page = crawl.pages.find(p => p.url.includes('portfolio/basseyn'));
console.log('crawledPage.images:', (page.images||[]).length);
for (const i of page.images||[]) console.log(' ', i.width+'x'+i.height, (i.src||'').split('/').pop(), 'logo:',i.likelyLogo,'hero:',i.likelyHero, '| alt:', (i.alt||'').slice(0,40));
const $ = cheerio.load(page.html);
// background images in slider
const bgs=[];
$('[style*="background"]').each((i,el)=>{const s=$(el).attr('style')||'';const m=s.match(/url\(['"]?([^)'"]+)/);if(m)bgs.push(m[1].split('/').pop());});
console.log('bg-image urls:', bgs.slice(0,15));
// picture/source/srcset
const srcsets=[]; $('source[srcset],img[srcset]').each((i,el)=>srcsets.push(($(el).attr('srcset')||'').slice(0,80)));
console.log('srcsets:', srcsets.slice(0,8));
