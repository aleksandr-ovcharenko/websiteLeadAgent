import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const C2 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation';
const SRC = join(C2, 'source');
const extracted = JSON.parse(await readFile(join(SRC, 'extracted.json'), 'utf8'));
const mediaMap = JSON.parse(await readFile(join(SRC, 'media-map.json'), 'utf8'));
const portfolio = JSON.parse(await readFile(join(C2, 'portfolio-intelligence.json'), 'utf8'));

const media = [];
function addMedia(filename, sourceUrl, alt) {
  if (!filename) return null;
  media.push({ filename, sourceUrl, alt });
  return filename;
}

function findFile(url) {
  const m = mediaMap.find(m => m.sourceUrl === url);
  return m?.filename;
}

const projects = portfolio.projects.map(p => {
  const file = findFile(extracted.projects.find(e => e.title === p.title)?.cover);
  return {
    title: p.title,
    slug: p.title.replace(/[^a-zA-Z0-9а-яА-Я]/g, '-').replace(/-+/g, '-').toLowerCase(),
    category: p.category,
    summary: p.segment,
    status: p.status,
    flagship: p.flagship,
    coverImage: file,
    url: extracted.projects.find(e => e.title === p.title)?.url || ''
  };
});

const services = [
  { title: 'Архитектурное проектирование', slug: 'arhitektura', shortDescription: 'Разработка архитектурных решений, эскизов, визуализаций.' },
  { title: 'Строительное проектирование', slug: 'stroitelstvo', shortDescription: 'Конструктивные решения, расчеты, разделы КЖ, КМ, КР.' },
  { title: 'Генеральное проектирование', slug: 'general', shortDescription: 'Комплексное управление проектом, координация разделов.' }
];

const stats = [
  { label: 'Запроектировано', value: '1200+', suffix: 'объектов за 13 лет' },
  { label: 'Общая площадь', value: '150000', suffix: 'м2 сдано' },
  { label: 'Технология', value: 'BIM', suffix: '3D-моделирование' }
];

const homepageSections = [
  { type: 'hero', enabled: true },
  { type: 'trust-strip', enabled: true },
  { type: 'services', enabled: true },
  { type: 'portfolio', enabled: true },
  { type: 'process', enabled: true },
  { type: 'testimonials', enabled: true },
  { type: 'partners', enabled: true },
  { type: 'cta', enabled: true }
];

const processSteps = [
  { step: '01', title: 'Сбор исходных данных', text: 'Предпроектная проработка, помощь в сборе данных.' },
  { step: '02', title: 'Проектирование', text: 'Разработка ПСД в BIM-модели с координацией разделов.' },
  { step: '03', title: 'Согласование', text: 'Прохождение экспертизы и согласование в госорганах.' },
  { step: '04', title: 'Реализация', text: 'Сопровождение строительства и ввод объекта в эксплуатацию.' }
];

const partners = extracted.partners.map((p, i) => ({ id: i + 1, src: findFile(p.src), alt: p.alt || 'Партнер' })).filter(p => p.src);

const videoTestimonials = extracted.videoTestimonials.slice(0, 6).map(v => ({
  youtubeId: v.youtubeId,
  thumbnail: v.thumbnail,
  title: `Отзыв клиента ${v.youtubeId}`
}));

const cms = {
  company: extracted.company,
  contacts: extracted.contacts,
  navigation: extracted.nav.filter(n => n.url && !n.url.startsWith('tel:') && !n.url.startsWith('http')).map(n => ({ ...n, url: n.url.replace(/^\//, '') })).slice(0, 6),
  hero: {
    title: extracted.hero.title,
    description: extracted.hero.description,
    cta: extracted.hero.cta,
    imageId: '584144c8-Жилой-комплекс-Соколиный-край-в-аг-Мачул.jpg',
    videoUrl: extracted.hero.video
  },
  stats,
  services,
  projects,
  process: processSteps,
  partners,
  videoTestimonials,
  homepageSections,
  media,
  about: {
    heading: 'Проектирование зданий и сооружений от «Проект-М»',
    text: extracted.about.slice(0, 800),
    imageId: null
  },
  cta: {
    title: 'Обсудим ваш объект',
    description: 'Бесплатная консультация по проектированию, согласованию и экспертизе.',
    button: 'Заказать консультацию'
  }
};

// Add media entries to registry
for (const p of projects) if (p.cover) addMedia(p.cover, mediaMap.find(m => m.filename === p.cover)?.sourceUrl, p.title);
for (const part of partners) addMedia(part.src, mediaMap.find(m => m.filename === part.src)?.sourceUrl, part.alt);

await mkdir(join(SRC, 'images'), { recursive: true });
await writeFile(join(SRC, 'cms-content.json'), JSON.stringify(cms, null, 2), 'utf8');
console.log('CMS built. Media', media.length);
