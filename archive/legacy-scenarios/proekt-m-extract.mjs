import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { join } from 'node:path';

const PAGES = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/pages';

function clean(t) {
  return t ? t.replace(/\s+/g, ' ').trim() : '';
}

function fullUrl(u, base = 'https://proekt-m.by/') {
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http')) return u;
  if (u.startsWith('/')) return 'https://proekt-m.by' + u;
  const encoded = encodeURI(u).replace(/%2F/g, '/');
  try { return new URL(encoded, base).toString(); } catch { return null; }
}

function bgImage($el) {
  const style = $el.attr('style') || '';
  const m = style.match(/url\(['"]([^'"]+)['"]\)/) || style.match(/url\(([^)\s]+)\)/);
  return m ? fullUrl(m[1]) : null;
}

function imgSrc($el) {
  const src = $el.attr('data-src') || $el.attr('src');
  if (src && src.startsWith('data:image/svg+xml')) return null;
  return src ? fullUrl(src) : null;
}

async function parse(name) {
  try {
    const h = await readFile(join(PAGES, name), 'utf8');
    return load(h);
  } catch { return null; }
}

const $ = await parse('index.html');

const out = {};

// Company basics
const title = clean($('title').text());
const metaDesc = clean($('meta[name="description"]').attr('content'));
out.company = {
  name: 'ООО «Проект-М»',
  shortName: 'Проект-М',
  title,
  metaDescription: metaDesc,
};

// Navigation
out.nav = [];
$('.main-menu a, .navigation-menu a, .contacts-menu a').each((_, el) => {
  const text = clean($(el).text());
  const href = $(el).attr('href');
  if (text && href) out.nav.push({ label: text, url: href });
});
out.nav = [...new Map(out.nav.map(n => [n.url, n])).values()];

// Hero
const heroVideo = $('.index-video-frame source').attr('src') || $('.index-video-frame').attr('src');
const heroPoster = $('.index-video-frame').attr('poster');
out.hero = {
  title: clean($('.index-slide-content .name').text()),
  description: clean($('.index-slide-content .description').text()),
  cta: clean($('.index-slide-content .button').text()),
  video: fullUrl(heroVideo),
  poster: fullUrl(heroPoster)
};

// Advantages / why us
out.advantages = [];
$('.w-our-better .w-item').each((_, el) => {
  const name = clean($(el).find('.top .name').text());
  const desc = clean($(el).find('.bottom .description').text());
  if (name) out.advantages.push({ name, description: desc });
});

// Article / about
out.about = clean($('.s-index-article-line article').text());
out.aboutHtml = $.html('.s-index-article-line article');

// Project groups (two blocks)
out.projects = [];
$('.projects_block').each((_, block) => {
  const blockTitle = clean($(block).find('.section-name').first().text());
  $(block).find('.item').each((__, item) => {
    const $item = $(item);
    const url = $item.find('a.link, a.a_name').first().attr('href');
    const title = clean($item.find('.name').text());
    const img = bgImage($item.find('.responsive-image')) || imgSrc($item.find('img'));
    // infer sector from URL
    const sector = url?.includes('zhilyie') ? 'Жилые' : url?.includes('promyshlennogo') ? 'Промышленные' : url?.includes('obshhestvennogo') ? 'Общественные' : 'Другие';
    if (title && !out.projects.find(p => p.title === title)) {
      out.projects.push({ title, url, category: sector, cover: img, block: blockTitle });
    }
  });
});

// Partners
out.partners = [];
$('.s-partners .owl-carousel .item img').each((_, el) => {
  const src = imgSrc($(el));
  const alt = $(el).attr('alt') || '';
  if (src) out.partners.push({ src, alt });
});

// Video feedbacks (YouTube ids)
out.videoTestimonials = [];
$('.w-index-feedbacks .w-item').each((_, el) => {
  const $el = $(el);
  const img = imgSrc($el.find('img'));
  const cls = $el.attr('class') || '';
  const num = cls.match(/video_(\d+)/)?.[1];
  const youtubeMatch = img?.match(/\/vi\/([^/]+)\//);
  if (youtubeMatch) {
    out.videoTestimonials.push({ index: Number(num), youtubeId: youtubeMatch[1], thumbnail: img });
  }
});

// Footer contacts
out.contacts = {
  phone: clean($('.w-phones .phone').first().text()) || clean($('.phones_top').first().text()),
  address: clean($('.adress, .micro_adress').first().text()),
  email: clean($('a[href^="mailto:"]').first().text()),
  workTime: clean($('.contact_work_time').first().text())
};

// Service pages
async function extractService(name) {
  const $$ = await parse(name);
  if (!$$) return null;
  const h1 = clean($$('h1').text());
  const content = clean($$('.content article').text() || $$('.content').text());
  return { title: h1, content: content.slice(0, 2000) };
}

out.services = {
  architectural: await extractService('arhitekturnoe-proektirovanie-zdanij.html'),
  construction: await extractService('stroitelnoe-proektirovanie-zdanij.html'),
  general: await extractService('generalnoe-proektirovanie-zdanij.html'),
  list: await (async () => {
    const $$ = await parse('uslugi.html');
    if (!$$) return [];
    const items = [];
    $$('.content a[href*=".html"], .content h2, .content h3, .content p').each((_, el) => {
      const t = clean($$(el).text());
      if (t) items.push(t);
    });
    return items.slice(0, 40);
  })()
};

// About page
const $about = await parse('o-kompanii.html');
out.aboutPage = {
  title: clean($about?.('h1').text() || ''),
  content: clean($about?.('.content').text() || '').slice(0, 4000)
};

// Contacts page
const $contacts = await parse('kontakty.html');
out.contactsPage = {
  title: clean($contacts?.('h1').text() || ''),
  content: clean($contacts?.('.content').text() || '').slice(0, 4000)
};

await writeFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/extracted.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Extracted', Object.keys(out), 'projects', out.projects.length, 'testimonials', out.videoTestimonials.length, 'partners', out.partners.length);
