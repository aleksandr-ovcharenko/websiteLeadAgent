import type { SiteContentPlanV2, PlannedEntity, PlannedDynamicSection } from './siteContentPlanV2.js';

export type EvidenceItem = {
  type: 'entity' | 'dynamic' | 'contact' | 'sourceNavigation' | 'siteIdentity' | 'inference';
  id?: string;
  field: string;
  value: string;
  sourceUrl?: string;
  inference?: boolean;
};

export interface CustomerProblemBrief {
  version: '1.0';
  generatedAt: string;
  siteKey: string;
  baseUrl: string;
  brandName: { value: string; evidence: EvidenceItem[] };
  industry: { value: string; evidence: EvidenceItem[] };
  primaryAudiences: { value: string[]; evidence: EvidenceItem[] };
  whatTheCustomerSells: { value: string[]; evidence: EvidenceItem[] };
  primaryCustomerJob: { value: string; evidence: EvidenceItem[] };
  decisionCriteria: { value: string[]; evidence: EvidenceItem[] };
  customerRisksOrObjections: { value: string[]; evidence: EvidenceItem[] };
  availableProof: { value: string[]; evidence: EvidenceItem[] };
  primaryConversionAction: { value: string; evidence: EvidenceItem[] };
  secondaryConversionActions: { value: string[]; evidence: EvidenceItem[] };
  contentStrengths: { value: string[]; evidence: EvidenceItem[] };
  contentGaps: { value: string[]; evidence: EvidenceItem[] };
  businessModel: { value: string; evidence: EvidenceItem[] };
  interactionMode: { value: string; evidence: EvidenceItem[] };
  sourceEvidence: EvidenceItem[];
  attributes: { procurementEvidence?: boolean; hasPrices?: boolean; hasConfigurator?: boolean; articleCollection?: boolean };
}

const clean = (s: string | undefined, n = 120) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function entityEvidence(plan: SiteContentPlanV2, type: string, fields: (keyof PlannedEntity)[]): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const e of plan.entities.filter((e) => e.type === type)) {
    for (const f of fields) {
      const v = (e as any)[f];
      if (v) out.push({ type: 'entity', id: e.id, field: String(f), value: clean(String(v)), sourceUrl: e.detailUrl });
    }
  }
  return out;
}

function dynamicEvidence(plan: SiteContentPlanV2, kinds: string[]): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const d of plan.dynamicSections.filter((d) => kinds.includes(d.kind))) {
    for (const [i, it] of d.items.entries()) {
      if (it.title) out.push({ type: 'dynamic', id: `${d.id}#${i}`, field: 'title', value: clean(it.title), sourceUrl: d.sourcePages[0] });
      if (it.text) out.push({ type: 'dynamic', id: `${d.id}#${i}`, field: 'text', value: clean(it.text), sourceUrl: d.sourcePages[0] });
    }
  }
  return out;
}

export function buildCustomerProblemBrief(plan: SiteContentPlanV2): CustomerProblemBrief {
  const svc = plan.entities.filter((e) => e.type === 'service');
  const prj = plan.entities.filter((e) => e.type === 'project');
  const prod = plan.entities.filter((e) => e.type === 'product');
  const news = plan.entities.filter((e) => e.type === 'news');
  const articles = plan.entities.filter((e) => e.type === 'article');
  const proc = plan.dynamicSections.find((d) => d.kind === 'PROCESS');
  const faq = plan.dynamicSections.find((d) => d.kind === 'FAQ');
  const pricing = plan.dynamicSections.find((d) => d.kind === 'PRICING');
  const stats = plan.dynamicSections.find((d) => d.kind === 'STATS');
  const rev = plan.dynamicSections.find((d) => d.kind === 'REVIEWS');
  const adv = plan.dynamicSections.find((d) => d.kind === 'ADVANTAGES');

  const brand = plan.experience?.brand?.name || plan.siteIdentity.displayName || '';

  const archetype = plan.experience?.archetype || 'SERVICE_PORTFOLIO';

  const hasProcurement =
    plan.contacts.emails.some((e) => /закуп|заказы|постав|снабжен/i.test(e.value)) ||
    plan.sourceNavigation.some((n) => /закуп|тендер|снабжен/i.test(n.label));

  const hasPrices =
    !!pricing ||
    prod.some((p) => /руб|₽|цен|стоим|price/i.test(JSON.stringify(p.attributes || {}))) ||
    plan.entities.some((e) => /руб|₽|цен|стоим|price/i.test(JSON.stringify(e.attributes || {})));

  const hasConfigurator =
    plan.plannedNavigation.some((n) => /конструктор|конфигур|подобрать/i.test(n.label)) ||
    plan.sourceNavigation.some((n) => /конструктор|конфигур/i.test(n.label));

  const articleCollection = articles.length > 0 || news.length > 0;

  const sourceEvidence: EvidenceItem[] = ([
    { type: 'siteIdentity' as const, field: 'displayName', value: plan.siteIdentity.displayName || '', sourceUrl: plan.baseUrl, inference: false },
    { type: 'siteIdentity' as const, field: 'description', value: plan.siteIdentity.description || '', sourceUrl: plan.baseUrl, inference: false },
    ...plan.contacts.phones.map((p) => ({ type: 'contact' as const, field: 'phone' as const, value: p.value, sourceUrl: p.sourceUrl, inference: false })),
    ...plan.contacts.emails.map((p) => ({ type: 'contact' as const, field: 'email' as const, value: p.value, sourceUrl: p.sourceUrl, inference: false })),
    ...plan.contacts.addresses.map((p) => ({ type: 'contact' as const, field: 'address' as const, value: p.value, sourceUrl: p.sourceUrl, inference: false })),
    ...plan.sourceNavigation.map((n) => ({ type: 'sourceNavigation' as const, field: 'label', value: n.label, sourceUrl: n.url, inference: false })),
    ...entityEvidence(plan, 'service', ['title', 'cardSummary']),
    ...entityEvidence(plan, 'project', ['title', 'cardSummary']),
    ...entityEvidence(plan, 'product', ['title', 'cardSummary']),
    ...dynamicEvidence(plan, ['PROCESS', 'FAQ', 'STATS', 'REVIEWS', 'ADVANTAGES', 'PRICING']),
  ] as EvidenceItem[]).filter((e) => e.value);

  const whatSells: string[] = [];
  if (svc.length) whatSells.push(`услуги (${svc.map((s) => s.title).join(', ').slice(0, 200)})`);
  if (prod.length) whatSells.push(`каталог/продукты (${prod.map((p) => p.title).join(', ').slice(0, 200)})`);
  if (prj.length) whatSells.push(`портфолио/проекты (${prj.map((p) => p.title).join(', ').slice(0, 200)})`);

  const audiences: string[] = [];
  if (archetype === 'CATALOG') audiences.push('покупатель, выбирающий готовое решение');
  else if (archetype === 'CREATIVE_PORTFOLIO') audiences.push('заказчик, оценивающий стиль и кейсы');
  else audiences.push('заказчик строительных/проектных услуг');
  if (hasPrices) audiences.push('цена-чувствительный сравнивающий покупатель');
  if (hasConfigurator) audiences.push('самостоятельный планировщик');

  const customerJob = archetype === 'CATALOG'
    ? 'выбрать подходящее решение и оформить заявку'
    : archetype === 'CREATIVE_PORTFOLIO'
      ? 'оценить стиль и доверие через работы'
      : 'получить надёжного подрядчика и понятный процесс';

  const criteria: string[] = [];
  if (prj.length) criteria.push('портфолио реализованных работ');
  if (svc.length) criteria.push('перечень и описание услуг');
  if (proc) criteria.push('этапы работы / процесс');
  if (faq) criteria.push('ответы на типовые вопросы');
  if (pricing) criteria.push('прозрачность цен');
  if (rev) criteria.push('отзывы');
  if (hasConfigurator) criteria.push('возможность подобрать / сконфигурировать');

  const risks: string[] = [];
  if (!proc && archetype === 'SERVICE_PORTFOLIO') risks.push('нет видимого процесса работы');
  if (!prj && archetype === 'CREATIVE_PORTFOLIO') risks.push('мало кейсов / портфолио');
  if (!prod.length && archetype === 'CATALOG') risks.push('каталог не заполнен');
  if (!faq) risks.push('не хватает ответов на вопросы');
  if (!plan.contacts.phones.length) risks.push('нет видимого телефона');

  const proof: string[] = [];
  if (prj.length) proof.push(`реальные проекты: ${prj.length}`);
  if (prod.length) proof.push(`продукты в каталоге: ${prod.length}`);
  if (svc.length) proof.push(`услуги: ${svc.length}`);
  if (stats) proof.push('цифры/статистика');
  if (rev) proof.push('отзывы');
  if (faq) proof.push('FAQ');
  if (plan.siteIdentity.employees) proof.push(`сотрудники: ${plan.siteIdentity.employees}`);
  if (plan.siteIdentity.founded) proof.push(`основано: ${plan.siteIdentity.founded}`);

  const strengths: string[] = [];
  if (plan.homepage.plannedSections.length >= 4) strengths.push('структура homepage определена');
  if (svc.length) strengths.push(`услуги источника (${svc.length})`);
  if (prj.length) strengths.push(`проекты-объекты (${prj.length})`);
  if (prod.length) strengths.push(`товарные карточки (${prod.length})`);
  if (proc) strengths.push('этапы работ');

  const gaps: string[] = [];
  if (!prj.length && archetype !== 'CATALOG') gaps.push('недостаточно визуальных кейсов');
  if (!prod.length && archetype === 'CATALOG') gaps.push('каталог не выделен');
  if (!rev) gaps.push('нет отзывов');
  if (!pricing) gaps.push('нет ценовой информации');
  if (!plan.media.hero) gaps.push('нет выделенного hero-media');

  const businessModel = archetype === 'CATALOG' ? 'каталог + заявка' : archetype === 'CREATIVE_PORTFOLIO' ? 'портфолио + консультация' : 'услуги + портфолио + обращение';
  const interactionMode = hasConfigurator ? 'self-service + заявка' : 'консультация + обратная связь';

  const primaryCta = plan.contacts.phones.length
    ? 'позвонить / связаться'
    : 'оставить заявку';

  const secondaryCtas: string[] = ['посмотреть портфолио'];
  if (prod.length) secondaryCtas[0] = 'открыть каталог';
  if (svc.length) secondaryCtas.push('изучить услуги');
  if (hasConfigurator) secondaryCtas.push('подобрать в конфигураторе');

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    siteKey: plan.siteKey,
    baseUrl: plan.baseUrl,
    brandName: { value: brand, evidence: [{ type: 'siteIdentity' as const, field: 'displayName', value: brand, sourceUrl: plan.baseUrl, inference: !plan.experience?.brand?.name }] },
    industry: { value: plan.siteIdentity.industry || businessModel, evidence: [{ type: 'inference' as const, field: 'industry', value: businessModel, inference: true }] },
    primaryAudiences: { value: audiences, evidence: [{ type: 'inference' as const, field: 'primaryAudiences', value: audiences.join('; '), inference: true }] },
    whatTheCustomerSells: { value: whatSells, evidence: entityEvidence(plan, 'service', ['title']).slice(0, 8) as EvidenceItem[] },
    primaryCustomerJob: { value: customerJob, evidence: [{ type: 'inference' as const, field: 'primaryCustomerJob', value: customerJob, inference: true }] },
    decisionCriteria: { value: criteria, evidence: dynamicEvidence(plan, ['PROCESS', 'FAQ', 'ADVANTAGES', 'PRICING']).slice(0, 6) as EvidenceItem[] },
    customerRisksOrObjections: { value: risks, evidence: [{ type: 'inference' as const, field: 'customerRisksOrObjections', value: risks.join('; '), inference: true }] },
    availableProof: { value: proof, evidence: [{ type: 'inference' as const, field: 'availableProof', value: proof.join('; '), inference: true }] },
    primaryConversionAction: { value: primaryCta, evidence: plan.contacts.phones.map((p) => ({ type: 'contact' as const, field: 'phone' as const, value: p.value, sourceUrl: p.sourceUrl })) as EvidenceItem[] },
    secondaryConversionActions: { value: secondaryCtas, evidence: plan.plannedNavigation.map((n) => ({ type: 'sourceNavigation' as const, field: 'label', value: n.label, sourceUrl: n.route })).slice(0, 4) as EvidenceItem[] },
    contentStrengths: { value: strengths, evidence: [] as EvidenceItem[] },
    contentGaps: { value: gaps, evidence: [] as EvidenceItem[] },
    businessModel: { value: businessModel, evidence: [{ type: 'inference' as const, field: 'businessModel', value: businessModel, inference: true }] },
    interactionMode: { value: interactionMode, evidence: [{ type: 'inference' as const, field: 'interactionMode', value: interactionMode, inference: true }] },
    sourceEvidence,
    attributes: { procurementEvidence: hasProcurement, hasPrices, hasConfigurator, articleCollection },
  };
}
