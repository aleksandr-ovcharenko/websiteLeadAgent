import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const crawl = JSON.parse(await readFile('data/redesign/pilot-2b/lishen/crawl-full.json','utf8'));
const page = crawl.pages.find(p => p.path === '/contacts' || p.url.endsWith('/contacts') || p.url.endsWith('/contacts/'));
console.log('contacts url:', page?.url);
const $ = cheerio.load(page.html);
// where is the address text?
const t = $('body').text();
const i = t.indexOf('Стариновская');
console.log('addr idx:', i, JSON.stringify(t.slice(Math.max(0,i-60), i+80)));
// find element containing it
$('*').each((_,el)=>{ const own=$(el).clone().children().remove().end().text().trim(); if(own.includes('Стариновская')) console.log('FOUND el:', el.tagName, (el.attribs?.class||'').slice(0,60), '| ancestors:', $(el).parents().map((_,p)=>p.tagName+'.'+(p.attribs?.class||'').split(' ')[0]).get().slice(0,5).join(' < ')); });
