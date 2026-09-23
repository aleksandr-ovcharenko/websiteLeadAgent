import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';
const SRC = join(C1, 'source');
const IMGDIR = join(SRC, 'images');
const PAGES = join(SRC, 'pages');

const extracted = JSON.parse(await readFile(join(SRC, 'extracted.json'), 'utf8'));
const $ = load(await readFile(join(PAGES, 'index.html'), 'utf8'));

function clean(t) {
  return t.replace(/\s+/g, ' ').trim();
}

function hash(u) {
  return createHash('sha256').update(u).digest('hex').slice(0, 8);
}

function baseName(u) {
  try {
    const p = new URL(u).pathname;
    return p.split('/').pop() || 'image.jpg';
  } catch { return 'image.jpg'; }
}

function localName(u) {
  const b = baseName(u);
  // clean any query strings
  return `${hash(u)}-${b.split('?')[0]}`;
}

const mediaRegistry = [];
const downloadQueue = [];

function registerMedia(url, alt = '') {
  if (!url) return null;
  if (!url.startsWith('https://atelit.by/wp-content/uploads/')) return null;
  const filename = localName(url);
  if (!mediaRegistry.find(m => m.filename === filename)) {
    mediaRegistry.push({ filename, sourceUrl: url, alt });
    downloadQueue.push({ url, filename });
  }
  return filename;
}

// Parse main-works featured projects from homepage
const works = [];
$('.main-works__row').each((_, el) => {
  const $r = $(el);
  const title = clean($r.find('.main-works__rtitle').text());
  const text = clean($r.find('.main-works__rttext').text());
  const href = $r.find('.main-works__rbutton a').attr('href') || $r.find('a').attr('href') || '';
  const imgs = [];
  $r.find('a[data-fancybox]').each((_, a) => {
    const src = $(a).attr('href');
    if (src && src.startsWith('https://atelit.by/wp-content/uploads/')) imgs.push(src);
  });
  $r.find('img').each((_, img) => {
    const src = $(img).attr('data-src') || $(img).attr('src');
    if (src && src.startsWith('https://atelit.by/wp-content/uploads/')) imgs.push(src);
  });
  const cover = imgs[0] || null;
  if (title) works.push({ title, text, href, cover, images: [...new Set(imgs)] });
});

// Match detail summaries to works
const projects = works.map((w, i) => {
  const detail = extracted.projects.find(p => p.title === w.title || w.href && p.title.toLowerCase().includes(w.title.toLowerCase().slice(0, 12)));
  const slug = w.href.replace(/^\/|\/$/g, '') || `project-${i}`;
  return {
    title: w.title,
    slug,
    category: 'Квартиры',
    location: detail?.summary?.match(/г\.\s*[^\s]+/)?.[0] || 'г. Минск',
    area: detail?.summary?.match(/(\d+[\.,]?\d*)\s*м?²?/)?.[0] || '',
    summary: detail?.summary ? clean(detail.summary).slice(0, 240) : w.text,
    coverImage: { filename: registerMedia(detail?.cover || w.cover, w.title) }
  };
});

// Assign style categories for filterable portfolio
const styleCategories = (extracted.styles || []).map(s => s.name).filter(Boolean);
projects.forEach((p, i) => {
  p.category = styleCategories[i % styleCategories.length] || 'Интерьеры';
});

// Styles gallery
const styles = extracted.styles.map(s => ({
  name: s.name,
  image: registerMedia(s.image, s.name)
})).filter(s => s.image);

// Promo before/after
const promo = { title: 'Бесплатный дизайнерский эскиз', before: null, after: null };
const beforeUrl = $('.our-akcii-pbef').attr('href') || $('.our-akcii-pbef img').attr('data-src');
const afterUrl = $('.our-akcii-pafter').attr('href') || $('.our-akcii-pafter img').attr('data-src');
if (beforeUrl && afterUrl) {
  promo.before = registerMedia(beforeUrl, 'Было');
  promo.after = registerMedia(afterUrl, 'Стало');
}

// Services: use extracted, add summary from service page where possible
const services = extracted.services.map((s, i) => ({
  title: s.title.replace(/^./, c => c.toUpperCase()),
  slug: s.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-я0-9-]/g, '').slice(0, 40),
  shortDescription: '',
  icon: registerMedia(s.image, s.title)
}));

// Pricing as products/properties
const products = extracted.prices.map((p, i) => ({
  title: p.title.replace(/Проект «Полный»\*.*$/, '').trim(),
  slug: `package-${i}`,
  summary: `${p.price ? p.price + '. ' : ''}${p.text}`,
  price: p.price,
  coverImage: { filename: registerMedia(extracted.projects[i % extracted.projects.length]?.cover, p.title) }
}));

// Company
const company = {
  name: 'Ателит',
  shortName: 'Ателит',
  legalName: 'Ателит',
  description: extracted.about.text,
  founded: '2003', // inferred from 20+ years claim; flagged in provenance
  phone: extracted.company.phones[0],
  email: 'atelit@inbox.ru',
  address: extracted.company.address,
  hours: extracted.company.hours,
  social: extracted.company.social.slice(0, 6)
};

// Hero
const hero = {
  title: 'Дизайн интерьера и ремонт премиум-класса',
  subtitle: 'Ателит — команда архитекторов, дизайнеров и строителей. Создаём интерьеры квартир и домов с 2003 года.',
  imageId: registerMedia(extracted.hero.bg, 'Hero background'),
  buttonLabel: 'Портфолио',
  buttonUrl: '#projects',
  secondaryCtaLabel: 'Рассчитать стоимость',
  secondaryCtaTarget: '#pricing'
};

// About
const aboutHeading = extracted.about.title;
const about = {
  heading: aboutHeading,
  content: extracted.about.text,
  imageId: registerMedia(extracted.projects[0]?.cover || extracted.styles[0]?.image, aboutHeading)
};

// CTA
const cta = {
  title: 'Обсудить ваш проект',
  description: 'Получите бесплатную консультацию и планировочное решение.',
  buttonLabel: 'Оставить заявку',
  buttonUrl: '#contacts'
};

// Stats from facts
const stats = extracted.facts.map(f => ({ value: f.num, label: f.text }));

// Process/stages
const process = extracted.stages.map(s => ({ title: s.title.replace(/^\d+\.\s*/, ''), text: s.text }));

// Team
const team = extracted.team.filter(t => t.name).map(t => ({
  name: t.name.replace(/(Архитектор|Дизайнер).*$/, '').trim(),
  role: t.name.match(/(Архитектор|Дизайнер).*$/)?.[0]?.trim() || '',
  text: t.text,
  image: registerMedia(t.image, t.name)
})).filter((t, i, a) => a.findIndex(x => x.name === t.name) === i);

// Navigation from index header
const navItems = [];
$('.menu-item a').each((_, el) => {
  const text = clean($(el).text());
  const href = $(el).attr('href') || '#';
  if (!text || text === 'Главная' || href === '#') return;
  if (navItems.find(n => n.label === text)) return;
  navItems.push({ label: text, url: href.replace(/^https:\/\/atelit\.by/, '') });
});
const navigation = navItems.slice(0, 7);

// Homepage section order
const homepageSections = [
  { type: 'hero', enabled: true, sortOrder: 0 },
  { type: 'services', enabled: true, sortOrder: 1, limit: 8 },
  { type: 'projects', enabled: true, sortOrder: 2, limit: 12 },
  { type: 'before-after', enabled: !!promo.before && !!promo.after, sortOrder: 3 },
  { type: 'properties', enabled: true, sortOrder: 4, limit: 3 },
  { type: 'process', enabled: true, sortOrder: 5 },
  { type: 'about', enabled: true, sortOrder: 6 },
  { type: 'team', enabled: true, sortOrder: 7 },
  { type: 'cta', enabled: true, sortOrder: 8 }
];

const cms = {
  company,
  hero,
  about,
  cta,
  stats,
  homepageSections,
  navigation,
  services,
  projects,
  products,
  styles,
  process,
  team,
  promo,
  media: mediaRegistry
};

// Download images
await mkdir(IMGDIR, { recursive: true });
const failed = [];
for (const { url, filename } of downloadQueue) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(IMGDIR, filename), buf);
  } catch (e) {
    failed.push({ url, filename, error: e.message });
  }
}

await writeFile(join(SRC, 'cms-content.json'), JSON.stringify(cms, null, 2), 'utf8');
await writeFile(join(SRC, 'download-failures.json'), JSON.stringify(failed, null, 2), 'utf8');
console.log('CMS built. Media', mediaRegistry.length, 'Failed', failed.length);
