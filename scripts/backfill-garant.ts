import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_ID = 'cmtdkqiu50004crwd529otns8';
const LEAD_ID = 'cmtdkotrm0000zkq4vfiv2p2q';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё\-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `item-${Date.now()}`;
}

const companyName = 'Гарант Качества';
const legalName = 'ООО «ГАРАНТ КАЧЕСТВА»';
const address = '220020, г. Минск, ул. Тимирязева, 121/4, ком. 313, 314';
const workingHours = 'Пн — Пт: 8.00 – 17.00; Сб, Вс: Выходной';
const phone = '+375 17 374-15-28';
const fax = '+375 17 357-15-29';
const procurement1 = '+375 17 374-15-41';
const procurement2 = '+375 17 373-15-27';
const email = 'garantk@tut.by';
const domain = 'garantk.by';

const services = [
  {
    title: 'Земляные работы',
    desc: 'Разработка грунта, устройство котлованов, траншей. Горизонтальные и наклонные штольни любой сложности.'
  },
  {
    title: 'Геодезические работы',
    desc: 'Полное инженерно-геодезическое сопровождение возводимых объектов на всех этапах строительства с оформлением отчётной документации.'
  },
  {
    title: 'Монтаж строительных конструкций',
    desc: 'Полный спектр работ по монтажу железобетонных и бетонных конструкций: от подготовки места до проведения самих работ.'
  },
  {
    title: 'Общестроительные работы',
    desc: 'Все виды строительных работ при капитальном ремонте и реконструкции объектов. Полный цикл от нулевого цикла до ввода в эксплуатацию.'
  },
  {
    title: 'Комплекс отделочных работ',
    desc: 'Внутренняя и внешняя отделка: штукатурные, малярные, плиточные и облицовочные работы.'
  },
  {
    title: 'Благоустройство территорий',
    desc: 'Полный комплекс услуг по дорожным работам, организации освещения, озеленению и мощению.'
  },
  {
    title: 'Испытание бетонных конструкций',
    desc: 'Лабораторные испытания бетонных смесей, сборных и монолитных железобетонных конструкций.'
  },
  {
    title: 'Контроль качества строительства',
    desc: 'Бюро контроля качества и надзора за строительными работами, контроль строительных материалов.'
  },
];

const projects = [
  {
    title: 'Производственное здание',
    category: 'Промышленное строительство',
    location: 'Индустриальный парк «Великий камень»',
    status: 'Завершён',
    excerpt: 'Промышленное здание, реализованное в Индустриальном парке «Великий камень».'
  },
  {
    title: 'Производственный комплекс',
    category: 'Промышленное строительство',
    location: 'д. Ярково, Минский район',
    status: 'Завершён',
    excerpt: 'Производственный комплекс в д. Ярково, Минский район.'
  },
  {
    title: 'Реконструкция многофункционального здания',
    category: 'Реконструкция',
    location: 'г. Минск, ул. Монтажников, 19A/1',
    status: 'Завершён',
    excerpt: 'Реконструкция многофункционального здания по адресу г. Минск, ул. Монтажников, 19A/1.'
  },
  {
    title: 'Производственный комплекс',
    category: 'Промышленное строительство',
    location: 'ООО «Индастриал Девелопмент»',
    status: 'Завершён',
    excerpt: 'Производственный комплекс для ООО «Индастриал Девелопмент».'
  },
];

const news = [
  {
    title: 'Завершён монтаж металлоконструкций производственного корпуса в Минской области',
    date: '2025-08-14'
  },
  {
    title: 'Начаты земляные работы на новом промышленном объекте в Брестской области',
    date: '2025-07-02'
  },
  {
    title: 'Компания приняла участие в строительной выставке BuildExpo 2025',
    date: '2025-05-18'
  },
];

const vacancies: any[] = []; // no real data yet; page will show placeholder

async function main() {
  // 1. Update lead and site metadata
  await prisma.lead.update({
    where: { id: LEAD_ID },
    data: {
      companyName,
      phone,
      address,
      websiteDomain: domain,
      manualReviewStatus: 'GOOD',
      redesignStage: 'DEMO_GENERATED'
    } as any
  });

  await prisma.site.update({
    where: { id: SITE_ID },
    data: {
      name: companyName,
      slug: 'garant-kachestva',
      domain,
      status: 'ACTIVE',
      settings: { previewUrl: `http://localhost:3336/showcase/8e25ix7c` }
    } as any
  });

  const existingSettings = await prisma.siteSettings.findUnique({ where: { siteId: SITE_ID } as any });
  const settingsData = {
    siteId: SITE_ID,
    companyName,
    phone,
    email,
    address,
    workingHours,
    socialLinks: [] as any,
    language: 'ru',
    timezone: 'Europe/Minsk',
    defaultSeoTitle: `${companyName} — строительная компания`,
    defaultSeoDescription: 'Строительная компания ГАРАНТ КАЧЕСТВА. Полный комплекс строительных, монтажных и инженерных работ.',
    previewUrl: `http://localhost:3336/showcase/8e25ix7c`,
    contacts: {
      phones: [
        { label: 'Заказчикам', number: phone },
        { label: 'Факс', number: fax },
        { label: 'Отдел закупок', number: procurement1 },
        { label: 'Отдел закупок', number: procurement2 }
      ],
      email,
      address,
      workingHours
    } as any
  };
  if (existingSettings) {
    await prisma.siteSettings.update({ where: { siteId: SITE_ID } as any, data: settingsData as any });
  } else {
    await prisma.siteSettings.create({ data: settingsData as any });
  }

  // 2. Clear old noisy content for this site
  await prisma.menuItem.deleteMany({ where: { siteId: SITE_ID } as any });
  await prisma.menu.deleteMany({ where: { siteId: SITE_ID } as any });
  await prisma.page.deleteMany({ where: { siteId: SITE_ID } as any });
  await prisma.service.deleteMany({ where: { siteId: SITE_ID } as any });
  await prisma.project.deleteMany({ where: { siteId: SITE_ID } as any });
  await prisma.newsPost.deleteMany({ where: { siteId: SITE_ID } as any });
  await prisma.vacancy.deleteMany({ where: { siteId: SITE_ID } as any });

  const now = new Date();

  // 3. Create pages
  const pageData = [
    { title: `${companyName} | Ваш надёжный подрядчик в Беларуси`, slug: 'index', isHomepage: true, blocks: [{ type: 'hero', content: 'Мы — эффективный и надёжный генподрядчик в строительстве. Берём на себя полный спектр задач: от разработки концепции и до сдачи объекта точно в срок.' }] },
    { title: 'О компании', slug: 'about', blocks: [{ type: 'text', content: `${legalName} выполняет комплекс строительных, монтажных и инженерных работ — от подготовки и проектирования до реализации и сдачи объекта. Работы выполняются с участием собственных специалистов и строительной техники, с соблюдением требований проекта, строительных норм и задач заказчика.` }] },
    { title: 'Услуги', slug: 'services', blocks: [{ type: 'services' }] },
    { title: 'Наши объекты', slug: 'objects', blocks: [{ type: 'projects' }] },
    { title: 'Новости', slug: 'news', blocks: [{ type: 'news' }] },
    { title: 'Контакты', slug: 'contacts', blocks: [{ type: 'contacts' }] },
    { title: 'Аттестаты и сертификаты', slug: 'certificates', blocks: [{ type: 'text', content: 'Аттестаты и сертификаты компании подтверждают качество выполняемых работ.' }] },
    { title: 'Отзывы', slug: 'reviews', blocks: [{ type: 'text', content: 'Отзывы наших заказчиков и партнёров.' }] },
    { title: 'Вакансии', slug: 'vacancies', blocks: [{ type: 'vacancies' }] },
  ];

  const createdPages: Record<string, any> = {};
  for (const p of pageData) {
    const created = await prisma.page.create({
      data: {
        siteId: SITE_ID,
        title: p.title,
        slug: p.slug,
        isHomepage: p.isHomepage || false,
        blocks: p.blocks as any,
        status: 'PUBLISHED',
        publishedAt: now,
        sourceType: 'MANUAL',
        seoTitle: p.title,
        seoDescription: p.blocks[0]?.content?.toString().slice(0, 160) || ''
      } as any
    });
    createdPages[p.slug] = created;
  }

  // 4. Create services
  const createdServices: any[] = [];
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const created = await prisma.service.create({
      data: {
        siteId: SITE_ID,
        title: s.title,
        slug: slugify(s.title),
        shortDescription: s.desc,
        blocks: [{ type: 'text', content: s.desc }] as any,
        sortOrder: i,
        status: 'PUBLISHED',
        publishedAt: now,
        sourceType: 'MANUAL',
        seoTitle: s.title,
        seoDescription: s.desc.slice(0, 160)
      } as any
    });
    createdServices.push(created);
  }

  // 5. Create projects
  const createdProjects: any[] = [];
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const created = await prisma.project.create({
      data: {
        siteId: SITE_ID,
        title: p.title,
        slug: slugify(p.title + '-' + i),
        excerpt: p.excerpt,
        category: p.category,
        location: p.location,
        projectStatus: p.status,
        blocks: [{ type: 'text', content: p.excerpt }] as any,
        status: 'PUBLISHED',
        publishedAt: now,
        sourceType: 'MANUAL',
        seoTitle: p.title,
        seoDescription: p.excerpt.slice(0, 160)
      } as any
    });
    createdProjects.push(created);
  }

  // 6. Create news
  for (const n of news) {
    await prisma.newsPost.create({
      data: {
        siteId: SITE_ID,
        title: n.title,
        slug: slugify(n.title),
        excerpt: n.title,
        blocks: [{ type: 'text', content: n.title }] as any,
        publishedAt: new Date(n.date),
        status: 'PUBLISHED',
        sourceType: 'MANUAL',
        seoTitle: n.title,
        seoDescription: n.title.slice(0, 160)
      } as any
    });
  }

  // 7. Create main menu
  const mainMenu = await prisma.menu.create({
    data: { siteId: SITE_ID, name: 'main', isMain: true } as any
  });

  const menuSpec = [
    { label: 'Главная', slug: 'index' },
    { label: 'Услуги', slug: 'services' },
    { label: 'Объекты', slug: 'objects' },
    { label: 'О компании', slug: 'about' },
    { label: 'Новости', slug: 'news' },
    { label: 'Контакты', slug: 'contacts' },
  ];

  for (let i = 0; i < menuSpec.length; i++) {
    const m = menuSpec[i];
    await prisma.menuItem.create({
      data: {
        siteId: SITE_ID,
        menuId: mainMenu.id,
        label: m.label,
        pageId: createdPages[m.slug]?.id,
        sortOrder: i,
        visible: true
      } as any
    });
  }

  // 8. Update RedesignRun pipeline stage to show site is rendered
  const run = await prisma.redesignRun.findFirst({
    where: { siteId: SITE_ID },
    orderBy: { createdAt: 'desc' }
  });
  if (run) {
    await prisma.redesignRun.update({
      where: { id: run.id },
      data: { stage: 'SITE_RENDERED' } as any
    });
  }

  // 9. Upsert a SiteBuild record for idempotency/auditing
  await prisma.siteBuild.create({
    data: {
      siteId: SITE_ID,
      templateId: 'construction-modern-v1',
      status: 'SUCCESS',
      outputPath: `data/generated/sites/${SITE_ID}`
    } as any
  });

  console.log('Backfilled Garant site', { siteId: SITE_ID, pages: Object.keys(createdPages).length, services: createdServices.length, projects: createdProjects.length, news: news.length });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
