import type { SiteContentPlanV2 } from './siteContentPlanV2.js';
import type { CustomerProblemBrief } from './customerProblemBrief.js';

export type HomepageSectionSpec = {
  type: 'hero' | 'services' | 'projects' | 'products' | 'about' | 'news' | 'cta' | 'contacts' | 'dynamic';
  heading: string;
  entityIds?: string[];
  dynamicSectionId?: string;
  sectionType?: string;
  heroMedia?: 'show work' | 'show product' | 'show process' | 'show team' | 'show building' | 'no image';
};

export type VisualSystem = {
  stylePreset?: string;
  density: 'spacious' | 'comfortable' | 'dense';
  shape: 'sharp' | 'soft' | 'rounded' | 'pill';
  typography: 'editorial' | 'geometric' | 'clean' | 'expressive';
};

export interface ConceptSpec {
  id: string;
  conceptName: string;
  businessIdea: string;
  targetAudience: string;
  decisionStage: string;
  narrative: string;
  homepageSections: HomepageSectionSpec[];
  heroComposition: 'full-bleed' | 'split' | 'centered' | 'text-first';
  heroMediaIntent: 'show work' | 'show product' | 'show process' | 'show team' | 'show building' | 'no image';
  contentEmphasis: string[];
  layoutFamily: 'editorial' | 'catalog' | 'portfolio' | 'service-list' | 'process-first';
  componentFamilies: string[];
  visual: VisualSystem;
  ctaStrategy: {
    primary: { label: string; target: string };
    secondary?: { label: string; target: string };
    footerCta?: string;
  };
  detailPageStrategy: 'service-detail' | 'project-detail' | 'product-detail' | 'case-study';
  signatureInteraction?: string;
  rationale: string;
  evidenceIds: string[];
  differencesFromOthers: Record<string, string>;
}

export interface ConceptSpecResult {
  concepts: ConceptSpec[];
  brief: CustomerProblemBrief;
  diversity: { ok: boolean; fails: string[] };
}

function byArcType(plan: SiteContentPlanV2): 'service' | 'catalog' | 'portfolio' {
  const a = plan.experience?.archetype || 'SERVICE_PORTFOLIO';
  if (a === 'CATALOG') return 'catalog';
  if (a === 'CREATIVE_PORTFOLIO') return 'portfolio';
  return 'service';
}

function conceptA(plan: SiteContentPlanV2, brief: CustomerProblemBrief, allIds: string[]): ConceptSpec {
  const type = byArcType(plan);
  const hasProcurement = brief.attributes.procurementEvidence;

  const primaryCta = type === 'catalog'
    ? { label: 'Подобрать дом', target: 'COLLECTION:PRODUCTS' }
    : type === 'portfolio'
      ? { label: 'Обсудить интерьер', target: 'HOME_SECTION:CONTACTS' }
      : { label: 'Рассчитать проект', target: 'HOME_SECTION:CONTACTS' };

  const secondaryCta = type === 'catalog'
    ? { label: 'Открыть каталог', target: 'COLLECTION:PRODUCTS' }
    : { label: 'Посмотреть работы', target: 'COLLECTION:PROJECTS' };

  const homepage: HomepageSectionSpec[] = type === 'catalog' ? [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show product' } as any,
    { type: 'products', heading: 'Готовые решения', entityIds: allIds.filter((id) => id.startsWith('product-')) },
    { type: 'about', heading: 'Почему мы' },
    { type: 'cta', heading: 'Не нашли подходящее?' },
    { type: 'contacts', heading: 'Контакты' },
  ] : type === 'portfolio' ? [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show work' } as any,
    { type: 'projects', heading: 'Реализованные интерьеры', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'services', heading: 'Услуги', entityIds: allIds.filter((id) => id.startsWith('service-')) },
    { type: 'about', heading: 'О студии' },
    { type: 'contacts', heading: 'Контакты' },
  ] : [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show building' } as any,
    { type: 'services', heading: 'Услуги', entityIds: allIds.filter((id) => id.startsWith('service-')) },
    { type: 'projects', heading: 'Проекты', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'about', heading: 'О компании' },
    { type: 'contacts', heading: 'Контакты' },
  ];

  return {
    id: 'a-expertise-first',
    conceptName: 'Экспертиза как доверие',
    businessIdea: `Первым делом показать, что ${brief.brandName.value} решает основную задачу клиента — ${brief.primaryCustomerJob.value}.`,
    targetAudience: brief.primaryAudiences.value[0] || 'главный заказчик',
    decisionStage: 'оценка компетенции',
    narrative: 'Герой — бизнес-обещание. Дальше: что продаём, доказательства опыта, почему нам можно доверять, как связаться.',
    homepageSections: homepage,
    heroComposition: 'full-bleed',
    heroMediaIntent: (homepage[0].heroMedia as any) || 'show building',
    contentEmphasis: ['услуги', 'процесс', 'реальные проекты'],
    layoutFamily: type === 'catalog' ? 'catalog' : type === 'portfolio' ? 'editorial' : 'service-list',
    componentFamilies: ['hero-full', 'grid-cards', 'faq-if-present'],
    visual: { stylePreset: 'foret', density: 'spacious', shape: 'sharp', typography: 'editorial' },
    ctaStrategy: { primary: primaryCta, secondary: secondaryCta },
    detailPageStrategy: type === 'catalog' ? 'product-detail' : type === 'portfolio' ? 'project-detail' : 'service-detail',
    signatureInteraction: type === 'catalog' ? 'hover card → attributes' : 'hero image with project tag',
    rationale: `Опирается на ${brief.contentStrengths.value.join(', ')}. CTA — ${primaryCta.label}, потому что основной конверсионный шаг: ${brief.primaryConversionAction.value}.`,
    evidenceIds: brief.sourceEvidence.filter((e) => e.type === 'entity').map((e) => e.id || '').filter(Boolean),
    differencesFromOthers: {
      b: 'B смещает акцент на процесс/каталог; C строит историю через кейсы.',
    },
  };
}

function conceptB(plan: SiteContentPlanV2, brief: CustomerProblemBrief, allIds: string[]): ConceptSpec {
  const type = byArcType(plan);
  const process = plan.dynamicSections.find((d) => d.kind === 'PROCESS');
  const faq = plan.dynamicSections.find((d) => d.kind === 'FAQ');

  const primaryCta = type === 'catalog'
    ? { label: 'Выбрать дом в каталоге', target: 'COLLECTION:PRODUCTS' }
    : type === 'portfolio'
      ? { label: 'Записаться на консультацию', target: 'HOME_SECTION:CONTACTS' }
      : { label: 'Узнать этапы работы', target: process ? 'HOME_SECTION:process' : 'HOME_SECTION:CONTACTS' };

  const secondaryCta = type === 'catalog'
    ? { label: 'Сравнить модели', target: 'COLLECTION:PRODUCTS' }
    : { label: 'Наши услуги', target: 'COLLECTION:SERVICES' };

  const homepage: HomepageSectionSpec[] = type === 'catalog' ? [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show product' } as any,
    { type: 'about', heading: 'Как выбрать своё' },
    { type: 'products', heading: 'Каталог', entityIds: allIds.filter((id) => id.startsWith('product-')) },
    { type: 'dynamic', heading: process?.heading || 'Как мы работаем', sectionType: 'process', dynamicSectionId: process?.id },
    { type: 'cta', heading: 'Остались вопросы?' },
    { type: 'contacts', heading: 'Контакты' },
  ] : type === 'portfolio' ? [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show process' } as any,
    { type: 'about', heading: 'О студии' },
    { type: 'projects', heading: 'Кейсы', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'services', heading: 'Услуги', entityIds: allIds.filter((id) => id.startsWith('service-')) },
    { type: 'dynamic', heading: faq?.heading || 'Вопросы', sectionType: 'faq', dynamicSectionId: faq?.id },
    { type: 'contacts', heading: 'Контакты' },
  ] : [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show process' } as any,
    { type: 'dynamic', heading: process?.heading || 'Как мы работаем', sectionType: 'process', dynamicSectionId: process?.id },
    { type: 'services', heading: 'Услуги', entityIds: allIds.filter((id) => id.startsWith('service-')) },
    { type: 'projects', heading: 'Выполненные объекты', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'about', heading: 'О компании' },
    { type: 'contacts', heading: 'Контакты' },
  ];

  return {
    id: 'b-process-first',
    conceptName: 'Прозрачный путь',
    businessIdea: `Снять риски ${brief.customerRisksOrObjections.value[0] || 'заказчика'} через понятный процесс до договора.`,
    targetAudience: brief.primaryAudiences.value[1] || brief.primaryAudiences.value[0],
    decisionStage: 'сравнение и снятие рисков',
    narrative: 'Герой не фото, а обещание прозрачности. Сразу после героя — этапы или фильтры. Доказательства идут после доверия.',
    homepageSections: homepage,
    heroComposition: 'split',
    heroMediaIntent: (homepage[0].heroMedia as any) || 'show process',
    contentEmphasis: ['процесс', 'этапы', 'фильтры/атрибуты'],
    layoutFamily: 'process-first',
    componentFamilies: ['split-hero', 'process-timeline', 'filter-cards'],
    visual: { stylePreset: 'atlas', density: 'comfortable', shape: 'soft', typography: 'clean' },
    ctaStrategy: { primary: primaryCta, secondary: secondaryCta, footerCta: 'Позвонить' },
    detailPageStrategy: type === 'catalog' ? 'product-detail' : 'case-study',
    signatureInteraction: 'последовательное раскрытие этапов при скролле',
    rationale: `Акцент на ${brief.decisionCriteria.value.join(', ')}. Процесс вынесен раньше, потому что основное возражение: ${brief.customerRisksOrObjections.value[0]}.`,
    evidenceIds: brief.sourceEvidence.filter((e) => e.type === 'dynamic' && (e.field === 'title' || e.field === 'text')).map((e) => e.id || '').filter(Boolean),
    differencesFromOthers: {
      a: 'A ведёт сразу к услугам; C делает упор на портфолио/истории.',
    },
  };
}

function conceptC(plan: SiteContentPlanV2, brief: CustomerProblemBrief, allIds: string[]): ConceptSpec {
  const type = byArcType(plan);
  const hasProj = allIds.some((id) => id.startsWith('project-'));

  const primaryCta = type === 'catalog'
    ? { label: 'Посмотреть готовые дома', target: 'COLLECTION:PRODUCTS' }
    : type === 'portfolio'
      ? { label: 'Посмотреть портфолио', target: 'COLLECTION:PROJECTS' }
      : { label: 'Обсудить проект', target: 'HOME_SECTION:CONTACTS' };

  const secondaryCta = { label: 'Связаться', target: 'HOME_SECTION:CONTACTS' };

  const homepage: HomepageSectionSpec[] = type === 'catalog' ? [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show product' } as any,
    { type: 'projects', heading: 'Реальные объекты', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'products', heading: 'Модели для заказа', entityIds: allIds.filter((id) => id.startsWith('product-')) },
    { type: 'about', heading: 'Почему выбирают нас' },
    { type: 'contacts', heading: 'Контакты' },
  ] : type === 'portfolio' ? [
    { type: 'hero', heading: brief.brandName.value, heroMedia: 'show team' } as any,
    { type: 'projects', heading: 'Портфолио', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'about', heading: 'О студии' },
    { type: 'services', heading: 'Услуги', entityIds: allIds.filter((id) => id.startsWith('service-')) },
    { type: 'contacts', heading: 'Контакты' },
  ] : [
    { type: 'hero', heading: brief.brandName.value, heroMedia: hasProj ? 'show work' : 'show team' } as any,
    { type: 'projects', heading: 'Объекты', entityIds: allIds.filter((id) => id.startsWith('project-')) },
    { type: 'about', heading: 'О компании' },
    { type: 'services', heading: 'Услуги', entityIds: allIds.filter((id) => id.startsWith('service-')) },
    { type: 'contacts', heading: 'Контакты' },
  ];

  return {
    id: 'c-proof-first',
    conceptName: 'Доказательство опытом',
    businessIdea: `Убедить через реальные кейсы, а не обещания — ${brief.availableProof.value.slice(0, 2).join('; ')}.`,
    targetAudience: brief.primaryAudiences.value.find((a) => /оцен|сравн/i.test(a)) || brief.primaryAudiences.value[0],
    decisionStage: 'проверка портфолио',
    narrative: 'Открываемся реальными работами. Потом рассказываем, кто мы и что делаем.',
    homepageSections: homepage,
    heroComposition: 'centered',
    heroMediaIntent: (homepage[0].heroMedia as any) || (hasProj ? 'show work' : 'show team'),
    contentEmphasis: ['кейсы', 'фото', 'реальные объекты'],
    layoutFamily: 'portfolio',
    componentFamilies: ['centered-hero', 'masonry-grid', 'case-detail'],
    visual: { stylePreset: 'ember', density: 'spacious', shape: 'pill', typography: 'expressive' },
    ctaStrategy: { primary: primaryCta, secondary: secondaryCta },
    detailPageStrategy: 'project-detail',
    signatureInteraction: 'hover проекта → короткое описание объекта',
    rationale: `Опирается на ${brief.availableProof.value.join(', ')}. Проекты выведены вперёд, потому что аудитория на стадии ${brief.decisionCriteria.value[0] || 'оценки'}.`,
    evidenceIds: allIds.filter((id) => id.startsWith('project-') || id.startsWith('product-')),
    differencesFromOthers: {
      a: 'A ведёт с услуг; B с процесса; C ведёт с портфолио.',
    },
  };
}

export function generateConcepts(plan: SiteContentPlanV2, brief: CustomerProblemBrief): ConceptSpec[] {
  const allIds = plan.entities.map((e) => e.id);
  return [
    conceptA(plan, brief, allIds),
    conceptB(plan, brief, allIds),
    conceptC(plan, brief, allIds),
  ];
}

export function validateConceptDiversity(concepts: ConceptSpec[]): { ok: boolean; fails: string[] } {
  const fails: string[] = [];
  if (concepts.length < 2) return { ok: false, fails: ['need at least 2 concepts'] };

  const dims = [
    'heroComposition',
    'layoutFamily',
    'detailPageStrategy',
    'heroMediaIntent',
  ] as const;

  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const a = concepts[i];
      const b = concepts[j];
      const diffCount =
        (a.heroComposition !== b.heroComposition ? 1 : 0) +
        (a.layoutFamily !== b.layoutFamily ? 1 : 0) +
        (a.detailPageStrategy !== b.detailPageStrategy ? 1 : 0) +
        (a.heroMediaIntent !== b.heroMediaIntent ? 1 : 0) +
        (JSON.stringify(a.homepageSections.map((s) => s.type)) !== JSON.stringify(b.homepageSections.map((s) => s.type)) ? 1 : 0) +
        (a.ctaStrategy.primary.label !== b.ctaStrategy.primary.label ? 1 : 0);
      if (diffCount < 4) fails.push(`concepts ${a.id} and ${b.id} differ in only ${diffCount} dimensions`);
    }
  }

  return { ok: fails.length === 0, fails };
}
