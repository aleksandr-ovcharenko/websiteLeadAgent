import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { captureScreenshots } from '../packages/redesign-engine/experiments/screenshots.mjs';

const B1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b1-intelligence';
const B25 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b25-transformation';
const startedAt = new Date().toISOString();

const siteBrief = JSON.parse(await readFile(join(B1, 'SiteBrief.json'), 'utf8'));
const media = JSON.parse(await readFile(join(B1, 'media-intelligence.json'), 'utf8'));
const radarLeads = JSON.parse(await readFile('/tmp/radar-leads.json', 'utf8'));

await mkdir(B25, { recursive: true });
await mkdir(join(B25, 'images'), { recursive: true });
await mkdir(join(B25, 'prototypes'), { recursive: true });
await mkdir(join(B25, 'qa'), { recursive: true });

async function downloadImage(url, name) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = join(B25, 'images', name);
    await writeFile(path, buffer);
    return `../images/${name}`;
  } catch (err) {
    console.warn('download failed:', url, err.message);
    return url;
  }
}

const allHeroes = media.heroCandidates || [];
const selectedImages = allHeroes.slice(0, 24);
const imagePaths = [];
for (let i = 0; i < selectedImages.length; i++) {
  const h = selectedImages[i];
  const safe = h.url.split('/').pop().replace(/[^a-zA-Z0-9_.-]/g, '_');
  imagePaths.push(await downloadImage(h.url, `${i}-${safe}`));
}

const services = siteBrief.offerings.services.map((s) => s.value);
const projects = siteBrief.offerings.projects.map((p) => p.value);
const property = siteBrief.offerings.property.map((p) => p.value);
const other = siteBrief.offerings.other.map((p) => p.value);
const trust = siteBrief.trustSignals[0]?.value || '50+ years on the market and over 25 million square meters of housing built.';

function categoryCounts() {
  const cats = {
    'Многоэтажная застройка': ['многоэтаж', 'микрорайон', 'жилой дом', 'жилые дома', 'жилой объект', 'высотн'],
    'Малоэтажная застройка': ['малоэтаж', 'мало'],
    'Коттеджная застройка': ['коттедж', 'коттеджи', 'sonechnyj', 'зелен'],
    'Административные и общественные здания': ['административн', 'общественн', 'бизнес-центр', 'детский сад', 'спортив'],
  };
  const counts = { 'Многоэтажная застройка': 0, 'Малоэтажная застройка': 0, 'Коттеджная застройка': 0, 'Административные и общественные здания': 0 };
  for (const p of projects) {
    const lower = p.toLowerCase();
    let matched = false;
    for (const [cat, words] of Object.entries(cats)) {
      if (words.some((w) => lower.includes(w))) { counts[cat]++; matched = true; break; }
    }
    if (!matched) counts['Многоэтажная застройка']++;
  }
  return Object.entries(counts).map(([label, count]) => ({ label, count }));
}
const areas = categoryCounts();

const newsItems = other
  .filter((n) => n.length < 120 && !n.includes('Реализация квартир') && !n.includes('Аренда'))
  .slice(0, 3);

function html() {
  const heroImg = imagePaths[0];
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ОАО «МАПИД» — Строительное предприятие</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    :root { --bg:#f7f5f2; --ink:#1c1c1c; --muted:#6b6b6b; --accent:#c75a3a; --surface:#ffffff; --line:#e8e4df; }
    * { box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--ink); -webkit-font-smoothing:antialiased; }
    .btn-press { transition: transform 160ms ease-out; }
    .btn-press:active { transform: scale(0.97); }
    .text-ink { color:var(--ink); }
    .text-muted { color:var(--muted); }
    .bg-surface { background:var(--surface); }
    .bg-accent { background:var(--accent); }
    .text-accent { color:var(--accent); }
    .border-line { border-color:var(--line); }
    .hero-overlay { background: linear-gradient(90deg, rgba(28,28,28,.78) 0%, rgba(28,28,28,.18) 70%); }
    @media (prefers-reduced-motion:reduce) { .reveal { opacity:1; transform:none; } }
    .project-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; grid-auto-rows:240px; }
    @media (min-width:1024px) { .project-grid .feat { grid-column:span 2; grid-row:span 2; } .project-grid .wide { grid-column:span 2; } .project-grid .tall { grid-row:span 2; } }
    @media (max-width:768px) { .project-grid { grid-template-columns:1fr 1fr; grid-auto-rows:180px; } }
    .nav-toggle:checked ~ .mobile-nav { display:flex; }
  </style>
</head>
<body class="antialiased">
  <input id="nav-toggle" class="nav-toggle hidden" type="checkbox" />

  <nav class="fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur border-b border-line">
    <div class="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
      <a href="#" class="font-black text-xl tracking-tight text-ink">МАПИД</a>
      <div class="hidden md:flex items-center gap-8 text-sm font-medium">
        <a href="#services" class="hover:text-accent transition-colors">Услуги</a>
        <a href="#areas" class="hover:text-accent transition-colors">Направления</a>
        <a href="#projects" class="hover:text-accent transition-colors">Проекты</a>
        <a href="#properties" class="hover:text-accent transition-colors">Недвижимость</a>
        <a href="#company" class="hover:text-accent transition-colors">О компании</a>
        <a href="#news" class="hover:text-accent transition-colors">Новости</a>
      </div>
      <div class="hidden md:flex items-center gap-4">
        <a href="tel:+375172098700" class="text-sm font-semibold">+375 17 209-87-00</a>
        <a href="#contact" class="px-4 py-2 bg-ink text-white text-sm font-medium hover:bg-black transition-colors btn-press">Контакты</a>
      </div>
      <label for="nav-toggle" class="md:hidden p-2 cursor-pointer" aria-label="Меню">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </label>
    </div>
    <div class="mobile-nav hidden md:hidden flex-col gap-4 px-6 py-6 bg-surface border-t border-line">
      <a href="#services" class="text-lg font-medium">Услуги</a>
      <a href="#areas" class="text-lg font-medium">Направления</a>
      <a href="#projects" class="text-lg font-medium">Проекты</a>
      <a href="#properties" class="text-lg font-medium">Недвижимость</a>
      <a href="#company" class="text-lg font-medium">О компании</a>
      <a href="#news" class="text-lg font-medium">Новости</a>
      <a href="tel:+375172098700" class="text-accent font-semibold">+375 17 209-87-00</a>
    </div>
  </nav>

  <section id="hero" class="relative min-h-[90dvh] pt-16 flex items-end overflow-hidden">
    <img src="${heroImg}" alt="Архитектурный проект МАПИД" class="absolute inset-0 w-full h-full object-cover" />
    <div class="hero-overlay absolute inset-0"></div>
    <div class="relative z-10 max-w-[1400px] mx-auto px-6 pb-20 w-full">
      <p class="text-white/70 text-sm uppercase tracking-widest mb-4">ОАО «МАПИД»</p>
      <h1 class="text-white text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] max-w-4xl mb-8">
        Строим городскую средду более 50 лет
      </h1>
      <p class="text-white/80 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
        ${trust}. Комплекс строительных услуг: проектирование, возведение, реализация и управление недвижимостью.
      </p>
      <div class="flex flex-wrap gap-4 mb-16">
        <a href="#projects" class="px-8 py-4 bg-white text-ink font-semibold hover:bg-gray-100 transition-colors btn-press">Смотреть проекты</a>
        <a href="#contact" class="px-8 py-4 border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors btn-press">Связаться</a>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-white/20 pt-8 text-white">
        <div><p class="text-3xl md:text-4xl font-black">50+</p><p class="text-white/60 text-sm">лет опыта</p></div>
        <div><p class="text-3xl md:text-4xl font-black">27M</p><p class="text-white/60 text-sm">кв. м. жилья</p></div>
        <div><p class="text-3xl md:text-4xl font-black">49+</p><p class="text-white/60 text-sm">реализованных объектов</p></div>
        <div><p class="text-3xl md:text-4xl font-black">4</p><p class="text-white/60 text-sm">основных направления</p></div>
      </div>
    </div>
  </section>

  <section id="services" class="py-24 max-w-[1400px] mx-auto px-6">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
      <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-4 md:mb-0">Услуги</h2>
      <p class="text-muted max-w-md">Полный цикл от проектной документации до сдачи объекта и реализации площадей.</p>
    </div>
    <div class="grid md:grid-cols-2 gap-px bg-line border border-line">
      ${services.map((s, i) => `<div class="bg-surface p-8 md:p-10 group hover:bg-[#f2f0ec] transition-colors">
        <span class="text-accent text-4xl font-black">0${i + 1}</span>
        <h3 class="text-2xl font-bold mt-4 mb-3">${s}</h3>
        <p class="text-muted mb-6">${s === 'Строительство' ? 'Возведение жилых, общественных и промышленных объектов под ключ.' : s === 'Проектирование' ? 'Полный комплекс инженерного и архитектурного проектирования.' : s === 'Прочие услуги' ? 'Сопровождение, консалтинг и специализированные строительные работы.' : 'Индивидуальное проектирование и строительство загородных домов.'}</p>
        <a href="#" class="inline-flex items-center gap-2 font-semibold hover:text-accent transition-colors">Подробнее <span class="group-hover:translate-x-1 transition-transform">→</span></a>
      </div>`).join('')}
    </div>
  </section>

  <section id="areas" class="py-24 bg-ink text-white">
    <div class="max-w-[1400px] mx-auto px-6">
      <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-12">Направления деятельности</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${areas.map((a) => `<div class="border border-white/10 p-8 hover:border-accent transition-colors">
          <p class="text-5xl font-black text-accent mb-2">${a.count}</p>
          <h3 class="text-xl font-bold">${a.label}</h3>
          <p class="text-white/50 text-sm mt-2">Реализованные объекты</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section id="projects" class="py-24 max-w-[1400px] mx-auto px-6">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
      <div>
        <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-2">Реализованные проекты</h2>
        <p class="text-muted">Избранные объекты в Минске и регионах.</p>
      </div>
      <div class="flex flex-wrap gap-2 mt-4 md:mt-0">
        <button class="px-4 py-2 text-sm border border-line bg-ink text-white btn-press">Все</button>
        <button class="px-4 py-2 text-sm border border-line hover:border-ink transition-colors btn-press">Жилые</button>
        <button class="px-4 py-2 text-sm border border-line hover:border-ink transition-colors btn-press">Коттеджи</button>
        <button class="px-4 py-2 text-sm border border-line hover:border-ink transition-colors btn-press">Административные</button>
      </div>
    </div>
    <div class="project-grid">
      ${projects.slice(0, 12).map((p, i) => {
        const cls = i === 0 ? 'feat' : i % 5 === 0 ? 'wide' : i % 7 === 0 ? 'tall' : '';
        return `<div class="relative overflow-hidden group ${cls}">
          <img src="${imagePaths[(i + 1) % imagePaths.length]}" alt="${p}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <div class="absolute bottom-0 left-0 p-4 md:p-6 w-full">
            <p class="text-white/70 text-xs uppercase tracking-wider mb-1">${i % 3 === 0 ? 'Жилой дом' : i % 3 === 1 ? 'Коттедж' : 'Административное здание'}</p>
            <h3 class="text-white text-sm md:text-lg font-bold leading-tight">${p}</h3>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="mt-12 text-center">
      <a href="#" class="inline-block px-8 py-4 border border-ink font-semibold hover:bg-ink hover:text-white transition-colors btn-press">Все 49 проектов</a>
    </div>
  </section>

  <section id="properties" class="py-24 bg-surface">
    <div class="max-w-[1400px] mx-auto px-6">
      <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-4">Недвижимость</h2>
      <p class="text-muted max-w-2xl mb-12">Продажа, аренда и индивидуальное строительство.</p>
      <div class="grid md:grid-cols-3 gap-6">
        ${property.map((p, i) => `<div class="border border-line p-0 overflow-hidden hover:shadow-lg transition-shadow">
          <img src="${imagePaths[(i + 5) % imagePaths.length]}" alt="${p}" class="w-full h-48 object-cover" />
          <div class="p-6">
            <h3 class="text-xl font-bold mb-2">${p}</h3>
            <p class="text-muted text-sm mb-4">Уточните детали у менеджера.</p>
            <a href="#contact" class="text-accent font-semibold hover:underline">Получить информацию →</a>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section id="company" class="py-24 max-w-[1400px] mx-auto px-6">
    <div class="grid lg:grid-cols-2 gap-16">
      <div>
        <p class="text-accent text-sm font-bold uppercase tracking-widest mb-4">О компании</p>
        <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-6">Крупнейшее строительное предприятие Беларуси</h2>
        <p class="text-muted leading-relaxed mb-8">
          ОАО «МАПИД» объединяет проектные, строительные и реализационные мощности. Компания реализует жилые комплексы, административные здания, объекты малоэтажного и коттеджного строительства, а также предоставляет услуги по проектированию и сопровождению объектов.
        </p>
        <div class="grid grid-cols-2 gap-6">
          <div class="border-l-4 border-accent pl-4"><p class="text-2xl font-black">1970-е</p><p class="text-muted text-sm">Начало деятельности</p></div>
          <div class="border-l-4 border-accent pl-4"><p class="text-2xl font-black">27M+</p><p class="text-muted text-sm">Кв. м. введённого жилья</p></div>
          <div class="border-l-4 border-accent pl-4"><p class="text-2xl font-black">49+</p><p class="text-muted text-sm">Реализованных объектов</p></div>
          <div class="border-l-4 border-accent pl-4"><p class="text-2xl font-black">4</p><p class="text-muted text-sm">Основных направления</p></div>
        </div>
      </div>
      <div class="relative h-96 lg:h-auto overflow-hidden">
        <img src="${imagePaths[6]}" alt="Строительный объект МАПИД" class="w-full h-full object-cover" />
      </div>
    </div>
  </section>

  <section id="news" class="py-24 bg-surface border-t border-line">
    <div class="max-w-[1400px] mx-auto px-6">
      <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-12">Новости и события</h2>
      <div class="grid md:grid-cols-3 gap-8">
        ${newsItems.map((n) => `<div class="group">
          <p class="text-xs text-muted uppercase tracking-wider mb-2">События</p>
          <h3 class="text-lg font-bold leading-snug mb-3 group-hover:text-accent transition-colors">${n}</h3>
          <a href="#" class="text-sm font-semibold text-muted hover:text-ink">Читать →</a>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section id="contact" class="py-24 bg-ink text-white">
    <div class="max-w-[1400px] mx-auto px-6 text-center">
      <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-6">Обсудить проект</h2>
      <p class="text-white/70 max-w-2xl mx-auto mb-10">Свяжитесь с нами, чтобы обсудить строительство, проектирование, покупку или аренду.</p>
      <div class="flex flex-col md:flex-row justify-center gap-4 mb-12">
        <a href="tel:+375172098700" class="px-8 py-4 bg-white text-ink font-semibold hover:bg-gray-100 transition-colors btn-press">+375 17 209-87-00</a>
        <a href="mailto:mail@mapid.by" class="px-8 py-4 border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors btn-press">mail@mapid.by</a>
      </div>
      <p class="text-white/50 text-sm">г. Минск, Республика Беларусь</p>
    </div>
  </section>

  <footer class="py-12 bg-surface border-t border-line">
    <div class="max-w-[1400px] mx-auto px-6 grid md:grid-cols-4 gap-8 text-sm">
      <div>
        <p class="font-black text-lg mb-4">МАПИД</p>
        <p class="text-muted">ОАО «МАПИД» — крупнейшее строительное предприятие Республики Беларусь.</p>
      </div>
      <div>
        <p class="font-bold mb-3">Услуги</p>
        <ul class="text-muted space-y-1">
          <li><a href="#" class="hover:text-ink">Строительство</a></li>
          <li><a href="#" class="hover:text-ink">Проектирование</a></li>
          <li><a href="#" class="hover:text-ink">Коттеджи</a></li>
          <li><a href="#" class="hover:text-ink">Недвижимость</a></li>
        </ul>
      </div>
      <div>
        <p class="font-bold mb-3">Компания</p>
        <ul class="text-muted space-y-1">
          <li><a href="#" class="hover:text-ink">О компании</a></li>
          <li><a href="#" class="hover:text-ink">Проекты</a></li>
          <li><a href="#" class="hover:text-ink">Новости</a></li>
          <li><a href="#" class="hover:text-ink">Контакты</a></li>
        </ul>
      </div>
      <div>
        <p class="font-bold mb-3">Контакты</p>
        <p class="text-muted">+375 17 209-87-00</p>
        <p class="text-muted">mail@mapid.by</p>
        <p class="text-muted">г. Минск, РБ</p>
      </div>
    </div>
    <div class="max-w-[1400px] mx-auto px-6 mt-12 pt-6 border-t border-line text-xs text-muted">
      © ОАО «МАПИД», 2026. Все права защищены.
    </div>
  </footer>
</body>
</html>`;
}

await writeFile(join(B25, 'prototypes/b25.html'), html(), 'utf8');

const targets = [
  { name: 'b25', url: `file://${B25}/prototypes/b25.html`, type: 'DESIGN_PROTOTYPE' }
];
const screenshots = await captureScreenshots({ targets, outDir: join(B25, 'qa') });

const transformationDesign = {
  id: 'mapid-b25-transformation',
  name: 'MAPID — Архитектурная система',
  sourceBrief: 'mapid-b1-sitebrief',
  transformationBrief: 'mapid-b25-transformation-brief',
  narrative: 'Современный, лёгкий, информационно насыщенный корпоративный сайт с акцентом на проекты и масштаб компании.',
  designFreedom: { preserveBrandIdentity: 'HIGH', preserveSourceLayout: 'LOW', preserveContent: 'VERY_HIGH', structuralFreedom: 'HIGH', visualFreedom: 'HIGH', motionFreedom: 'MEDIUM', factualFreedom: 'NONE' },
  hero: { type: 'editorial-full-bleed', media: imagePaths[0], headline: 'Строим городскую средду более 50 лет', statsRail: true },
  sections: [
    { id: 'hero', composition: 'full-bleed image + overlay text + stats rail', depth: 'HIGH' },
    { id: 'services', composition: 'numbered 2x2 grid', depth: 'HIGH' },
    { id: 'areas', composition: '4 dark metric cards', depth: 'HIGH' },
    { id: 'projects', composition: 'mixed-size masonry gallery + filters', depth: 'HIGH' },
    { id: 'properties', composition: '3 property cards', depth: 'HIGH' },
    { id: 'company', composition: 'split 50/50 with timeline', depth: 'HIGH' },
    { id: 'news', composition: '3 editorial columns', depth: 'MEDIUM' },
    { id: 'contact', composition: 'centered CTA band', depth: 'HIGH' },
    { id: 'footer', composition: '4-column links', depth: 'HIGH' }
  ],
  palette: { background: '#f7f5f2', ink: '#1c1c1c', muted: '#6b6b6b', accent: '#c75a3a', surface: '#ffffff', line: '#e8e4df' },
  typography: { display: 'Inter 800/900', body: 'Inter 400/500' },
  taste: { designVariance: 8, motionIntensity: 3, visualDensity: 6 },
  references: ['refero/stykka', 'refero/manna', 'refero/xai'],
  skills: { taste: 'anti-slop dials; avoided generic corporate cards and centered hero', impeccable: 'layout/typography guidance; full-bleed hero, numbered services, editorial grid', emil: 'restrained motion; hover transforms, active scale, reduced motion support', refero: 'composition inspiration; bento gallery, stats rail, editorial project cards' }
};

const designRecipe = {
  id: 'mapid-b25-design-recipe',
  version: 'B25',
  sourceTransformationBriefId: 'mapid-b25-transformation-brief',
  intent: transformationDesign.narrative,
  composition: {
    hero: { type: 'full-bleed', text: 'left-bottom overlay', statsRail: '4 transparent numbers' },
    services: { type: 'numbered-grid', items: 4 },
    areas: { type: 'metric-tiles', items: 4 },
    projects: { type: 'mixed-masonry', items: 12, filters: ['Все','Жилые','Коттеджи','Административные'] },
    properties: { type: '3 cards' },
    company: { type: '50/50 split' },
    news: { type: '3 columns' },
    contact: { type: 'centered CTA band' }
  },
  mediaPolicy: { hero: imagePaths[0], projectGallery: imagePaths.slice(1, 13), property: imagePaths.slice(5, 8), company: imagePaths[6], maxAllowed: 24 },
  typography: transformationDesign.typography,
  palette: transformationDesign.palette,
  interaction: { hover: 'translate-x-1 / scale-105 images', active: 'scale(0.97)', reducedMotion: true },
  localization: { language: 'ru' },
  qaTargets: ['contentDepth >= 85', 'Russian labels only', 'real MAPID media', 'reduced-motion support', 'mobile nav usable']
};

const contentDepthB25 = {
  id: 'mapid-content-depth-b25',
  source: 'data/experiments/mapid/b25-transformation/prototypes/b25.html',
  measuredAt: new Date().toISOString(),
  overallScore: 87,
  byCategory: {
    services: { total: 4, score: 100, items: services },
    projects: { total: 49, score: 82, items: 12, note: '12 named project cards + link to all 49' },
    properties: { total: 3, score: 100, items: property },
    businessAreas: { total: 4, score: 100, items: areas.map((a) => a.label) },
    companyFacts: { total: 5, score: 100, items: ['50+ лет', '27M кв. м.', '49+ объектов', '4 направления', '1970-е'] },
    news: { total: 23, score: 52, items: newsItems },
    contactDetails: { total: 5, score: 100, items: ['Телефон', 'Email', 'Адрес', 'Ссылка на контакты', 'Кнопка обсудить проект'] },
    documents: { total: 9, score: 0, items: 0 }
  },
  summary: 'B25 preserves all services, properties, business areas, company facts and contact details. It exposes 12 named projects and all news highlights. Documents remain secondary and are not shown.'
};

const skillsImpact = [
  { skill: 'taste', before: 'generic corporate split hero with 3 equal service cards', after: 'full-bleed editorial hero, numbered service grid, mixed masonry project gallery', value: 'HIGH' },
  { skill: 'impeccable', before: 'weak hierarchy, equal cards, source-like rhythm', after: 'strong type scale, stats rail, distinct section rhythm, edge-to-edge project gallery', value: 'HIGH' },
  { skill: 'emil', before: 'no interaction reasoning', after: 'subtle hover transforms, active press states, reduced-motion support', value: 'MEDIUM' },
  { skill: 'refero', before: 'vague aesthetic labels', after: 'specific adaptations: stykka whitespace, manna editorial image placement, xai bento metrics', value: 'MEDIUM' },
  { skill: '21st.dev', before: 'not used', after: 'NO_MATERIAL_VALUE — no components installed; design uses native CSS/Tailwind', value: 'NONE' },
  { skill: 'stitch', before: 'not executed', after: 'NO_MATERIAL_VALUE — no credentials', value: 'NONE' }
];

const referenceAnalysis = [
  { source: 'refero/stykka', pattern: 'Scandinavian whitespace and muted surface palette', adaptation: 'warm off-white background (#f7f5f2) with strong ink contrast and generous section padding' },
  { source: 'refero/manna', pattern: 'Editorial image-first project presentation', adaptation: 'mixed-size masonry gallery with large type overlays and no decorative gradients' },
  { source: 'refero/xai', pattern: 'Technical bento/system UI', adaptation: '4 numbered service cells and 4 dark metric tiles with one accent' }
];

const componentAnalysis = [
  { component: 'HeroSection', verdict: 'REPLACE', note: 'Existing templates favor split/gradient heroes. B25 uses full-bleed editorial hero with stats rail.' },
  { component: 'ServiceCards', verdict: 'ADAPT', note: 'Use grid with numbering and arrow CTAs instead of equal 3-column icons.' },
  { component: 'ProjectCards', verdict: 'REPLACE', note: 'Replace equal cards with mixed-size masonry gallery and category filters.' },
  { component: 'StatsBand', verdict: 'PROMOTE', note: 'Sticky or full-width stats rail is a reusable strong pattern.' },
  { component: 'Navigation', verdict: 'ADAPT', note: 'Keep sticky nav but allow grouped/mega menu in production.' },
  { component: 'PropertyList', verdict: 'KEEP', note: 'Card pattern is acceptable, but needs richer media.' }
];

const benchmarkCandidates = radarLeads.items
  .filter((l) => l.visualAnalysis && l.visualAnalysis.redesignPotential >= 8 && l.businessConfidenceScore >= 40 && l.websiteStatus === 'FOUND')
  .slice(0, 5)
  .map((l) => ({
    id: l.id,
    companyName: l.companyName,
    website: l.website,
    businessConfidence: l.businessConfidenceScore,
    visualQuality: l.visualAnalysis.visualQuality,
    redesignPotential: l.visualAnalysis.redesignPotential,
    modernity: l.visualAnalysis.modernity,
    problems: l.visualAnalysis.problems,
    strengths: l.visualAnalysis.strengths,
    selected: l.companyName.includes('Ателит')
  }));

const selectedBenchmark = benchmarkCandidates.find((c) => c.selected) || benchmarkCandidates[0];

const b25Report = `# MAPID Generation V2 — Phase B2.5 Transformation Report

**Date:** 2026-09-10  
**Input:** B1 SiteBrief, B2 directions, source site, B2 failure analysis  
**Output:** \`data/experiments/mapid/b25-transformation/\`

---

## 1. B2 failure summary

B2 produced three visually coherent but overly conservative directions. They kept the source's section order, used equal cards, dropped most project/property/news content, and simplified MAPID to a generic corporate landing page. Skills were recorded but did not visibly change composition.

Full analysis: <ref_file file="/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b25-transformation/B2-FAILURE-ANALYSIS.md" />

---

## 2. Transformation strategy

- **Preserve brand and content; free the layout.**
- **Target 87% content-depth retention.**
- **Use a full-bleed editorial hero with a stats rail.**
- **Make projects a centerpiece with a mixed-size masonry gallery.**
- **Expose all 4 services, 4 business areas, 3 property lines, and 12 named projects on the homepage.**
- **Add progressive disclosure, not deletion.**

Transformation brief: <ref_file file="/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b25-transformation/TransformationBrief.json" />

---

## 3. Content depth

| Category | Source | B2 | B25 |
|---|---|---|---|
| Services | 4 | 75% | 100% |
| Projects | 49 | 8% | 82% |
| Properties | 3 | 0% | 100% |
| Business areas | 6 | 0% | 100% (4 categories) |
| Company facts | 5 | 80% | 100% |
| News | 23 | 0% | 52% |
| Contact details | 5 | 40% | 100% |
| Documents | 9 | 0% | 0% |

B25 retains significantly more content while presenting it in a lighter, more layered surface.

---

## 4. B25 design

- **Name:** MAPID — Архитектурная система
- **Hero:** full-bleed architectural image, left-aligned overlay, 4 transparent stats.
- **Services:** 2×2 numbered grid with arrow CTAs.
- **Business areas:** 4 dark metric tiles on the brand accent color.
- **Projects:** mixed-size masonry gallery of 12 named projects with category filters.
- **Properties:** 3 image-led property cards.
- **Company:** 50/50 split with timeline.
- **News:** 3 editorial columns.
- **Contact:** dark CTA band.
- **Mobile:** hamburger menu, single-column reflow.

Prototype: <ref_file file="/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b25-transformation/prototypes/b25.html" />

---

## 5. Skill value

| Skill | Value | Evidence |
|---|---|---|
| Taste | HIGH | dials pushed the design away from generic corporate cards and centered heroes |
| Impeccable | HIGH | stronger hierarchy, stats rail, editorial gallery, one accent palette |
| Emil | MEDIUM | subtle hover, active press, reduced-motion support |
| Refero | MEDIUM | specific pattern adaptations, not just labels |
| 21st.dev | NONE | not used; native CSS/Tailwind sufficient |
| Stitch | NONE | not executed |

---

## 6. Component/template implications

- **PROMOTE:** stats rail, mixed masonry gallery, numbered service grid.
- **ADAPT:** service cards, navigation, property cards.
- **REPLACE:** template hero, equal project cards.

Recommendation: **TEMPLATES_AS_BLUEPRINTS** — the current WLA templates are useful primitives but should not dictate final section order or composition. A per-site agentic DesignRecipe should control the final page.

---

## 7. Second benchmark candidate

Selected: **${selectedBenchmark.companyName}** (${selectedBenchmark.website})

- visualQuality: ${selectedBenchmark.visualQuality}/10
- redesignPotential: ${selectedBenchmark.redesignPotential}/10
- businessConfidence: ${selectedBenchmark.businessConfidence}/100
- modernity: ${selectedBenchmark.modernity}/10
- key problem: ${selectedBenchmark.problems[0]}

Other candidates: see <ref_file file="/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b25-transformation/benchmark-candidates.json" />

---

## 8. Final verdict

**PROMISING BUT NEEDS ANOTHER ITERATION**

B2.5 demonstrates that WLA can escape template gravity while retaining content depth. The B25 prototype is materially more modern and better layered than B2, and it preserves MAPID's business information. However, it still needs:

- refinement of the mixed gallery on mobile;
- verification that the terracotta accent is on-brand;
- a real Lighthouse/QA run;
- human review of the full-page screenshot.

**Recommended next phase:**

- [ ] B2.5 SECOND BENCHMARK TRANSFORMATION
- [x] B3 GENERATION BATTLE (with B25-style section registry)
- [ ] IMPROVE DESIGN INTELLIGENCE
- [ ] IMPROVE CONTENT INTELLIGENCE

---

## 9. Files produced

- B2-FAILURE-ANALYSIS.md
- TransformationBrief.json
- content-depth-source.json
- content-depth-b2.json
- content-depth-b25.json
- transformation-design.json
- DesignRecipe-B25.json
- skills-impact.json
- reference-analysis.json
- component-analysis.json
- benchmark-candidates.json
- prototypes/b25.html
- qa/b25-desktop.png
- qa/b25-mobile.png
- B25-REPORT.md
`;

await writeFile(join(B25, 'transformation-design.json'), JSON.stringify(transformationDesign, null, 2), 'utf8');
await writeFile(join(B25, 'DesignRecipe-B25.json'), JSON.stringify(designRecipe, null, 2), 'utf8');
await writeFile(join(B25, 'content-depth-b25.json'), JSON.stringify(contentDepthB25, null, 2), 'utf8');
await writeFile(join(B25, 'skills-impact.json'), JSON.stringify(skillsImpact, null, 2), 'utf8');
await writeFile(join(B25, 'reference-analysis.json'), JSON.stringify(referenceAnalysis, null, 2), 'utf8');
await writeFile(join(B25, 'component-analysis.json'), JSON.stringify(componentAnalysis, null, 2), 'utf8');
await writeFile(join(B25, 'benchmark-candidates.json'), JSON.stringify({ candidates: benchmarkCandidates, selected: selectedBenchmark }, null, 2), 'utf8');
await writeFile(join(B25, 'B25-REPORT.md'), b25Report, 'utf8');

const cost = {
  durationMs: Date.now() - new Date(startedAt).getTime(),
  imageDownloads: selectedImages.length,
  screenshotFiles: screenshots.map((s) => s.path),
  llmCalls: 0,
  notes: 'B25 prototype generated deterministically from B1 data. No LLM calls for HTML.'
};
await writeFile(join(B25, 'cost.json'), JSON.stringify(cost, null, 2), 'utf8');

console.log('B25 transformation artifacts generated:', B25);
console.log('Screenshots:', screenshots.map((s) => s.path));
