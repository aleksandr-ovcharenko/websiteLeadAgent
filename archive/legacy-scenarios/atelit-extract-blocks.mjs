import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { join } from 'node:path';

const PAGES = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/pages';
const files = {
  index: join(PAGES, 'index.html'),
  services: join(PAGES, 'dizajn-interera.html'),
  cottages: join(PAGES, 'kottedzhej.html'),
  portfolio: join(PAGES, 'portfolio.html'),
  pricing: join(PAGES, 'tseny-tseny-na-dizajn-interera.html'),
  pricingRepair: join(PAGES, 'tseny-tseny-na-remont-kvartir.html'),
  about: join(PAGES, 'atelit-v-smi.html'),
  contacts: join(PAGES, 'kontakty.html'),
  calc: join(PAGES, 'raschet-stoimosti.html'),
  promo: join(PAGES, 'sale.html'),
};

function clean(t) {
  return t.replace(/\s+/g, ' ').trim();
}

async function parseFile(path) {
  const h = await readFile(path, 'utf8');
  return load(h);
}

const parsed = {};
for (const [name, path] of Object.entries(files)) {
  try { parsed[name] = await parseFile(path); } catch {}
}

function imgSrc($el, base = 'https://atelit.by') {
  if (!$el || !$el.length) return null;
  let src = $el.attr('data-src') || $el.attr('src');
  // skip lazy placeholder
  if (src && src.includes('data:image/svg+xml')) src = null;
  if (!src) {
    const style = $el.attr('style') || '';
    const m = style.match(/url\(([^)]+)\)/);
    if (m) src = m[1].replace(/["']/g, '');
  }
  if (!src) {
    // noscript fallback
    const noscript = $el.parent().find('noscript').html() || '';
    const m = noscript.match(/src=["']([^"']+)["']/);
    if (m) src = m[1];
  }
  if (!src) return null;
  try {
    const u = new URL(src, base);
    if (u.hostname !== 'atelit.by') return null;
    return u.toString();
  } catch { return null; }
}

const out = {};

// Nav
const $ = parsed.index;
out.nav = $('#menu-glavnoe-menyu-container .menu-item a').map((_, el) => {
  const $el = $(el);
  return { label: clean($el.text()), url: $el.attr('href') };
}).get().filter(n => n.label && !n.label.startsWith('http'));

// Company
out.company = {
  name: 'Ателит',
  tagline: 'ремонт премиум качества',
  address: clean($('.header-r__loctext').first().text()),
  phones: [...new Set($('.header-r__addphones a').map((_, el) => clean($(el).text())).get().filter(Boolean))],
  social: [...new Set($('.header-r-social a, .footer-social__items a').map((_, el) => $(el).attr('href')).get().filter(u => u && u.includes('http')))],
  hours: clean($('.footer-textarea').text().match(/Время работы:[^\n]+/i)?.[0] || ''),
  legal: clean($('.footer-textarea').text()),
};

// Hero
const heroItem = $('.main-slider__item').first();
out.hero = {
  title: 'Дизайн интерьера и ремонт премиум-класса',
  subtitle: clean($('.main-about__text').text().slice(0, 200)),
  cta: 'Заказать дизайн-проект',
  bg: heroItem.attr('style')?.match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, '') || null
};

// About / main-about
out.about = {
  title: clean($('.main-about__title').text()) || 'Мы создаем красоту и комфорт',
  text: clean($('.main-about__text').text())
};

// Facts
out.facts = $('.list-about .list-about-item').map((_, el) => ({
  num: clean($(el).find('.list-about-item__num').text()),
  text: clean($(el).find('.list-about-item__text').text())
})).get().filter(f => f.text);

// Services
out.services = $('.our-serves-list .our-serves-list-item').map((_, el) => ({
  title: clean($(el).find('.our-serves-list-item__text').text()),
  image: imgSrc($(el).find('img').first())
})).get().filter(s => s.title);

// Service page deeper text
if (parsed.services) {
  out.servicePage = {
    title: clean(parsed.services('h1').text()),
    text: clean(parsed.services('.entry-content').text()).slice(0, 1200)
  };
}
if (parsed.cottages) {
  out.cottagePage = {
    title: clean(parsed.cottages('h1').text()),
    text: clean(parsed.cottages('.entry-content').text()).slice(0, 1200)
  };
}

// Homepage featured works (main-works) - image-only slider, text is separate
out.works = [];
$('.main-works-slider__item').each((i, el) => {
  const $el = $(el);
  const url = $el.find('a').attr('href') || $el.attr('href') || null;
  const bg = ($el.attr('style') || '').match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, '') || null;
  const img = imgSrc($el.find('img').first()) || bg;
  if (img) out.works.push({ index: i, url, image: img });
});

// Portfolio page project list
if (parsed.portfolio) {
  const $$ = parsed.portfolio;
  out.portfolioProjects = [];
  $$('a[href*="/kvartira"]').each((_, el) => {
    const href = $$(el).attr('href');
    const title = clean($$(el).text());
    if (href && title && title.length > 3 && !title.toLowerCase().includes('подробнее')) {
      out.portfolioProjects.push({ title, url: href });
    }
  });
  out.portfolioProjects = [...new Map(out.portfolioProjects.map(p => [p.url, p])).values()];
}

// Project detail pages
out.projects = [];
const projFiles = ['kvartira-na-ilianskoi-10.html','kvartira-na-kommunisticheskoy.html','kvartira-na-makaenka-12v.html','kvartira-na-novovilenskoj.html','kvartira-na-ratomskoy.html','kvartira-na-rozhdestvenskoy-2a.html','kvartira-v-zhk-minsk-mir.html'];
for (const pf of projFiles) {
  try {
    const $p = await parseFile(join(PAGES, pf));
    const title = clean($p('h1').text()) || clean($p('.page-top h1').text());
    const projectText = clean($p('.who-made-project-text').text());
    // collect all real images from noscript + data-src
    const imgs = [];
    $p('img, a[data-fancybox]').each((_, el) => {
      let src = $p(el).attr('href') || imgSrc($p(el));
      if (src && src.startsWith('https://atelit.by/wp-content/uploads/') && !imgs.includes(src)) imgs.push(src);
    });
    const cover = ($p('.page-top-wrapper').attr('style') || '').match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, '') || imgs[0];
    out.projects.push({ title, summary: projectText, cover, images: imgs.slice(0, 12) });
  } catch {}
}

// Stages/process
out.stages = $('.main-stages__row .main-stages__item').map((_, el) => ({
  title: clean($(el).find('.main-stages__title').text()),
  text: clean($(el).find('.main-stages__text').text()),
})).get().filter(s => s.title);

// Pricing
out.prices = $('.main-prices-row .main-prices-item').map((_, el) => ({
  title: clean($(el).find('.main-prices-item__title').text()),
  price: clean($(el).find('.main-prices-item__price').text()),
  text: clean($(el).find('.main-prices-item__text').text()),
  button: clean($(el).find('.main-prices-item__btn').text()),
})).get().filter(p => p.title);

// Team
out.team = $('.our-team-row .our-team__item').map((_, el) => ({
  name: clean($(el).find('.our-team__title').text()),
  text: clean($(el).find('.our-team__text').text()),
  image: imgSrc($(el).find('img').first())
})).get().filter(t => t.text);

// Promotions / акции
out.promos = $('.our-akcii-r .our-akcii-r-item').map((_, el) => ({
  title: clean($(el).find('.our-akcii-r-item__title').text()),
  before: clean($(el).find('.our-akcii-pbef').text()),
  after: clean($(el).find('.our-akcii-pafter').text()),
})).get().filter(p => p.title);

// Styles
out.styles = $('.our-styles-row .our-styles__item').map((_, el) => ({
  name: clean($(el).find('.our-styles__text').text()),
  image: imgSrc($(el).find('img').first()) || (($(el).attr('style') || '').match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, '') || null)
})).get().filter(s => s.name || s.image);

// Videos
out.videos = $('.our-videos__item').map((_, el) => ({
  url: $(el).find('a').attr('href') || $(el).attr('data-src'),
  image: imgSrc($(el).find('img').first())
})).get().filter(v => v.url || v.image);

await writeFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization/source/extracted.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Extracted', Object.keys(out), 'projects', out.projects.length, 'works', out.works.length);
