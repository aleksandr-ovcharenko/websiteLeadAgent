import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAllowedUrl } from '@minsk/security';
import { captureScreenshots, createArtifactRef, hashFile, ArtifactType } from '../packages/redesign-engine/experiments/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const B1 = join(ROOT, 'data/experiments/mapid/b1-intelligence');
const B2 = join(ROOT, 'data/experiments/mapid/b2-design');

const siteBrief = JSON.parse(await readFile(join(B1, 'SiteBrief.json'), 'utf8'));
const media = JSON.parse(await readFile(join(B1, 'media-intelligence.json'), 'utf8'));
const competitors = JSON.parse(await readFile(join(B1, 'competitor-intelligence.json'), 'utf8'));

const startedAt = new Date().toISOString();

async function downloadMedia(url, name) {
  try {
    await assertAllowedUrl(url);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = join(B2, 'images', name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return { url, name, path };
  } catch (err) {
    console.warn('Download failed:', url, err.message);
    return { url, name, path: url }; // fallback to external URL
  }
}

await mkdir(B2, { recursive: true });
await mkdir(join(B2, 'images'), { recursive: true });
await mkdir(join(B2, 'prototypes'), { recursive: true });

const preferredHero = media.heroCandidates.slice(0, 6);
const heroImages = [];
for (let i = 0; i < preferredHero.length; i++) {
  const h = preferredHero[i];
  const safe = h.url.split('/').pop().replace(/[^a-zA-Z0-9_.-]/g, '_');
  heroImages.push(await downloadMedia(h.url, `${i}-${safe}`));
}

const designBrief = {
  id: 'mapid-b2-design-brief',
  sourceSnapshotId: 'mapid-benchmark-1788986461195',
  sourceSiteBriefId: 'mapid-b1-sitebrief',
  business: {
    identity: siteBrief.business.name.value,
    industry: siteBrief.business.industry.value,
    positioning: siteBrief.business.subtype.value,
    geography: siteBrief.business.geography.value,
  },
  audiences: siteBrief.audiences.map((a) => a.type),
  goals: {
    primary: 'Предоставить информацию об услугах, проектах и недвижимости MAPID',
    secondary: ['Продемонстрировать реализованные проекты', 'Организовать контакт с клиентами', 'Укрепить доверие к масштабу компании'],
  },
  trust: {
    strongestSignals: [
      'Более 50 лет на рынке',
      'Более 25 млн кв. м. жилья',
      'Крупнейшее строительное предприятие Беларуси',
    ],
  },
  content: {
    availableSections: ['hero', 'services', 'projects', 'trust', 'news', 'contacts'],
    projectStrength: 'Высокая: 49+ проектов с идентификаторами и фотографиями',
    serviceStrength: 'Чёткая: строительство, проектирование, прочие услуги, коттеджи',
    propertyContent: 'Реализация квартир, аренда помещений, строительство коттеджей',
    newsImportance: 'Низкая-средняя: пресс-релизы и события',
  },
  media: {
    preferredHeroCandidates: preferredHero.map((h) => h.url),
    projectMedia: media.heroCandidates.filter((h) => h.semanticType === 'PROJECT_PHOTO' || h.semanticType === 'BUILDING').slice(0, 12).map((h) => h.url),
    rejectedMedia: ['QR-коды', 'социальные иконки', 'footer-логотипы', 'маленькие utility-изображения'],
  },
  language: {
    primary: 'ru',
  },
  industryIntelligence: {
    norms: competitors.intelligence.industryPatterns,
    overused: ['общие цифры без контекста', 'многослойные хедеры с дублированием', 'премиальный синий без обоснования'],
    opportunities: competitors.intelligence.opportunities,
    avoid: competitors.intelligence.avoid,
  },
  constraints: {
    noInventedFacts: true,
    cmsCompatible: true,
    responsiveRequired: true,
    accessibilityRequired: true,
  },
};

const wlaInventory = {
  usefulPatterns: [
    'construction-modern-v1 переключает пресеты ?style= без изменения контента',
    'CMS-шаблоны уже держат home, services, projects, news, contacts',
    'StylePreset-архитектура позволяет разделять токены и варианты компонентов',
  ],
  overusedPatterns: [
    'героический градиент с поверх text-white',
    'одинаковые трёхколоночные карточки услуг',
    'крупный штрихованный текст как единственный акцент',
    'пресет, который меняет только цвет и радиус',
  ],
  knownLimitations: [
    'App.tsx ~2000 строк; варианты компоновки нельзя выразить одним CSS',
    'hero и CTA жёстко закодированы на светлом/тёмном контрасте',
    'шаблон предполагает страховой/landing-UX, а не корпоративное портфолио',
  ],
  sectionsWorthRetaining: ['hero', 'services', 'projects', 'contacts'],
  sectionsTemplateBound: ['projects', 'news'],
};

const industryDesignIntelligence = {
  expected: [
    'упор на масштаб, опыт и доверие',
    'структурированная навигация по услугам и проектам',
    'архитектурная фотография и видео',
  ],
  overused: [
    'корпоративный синий + белый',
    'генерик-landings с тремя пиктограммами',
    'счётчики вида 0-0-0-0',
  ],
  opportunities: [
    'чёткое разделение услуг/проектов/недвижимости',
    'проектная галерея с контекстом, а не только названием',
    'многоуровневое повествование об опыте компании',
  ],
  avoid: [
    'SaaS-паттерны, неуместные для строительства',
    'переходы и задержки, замедляющие поиск информации',
    'стоковые изображения без реальных объектов MAPID',
  ],
  differentiation: [
    'история + масштаб + доказанные проекты',
    'русскоязычный, но современный тон',
  ],
};

const skillProvenance = [
  { skill: 'taste-skill/taste-skill', source: 'Leonxlnx/taste-skill', stage: 'DESIGN', reason: 'set DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY dials' },
  { skill: 'impeccable', source: 'pbakaus/impeccable', stage: 'DESIGN', reason: 'shape/critique/playbooks for layout, typeset, layout critique; engine binary not executed in B2' },
  { skill: 'emil-design-eng', source: 'emilkowalski/skills', stage: 'DESIGN', reason: 'restrained motion, ease-out, active states, no scale(0)' },
  { skill: 'refero', source: 'WLA design-reference/refero', stage: 'DESIGN', reason: 'composition and typography inspiration' },
  { skill: 'wla', source: 'packages/templates', stage: 'DESIGN', reason: 'existing construction templates and StylePreset knowledge' },
];

const referoUsage = [
  { id: 'stykka', usedFor: 'A — Engineering Authority', influence: 'Scandinavian restraint, whitespace, clear hierarchy' },
  { id: 'manna', usedFor: 'B — Architectural Editorial', influence: 'editorial monograph, sharp typography, image-first composition' },
  { id: 'xai', usedFor: 'C — Modern Infrastructure', influence: 'clean technical lab, pill buttons, systematic grid' },
];

const stitchEvaluation = {
  accessMethod: 'Stitch SDK / MCP / web UI — not available in this environment',
  pricing: 'Free during Google Labs; 350 standard + 200 pro generations/month',
  capabilities: ['text-to-UI', 'sketch-to-design', 'HTML/CSS/Tailwind/React export', 'Figma one-click export', 'design system markdown (DESIGN.md)'],
  outputCapabilities: 'HTML/CSS, React, Tailwind, Figma, DESIGN.md',
  automation: 'MCP server and SDK exist; require Google credentials',
  terms: 'Google Labs experiment, no commercial permanence guarantee',
  attempted: false,
  reason: 'No Google credentials or project configured in this environment',
  verdict: 'EXPERIMENTAL',
  notes: 'Documented as strong for rapid ideation, generic by default, weak accessibility. A future B3 can run with credentials.',
};

const commonHead = (title) => `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .btn-press:active { transform: scale(0.97); }
  </style>
</head>
<body class="bg-white text-slate-900">
`;

function navHtml(active = '') {
  const links = [
    { label: 'Главная', href: '#hero' },
    { label: 'Проекты', href: '#projects' },
    { label: 'Услуги', href: '#services' },
    { label: 'О компании', href: '#about' },
    { label: 'Контакты', href: '#contacts' },
  ];
  return `
  <nav class="w-full border-b bg-white/95 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <a href="#" class="font-bold text-lg tracking-tight">МАПИД</a>
      <div class="hidden md:flex gap-8 text-sm">
        ${links.map((l) => `<a class="hover:text-slate-500 transition-colors${active === l.label ? ' font-semibold' : ''}" href="${l.href}">${l.label}</a>`).join('')}
      </div>
      <a href="#contacts" class="text-sm px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-700 transition-colors btn-press">Связаться</a>
    </div>
  </nav>
  `;
}

const ctaSection = `
  <section id="contacts" class="py-20 bg-slate-50">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <h2 class="text-2xl md:text-3xl font-semibold mb-4">Обсудить проект</h2>
      <p class="text-slate-600 mb-8 max-w-xl mx-auto">Оставьте заявку — специалист свяжется и проконсультирует по услугам MAPID.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="tel:+375172098700" class="px-6 py-3 bg-slate-900 text-white rounded hover:bg-slate-700 transition-colors btn-press font-medium">Позвонить</a>
        <a href="mailto:mail@mapid.by" class="px-6 py-3 border border-slate-300 rounded hover:border-slate-500 transition-colors btn-press font-medium">Написать</a>
      </div>
    </div>
  </section>
  <footer class="py-8 text-center text-sm text-slate-500 border-t">
    © ОАО «МАПИД», 2026. Все права защищены.
  </footer>
`;

// Direction A — Engineering Authority
const dirA = {
  id: 'A',
  name: 'Инженерное доверие',
  businessRationale: 'Крупнейшему строителю нужна не демонстрация, а уверенность. Цифры, опыт, доказанный масштаб — без трендовых украшений.',
  audienceFit: 'Заказчики B2B, девелоперы, частные инвесторы',
  narrative: '50+ лет. 27 млн кв. м. Полный цикл от проектирования до сдачи.',
  informationArchitecture: 'hero → статистика → услуги → проекты → доверие → контакты',
  hero: {
    intent: 'Сразу дать масштаб и пригласить к диалогу',
    structure: 'left-right split: headline + 2 CTAs / full-height building image',
    copyBehavior: 'headline + подзаголовок + цифры в строке',
    mediaBehavior: 'одно архитектурное фото, desaturated, никаких QR',
    primaryCTA: 'Смотреть проекты',
    secondaryCTA: 'Связаться',
  },
  navigation: { style: 'horizontal top, minimal', behavior: 'fixed, transparent to white' },
  sections: [
    { type: 'hero', purpose: 'впечатление масштаба', composition: '50/50 split', priority: 1 },
    { type: 'stats', purpose: 'доказательства', composition: '4 метрики в ряд', priority: 2 },
    { type: 'services', purpose: 'запомнить услуги', composition: '3 списка + иконки', priority: 3 },
    { type: 'projects', purpose: 'портфолио', composition: 'сетка 4×n, фото + район', priority: 4 },
    { type: 'about', purpose: 'доверие', composition: 'текст + история', priority: 5 },
    { type: 'contacts', purpose: 'конверсия', composition: 'центрированный CTA', priority: 6 },
  ],
  typography: { display: 'Inter, bold, tight tracking', body: 'Inter, 16/24' },
  colorSystem: { mode: 'light', roles: { canvas: 'white', ink: 'slate-900', accent: 'emerald-700', muted: 'slate-500' } },
  spacingSystem: 'loose vertical rhythm, 80-100px section padding',
  imageTreatment: 'desaturated architectural photography, no heavy overlays',
  trustPresentation: 'facts: years, sqm, projects, staff; source-grounded only',
  projectPresentation: 'grid of real project photos with names and city',
  servicesPresentation: 'three clear categories with concise descriptions',
  aboutPresentation: 'one large paragraph and a timeline-like stat row',
  contactPresentation: 'phone + email + form CTA',
  motion: { level: 'very low', specifics: 'only CSS :active scale, no scroll animations' },
  taste: { designVariance: 4, motionIntensity: 2, visualDensity: 5 },
  references: ['refero/stykka'],
  skillsUsed: ['taste-skill', 'impeccable', 'emil-design-eng'],
  risks: ['может показаться консервативным', 'требует сильных фотографий'],
  whyItIsDifferent: 'опирается на факты и масштаб, а не на трендовые приёмы',
};

function htmlA() {
  const img = heroImages[0]?.path || heroImages[0]?.url;
  return `${commonHead('МАПИД — Инженерное доверие')}
${navHtml('Главная')}
  <section id="hero" class="min-h-[80dvh] flex flex-col md:flex-row items-stretch">
    <div class="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-20 py-16 bg-white">
      <p class="text-emerald-700 font-semibold mb-4">ОАО «МАПИД»</p>
      <h1 class="text-4xl md:text-6xl font-bold tracking-tight leading-none mb-6">Более 50 лет строим качественное жильё</h1>
      <p class="text-lg text-slate-600 max-w-md mb-8">Современный комплекс строительных услуг: проектирование, возведение, реализация. Более 25 млн кв. м. введённого жилья.</p>
      <div class="flex flex-wrap gap-4 mb-10">
        <a href="#projects" class="px-6 py-3 bg-emerald-700 text-white rounded hover:bg-emerald-800 transition-colors btn-press font-medium">Смотреть проекты</a>
        <a href="#contacts" class="px-6 py-3 border border-slate-300 rounded hover:border-slate-500 transition-colors btn-press font-medium">Связаться</a>
      </div>
      <div class="grid grid-cols-4 gap-6 text-sm border-t pt-6">
        <div><p class="text-2xl font-bold">50+</p><p class="text-slate-500">лет опыта</p></div>
        <div><p class="text-2xl font-bold">27M</p><p class="text-slate-500">кв. м. жилья</p></div>
        <div><p class="text-2xl font-bold">49+</p><p class="text-slate-500">проектов</p></div>
        <div><p class="text-2xl font-bold">4</p><p class="text-slate-500">направления</p></div>
      </div>
    </div>
    <div class="flex-1 min-h-[50dvh] md:min-h-0 bg-slate-100">
      <img src="${img}" alt="Реализованный проект MAPID" class="w-full h-full object-cover" />
    </div>
  </section>
  <section id="services" class="py-20 bg-white max-w-7xl mx-auto px-6">
    <h2 class="text-3xl font-bold mb-12">Услуги</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div><h3 class="text-xl font-semibold mb-2">Строительство</h3><p class="text-slate-600">Возведение жилых, общественных и промышленных объектов под ключ.</p></div>
      <div><h3 class="text-xl font-semibold mb-2">Проектирование</h3><p class="text-slate-600">Проектная документация и инженерный сопровождение.</p></div>
      <div><h3 class="text-xl font-semibold mb-2">Коттеджи</h3><p class="text-slate-600">Строительство загородных домов и малоэтажных решений.</p></div>
    </div>
  </section>
  <section id="projects" class="py-20 bg-slate-50">
    <div class="max-w-7xl mx-auto px-6">
      <h2 class="text-3xl font-bold mb-12">Реализованные проекты</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${[0, 1, 2, 3].map((i) => `<div class="bg-white rounded overflow-hidden"><img src="${heroImages[i]?.path || heroImages[i]?.url}" alt="Проект" class="w-full h-40 object-cover" /><div class="p-4"><h4 class="font-semibold">Жилой объект</h4><p class="text-sm text-slate-500">г. Минск</p></div></div>`).join('')}
      </div>
    </div>
  </section>
${ctaSection}
</body>
</html>`;
}

// Direction B — Architectural Editorial
const dirB = {
  id: 'B',
  name: 'Архитектурная хроника',
  businessRationale: 'MAPID строит городскую среду. Дизайн должен читаться как журнал: проекты рассказывают истории, а цифры — комментарии.',
  audienceFit: 'Покупатели недвижимости, городские журналисты, инвесторы',
  narrative: 'Каждый объект — это часть городской истории. Смотрите, как меняется Минск и область.',
  informationArchitecture: 'hero → выбранный проект → сетка кейсов → услуги → о компании → контакты',
  hero: {
    intent: 'Захватить внимание крупным изображением и редакторским заголовком',
    structure: 'full-bleed image, overlay headline, bottom CTA bar',
    copyBehavior: 'short headline, large display, minimal CTA',
    mediaBehavior: 'full-width architectural photo, no gradient masks',
    primaryCTA: 'Открыть галерею проектов',
    secondaryCTA: 'Узнать об услугах',
  },
  navigation: { style: 'minimal, transparent over hero, white on scroll', behavior: 'fades in on scroll' },
  sections: [
    { type: 'hero', purpose: 'эмоциональный взлёт', composition: 'full-bleed image + overlay text', priority: 1 },
    { type: 'featured-project', purpose: 'глубина повествования', composition: 'split 60/40', priority: 2 },
    { type: 'project-grid', purpose: 'навигация по объектам', composition: 'masonry / 3-column', priority: 3 },
    { type: 'services', purpose: 'контекст услуг', composition: '2-column list', priority: 4 },
    { type: 'about', purpose: 'доверие', composition: 'wide text block', priority: 5 },
    { type: 'contacts', purpose: 'конверсия', composition: 'inline CTA', priority: 6 },
  ],
  typography: { display: 'Inter, extra-bold, negative tracking', body: 'Inter, 17/28' },
  colorSystem: { mode: 'light', roles: { canvas: 'stone-50', ink: 'zinc-900', accent: 'orange-700', muted: 'stone-500' } },
  spacingSystem: 'asymmetric, big top/bottom, tight between tiles',
  imageTreatment: 'full-bleed architecture, subtle warm tint, generous crops',
  trustPresentation: 'опыт через выдержки из проектов, а не счётчики',
  projectPresentation: 'крупные карточки с районом, годом, статусом (если известен)',
  servicesPresentation: 'встроены в историю проекта, список без иконок',
  aboutPresentation: 'колонка текста + портрет архитектуры',
  contactPresentation: 'CTA в подвале с прямым телефоном',
  motion: { level: 'low', specifics: 'lazy image fade, no scroll-jack' },
  taste: { designVariance: 8, motionIntensity: 3, visualDensity: 3 },
  references: ['refero/manna'],
  skillsUsed: ['taste-skill', 'impeccable', 'emil-design-eng'],
  risks: ['требует много качественных фото', 'может уронить производительность больших изображений'],
  whyItIsDifferent: 'журнальная композиция с проектом-героем, а не равномерная сетка',
};

function htmlB() {
  const img = heroImages[1]?.path || heroImages[1]?.url;
  return `${commonHead('МАПИД — Архитектурная хроника')}
${navHtml('Главная')}
  <section id="hero" class="relative h-[92dvh] w-full overflow-hidden">
    <img src="${img}" alt="Архитектурный проект MAPID" class="absolute inset-0 w-full h-full object-cover" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
    <div class="absolute bottom-0 left-0 w-full p-6 md:p-16 text-white">
      <p class="uppercase tracking-widest text-sm mb-4">Реализованные объекты</p>
      <h1 class="text-4xl md:text-7xl font-extrabold tracking-tight leading-none max-w-3xl mb-6">Мы строим городскую среду</h1>
      <div class="flex gap-4">
        <a href="#projects" class="px-6 py-3 bg-white text-zinc-900 rounded hover:bg-zinc-200 transition-colors btn-press font-medium">Открыть галерею</a>
        <a href="#services" class="px-6 py-3 border border-white/50 text-white rounded hover:bg-white/10 transition-colors btn-press font-medium">Услуги</a>
      </div>
    </div>
  </section>
  <section id="projects" class="py-20 bg-stone-50">
    <div class="max-w-7xl mx-auto px-6">
      <h2 class="text-3xl font-bold mb-4">Избранные проекты</h2>
      <p class="text-stone-600 mb-12 max-w-2xl">Каждый объект — это результат работы проектировщиков, инженеров и строителей.</p>
      <div class="grid md:grid-cols-3 gap-6">
        ${[1, 2, 3].map((i) => `<div class="bg-white p-0"><img src="${heroImages[i]?.path || heroImages[i]?.url}" alt="Проект" class="w-full h-52 object-cover mb-4" /><div class="p-4"><h3 class="text-lg font-bold mb-1">Жилой объект MAPID</h3><p class="text-sm text-stone-500">г. Минск</p></div></div>`).join('')}
      </div>
    </div>
  </section>
  <section id="services" class="py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16">
      <div>
        <h2 class="text-3xl font-bold mb-6">Что мы делаем</h2>
        <ul class="space-y-4 text-stone-700">
          <li><strong>Строительство</strong> — жилые, общественные и промышленные объекты.</li>
          <li><strong>Проектирование</strong> — комплексная документация.</li>
          <li><strong>Коттеджи</strong> — малоэтажное строительство под ключ.</li>
          <li><strong>Недвижимость</strong> — продажа и аренда.</li>
        </ul>
      </div>
      <div>
        <img src="${heroImages[4]?.path || heroImages[4]?.url}" alt="Строительный процесс" class="w-full h-80 object-cover rounded" />
      </div>
    </div>
  </section>
${ctaSection}
</body>
</html>`;
}

// Direction C — Modern Infrastructure
const dirC = {
  id: 'C',
  name: 'Современная инфраструктура',
  businessRationale: 'MAPID — это инженерный холдинг с дочерними подразделениями. Дизайн показывает систему, технологичность и масштаб.',
  audienceFit: 'B2B-партнёры, инвесторы, заказчики технических услуг',
  narrative: 'Полный цикл. Точные данные. Расширяемая структура.',
  informationArchitecture: 'hero → направления (bento) → метрики → проекты → технологии → контакты',
  hero: {
    intent: 'Показать MAPID как технологичную систему',
    structure: 'centered hero with bento grid of business units below',
    copyBehavior: 'короткий заголовок + акцент на полный цикл',
    mediaBehavior: 'минимальный hero, акцент на типографику и сетку',
    primaryCTA: 'Выбрать направление',
    secondaryCTA: 'Контакты',
  },
  navigation: { style: 'sharp top bar with logo and text links', behavior: 'static, high contrast' },
  sections: [
    { type: 'hero', purpose: 'позиционирование', composition: 'centered text over light canvas', priority: 1 },
    { type: 'bento', purpose: 'структура бизнеса', composition: '3×2 grid', priority: 2 },
    { type: 'stats', purpose: 'масштаб', composition: 'wide metric bar', priority: 3 },
    { type: 'projects', purpose: 'портфолио', composition: 'horizontal scroll', priority: 4 },
    { type: 'services', purpose: 'услуги', composition: 'technical list', priority: 5 },
    { type: 'contacts', purpose: 'конверсия', composition: 'form CTA', priority: 6 },
  ],
  typography: { display: 'Inter, bold, uppercase tracking', body: 'Inter, 15/22' },
  colorSystem: { mode: 'light', roles: { canvas: 'zinc-50', ink: 'zinc-950', accent: 'blue-700', muted: 'zinc-500' } },
  spacingSystem: 'tight, grid-governed, 64-80px section padding',
  imageTreatment: 'cool, slightly desaturated, cropped to grid',
  trustPresentation: 'метрики в сетке, чёткие цифры',
  projectPresentation: 'горизонтальная лента объектов',
  servicesPresentation: 'bento-карточки направлений',
  aboutPresentation: 'один абзац + bento-структура',
  contactPresentation: 'формат обращения',
  motion: { level: 'low', specifics: 'hover transitions 150ms, no springs' },
  taste: { designVariance: 6, motionIntensity: 3, visualDensity: 6 },
  references: ['refero/xai'],
  skillsUsed: ['taste-skill', 'impeccable', 'emil-design-eng'],
  risks: ['может показаться холодным', 'требует хорошего мобильного перестроения'],
  whyItIsDifferent: 'системный bento-UX вместо классического hero-карусели',
};

function htmlC() {
  const img = heroImages[2]?.path || heroImages[2]?.url;
  return `${commonHead('МАПИД — Современная инфраструктура')}
${navHtml('Главная')}
  <section id="hero" class="py-24 bg-zinc-50 text-center">
    <div class="max-w-4xl mx-auto px-6">
      <p class="text-blue-700 font-semibold mb-4 uppercase tracking-wider text-sm">ОАО «МАПИД»</p>
      <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6">Полный цикл инфраструктуры для жизни</h1>
      <p class="text-lg text-zinc-600 max-w-2xl mx-auto mb-10">Проектирование, строительство, реализация и управление недвижимостью — одна система под одним брендом.</p>
      <div class="flex justify-center gap-4">
        <a href="#directions" class="px-6 py-3 bg-zinc-900 text-white rounded hover:bg-zinc-700 transition-colors btn-press font-medium">Выбрать направление</a>
        <a href="#contacts" class="px-6 py-3 border border-zinc-300 rounded hover:border-zinc-500 transition-colors btn-press font-medium">Контакты</a>
      </div>
    </div>
  </section>
  <section id="directions" class="py-20 bg-white max-w-7xl mx-auto px-6">
    <h2 class="text-2xl font-bold mb-10 text-center">Направления</h2>
    <div class="grid md:grid-cols-3 gap-6">
      <div class="bg-zinc-50 p-6 rounded border border-zinc-100 hover:border-blue-300 transition-colors"><h3 class="text-lg font-bold mb-2">Строительство</h3><p class="text-sm text-zinc-600">Жилые, общественные и промышленные объекты.</p></div>
      <div class="bg-zinc-50 p-6 rounded border border-zinc-100 hover:border-blue-300 transition-colors"><h3 class="text-lg font-bold mb-2">Проектирование</h3><p class="text-sm text-zinc-600">Инженерная и проектная документация.</p></div>
      <div class="bg-zinc-50 p-6 rounded border border-zinc-100 hover:border-blue-300 transition-colors"><h3 class="text-lg font-bold mb-2">Недвижимость</h3><p class="text-sm text-zinc-600">Продажа и аренда площадей.</p></div>
      <div class="bg-zinc-50 p-6 rounded border border-zinc-100 hover:border-blue-300 transition-colors"><h3 class="text-lg font-bold mb-2">Коттеджи</h3><p class="text-sm text-zinc-600">Индивидуальное малоэтажное строительство.</p></div>
      <div class="bg-zinc-50 p-6 rounded border border-zinc-100 hover:border-blue-300 transition-colors"><h3 class="text-lg font-bold mb-2">Проекты</h3><p class="text-sm text-zinc-600">Реализованные объекты в Минске и регионах.</p></div>
      <div class="bg-zinc-50 p-6 rounded border border-zinc-100 hover:border-blue-300 transition-colors"><h3 class="text-lg font-bold mb-2">Партнёрам</h3><p class="text-sm text-zinc-600">Субподряд, поставщикам, инвесторам.</p></div>
    </div>
  </section>
  <section class="py-16 bg-zinc-900 text-white">
    <div class="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      <div><p class="text-3xl font-bold">50+</p><p class="text-zinc-400 text-sm">лет на рынке</p></div>
      <div><p class="text-3xl font-bold">27M</p><p class="text-zinc-400 text-sm">кв. м. жилья</p></div>
      <div><p class="text-3xl font-bold">49+</p><p class="text-zinc-400 text-sm">объектов</p></div>
      <div><p class="text-3xl font-bold">4</p><p class="text-zinc-400 text-sm">направления</p></div>
    </div>
  </section>
  <section id="projects" class="py-20 bg-zinc-50">
    <div class="max-w-7xl mx-auto px-6">
      <h2 class="text-2xl font-bold mb-8">Реализованные объекты</h2>
      <div class="flex gap-6 overflow-x-auto pb-4">
        ${[0, 3, 4, 5].map((i) => `<div class="min-w-[260px] bg-white rounded overflow-hidden"><img src="${heroImages[i]?.path || heroImages[i]?.url}" alt="Проект" class="w-full h-44 object-cover" /><div class="p-4"><h4 class="font-semibold text-sm">Жилой объект</h4><p class="text-xs text-zinc-500">г. Минск</p></div></div>`).join('')}
      </div>
    </div>
  </section>
${ctaSection}
</body>
</html>`;
}

function designRecipe(id, direction) {
  return {
    id: `mapid-b2-recipe-${id}`,
    version: 'B2',
    sourceSiteBriefId: 'mapid-b1-sitebrief',
    sourceDesignBriefId: 'mapid-b2-design-brief',
    direction: direction.name,
    strategy: {
      primaryGoal: designBrief.goals.primary,
      secondaryGoals: designBrief.goals.secondary,
      narrative: direction.narrative,
    },
    design: {
      variance: direction.taste.designVariance,
      motion: direction.taste.motionIntensity,
      density: direction.taste.visualDensity,
      visualLanguage: direction.whyItIsDifferent,
    },
    typography: direction.typography,
    palette: direction.colorSystem,
    composition: {
      hero: direction.hero,
      services: direction.sections.find((s) => s.type === 'services'),
      projects: direction.sections.find((s) => s.type === 'projects'),
      trust: direction.sections.find((s) => s.type === 'stats' || s.type === 'about'),
      news: designBrief.content.newsImportance,
      contacts: { cta: 'Связаться', phone: '+375172098700', email: 'mail@mapid.by' },
    },
    media: {
      heroPolicy: 'USE_B1_HERO_CANDIDATES, NO_QR_NO_ICON',
      projectPolicy: 'GRID_OF_REAL_PROJECT_PHOTOS',
      rejectedTypes: ['QR', 'SOCIAL_ICON', 'FOOTER_LOGO'],
    },
    interaction: {
      motionLevel: direction.motion.level,
      navigationBehavior: direction.navigation.behavior,
    },
    localization: { language: 'ru' },
    contentRules: { sourceGroundedOnly: true },
    references: direction.references,
    skills: direction.skillsUsed,
    qaTargets: ['accessibility', 'mobile-responsiveness', 'no-invented-facts', 'Russian-labels-only'],
  };
}

const directions = [dirA, dirB, dirC];

await writeFile(join(B2, 'DesignBrief.json'), JSON.stringify(designBrief, null, 2), 'utf8');
await writeFile(join(B2, 'wla-design-inventory.json'), JSON.stringify(wlaInventory, null, 2), 'utf8');
await writeFile(join(B2, 'industry-design-intelligence.json'), JSON.stringify(industryDesignIntelligence, null, 2), 'utf8');
await writeFile(join(B2, 'skill-provenance.json'), JSON.stringify(skillProvenance, null, 2), 'utf8');
await writeFile(join(B2, 'refero-usage.json'), JSON.stringify(referoUsage, null, 2), 'utf8');
await writeFile(join(B2, 'stitch-evaluation.json'), JSON.stringify(stitchEvaluation, null, 2), 'utf8');

for (const dir of directions) {
  await writeFile(join(B2, `direction-${dir.id}.json`), JSON.stringify(dir, null, 2), 'utf8');
  await writeFile(join(B2, `DesignRecipe-${dir.id}.json`), JSON.stringify(designRecipe(dir.id, dir), null, 2), 'utf8');
}

await writeFile(join(B2, 'prototypes/direction-A.html'), htmlA(), 'utf8');
await writeFile(join(B2, 'prototypes/direction-B.html'), htmlB(), 'utf8');
await writeFile(join(B2, 'prototypes/direction-C.html'), htmlC(), 'utf8');

// Capture screenshots
const targets = [
  { name: 'direction-A', url: `file://${B2}/prototypes/direction-A.html`, type: ArtifactType.DESIGN_PROTOTYPE },
  { name: 'direction-B', url: `file://${B2}/prototypes/direction-B.html`, type: ArtifactType.DESIGN_PROTOTYPE },
  { name: 'direction-C', url: `file://${B2}/prototypes/direction-C.html`, type: ArtifactType.DESIGN_PROTOTYPE },
];

const screenshotArtifacts = await captureScreenshots({ targets, outDir: join(B2, 'prototypes') });

// Cost / time
const cost = {
  providers: [],
  durationMs: Date.now() - new Date(startedAt).getTime(),
  startedAt,
  completedAt: new Date().toISOString(),
  notes: 'B2 used no paid LLM calls. Design reasoning came from B1 + skill guidance. Prototypes were generated deterministically.',
};

await writeFile(join(B2, 'cost.json'), JSON.stringify(cost, null, 2), 'utf8');

console.log('B2 design artifacts generated:', B2);
console.log('Prototypes:', targets.map((t) => t.url));
console.log('Screenshots:', screenshotArtifacts.map((a) => a.path));
