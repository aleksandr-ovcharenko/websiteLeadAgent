import { randomUUID } from 'node:crypto';
import type { SourceDocument, SourceDocumentCollection, SourceDocumentImage, SourceDocumentSection } from '../types.js';
import type {
  PageClassification,
  CollectionClassification,
  SectionClassification,
  ImageCandidate,
  CompanyEntity,
  ContactsEntity,
  ServiceEntity,
  ProjectEntity,
  NewsEntity,
  VacancyEntity,
  ProductEntity,
  FactEntity,
  Relationship,
  Evidence,
} from './schema.js';
import type {
  PageClassificationContext,
  CollectionClassificationContext,
  SectionClassificationContext,
  MediaClassificationContext,
  EntityExtractionContext,
  GenerationSemanticProvider,
} from './provider.js';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const WORD_BOUNDARY_LEFT = '(?<![\\p{L}\\p{N}])';
const WORD_BOUNDARY_RIGHT = '(?![\\p{L}\\p{N}])';

function pattern(terms: string[], flags = 'iu'): RegExp {
  const source = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`${WORD_BOUNDARY_LEFT}(?:${source})${WORD_BOUNDARY_RIGHT}`, flags);
}

function valuePattern(valuePattern: string, units: string[], flags = 'iu'): RegExp {
  return new RegExp(`${WORD_BOUNDARY_LEFT}(${valuePattern})\\s*(?:${units.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})${WORD_BOUNDARY_RIGHT}`, flags);
}

const HOME_RE = pattern(['home', 'start', 'index', 'главная', 'home page', 'startseite', 'accueil']);
const ABOUT_RE = pattern(['about us', 'about company', 'about', 'company', 'о нас', 'о компании', 'о предприятии', 'о-нас', 'о-компании', 'predpriyatii', 'über uns', 'unternehmen']);
const SERVICES_RE = pattern(['services', 'service', 'услуги', 'uslugi', 'услуга', 'sluzhby', 'serviceleistungen', 'leistungen', 'dienstleistungen']);
const PROJECTS_RE = pattern(['projects', 'project', 'project portfolio', 'portfolio', 'work', 'our work', 'completed work', 'проекты', 'проектов', 'proekty', 'projekte', 'объекты', 'obekty', 'objekty', 'realisierte projekte', 'referenzen', 'realizacje']);
const NEWS_RE = pattern(['news', 'blog', 'articles', 'press', 'новости', 'novosti', 'novini', 'presse', 'aktuelles', 'neuigkeiten']);
const VACANCIES_RE = pattern(['vacancies', 'vacancy', 'careers', 'career', 'jobs', 'job', 'вакансии', 'vakansii', 'rabota', 'kariera', 'stellenangebote', 'offene stellen']);
const PRODUCTS_RE = pattern(['products', 'product', 'catalog', 'katalog', 'shop', 'store', 'каталог', 'продукция', 'produktsiya', 'produkciya', 'produkte', 'production', 'production', 'nedvizhimost', 'недвижимость', 'real estate', 'realty']);
const CONTACTS_RE = pattern(['contacts', 'contact us', 'kontakty', 'контакты', 'kontakt', 'связаться', 'impressum', 'standort', 'anfahrt']);
const LEGAL_RE = pattern(['privacy', 'policy', 'terms', 'legal', 'cookie', 'confidential', 'gdpr', 'agreement', 'contract', 'политика', 'конфиденциальность', 'оферта', 'соглашение', 'условия', 'пользовательское']);

const COLOR_NAMES = pattern(['черным', 'белым', 'синим', 'красным', 'зеленым', 'желтым', 'оранжевым', 'коричневым', 'розовым', 'серым', 'фиолетовым', 'голубым', 'бежевым', 'темно', 'светло', 'color', 'colour', 'style', 'theme', 'skin', 'light', 'dark', 'contrast', 'background']);
const LANG_LABELS = pattern(['ru', 'by', 'en', 'de', 'pl', 'ua', 'kz', 'uz', 'az', 'рос', 'бел', 'eng', 'deu', 'рус', 'беларуская', 'english', 'deutsch', 'polski', 'українська', "o'zbek", 'français', 'español', 'italiano']);

const LEGAL_FORMS = new RegExp(`${WORD_BOUNDARY_LEFT}(?:LLC|Inc\\.?|Ltd\\.?|GmbH|PLC|LLP|Corp\\.?|Co\\.?|S\\.?A\\.?|S\\.?p\\.?A\\.?|B\\.?V\\.?|K\\.?K\\.?|ООО|ОАО|ЗАО|АО|УП|ИП|РУП|ОДО|ТЧУП|ЧУП|ГУП|КУП|ПУ|СООО|ТОО|AO|OJSC|CJSC|LTD|PLC|GmbH)${WORD_BOUNDARY_RIGHT}(?:\\s+|\\.|$)`, 'giu');

const AD_DOMAINS = /(adform|doubleclick|googleads|googlesyndication|adsystem|amazon-adsystem|yandex\.ru\/ads|mc\.yandex\.ru|adservice|evocontrols\.com|adfox|banners|banner|реклама|adriver|adnxs|openx|pubmatic|rubicon)/i;
const AD_MARKERS = pattern(['реклама', 'advertisement', 'ad', 'ads', 'banner', 'promo', 'promotion', 'sponsored', 'рекламный', 'баннер', 'publicidad', 'publicité', 'werbung', 'anzeige']);
const UTILITY_MARKERS = pattern(['translate', 'translation', 'language', 'flag', 'search', 'cart', 'basket', 'checkout', 'login', 'account', 'profile', 'user', 'social', 'share', 'menu', 'hamburger', 'close', 'expand', 'dropdown', 'scroll', 'back', 'arrow', 'icon', 'svg', 'sprite', 'widget']);

// Portfolio / completed-work / real-object signals (generic, not domain-specific)
const PORTFOLIO_RE = pattern(['реализованные', 'реализованных', 'готовые', 'готовых', 'выполненные', 'выполненных', 'завершенные', 'завершенных', 'наши работы', 'примеры работ', 'примеры готовых работ', 'наши объекты', 'объекты', 'объектов', 'строящиеся объекты', 'введенные в эксплуатацию', 'в эксплуатации', 'портфолио', 'портфель', 'completed', 'realized', 'finished works', 'our work', 'our projects', 'selected works', 'references', 'referenzen', 'realisierte', 'projekte', 'obiekty', 'obiecte', 'realizacje']);
// Product / catalog / offering signals
const PRODUCT_CATALOG_RE = pattern(['каталог', 'каталоге', 'купить', 'цена', 'цены', 'заказать', 'выбрать', 'конфигуратор', 'модель', 'модели', 'руб', 'рублей', 'usd', '$', '€', 'buy', 'price', 'prices', 'order', 'model', 'models', 'configurator', 'catalogue', 'shop', 'store', 'кв м', 'м2', 'm2', 'м²', 'квадрат', 'квадратных', 'стоимость', 'cost', 'square meters', 'sqm']);
// Generic object / address hints that a card represents a real project
const OBJECT_REF_RE = pattern(['жк', 'жилой комплекс', 'жилой дом', 'жилая застройка', 'жилая', 'жилые', 'жилой', 'микрорайон', 'квартал', 'поселок', 'посёлок', 'поселке', 'посёлке', 'застройка', 'застройки', 'застройку', 'район', 'тракт', 'улица', 'ул\\.', 'пер\\.', 'пр\\.', 'проспект', 'площадь', 'область', 'адрес', ' residential', 'complex', 'building', 'construction', 'строительство', 'здание', 'сооружение', 'object', 'obyekt', 'district']);

// Category / status group label detection. A PROJECT is a concrete business object.
// A PROJECT CATEGORY describes many projects; a PROJECT STATUS groups projects by lifecycle.
const CATEGORY_RE = pattern(['residential', 'commercial', 'industrial', 'multi storey', 'multi-storey', 'multi story', 'multi-story', 'low rise', 'low-rise', 'cottage', 'administrative', 'public', 'mixed use', 'mixed-use', 'office', 'retail', 'housing', 'apartment', 'condo', 'townhouse', 'single family', 'development', 'buildings', 'construction', 'works', 'projects', 'objects', 'categories', 'types', 'kinds', 'многоэтажная', 'малоэтажная', 'коттеджная', 'административные', 'общественные', 'жилая', 'жилые', 'жилое', 'коммерческая', 'промышленная', 'индивидуальная', 'многоэтажное', 'малоэтажное', 'коттеджное', 'административное', 'общественное', 'коммерческое', 'промышленное', 'застройка', 'здания', 'строительство', 'объекты', 'работы', 'проекты', 'виды', 'типы', 'категории', 'kategorii', 'tipy', 'vidy']);
const STATUS_RE = pattern(['in progress', 'under construction', 'ongoing', 'current', 'new', 'latest', 'recent', 'completed', 'finished', 'done', 'past', 'archive', 'archived', 'planned', 'upcoming', 'selected', 'featured', 'строится', 'строящиеся', 'в процессе', 'в процессе строительства', 'готовые', 'готовых', 'завершенные', 'завершенных', 'завершённые', 'выполненные', 'выполненных', 'введены в эксплуатацию', 'введенные в эксплуатацию', 'в эксплуатации', 'текущие', 'архив', 'новые', 'последние', 'aktuell', 'laufend', 'in bearbeitung', 'abgeschlossen', 'neu', 'neue', 'realisierte', 'realisierte projekte', 'referenzen']);
const CONCRETE_OBJECT_TYPE_RE = pattern(['жк', 'жилой комплекс', 'жилой дом', 'жилые дома', 'жилая застройка', 'жилой квартал', 'жилой район', 'микрорайон', 'квартал', 'район', 'поселок', 'посёлок', 'деревня', 'село', 'поселке', 'посёлке', 'бизнес-центр', 'детский сад', 'спортивный комплекс', 'административное здание', 'общественное здание', 'офисное здание', 'торговый центр', 'склад', 'производственное', 'завод', 'школа', 'поликлиника', 'больница', 'магистраль', 'мост', 'дорога', 'по ул', 'по генплану', 'ул\\.', 'пр\\.', 'пер\\.', 'д\\.', 'г\\.', 'область', 'республика', 'рф', 'беларусь', 'литва', 'германия', 'польш']);
const CONCRETE_OBJECT_MARKER_RE = /[«""“”\d№]/u;

const YEAR_RE = /(?<![\p{L}\p{N}])(?:19|20)\d{2}(?![\p{L}\p{N}])/u;
const EMPLOYEES_RE = valuePattern('\\d[\\d\\s]*', ['сотрудник', 'сотрудников', 'сотрудника', 'человек', 'работника', 'работников', 'persone', 'mitarbeiter', 'mitarbeitern', 'employees', 'employee', 'staff', 'team members', 'team member', 'collaboratori', 'dipendenti']);

// Non-news semantic signals (multi-lingual, generic)
const INVESTOR_RE = pattern(['investor', 'investors', 'shareholder', 'shareholders', 'investor relations', 'акционер', 'акционерам', 'акционеров', 'инвесторам', 'инвестор', 'инвесторов', 'годовое общее собрание', 'общее собрание', 'annual meeting', 'general meeting', 'annual report', 'годовой отчет', 'ежегодный отчет', 'отчет акционерам']);
const REPORT_DOCUMENT_RE = pattern(['report', 'reports', 'reporting', 'отчет', 'отчета', 'отчетов', 'отчетность', 'отчетности', 'бухгалтерский баланс', 'аудитор', 'аудиторское заключение', 'аудиторы', 'declaration', 'декларация', 'декларации', 'деклараций', 'декларацию', 'протокол', 'протокола', 'протоколы', 'приказ', 'приказа', 'приказы', 'политика', 'политики', 'политику', 'policy', 'policies', 'charter', 'устав', 'устава', 'regulation', 'положение', 'документ', 'документы', 'document', 'documents', 'баланс', 'баланса']);
const COMPLIANCE_RE = pattern(['corruption', 'коррупция', 'коррупции', 'коррупцией', 'anti-corruption', 'противодействие коррупции', 'противодействию коррупции', 'compliance', 'ethics', 'code of conduct', 'privacy', 'personal data', 'персональные данные', 'antimonopoly', 'антимонопольный', 'antitrust', 'cookie', 'cookies', 'terms of use']);

// Corporate page subtype signals (multi-lingual, generic)
const HISTORY_RE = pattern(['history', 'история', 'хронология', 'chronology', 'milestones', 'company history', 'our history', 'наша история', 'geschichte']);
const MISSION_RE = pattern(['mission', 'vision', 'values', 'цель', 'цели', 'миссия', 'видение', 'ценности', 'наши ценности', 'our values', 'mission and values', 'werte', 'valeurs', 'strategie', 'strategy']);
const MANAGEMENT_RE = pattern(['management', 'leadership', 'executive', 'руководство', 'дирекция', 'директорат', 'совет директоров', 'наблюдательный совет', 'direction', 'leitung', 'directorio', 'organe', 'organi']);
const TEAM_RE = pattern(['team', 'employees', 'сотрудники', 'команда', 'наша команда', 'our team', 'mitarbeiter', 'collaboratori', 'personale', 'staff']);
const CERTIFICATES_RE = pattern(['certificate', 'certificates', 'certification', 'сертификат', 'сертификаты', 'лицензия', 'лицензии', 'license', 'licenses', 'licences', 'akkreditierung', 'accreditation', 'certificat']);
const UNP_RE = /(?<![\p{L}\p{N}])\d{9}(?![\p{L}\p{N}])/u;

function id(): string {
  return `sem-${randomUUID().slice(0, 8)}`;
}

function norm(s?: string): string {
  return (s || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
}

function decodePath(url: string): string {
  try {
    let p = new URL(url).pathname;
    try { p = decodeURIComponent(p); } catch {}
    return p;
  } catch {
    return '';
  }
}

function pathSegments(url: string): string[] {
  return decodePath(url).split('/').filter(Boolean).map((s) => norm(s));
}

function lastSegment(url: string): string {
  const parts = pathSegments(url);
  return parts[parts.length - 1] || '';
}

function hasRe(re: RegExp, ...texts: (string | undefined)[]): boolean {
  for (const t of texts) if (t && re.test(t)) return true;
  return false;
}

function countRe(re: RegExp, ...texts: (string | undefined)[]): number {
  let n = 0;
  for (const t of texts) if (t) n += (t.match(re) || []).length;
  return n;
}

function pickBest(values: { value: string; score: number }[]): string | undefined {
  const sorted = values.filter((v) => v.value).sort((a, b) => b.score - a.score);
  return sorted[0]?.value;
}

function cleanCompanyName(name: string): string {
  const genericLead = /^(?:главная|home|start|about(?:\s+us)?|services?|projects?|portfolio|news|contacts?|careers?|vacancies?|products?|company|site\s+title|о\s+нас|о\s+компании|о\s+предприятии|контакты|услуги|проекты|новости|вакансии|продукция|каталог)\s*[|–—-]\s*/iu;
  return name
    // strip generic website prefix phrases
    .replace(/^\s*(?:официальный\s+сайт\s+(?:компании|организации)?|официальный\s+сайт|official\s+site(?:\s+of)?|офіційний\s+сайт|сайт\s+компании|site\s+title)\s*[—–−-]?\s*/iu, '')
    // strip leading generic breadcrumb-like segment
    .replace(genericLead, '')
    // strip trailing site suffixes such as " | Company" or " - tagline"; keep hyphenated abbreviations like A-100
    .replace(/\s+[|–—]\s+.*$|(?:^|\s)\s+-\s+.*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[«»""'']/g, '')
    .replace(/^\s*(?:ООО|ОАО|ЗАО|АО|УП|РУП|ОДО|ТЧУП|ЧУП|ГУП|КУП|СООО|ТОО|ИП|LLC|Inc\.?|Ltd\.?|GmbH|PLC|JSC)\s*[.,\-]?\s*/giu, '')
    .replace(LEGAL_FORMS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericCompanyName(name: string): boolean {
  const n = norm(name);
  if (n.length < 2) return true;
  const generic = /^(home|about(?:\s+us)?|contacts?|services?|projects?|news|careers?|vacancies?|company|о-нас|о-компании|о нас|о компании|контакты|услуги|проекты|новости|вакансии|главная|каталог|продукция|site title)$/iu;
  if (generic.test(n) || n.startsWith('site title')) return true;
  // reject values that look like domain names used as site names
  if (/(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[a-z0-9-]*)?$/i.test(name.trim())) return true;
  return false;
}

const GENERIC_HEADING_PREFIXES = [
  'home','about us','about','services index','services','projects index','projects','news index','news','careers','career','vacancies','vacancy','contact us','contact','company','catalogue','catalog','products index','products',
  'о нас','о компании','о предприятии','об нас','услуги','проекты','новости','вакансии','контакты','главная','каталог','продукция','история','миссия и цель','миссия и цели','миссия','руководство','структура предприятия','структура','сертификаты','документы','акционерам','инвесторам','информация','бухгалтерский баланс','аудиторское заключение','политика предприятия','политика','противодействие коррупции','мероприятия','профсоюз','сотрудничество','обращения граждан','сотрудники','команда',
  // Transliterated Russian paths / Latin-in-URL slugs
  'proekty','proekty domov','proektov','proektov domov',
  // CTA / utility labels that are not concrete entities
  'оставить отклик','оставить','оставить заявку','оставить заказ','заказать звонок','заказать','обратная связь','служба заботы','перейти','перейти на сайт','написать нам','позвонить','скачать','подробнее','узнать больше','learn more','read more','apply now','contact us','get in touch','request a quote','get quote','call us','send message','send',
];

function isGenericHeading(heading: string): boolean {
  const n = norm(heading);
  return GENERIC_HEADING_PREFIXES.some((p) => n === p || n.startsWith(p + ' '));
}

function isConcreteProjectTitle(title: string): boolean {
  const n = norm(title);
  return CONCRETE_OBJECT_MARKER_RE.test(n) || CONCRETE_OBJECT_TYPE_RE.test(n);
}

function isCategoryTitle(title: string): boolean {
  const n = norm(title);
  if (isConcreteProjectTitle(title)) return false;
  return CATEGORY_RE.test(n);
}

function isStatusTitle(title: string): boolean {
  const n = norm(title);
  if (isConcreteProjectTitle(title)) return false;
  return STATUS_RE.test(n);
}

function isGroupLabel(title: string): 'category' | 'status' | false {
  if (isStatusTitle(title)) return 'status';
  if (isCategoryTitle(title)) return 'category';
  return false;
}

// Some galleries (awards, image grids) put the project name inside the description
// rather than in a title element. Try to recover it from the leading clause.
function titleFromDescription(description: string): string | undefined {
  if (!description) return undefined;
  const separators = ['Номинация', 'Премия', 'Award', 'Лауреат', 'Победитель', 'место', 'места', '—', '–', '-', '|', '. '];
  let text = description.trim();
  for (const sep of separators) {
    const idx = text.indexOf(sep);
    if (idx > 0) text = text.slice(0, idx).trim();
  }
  // trim trailing noise like award positions or stray punctuation
  text = text.replace(/[\s\d]+$/, '').trim();
  if (text.endsWith('«')) text = text.slice(0, -1).trim();
  if (text.length > 100) text = text.slice(0, 100);
  if (text.length < 3) return undefined;
  if (OBJECT_REF_RE.test(text) || PROJECTS_RE.test(text)) return cleanText(text);
  return undefined;
}

// A project item must carry at least one concrete project signal: object type / address,
// a project/portfolio URL path, or a description mentioning a real object.
// Broad portfolio/status terms (PORTFOLIO_RE) are intentionally excluded here because
// they also match status labels like "Реализованных объектов".
function isConcreteProjectEvidence(item: SourceDocumentCollection['items'][number], resolvedUrl: string | undefined, title: string): boolean {
  if (OBJECT_REF_RE.test(title) || PROJECTS_RE.test(title)) return true;
  if (resolvedUrl) {
    const path = norm(new URL(resolvedUrl).pathname);
    if (OBJECT_REF_RE.test(path) || PROJECTS_RE.test(path)) return true;
  }
  if (item.description && (OBJECT_REF_RE.test(item.description) || PROJECTS_RE.test(item.description))) return true;
  if (item.image && title && /[\d№«""“”]/u.test(title) && OBJECT_REF_RE.test(title)) return true;
  return false;
}

// Investor/shareholder, report/document and compliance/legal content is not a news article
// even when it appears inside a "news" section or has a date.
function isInvestorOrReportContent(text: string | undefined, url?: string): boolean {
  const t = norm(text || '');
  const u = norm(decodePath(url || ''));
  const all = `${t} ${u}`;
  return INVESTOR_RE.test(all) || REPORT_DOCUMENT_RE.test(all) || COMPLIANCE_RE.test(all) || LEGAL_RE.test(all);
}

export function pageCategoryAndSubType(type: PageClassification['type'], doc: SourceDocument): { category: 'HOME' | 'CORPORATE' | 'CONTENT' | 'UTILITY'; subType?: string } {
  if (type === 'HOME') return { category: 'HOME' };

  const contentTypes: PageClassification['type'][] = ['SERVICES_INDEX', 'SERVICE_DETAIL', 'PROJECTS_INDEX', 'PROJECT_DETAIL', 'NEWS_INDEX', 'NEWS_DETAIL', 'VACANCIES_INDEX', 'VACANCY_DETAIL', 'PRODUCTS_INDEX', 'PRODUCT_DETAIL'];
  if (contentTypes.includes(type)) {
    const base = type.replace(/_(INDEX|DETAIL)$/, '');
    const suffix = type.endsWith('_INDEX') ? 'INDEX' : 'DETAIL';
    return { category: 'CONTENT', subType: `${base}_${suffix}` };
  }

  if (type === 'CONTACTS') return { category: 'UTILITY', subType: 'CONTACTS' };
  if (type === 'LEGAL') return { category: 'UTILITY', subType: 'LEGAL' };
  if (type === 'OTHER') return { category: 'UTILITY', subType: 'OTHER' };

  // Corporate page subtypes (type is ABOUT or falls through)
  const allText = norm(`${doc.h1 || ''} ${doc.title || ''} ${doc.metaDescription || ''} ${decodePath(doc.url)} ${breadcrumbLabels(doc)} ${allNavLabels(doc)}`);

  if (INVESTOR_RE.test(allText) || /\b(investor|shareholder|акционер|инвестор|investor relations)\b/iu.test(allText)) return { category: 'CORPORATE', subType: 'INVESTOR_RELATIONS' };
  if (COMPLIANCE_RE.test(allText)) return { category: 'CORPORATE', subType: 'COMPLIANCE' };
  if (REPORT_DOCUMENT_RE.test(allText)) return { category: 'CORPORATE', subType: 'DOCUMENTS' };
  if (CERTIFICATES_RE.test(allText)) return { category: 'CORPORATE', subType: 'CERTIFICATES' };
  if (MANAGEMENT_RE.test(allText)) return { category: 'CORPORATE', subType: 'MANAGEMENT' };
  if (TEAM_RE.test(allText)) return { category: 'CORPORATE', subType: 'TEAM' };
  if (HISTORY_RE.test(allText)) return { category: 'CORPORATE', subType: 'HISTORY' };
  if (MISSION_RE.test(allText)) return { category: 'CORPORATE', subType: 'MISSION' };

  return { category: 'CORPORATE', subType: 'ABOUT' };
}

function urlBasePath(url?: string): string {
  if (!url) return '';
  try {
    let p = new URL(url).pathname.replace(/\.html?$/i, '');
    p = p.replace(/\/+$/, '');
    return p;
  } catch {
    return '';
  }
}

function urlDir(url?: string): string {
  const p = urlBasePath(url);
  const idx = p.lastIndexOf('/');
  return idx > 0 ? p.slice(0, idx) : '';
}

function isCategoryLandingUrl(url: string | undefined, allUrls: (string | undefined)[]): boolean {
  if (!url) return false;
  const base = urlBasePath(url);
  const prefix = base + '/';
  return allUrls.some((u) => {
    if (!u || u === url) return false;
    const other = new URL(u).pathname;
    return other.startsWith(prefix);
  });
}

function isHomePage(doc: SourceDocument, baseUrl: string): boolean {
  if (doc.isHomepage) return true;
  const path = decodePath(doc.url);
  if (path === '/' || path === '') return true;
  const basePath = decodePath(baseUrl);
  return path === basePath || path === `${basePath}/`;
}

function structuredDataTypes(doc: SourceDocument): string[] {
  const types: string[] = [];
  for (const sd of doc.structuredData || []) {
    if (sd['@type']) types.push(String(sd['@type']));
    if (Array.isArray(sd['@graph'])) {
      for (const g of sd['@graph']) if (g['@type']) types.push(String(g['@type']));
    }
  }
  return types.map((t) => t.toLowerCase());
}

function breadcrumbLabels(doc: SourceDocument): string {
  return (doc.chrome.nav?.breadcrumbs || []).map((b) => b.label).join(' ');
}

function allNavLabels(doc: SourceDocument): string {
  const walk = (nodes: any[]): string[] => nodes.flatMap((n) => [n.label, ...(n.children ? walk(n.children) : [])]);
  const primary = doc.chrome.nav?.primary || [];
  const secondary = doc.chrome.nav?.secondary || [];
  return [...walk(primary), ...walk(secondary)].join(' ');
}

function parentSectionHeading(doc: SourceDocument, collectionId: string): string {
  for (const sec of doc.sections || []) {
    if ((sec.collections || []).some((c) => c.id === collectionId)) {
      return [sec.heading, ...sec.paragraphs].join(' ');
    }
  }
  return '';
}

function parentSectionRegion(doc: SourceDocument, collectionId: string): string {
  for (const sec of doc.sections || []) {
    if ((sec.collections || []).some((c) => c.id === collectionId)) {
      return sec.region || 'unknown';
    }
  }
  return 'unknown';
}

function navAncestryForUrl(url: string, doc: SourceDocument): string[] {
  const walk = (nodes: any[], path: string[] = []): string[][] => {
    const out: string[][] = [];
    for (const n of nodes) {
      const p = [...path, n.label];
      if (n.url && sameUrl(url, n.url)) return [p];
      if (n.children) {
        const child = walk(n.children, p);
        if (child.length) return child;
      }
    }
    return out;
  };
  const primary = doc.chrome.nav?.primary || [];
  const secondary = doc.chrome.nav?.secondary || [];
  const found = walk(primary).length ? walk(primary) : walk(secondary);
  return found[0] || [];
}

function sameUrl(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  try { return new URL(a).pathname === new URL(b).pathname; } catch { return a === b; }
}

function evidence(
  type: string,
  value: string,
  confidence: number,
  extra: Partial<Evidence> = {}
): Evidence {
  return { type, value, confidence, ...extra };
}

function pageEvidence(
  doc: SourceDocument,
  type: string,
  value: string,
  confidence: number
): Evidence {
  return { type, value, confidence, sourceDocumentId: doc.id };
}

export class RuleBasedSemanticProvider implements GenerationSemanticProvider {
  readonly name = 'rule-based';
  readonly model = 'none';
  readonly promptVersion = '0.1';
  readonly temperature = 0;
  readonly confidenceThresholds = {
    high: 0.85,
    medium: 0.65,
    low: 0.4,
  };

  classifyPage(ctx: PageClassificationContext): PageClassification {
    const { sourceDocument: doc, allDocuments, baseUrl } = ctx;
    const signals: { type: PageClassification['type']; score: number; evidence: Evidence[] }[] = [];
    const title = norm(doc.title);
    const h1 = norm(doc.h1 || '');
    const meta = norm(doc.metaDescription);
    const pathText = norm(decodePath(doc.url));
    const segments = pathSegments(doc.url);
    const last = lastSegment(doc.url);
    const bc = norm(breadcrumbLabels(doc));
    const nav = norm(allNavLabels(doc));
    const structured = structuredDataTypes(doc);
    // allText intentionally excludes global nav labels; those are used via nav ancestry only
    const allText = `${title} ${h1} ${meta} ${bc}`;

    const add = (type: PageClassification['type'], baseScore: number, reasons: Evidence[]) => signals.push({ type, score: baseScore, evidence: reasons });

    const detailType: Record<string, PageClassification['type']> = {
      ABOUT: 'ABOUT',
      SERVICES_INDEX: 'SERVICE_DETAIL',
      PROJECTS_INDEX: 'PROJECT_DETAIL',
      NEWS_INDEX: 'NEWS_DETAIL',
      VACANCIES_INDEX: 'VACANCY_DETAIL',
      PRODUCTS_INDEX: 'PRODUCT_DETAIL',
      CONTACTS: 'CONTACTS',
      LEGAL: 'LEGAL',
    };

    // Path-based classification
    const pathMatch = (re: RegExp, score: number, type: PageClassification['type']) => {
      if (segments.some((s) => re.test(s)) || re.test(pathText)) {
        const hit = segments.find((s) => re.test(s)) || lastSegment(doc.url);
        const lastSeg = lastSegment(doc.url);
        // A multi-segment path is only treated as a detail page when the final segment is a concrete
        // name, not a generic category slug such as /catalog/proekty-domov/.
        const detail = segments.length >= 2 && !isGenericHeading(lastSeg);
        const resolved = (detail ? detailType[type] : type) as PageClassification['type'];
        let sc = score;
        if (detail) sc += 10;
        if (re.test(h1) || re.test(title)) sc += 8;
        add(resolved, sc, [pageEvidence(doc, 'path', hit, 0.8)]);
      }
    };

    pathMatch(ABOUT_RE, 5, 'ABOUT');
    pathMatch(SERVICES_RE, 6, 'SERVICES_INDEX');
    pathMatch(PROJECTS_RE, 6, 'PROJECTS_INDEX');
    pathMatch(NEWS_RE, 7, 'NEWS_INDEX');
    pathMatch(VACANCIES_RE, 6, 'VACANCIES_INDEX');
    pathMatch(PRODUCTS_RE, 6, 'PRODUCTS_INDEX');
    pathMatch(CONTACTS_RE, 8, 'CONTACTS');
    pathMatch(LEGAL_RE, 9, 'LEGAL');

    if (isHomePage(doc, baseUrl)) add('HOME', 20, [pageEvidence(doc, 'url', doc.url, 0.95)]);

    // Title / H1 / meta content classification
    // Use only page-local content (title, h1, meta, breadcrumb). Global nav labels are too noisy.
    if (hasRe(ABOUT_RE, title, h1, meta, bc)) add('ABOUT', 6, [pageEvidence(doc, 'heading', h1 || title, 0.7)]);
    if (hasRe(SERVICES_RE, title, h1, meta, bc)) add('SERVICES_INDEX', 7, [pageEvidence(doc, 'heading', h1 || title, 0.75)]);
    if (hasRe(PROJECTS_RE, title, h1, meta, bc)) add('PROJECTS_INDEX', 7, [pageEvidence(doc, 'heading', h1 || title, 0.75)]);
    if (hasRe(NEWS_RE, title, h1, meta, bc)) add('NEWS_INDEX', 8, [pageEvidence(doc, 'heading', h1 || title, 0.8)]);
    if (hasRe(VACANCIES_RE, title, h1, meta, bc)) add('VACANCIES_INDEX', 7, [pageEvidence(doc, 'heading', h1 || title, 0.75)]);
    if (hasRe(PRODUCTS_RE, title, h1, meta, bc)) add('PRODUCTS_INDEX', 7, [pageEvidence(doc, 'heading', h1 || title, 0.75)]);
    if (hasRe(CONTACTS_RE, title, h1, meta, bc)) add('CONTACTS', 9, [pageEvidence(doc, 'heading', h1 || title, 0.85)]);
    if (hasRe(LEGAL_RE, title, h1, meta, bc)) add('LEGAL', 10, [pageEvidence(doc, 'heading', h1 || title, 0.85)]);

    // Structured data
    if (structured.includes('contactpage') || structured.includes('contact')) add('CONTACTS', 12, [pageEvidence(doc, 'jsonld', structured.join(', '), 0.9)]);
    if (structured.includes('jobposting')) add('VACANCIES_INDEX', 12, [pageEvidence(doc, 'jsonld', 'JobPosting', 0.9)]);
    if (structured.includes('newsarticle')) add('NEWS_DETAIL', 11, [pageEvidence(doc, 'jsonld', 'NewsArticle', 0.9)]);
    if (structured.includes('article')) add('NEWS_DETAIL', 9, [pageEvidence(doc, 'jsonld', 'Article', 0.85)]);
    if (structured.includes('product')) add('PRODUCT_DETAIL', 11, [pageEvidence(doc, 'jsonld', 'Product', 0.9)]);
    if (structured.includes('service')) add('SERVICE_DETAIL', 11, [pageEvidence(doc, 'jsonld', 'Service', 0.9)]);
    // Organization/LocalBusiness is intentionally not used as a page type signal; it appears on many pages (home, news, etc.)

    // Index vs detail discrimination
    const ownCollections = doc.collections || [];
    const hasManyItems = ownCollections.some((c) => c.items.length >= 3);
    const hasBodyParagraphs = doc.sections.some((s) => s.region === 'main' && s.paragraphs.length >= 2);
    const hasSingleH1Specific = h1.length > 0 && !isGenericHeading(doc.h1 || '');

    // Nav ancestry
    const ancestry = navAncestryForUrl(doc.url, doc);
    if (ancestry.length) {
      const ancestorText = norm(ancestry.join(' '));
      if (SERVICES_RE.test(ancestorText)) add('SERVICE_DETAIL', 8, [pageEvidence(doc, 'nav-ancestor', ancestorText, 0.7)]);
      if (PROJECTS_RE.test(ancestorText)) add('PROJECT_DETAIL', 8, [pageEvidence(doc, 'nav-ancestor', ancestorText, 0.7)]);
      if (NEWS_RE.test(ancestorText)) add('NEWS_DETAIL', 8, [pageEvidence(doc, 'nav-ancestor', ancestorText, 0.7)]);
      if (VACANCIES_RE.test(ancestorText)) add('VACANCY_DETAIL', 8, [pageEvidence(doc, 'nav-ancestor', ancestorText, 0.7)]);
    }

    // Promote detail over index when the page has a specific H1 and body text rather than a list
    const detailBoost = hasSingleH1Specific && hasBodyParagraphs && !hasManyItems ? 8 : 0;
    for (const s of signals) {
      if (s.type.endsWith('_DETAIL')) s.score += detailBoost;
    }

    // Choose best signal
    signals.sort((a, b) => b.score - a.score);
    const best = signals[0];

    // A "detail" page that actually contains a listing collection and has a generic heading is likely an index
    const genericH1 = h1.length > 0 && isGenericHeading(doc.h1 || '');
    const genericTitle = title.length > 0 && isGenericHeading(doc.title);
    if (best && best.type.endsWith('_DETAIL') && hasManyItems && (genericH1 || genericTitle)) {
      const detailToIndex: Record<string, PageClassification['type']> = {
        SERVICE_DETAIL: 'SERVICES_INDEX',
        PROJECT_DETAIL: 'PROJECTS_INDEX',
        NEWS_DETAIL: 'NEWS_INDEX',
        VACANCY_DETAIL: 'VACANCIES_INDEX',
        PRODUCT_DETAIL: 'PRODUCTS_INDEX',
      };
      if (detailToIndex[best.type]) {
        best.type = detailToIndex[best.type];
        best.evidence.push(pageEvidence(doc, 'listing', `page contains ${best.type} collection`, 0.6));
      }
    }

    if (!best) {
      const { category, subType } = pageCategoryAndSubType('OTHER', doc);
      return {
        sourceDocumentId: doc.id,
        type: 'OTHER',
        category,
        subType,
        confidence: 0.3,
        evidence: [pageEvidence(doc, 'fallback', 'no strong signals', 0.3)],
      };
    }

    let finalType = best.type;
    let confidence = Math.min(0.98, 0.5 + best.score / 40);
    if (best.type.endsWith('_INDEX') && hasSingleH1Specific && hasBodyParagraphs) {
      // Could be a detail page that also lists related items; downgrade if only one strong signal
      if (signals.length > 1 && signals[1].score >= best.score - 5) {
        confidence = 0.6;
      }
    }
    if (best.type.endsWith('_DETAIL') && !hasSingleH1Specific) {
      confidence = Math.max(0.45, confidence - 0.15);
    }

    const { category, subType } = pageCategoryAndSubType(finalType, doc);
    return { sourceDocumentId: doc.id, type: finalType, category, subType, confidence, evidence: best.evidence };
  }

  classifyCollection(ctx: CollectionClassificationContext): CollectionClassification {
    const { collection, sourceDocument: doc, pageClassification: page, baseUrl } = ctx;
    const items = collection.items || [];
    const titles = items.map((i) => norm(i.title)).filter(Boolean);
    const urls = items.map((i) => i.url).filter((u): u is string => Boolean(u));
    const selector = (collection.selector || '').toLowerCase();
    const descriptions = items.map((i) => norm(i.description)).filter(Boolean);
    const headingText = norm(collection.heading || '');
    const combinedText = `${titles.join(' ')} ${descriptions.join(' ')} ${urls.join(' ')} ${selector} ${doc.title || ''} ${headingText}`;
    const secHeading = parentSectionHeading(doc, collection.id);
    const secRegion = parentSectionRegion(doc, collection.id);

    // Structural signals
    const allUrlsInternal = urls.length > 0 && urls.every((u) => {
      try { return new URL(u).hostname === new URL(baseUrl).hostname; } catch { return true; }
    });
    const allUrlsExternal = urls.length > 0 && urls.every((u) => {
      try { return new URL(u).hostname !== new URL(baseUrl).hostname; } catch { return false; }
    });
    const allUrlsRoot = urls.length > 0 && urls.every((u) => {
      try { return new URL(u).pathname === '/' || new URL(u).pathname === ''; } catch { return false; }
    });
    const uniqueUrls = new Set(urls).size;
    const allSameUrl = uniqueUrls <= 1 && urls.length > 1;
    const hasRepeatedExternal = allUrlsExternal && allSameUrl;
    const allImagesHaveAdAlt = items.length > 0 && items.every((i) => i.title ? AD_MARKERS.test(i.title) : false);

    // Navigation / utility detection (modals and popups are not content collections)
    const navSelectors = /nav|menu|header|footer|breadcrumb|sidebar|widget|switcher|lang|translate|currency|cart|search|social|share|cookie|consent|modal|popup|dialog|overlay|drawer|offcanvas|lightbox|backdrop|v-modal/;
    if (navSelectors.test(selector) || /menu|nav|breadcrumb/.test(selector)) {
      if (titles.some((t) => HOME_RE.test(t) || ABOUT_RE.test(t) || SERVICES_RE.test(t) || CONTACTS_RE.test(t))) {
        return { collectionId: collection.id, type: 'NAVIGATION', confidence: 0.92, reason: 'nav/menu container with generic page labels' };
      }
    }

    // Language switcher
    if ((titles.length > 0 && titles.every((t) => LANG_LABELS.test(t))) || /lang|language|locale|translate|gtranslate|weglot|wpml/.test(selector + ' ' + urls.join(' '))) {
      return { collectionId: collection.id, type: 'LANGUAGE_SWITCHER', confidence: 0.92, reason: 'items are language labels or selector contains language markers' };
    }

    // Theme / color switcher
    if ((titles.length > 0 && titles.every((t) => COLOR_NAMES.test(t))) || /theme|color|style|skin|access/.test(selector)) {
      return { collectionId: collection.id, type: 'THEME_WIDGET', confidence: 0.9, reason: 'items are color/style names or selector contains theme markers' };
    }

    // Advertisement — but do not discard real project portfolios that happen to link to external project microsites
    if ((hasRepeatedExternal || allImagesHaveAdAlt || AD_MARKERS.test(combinedText) || /ads?|advertisement|sponsored|promo|banner/.test(selector)) && !PORTFOLIO_RE.test(combinedText) && !PROJECTS_RE.test(combinedText) && !OBJECT_REF_RE.test(combinedText)) {
      return { collectionId: collection.id, type: 'ADVERTISEMENT', confidence: 0.9, reason: 'repeated external/promo links or ad markers' };
    }

    // Navigation (generic labels with internal links)
    if (allUrlsInternal && titles.length > 1 && titles.every((t) => HOME_RE.test(t) || ABOUT_RE.test(t) || SERVICES_RE.test(t) || PROJECTS_RE.test(t) || NEWS_RE.test(t) || CONTACTS_RE.test(t) || PRODUCTS_RE.test(t) || VACANCIES_RE.test(t))) {
      return { collectionId: collection.id, type: 'NAVIGATION', confidence: 0.9, reason: 'items are generic internal page labels' };
    }

    // A menu-like collection whose titles are mostly generic page labels should not become service/project/news
    const genericRatio = titles.length > 0 ? titles.filter(isGenericHeading).length / titles.length : 0;
    if (genericRatio >= 0.5 && allUrlsInternal && !allUrlsRoot && !PORTFOLIO_RE.test(headingText) && !PROJECTS_RE.test(headingText)) {
      return { collectionId: collection.id, type: 'NAVIGATION', confidence: 0.75, reason: 'majority generic internal page labels' };
    }

    // Social links
    const socialHosts = /(?:facebook|twitter|x\.com|instagram|linkedin|youtube|tiktok|vk\.com|ok\.ru|telegram|whatsapp|viber|skype|pinterest)/i;
    if (socialHosts.test(urls.join(' ')) || /social|share|follow us|follow|соцсети|мы в соцсетях|подписывайтесь/.test(selector + ' ' + combinedText)) {
      return { collectionId: collection.id, type: 'SOCIAL_LINKS', confidence: 0.9, reason: 'social media links or share bar' };
    }

    // Utility (login, cart, search) — but not recent-posts / news widgets
    if (UTILITY_MARKERS.test(combinedText) && !/card|article|item|post|entry|recent|news/.test(selector + ' ' + headingText)) {
      return { collectionId: collection.id, type: 'UTILITY', confidence: 0.85, reason: 'utility icons or widgets' };
    }

    // Timeline / history / achievements / values are not project/service catalogs even on a home page.
    const FACTS_RE = pattern(['история', 'history', 'timeline', 'milestones', 'хронология', 'achievements', 'достижения', 'награды', 'awards', 'nominations', 'номинации', 'премии', 'наши ценности', 'our values', 'values', 'цінності', 'werte', 'valeurs', 'testimonials', 'отзывы', 'благодарности', 'reviews', 'trust', 'доверие', 'надежность']);
    if (FACTS_RE.test(headingText) && !PORTFOLIO_RE.test(headingText)) {
      const hasAnyDescriptions = items.some((i) => (i.description || '').trim().length > 10);
      const hasAnyImages = items.some((i) => !!i.image);
      if (items.length >= 2 && (hasAnyDescriptions || hasAnyImages)) {
        return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'OTHER', confidence: 0.65, reason: 'timeline/achievements/values content, not a catalog' };
      }
    }

    // Content collection subtype inference — driven by the collection's own evidence
    if (items.length >= 2 && !allUrlsRoot) {
      const goodUrls = urls.filter((u) => { try { const p = new URL(u).pathname; return p !== '/' && p !== ''; } catch { return false; } });
      const urlText = goodUrls.join(' ');
      const selectorText = norm(selector);
      const secText = norm(`${headingText} ${secHeading}`);
      const pageText = norm(`${doc.title || ''} ${doc.h1 || ''} ${doc.metaDescription || ''}`);
      const descText = descriptions.join(' ');
      const typeCandidate = (collection.typeCandidate || 'unknown').toLowerCase();

      const matches = (re: RegExp, text: string) => (text.match(re) || []).length;
      const itemMatches = (re: RegExp) => items.filter((i) => re.test(`${norm(i.title)} ${norm(i.description || '')} ${i.url || ''}`)).length;

      const pageType = page.type;
      const pageBoost = (index: PageClassification['type'], detail: PageClassification['type']) => (pageType === index || pageType === detail ? 3 : 0);
      // Type candidate is a weak hint, not a license; strong textual evidence must back it up
      const candidateBoost = (cand: string) => (typeCandidate === cand ? 2 : 0);
      const imageBonus = items.some((i) => i.image) ? 2 : 0;

      // Generic scores: section heading > page text > descriptions > selector > item titles > urls
      const scoreFor = (projectRe: RegExp[], secWeight = 8, pageWeight = 3, descWeight = 2, selWeight = 2, itemWeight = 1, urlWeight = 1) => {
        let s = 0;
        for (const re of projectRe) {
          s += matches(re, secText) * secWeight;
          s += matches(re, pageText) * pageWeight;
          s += matches(re, descText) * descWeight;
          s += matches(re, selectorText) * selWeight;
          s += itemMatches(re) * itemWeight;
          s += matches(re, urlText) * urlWeight;
        }
        return s;
      };

      const serviceScore = candidateBoost('services') + pageBoost('SERVICES_INDEX', 'SERVICE_DETAIL') + imageBonus + scoreFor([SERVICES_RE]);
      const projectScore = candidateBoost('projects') + pageBoost('PROJECTS_INDEX', 'PROJECT_DETAIL') + imageBonus + scoreFor([PROJECTS_RE, PORTFOLIO_RE]) + scoreFor([OBJECT_REF_RE], 6, 2, 1, 2, 2, 1);
      const newsScore = candidateBoost('news') + pageBoost('NEWS_INDEX', 'NEWS_DETAIL') + imageBonus + countRe(YEAR_RE, secText, pageText, urlText) + scoreFor([NEWS_RE]);
      const vacancyScore = candidateBoost('vacancies') + pageBoost('VACANCIES_INDEX', 'VACANCY_DETAIL') + imageBonus + scoreFor([VACANCIES_RE]);
      const productScore = candidateBoost('products') + pageBoost('PRODUCTS_INDEX', 'PRODUCT_DETAIL') + imageBonus + scoreFor([PRODUCTS_RE]) + scoreFor([PRODUCT_CATALOG_RE], 6, 2, 2, 2, 2, 1);

      const best = [
        { subtype: 'SERVICES' as const, score: serviceScore },
        { subtype: 'PROJECTS' as const, score: projectScore },
        { subtype: 'NEWS' as const, score: newsScore },
        { subtype: 'VACANCIES' as const, score: vacancyScore },
        { subtype: 'PRODUCTS' as const, score: productScore },
      ].sort((a, b) => b.score - a.score)[0];

      const hasImages = items.some((i) => i.image);
      const hasDescriptions = items.some((i) => (i.description || '').length > 20);
      const hasUrls = urls.length > 0;

      // A content subtype needs either the collection heading or the page itself to support it.
      // This keeps generic wrappers on home/about/corporate pages from becoming projects/services/etc.
      const headingSupports = (subtype: typeof best.subtype): boolean => {
        if (subtype === 'PROJECTS') return PROJECTS_RE.test(headingText) || PORTFOLIO_RE.test(headingText);
        if (subtype === 'PRODUCTS') return PRODUCTS_RE.test(headingText) || PRODUCT_CATALOG_RE.test(headingText);
        if (subtype === 'SERVICES') return SERVICES_RE.test(headingText);
        if (subtype === 'NEWS') return NEWS_RE.test(headingText);
        if (subtype === 'VACANCIES') return VACANCIES_RE.test(headingText);
        return false;
      };
      // Evidence that comes from the collection itself (heading, items, descriptions, URLs, selector),
      // not from the parent page title/h1. This stops navigation menus inside a NEWS_INDEX page, for example,
      // from inheriting a "NEWS" label just because the surrounding page is a news index.
      const hasCollectionEvidence = (subtype: typeof best.subtype): boolean => {
        if (headingSupports(subtype)) return true;
        if (subtype === 'PROJECTS') {
          return itemMatches(PROJECTS_RE) > 0 || itemMatches(PORTFOLIO_RE) > 0 || itemMatches(OBJECT_REF_RE) > 0 ||
            PORTFOLIO_RE.test(descText) || PROJECTS_RE.test(descText) || OBJECT_REF_RE.test(descText) ||
            PORTFOLIO_RE.test(urlText) || PROJECTS_RE.test(urlText) || OBJECT_REF_RE.test(urlText);
        }
        if (subtype === 'PRODUCTS') {
          return itemMatches(PRODUCTS_RE) > 0 || itemMatches(PRODUCT_CATALOG_RE) > 0 ||
            PRODUCT_CATALOG_RE.test(descText) || PRODUCTS_RE.test(descText) ||
            PRODUCT_CATALOG_RE.test(urlText) || PRODUCTS_RE.test(urlText);
        }
        if (subtype === 'SERVICES') {
          return itemMatches(SERVICES_RE) > 0 || SERVICES_RE.test(descText) || SERVICES_RE.test(urlText);
        }
        if (subtype === 'NEWS') {
          return itemMatches(NEWS_RE) > 0 || NEWS_RE.test(descText) || NEWS_RE.test(urlText) || /post|entry|news|novosti/.test(selectorText);
        }
        if (subtype === 'VACANCIES') {
          return itemMatches(VACANCIES_RE) > 0 || VACANCIES_RE.test(descText) || VACANCIES_RE.test(urlText);
        }
        return false;
      };
      const pageSupports = (subtype: typeof best.subtype): boolean => {
        // Detail pages require a heading to avoid classifying the whole page wrapper
        if (subtype === 'PROJECTS') return pageType === 'PROJECTS_INDEX' || pageType === 'HOME';
        if (subtype === 'PRODUCTS') return pageType === 'PRODUCTS_INDEX' || pageType === 'PROJECTS_INDEX' || pageType === 'HOME';
        if (subtype === 'SERVICES') return pageType === 'SERVICES_INDEX';
        if (subtype === 'NEWS') return pageType === 'NEWS_INDEX';
        if (subtype === 'VACANCIES') return pageType === 'VACANCIES_INDEX';
        return false;
      };

      // Strong project/product signals can come from the collection heading alone
      const minScore = 6;
      const candidates = [best, ...[serviceScore, projectScore, newsScore, vacancyScore, productScore]
        .map((score, idx) => ({
          subtype: (['SERVICES', 'PROJECTS', 'NEWS', 'VACANCIES', 'PRODUCTS'] as const)[idx],
          score,
        }))
        .filter((c) => c.score >= best.score * 0.7)];

      for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
        if (candidate.score < minScore || !(hasImages || hasUrls || hasDescriptions)) continue;
        // The collection itself must carry semantic evidence for the candidate subtype.
        // Page context (e.g. being on a NEWS_INDEX page) is not enough to label a
        // navigation menu or wrapper as a news/project/product catalog.
        if (!hasCollectionEvidence(candidate.subtype)) continue;

        if (candidate.subtype === 'PROJECTS' && projectScore > productScore) {
          return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'PROJECTS', confidence: Math.min(0.9, 0.55 + candidate.score / 30), reason: 'project/portfolio collection evidence' };
        }
        if (candidate.subtype === 'PRODUCTS' && productScore > projectScore) {
          return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'PRODUCTS', confidence: Math.min(0.88, 0.55 + candidate.score / 30), reason: 'product/catalog collection evidence' };
        }
        if (candidate.subtype === 'SERVICES') {
          return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'SERVICES', confidence: Math.min(0.9, 0.55 + candidate.score / 30), reason: 'service collection evidence' };
        }
        if (candidate.subtype === 'NEWS') {
          return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'NEWS', confidence: Math.min(0.88, 0.55 + candidate.score / 30), reason: 'news collection evidence' };
        }
        if (candidate.subtype === 'VACANCIES') {
          return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'VACANCIES', confidence: Math.min(0.9, 0.55 + candidate.score / 30), reason: 'vacancy collection evidence' };
        }
      }

      // Fallback content collection only if cards have descriptions/images
      if (hasDescriptions || hasImages) {
        return { collectionId: collection.id, type: 'CONTENT_COLLECTION', contentSubtype: 'OTHER', confidence: 0.6, reason: 'card-like repeated items with descriptions or images' };
      }
    }

    // Partner / repeated external logos (only when no stronger content semantics were found)
    if (allUrlsExternal && allUrlsInternal === false && items.length >= 2 && !PORTFOLIO_RE.test(combinedText) && !PROJECTS_RE.test(combinedText) && !PRODUCTS_RE.test(combinedText)) {
      return { collectionId: collection.id, type: 'PARTNER_LINKS', confidence: 0.75, reason: 'repeated external partner / brand links' };
    }

    return { collectionId: collection.id, type: 'UNKNOWN', confidence: 0.4, reason: 'insufficient evidence' };
  }

  classifySection(ctx: SectionClassificationContext): SectionClassification {
    const { section, sourceDocument: doc, pageClassification: page, collectionClassifications } = ctx;
    const heading = norm(section.heading);
    const text = `${section.paragraphs.join(' ')} ${section.lists.flat().join(' ')}`.toLowerCase();
    const selector = (section.domPath || '').toLowerCase();
    const evidenceList: Evidence[] = [pageEvidence(doc, 'section', heading, 0.6)];

    if (section.region === 'chrome' || /header|footer|nav|menu|sidebar/.test(selector)) {
      if (UTILITY_MARKERS.test(heading + ' ' + text)) {
        return { sectionId: section.id, type: 'UTILITY', confidence: 0.8, evidence: evidenceList };
      }
      return { sectionId: section.id, type: 'NAVIGATION', confidence: 0.8, evidence: evidenceList };
    }

    // If section contains a collection classified as language/theme/ad, inherit that role
    for (const col of section.collections || []) {
      const cc = collectionClassifications.find((c) => c.collectionId === col.id);
      if (cc) {
        if (cc.type === 'LANGUAGE_SWITCHER') return { sectionId: section.id, type: 'LANGUAGE_SWITCHER', confidence: cc.confidence, evidence: evidenceList };
        if (cc.type === 'THEME_WIDGET') return { sectionId: section.id, type: 'THEME_WIDGET', confidence: cc.confidence, evidence: evidenceList };
        if (cc.type === 'ADVERTISEMENT') return { sectionId: section.id, type: 'ADVERTISEMENT', confidence: cc.confidence, evidence: evidenceList };
        if (cc.type === 'NAVIGATION') return { sectionId: section.id, type: 'NAVIGATION', confidence: cc.confidence, evidence: evidenceList };
      }
    }

    if (AD_MARKERS.test(heading + ' ' + text) || /ads?|advertisement|banner|promo|sponsored/.test(selector)) {
      return { sectionId: section.id, type: 'ADVERTISEMENT', confidence: 0.85, evidence: evidenceList };
    }

    // Contact details
    const contactSignals = /(phone|email|address|котакты|контакты|kontakty|адрес|телефон|e-mail|write us|find us|location|map|opening hours|working hours|часы работы|режим работы|график)/iu;
    if (contactSignals.test(heading + ' ' + text) || page.type === 'CONTACTS') {
      const hasContact = doc.chrome.contacts?.phones?.length || doc.chrome.contacts?.emails?.length || text.match(/[\(\+]\d/) || text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (hasContact) return { sectionId: section.id, type: 'CONTACT_DETAILS', confidence: 0.85, evidence: evidenceList };
    }

    // Hero
    if (section.order === 0 && section.images.length > 0 && (section.paragraphs.length <= 2 || (section.heading?.length ?? 0) < 80)) {
      return { sectionId: section.id, type: 'HERO_CONTENT', confidence: 0.7, evidence: evidenceList };
    }

    // Statistics
    if (/\d{2,}%?\s*(\+|employees?|clients?|projects?|years?|лет|опыт|works?|объектов|клиентов|сотрудников|проектов)/i.test(text) || /(stat|metrics?|numbers?|цифры|достижения|achievements|facts|факты)/iu.test(heading)) {
      return { sectionId: section.id, type: 'STATISTICS', confidence: 0.75, evidence: evidenceList };
    }

    // Testimonial
    if (/(testimonial|review|отзыв|quote|“|"|«|recommend|client said)/iu.test(text) && text.length > 40) {
      return { sectionId: section.id, type: 'TESTIMONIAL', confidence: 0.72, evidence: evidenceList };
    }

    // Team
    if (/(team|staff|people|наша команда|сотрудники|руководство|management|directors?)/iu.test(heading + ' ' + selector)) {
      return { sectionId: section.id, type: 'TEAM', confidence: 0.7, evidence: evidenceList };
    }

    // CTA
    if (/(call to action|cta|заказать|contact us|получить|узнать|request|order|call|consultation|бесплатная|free|callback|ostavit zayavku|contact|связаться)/iu.test(heading)) {
      return { sectionId: section.id, type: 'CTA', confidence: 0.72, evidence: evidenceList };
    }

    // Page-specific semantic roles
    if (page.type === 'ABOUT' || page.type === 'HOME') {
      if (section.order === 0 || /(about|company|о компании|о нас|mission|vision|values|история|history|mission)/iu.test(heading)) {
        return { sectionId: section.id, type: 'COMPANY_DESCRIPTION', confidence: 0.78, evidence: evidenceList };
      }
      return { sectionId: section.id, type: 'COMPANY_DESCRIPTION', confidence: 0.6, evidence: evidenceList };
    }
    if (page.type === 'SERVICE_DETAIL' || page.type === 'SERVICES_INDEX') return { sectionId: section.id, type: 'SERVICE_DESCRIPTION', confidence: 0.7, evidence: evidenceList };
    if (page.type === 'PROJECT_DETAIL' || page.type === 'PROJECTS_INDEX') return { sectionId: section.id, type: 'PROJECT_DESCRIPTION', confidence: 0.7, evidence: evidenceList };
    if (page.type === 'NEWS_DETAIL' || page.type === 'NEWS_INDEX') return { sectionId: section.id, type: 'ARTICLE_BODY', confidence: 0.75, evidence: evidenceList };

    if (section.paragraphs.length >= 2) {
      return { sectionId: section.id, type: 'COMPANY_DESCRIPTION', confidence: 0.45, evidence: evidenceList };
    }

    return { sectionId: section.id, type: 'UNKNOWN', confidence: 0.35, evidence: evidenceList };
  }

  classifyMedia(ctx: MediaClassificationContext): ImageCandidate {
    const { image, sourceDocument: doc, section, collection } = ctx;
    const { width = 0, height = 0 } = image;
    const alt = norm(image.alt);
    const selector = (image.domPath || '').toLowerCase();
    const src = image.src || '';
    const href = norm(image.href || '');
    const contextText = `${alt} ${selector} ${href}`;

    const provenance: ImageCandidate['provenance'] = {
      sourceDocumentIds: [doc.id],
      sourceSectionIds: section ? [section.id] : undefined,
      sourceCollectionIds: collection ? [collection.id] : undefined,
      sourceUrls: [src],
      evidenceText: contextText.slice(0, 200),
    };

    if (AD_MARKERS.test(contextText) || AD_DOMAINS.test(src) || /ads?|advertisement|banner|promo|sponsored/.test(selector)) {
      return { id: id(), src, alt: image.alt, width, height, role: 'ADVERTISEMENT', confidence: 0.85, provenance };
    }
    if (UTILITY_MARKERS.test(contextText) && (width < 64 || height < 64)) {
      return { id: id(), src, alt: image.alt, width, height, role: 'UTILITY_ICON', confidence: 0.85, provenance };
    }
    if (LANG_LABELS.test(contextText) || /lang|language|translate|flag|gtranslate|weglot|wpml/.test(selector)) {
      return { id: id(), src, alt: image.alt, width, height, role: 'LANGUAGE_ICON', confidence: 0.88, provenance };
    }
    if (image.provenance?.isLogo || /logo|brand|логотип/.test(alt + ' ' + selector)) {
      return { id: id(), src, alt: image.alt, width, height, role: 'LOGO', confidence: 0.85, provenance };
    }
    if (image.provenance?.isHero || (section?.order === 0 && width > 600 && height > 300)) {
      return { id: id(), src, alt: image.alt, width, height, role: 'HERO_CANDIDATE', confidence: 0.7, provenance };
    }

    // Infer from section/collection role
    if (section) {
      const secType = section.domPath ? '' : '';
      if (/service/.test(selector + ' ' + alt) || /service/.test(section.domPath || '')) {
        return { id: id(), src, alt: image.alt, width, height, role: 'SERVICE_IMAGE', confidence: 0.6, provenance };
      }
      if (/project|portfolio/.test(selector + ' ' + alt + ' ' + (section.domPath || ''))) {
        return { id: id(), src, alt: image.alt, width, height, role: 'PROJECT_IMAGE', confidence: 0.6, provenance };
      }
      if (/news|article/.test(selector + ' ' + alt + ' ' + (section.domPath || ''))) {
        return { id: id(), src, alt: image.alt, width, height, role: 'ARTICLE_IMAGE', confidence: 0.6, provenance };
      }
    }

    return { id: id(), src, alt: image.alt, width, height, role: 'UNKNOWN', confidence: 0.35, provenance };
  }

  extractCompany(ctx: EntityExtractionContext): CompanyEntity | undefined {
    const home = ctx.sourceDocuments.find((d) => d.isHomepage) || ctx.sourceDocuments[0];
    if (!home) return undefined;

    const candidates: { value: string; score: number; evidence: Evidence }[] = [];

    // JSON-LD Organization / LocalBusiness
    for (const sd of home.structuredData || []) {
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.legalName) {
          candidates.push({
            value: String(obj.legalName),
            score: 95,
            evidence: evidence('jsonld-legalName', String(obj.legalName), 0.95, { sourceDocumentId: home.id, context: 'Organization.legalName' }),
          });
        }
        if (obj['@graph']) obj['@graph'].forEach(scan);
      };
      scan(sd);
    }

    // OpenGraph site_name
    if (home.openGraph['og:site_name'] && !isGenericCompanyName(home.openGraph['og:site_name'])) {
      candidates.push({ value: home.openGraph['og:site_name'], score: 82, evidence: evidence('og:site_name', home.openGraph['og:site_name'], 0.82, { sourceDocumentId: home.id }) });
    }

    // Title segments: site names are often the last non-generic part, but can be first
    const titleParts = home.title
      .split(/\s*[|–—]\s*|\s+-\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const titleCandidates = titleParts
      .map((raw) => ({ raw, cleaned: cleanCompanyName(raw) }))
      .filter((p) => p.cleaned && !isGenericCompanyName(p.cleaned) && p.cleaned.length > 2)
      .map((p) => {
        const legalFormBonus = /(?:ООО|ОАО|ЗАО|АО|УП|РУП|ОДО|ТЧУП|ЧУП|ГУП|КУП|СООО|ТОО|ИП|LLC|Inc\.?|Ltd\.?|GmbH|PLC|JSC)/iu.test(p.raw) ? 1000 : 0;
        const wordCount = p.cleaned.split(/\s+/).length;
        return { value: p.cleaned, score: 80 + legalFormBonus - wordCount * 5 };
      });
    const bestTitle = pickBest(titleCandidates);
    if (bestTitle) {
      candidates.push({ value: bestTitle, score: 80, evidence: evidence('title', bestTitle, 0.8, { sourceDocumentId: home.id }) });
    }

    // Structured Organization.name may contain whole title; treat it like a title segment
    for (const sd of home.structuredData || []) {
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.name && typeof obj.name === 'string' && !obj.legalName) {
          const cleaned = cleanCompanyName(String(obj.name));
          if (cleaned && !isGenericCompanyName(cleaned) && cleaned.length > 2) {
            const legalFormBonus = /(?:ООО|ОАО|ЗАО|АО|УП|РУП|ОДО|ТЧУП|ЧУП|ГУП|КУП|СООО|ТОО|ИП|LLC|Inc\.?|Ltd\.?|GmbH|PLC|JSC)/iu.test(String(obj.name)) ? 1000 : 0;
            const wordCount = cleaned.split(/\s+/).length;
            candidates.push({ value: cleaned, score: 85 + legalFormBonus - wordCount * 5, evidence: evidence('jsonld-name', String(obj.name), 0.85, { sourceDocumentId: home.id, context: 'Organization.name' }) });
          }
        }
        if (obj['@graph']) obj['@graph'].forEach(scan);
      };
      scan(sd);
    }

    // Logo alt
    if (home.chrome.logo?.alt && !isGenericCompanyName(home.chrome.logo.alt)) {
      candidates.push({ value: cleanCompanyName(home.chrome.logo.alt), score: 75, evidence: evidence('logo-alt', home.chrome.logo.alt, 0.75, { sourceDocumentId: home.id }) });
    }

    // Homepage H1
    if (home.h1 && !isGenericCompanyName(home.h1)) {
      candidates.push({ value: cleanCompanyName(home.h1), score: 70, evidence: evidence('h1', home.h1, 0.7, { sourceDocumentId: home.id }) });
    }

    if (!candidates.length) return undefined;
    const sorted = candidates.sort((a, b) => b.score - a.score);
    const legalCandidate = sorted.find((c) => c.score >= 90 && c.evidence.type === 'jsonld-legalName');
    const nameCandidate = sorted.find((c) => c.score < 95 && c.score >= 70) || sorted[0];
    const display = cleanCompanyName(nameCandidate.value);
    const legalName = legalCandidate ? legalCandidate.value : undefined;
    const short = cleanCompanyName(display);

    const founded = this.findFact(ctx, 'FOUNDING_DATE');
    const companyText = `${home.title} ${home.h1 || ''} ${home.mainText || ''}`;
    const empMatch = companyText.match(EMPLOYEES_RE);
    const unpMatch = companyText.match(UNP_RE);
    const cleanMatch = (m: RegExpMatchArray | null) => m ? m[0].replace(/\s+/g, ' ').trim() : undefined;

    return {
      id: id(),
      title: display,
      displayName: short || display,
      legalName,
      shortName: short || display,
      description: this.extractCompanyDescription(ctx, home),
      confidence: nameCandidate.evidence.confidence,
      status: 'OK',
      sourceDocumentIds: [home.id],
      evidence: candidates.slice(0, 4).map((c) => c.evidence),
      founded: founded?.value,
      employees: cleanMatch(empMatch),
      unp: cleanMatch(unpMatch),
    };
  }

  private extractCompanyDescription(ctx: EntityExtractionContext, home: SourceDocument): string | undefined {
    const desc = home.metaDescription;
    if (desc && desc.length > 20 && desc.length < 500) return desc;
    const sections = ctx.sectionClassifications.get(home.id) || [];
    for (const sec of home.sections) {
      const sc = sections.find((s) => s.sectionId === sec.id);
      if (sc?.type === 'COMPANY_DESCRIPTION' && sec.paragraphs.length) {
        return sec.paragraphs.join(' ').slice(0, 500);
      }
    }
    const firstMain = home.sections.find((s) => s.region === 'main' && s.paragraphs.length);
    if (firstMain) return firstMain.paragraphs.join(' ').slice(0, 500);
    return undefined;
  }

  private findFact(ctx: EntityExtractionContext, type: string): FactEntity | undefined {
    return ctx.sourceDocuments
      .flatMap((d) => d.evidence?.dates?.map((dt) => ({ doc: d, dt })) || [])
      .filter(({ dt }) => (type === 'FOUNDING_DATE' && /foundingDate|startDate|founded|since|создан|основан/.test(dt.type + ' ' + dt.context)) || false)
      .map(({ doc, dt }) => ({
        id: id(),
        type: 'FOUNDING_DATE',
        value: dt.text,
        confidence: dt.type === 'jsonld' ? 0.9 : 0.6,
        evidence: [evidence(dt.type, dt.text, dt.type === 'jsonld' ? 0.9 : 0.6, { sourceDocumentId: doc.id, context: dt.context })],
      }))[0];
  }

  extractContacts(ctx: EntityExtractionContext): ContactsEntity | undefined {
    const contactDoc = ctx.sourceDocuments.find((d) => ctx.pageClassifications.get(d.id)?.type === 'CONTACTS');
    const home = ctx.sourceDocuments.find((d) => d.isHomepage) || ctx.sourceDocuments[0];
    const docs = contactDoc ? [contactDoc, home] : [home];
    if (!docs.length) return undefined;

    const phones: ContactsEntity['phones'] = [];
    const emails: ContactsEntity['emails'] = [];
    const addresses: ContactsEntity['addresses'] = [];
    const socialLinks: ContactsEntity['socialLinks'] = [];
    const seen = new Set<string>();

    for (const doc of docs) {
      const chrome = doc.chrome.contacts;
      for (const p of chrome?.phones || []) {
        if (!seen.has(p)) {
          seen.add(p);
          phones.push({ value: p, evidence: evidence('chrome-phone', p, 0.85, { sourceDocumentId: doc.id }) });
        }
      }
      for (const e of chrome?.emails || []) {
        if (!seen.has(e)) {
          seen.add(e);
          emails.push({ value: e, evidence: evidence('chrome-email', e, 0.85, { sourceDocumentId: doc.id }) });
        }
      }
      for (const a of chrome?.addresses || []) {
        if (!seen.has(a)) {
          seen.add(a);
          addresses.push({ value: a, evidence: evidence('chrome-address', a, 0.7, { sourceDocumentId: doc.id }) });
        }
      }
      for (const s of chrome?.socialLinks || []) {
        const key = `${s.platform}:${s.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          socialLinks.push({ platform: s.platform, url: s.url, evidence: evidence('chrome-social', s.url, 0.8, { sourceDocumentId: doc.id, context: s.platform }) });
        }
      }

      const sections = ctx.sectionClassifications.get(doc.id) || [];
      for (const sec of doc.sections) {
        const sc = sections.find((s) => s.sectionId === sec.id);
        if (sc?.type === 'CONTACT_DETAILS' || doc === contactDoc) {
          const text = sec.paragraphs.join('\n');
          const phoneMatches = text.match(/[\(\+]\d(?:[\s\(\)\-]?\d){6,30}/g) || [];
          for (const p of phoneMatches) {
            const clean = p.replace(/\s+/g, ' ').trim();
            if (clean.replace(/[^\d]/g, '').length >= 7 && !seen.has(clean)) {
              seen.add(clean);
              phones.push({ value: clean, evidence: evidence('section-phone', clean, 0.75, { sourceDocumentId: doc.id, sourceSectionId: sec.id }) });
            }
          }
          const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
          for (const e of emailMatches) {
            if (!seen.has(e)) {
              seen.add(e);
              emails.push({ value: e, evidence: evidence('section-email', e, 0.8, { sourceDocumentId: doc.id, sourceSectionId: sec.id }) });
            }
          }
        }
      }
    }

    if (!phones.length && !emails.length && !addresses.length && !socialLinks.length) return undefined;

    return {
      id: id(),
      phones: phones.slice(0, 5),
      emails: emails.slice(0, 5),
      addresses: addresses.slice(0, 3),
      socialLinks: socialLinks.slice(0, 10),
      workingHours: undefined,
      confidence: phones.length || emails.length ? 0.85 : 0.55,
      sourceDocumentIds: docs.map((d) => d.id),
      evidence: [...(phones[0]?.evidence ? [phones[0].evidence] : []), ...(emails[0]?.evidence ? [emails[0].evidence] : [])],
    };
  }

  extractServices(ctx: EntityExtractionContext): ServiceEntity[] {
    const services: ServiceEntity[] = [];
    const byUrl = new Map<string, ServiceEntity>();

    // Detail pages first
    for (const doc of ctx.sourceDocuments) {
      const pc = ctx.pageClassifications.get(doc.id);
      if (pc?.type !== 'SERVICE_DETAIL') continue;
      const h1 = doc.h1 || doc.title || '';
      const title = isGenericHeading(h1) ? lastSegment(doc.url).replace(/[-_]/g, ' ') : cleanCompanyName(h1);
      const sections = ctx.sectionClassifications.get(doc.id) || [];
      const descParts: string[] = [];
      for (const sec of doc.sections) {
        const sc = sections.find((s) => s.sectionId === sec.id);
        if ((sc?.type === 'SERVICE_DESCRIPTION' || sec.region === 'main') && sec.paragraphs.length) {
          descParts.push(...sec.paragraphs);
        }
      }
      const description = descParts.join(' ').slice(0, 1200) || undefined;
      const imgs = this.imagesForDoc(ctx, doc, ['SERVICE_IMAGE', 'HERO_CANDIDATE', 'UNKNOWN']);
      const e: ServiceEntity = {
        id: id(),
        title,
        description,
        confidence: pc.confidence * (description ? 1 : 0.75),
        status: description ? 'OK' : 'LOW_CONFIDENCE',
        sourceDocumentIds: [doc.id],
        sourceSectionIds: doc.sections.filter((s) => s.region === 'main').map((s) => s.id),
        imageIds: imgs.map((i) => i.id),
        evidence: pc.evidence,
      };
      services.push(e);
      byUrl.set(doc.url, e);
    }

    // Service collections can appear on any page when the collection itself is strongly classified
    for (const doc of ctx.sourceDocuments) {
      const colls = ctx.collectionClassifications.get(doc.id) || [];
      for (const col of doc.collections || []) {
        const cc = colls.find((c) => c.collectionId === col.id);
        if (cc?.type !== 'CONTENT_COLLECTION' || cc.contentSubtype !== 'SERVICES') continue;
        for (const item of col.items) {
          if (!item.title) continue;
          const resolvedUrl = item.url ? this.resolveUrl(item.url, ctx.baseUrl) : undefined;
          if (resolvedUrl) {
            try { if (new URL(resolvedUrl).pathname === new URL(doc.url).pathname) continue; } catch {}
          }
          if (resolvedUrl && byUrl.has(resolvedUrl)) {
            const existing = byUrl.get(resolvedUrl)!;
            existing.sourceCollectionIds = [...new Set([...(existing.sourceCollectionIds || []), col.id])];
            if (item.description && !existing.description) existing.description = item.description.slice(0, 1200);
            existing.evidence.push(evidence('collection-item', item.title, 0.65, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl }));
            continue;
          }
          // Evidence first: a collection card needs its own URL or a description, and a non-generic title
          if (isGenericHeading(item.title) && !item.description) continue;
          if (!resolvedUrl && !item.description) continue;
          const imgs = item.image ? [this.imageIdForSrc(ctx, item.image.src)] : [];
          const e: ServiceEntity = {
            id: id(),
            title: item.title,
            description: item.description?.slice(0, 1200),
            confidence: resolvedUrl ? 0.7 : 0.55,
            status: resolvedUrl || item.description ? 'OK' : 'LOW_CONFIDENCE',
            sourceDocumentIds: [doc.id],
            sourceCollectionIds: [col.id],
            imageIds: imgs.filter(Boolean) as string[],
            evidence: [evidence('collection-item', item.title, 0.65, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl || doc.url })],
          };
          services.push(e);
          if (resolvedUrl) byUrl.set(resolvedUrl, e);
        }
      }
    }

    return this.deduplicateEntities(services);
  }

  extractProjects(ctx: EntityExtractionContext): ProjectEntity[] {
    const projects: ProjectEntity[] = [];
    const byUrl = new Map<string, ProjectEntity>();

    for (const doc of ctx.sourceDocuments) {
      const pc = ctx.pageClassifications.get(doc.id);
      if (pc?.type !== 'PROJECT_DETAIL') continue;
      const title = isGenericHeading(doc.h1 || '') ? lastSegment(doc.url).replace(/[-_]/g, ' ') : cleanCompanyName(doc.h1 || doc.title);
      const desc = this.descriptionFromMainSections(doc, ctx, 'PROJECT_DESCRIPTION');
      const e: ProjectEntity = {
        id: id(),
        title,
        description: desc,
        confidence: pc.confidence,
        status: desc ? 'OK' : 'LOW_CONFIDENCE',
        sourceDocumentIds: [doc.id],
        sourceSectionIds: doc.sections.filter((s) => s.region === 'main').map((s) => s.id),
        imageIds: this.imagesForDoc(ctx, doc, ['PROJECT_IMAGE', 'HERO_CANDIDATE', 'UNKNOWN']).map((i) => i.id),
        evidence: pc.evidence,
      };
      projects.push(e);
      byUrl.set(doc.url, e);
    }

    // Project collections can appear on any page (home, about, dedicated index, etc.)
    for (const doc of ctx.sourceDocuments) {
      const colls = ctx.collectionClassifications.get(doc.id) || [];
      for (const col of doc.collections || []) {
        const cc = colls.find((c) => c.collectionId === col.id);
        if (cc?.type !== 'CONTENT_COLLECTION' || cc.contentSubtype !== 'PROJECTS') continue;

        // Pre-compute URL prefix relationships so category landing pages can be identified.
        const itemUrls = col.items.map((it) => it.url);
        let currentCategory: string | undefined;
        let currentStatus: string | undefined;

        for (const item of col.items) {
          let title: string | undefined = item.title && item.title.trim() ? item.title : titleFromDescription(item.description || '');
          if (!title) continue;

          // The collection heading itself is not an entity, even if it appears as an item.
          if (norm(title) === norm(col.heading || '')) continue;

          // Carry over an explicit group from the parser (e.g. a heading preceding concrete cards).
          if (item.group) currentCategory = item.group;

          const resolvedUrl = item.url ? this.resolveUrl(item.url, ctx.baseUrl) : undefined;

          // Detect group labels: project category / project status headings are not concrete projects.
          const groupKind = item.isGroup ? 'category' : isGroupLabel(title);
          const categoryLanding = item.url && isCategoryLandingUrl(item.url, itemUrls);
          if (groupKind === 'status' || groupKind === 'category' || categoryLanding || item.isGroup) {
            if (groupKind === 'status') currentStatus = title;
            if (groupKind === 'category' || categoryLanding || item.isGroup) currentCategory = title;
            continue;
          }

          // A collection heading like "Completed Projects" or a status label is not a concrete project.
          if (isGenericHeading(title) && !item.description && !item.image) continue;

          if (resolvedUrl) {
            try { if (new URL(resolvedUrl).pathname === new URL(doc.url).pathname) continue; } catch {}
            if (byUrl.has(resolvedUrl)) {
              const existing = byUrl.get(resolvedUrl)!;
              existing.sourceCollectionIds = [...new Set([...(existing.sourceCollectionIds || []), col.id])];
              if (item.image) {
                const imgId = this.imageIdForSrc(ctx, item.image.src);
                if (imgId && !existing.imageIds?.includes(imgId)) existing.imageIds = [...(existing.imageIds || []), imgId];
              }
              if (item.description && !existing.description) existing.description = item.description.slice(0, 1200);
              // Update group metadata if it was missing.
              if (!existing.category && currentCategory) existing.category = currentCategory;
              if (!existing.projectStatus && currentStatus) existing.projectStatus = currentStatus;
              continue;
            }
          }

          // A project card needs at least a meaningful title and either a URL or an image; description is optional
          if (!resolvedUrl && !item.image && !item.description) continue;

          // Reject entries that are really timeline facts, CTAs, or awards without a project object.
          if (!isConcreteProjectEvidence(item, resolvedUrl, title)) continue;

          const imgs = item.image ? [this.imageIdForSrc(ctx, item.image.src)] : [];
          const hasEvidence = resolvedUrl || item.image || (item.description || '').length > 20;
          const e: ProjectEntity = {
            id: id(),
            title,
            description: item.description?.slice(0, 1200),
            category: currentCategory,
            projectStatus: currentStatus,
            confidence: hasEvidence ? 0.75 : 0.55,
            status: hasEvidence ? 'OK' : 'LOW_CONFIDENCE',
            sourceDocumentIds: [doc.id],
            sourceCollectionIds: [col.id],
            imageIds: imgs.filter(Boolean) as string[],
            evidence: [evidence('collection-item', title, 0.7, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl || item.url || doc.url })],
          };
          projects.push(e);
          if (resolvedUrl) byUrl.set(resolvedUrl, e);
        }
      }
    }

    return this.deduplicateEntities(projects) as ProjectEntity[];
  }

  extractNews(ctx: EntityExtractionContext): NewsEntity[] {
    const news: NewsEntity[] = [];
    const byUrl = new Map<string, NewsEntity>();

    for (const doc of ctx.sourceDocuments) {
      const pc = ctx.pageClassifications.get(doc.id);
      if (pc?.type !== 'NEWS_DETAIL') continue;
      const title = isGenericHeading(doc.h1 || '') ? lastSegment(doc.url).replace(/[-_]/g, ' ') : cleanCompanyName(doc.h1 || doc.title);
      const pageText = `${doc.h1 || ''} ${doc.title || ''} ${doc.metaDescription || ''}`;
      if (isInvestorOrReportContent(pageText, doc.url)) continue;
      const date = this.extractDate(ctx, doc);
      const desc = this.descriptionFromMainSections(doc, ctx, 'ARTICLE_BODY');
      const newsEvidence: Evidence[] = [evidence('page-detail', title, pc.confidence, { sourceDocumentId: doc.id, sourceUrl: doc.url }), ...pc.evidence];
      if (date) {
        newsEvidence.push(date.evidence);
      } else {
        newsEvidence.push({ type: 'no-date', value: 'no published date evidence found', confidence: 0.5, sourceDocumentId: doc.id });
      }
      const e: NewsEntity = {
        id: id(),
        title,
        description: desc,
        date: date?.value ?? null,
        confidence: pc.confidence,
        status: desc ? 'OK' : 'LOW_CONFIDENCE',
        sourceDocumentIds: [doc.id],
        sourceSectionIds: doc.sections.filter((s) => s.region === 'main').map((s) => s.id),
        imageIds: this.imagesForDoc(ctx, doc, ['ARTICLE_IMAGE', 'HERO_CANDIDATE', 'UNKNOWN']).map((i) => i.id),
        evidence: newsEvidence,
      };
      news.push(e);
      const canonicalUrl = this.resolveUrl(doc.url, ctx.baseUrl) || doc.url;
      byUrl.set(canonicalUrl, e);
    }

    for (const doc of ctx.sourceDocuments) {
      const pc = ctx.pageClassifications.get(doc.id);
      if (pc?.type !== 'NEWS_INDEX') continue;
      const colls = ctx.collectionClassifications.get(doc.id) || [];
      for (const col of doc.collections || []) {
        const cc = colls.find((c) => c.collectionId === col.id);
        if (cc?.type !== 'CONTENT_COLLECTION' || cc.contentSubtype !== 'NEWS') continue;
        for (const item of col.items) {
          if (!item.title) continue;
          const resolvedUrl = item.url ? this.resolveUrl(item.url, ctx.baseUrl) : undefined;
          if (resolvedUrl) {
            try { if (new URL(resolvedUrl).pathname === new URL(doc.url).pathname) continue; } catch {}
            if (byUrl.has(resolvedUrl)) {
              // Merge the index-card evidence into the existing detail-page News entity.
              const existing = byUrl.get(resolvedUrl)!;
              existing.sourceCollectionIds = [...new Set([...(existing.sourceCollectionIds || []), col.id])];
              existing.sourceDocumentIds = [...new Set([...existing.sourceDocumentIds, doc.id])];
              if (item.description && !existing.description) existing.description = item.description.slice(0, 1200);
              if (item.image) {
                const imgId = this.imageIdForSrc(ctx, item.image.src);
                if (imgId && !existing.imageIds?.includes(imgId)) existing.imageIds = [...(existing.imageIds || []), imgId];
              }
              existing.evidence.push(evidence('collection-item', item.title, 0.6, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl }));
              continue;
            }
          }
          if (isGenericHeading(item.title) && !item.description) continue;
          if (!resolvedUrl && !item.description) continue;
          if (isInvestorOrReportContent(item.title, resolvedUrl || item.url)) continue;
          const date = this.extractDateFromItem(item, doc);
          const imgs = item.image ? [this.imageIdForSrc(ctx, item.image.src)] : [];
          const e: NewsEntity = {
            id: id(),
            title: item.title,
            description: item.description?.slice(0, 1200),
            date: date?.value,
            confidence: resolvedUrl ? 0.65 : 0.5,
            status: resolvedUrl || item.description ? 'OK' : 'LOW_CONFIDENCE',
            sourceDocumentIds: [doc.id],
            sourceCollectionIds: [col.id],
            imageIds: imgs.filter(Boolean) as string[],
            evidence: [evidence('collection-item', item.title, 0.6, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl || doc.url })],
          };
          news.push(e);
          if (resolvedUrl) byUrl.set(resolvedUrl, e);
        }
      }
    }

    return this.deduplicateEntities(news) as NewsEntity[];
  }

  extractVacancies(ctx: EntityExtractionContext): VacancyEntity[] {
    const vacancies: VacancyEntity[] = [];
    const byUrl = new Map<string, VacancyEntity>();

    for (const doc of ctx.sourceDocuments) {
      const pc = ctx.pageClassifications.get(doc.id);
      if (pc?.type !== 'VACANCY_DETAIL') continue;
      const title = isGenericHeading(doc.h1 || '') ? lastSegment(doc.url).replace(/[-_]/g, ' ') : cleanCompanyName(doc.h1 || doc.title);
      const desc = this.descriptionFromMainSections(doc, ctx, 'COMPANY_DESCRIPTION');
      const e: VacancyEntity = {
        id: id(),
        title,
        description: desc,
        confidence: pc.confidence,
        status: desc ? 'OK' : 'LOW_CONFIDENCE',
        sourceDocumentIds: [doc.id],
        sourceSectionIds: doc.sections.filter((s) => s.region === 'main').map((s) => s.id),
        imageIds: this.imagesForDoc(ctx, doc, ['UNKNOWN']).map((i) => i.id),
        evidence: pc.evidence,
      };
      vacancies.push(e);
      byUrl.set(doc.url, e);
    }

    for (const doc of ctx.sourceDocuments) {
      const colls = ctx.collectionClassifications.get(doc.id) || [];
      for (const col of doc.collections || []) {
        const cc = colls.find((c) => c.collectionId === col.id);
        if (cc?.type !== 'CONTENT_COLLECTION' || cc.contentSubtype !== 'VACANCIES') continue;
        for (const item of col.items) {
          if (!item.title) continue;
          const resolvedUrl = item.url ? this.resolveUrl(item.url, ctx.baseUrl) : undefined;
          if (resolvedUrl) {
            try { if (new URL(resolvedUrl).pathname === new URL(doc.url).pathname) continue; } catch {}
            if (byUrl.has(resolvedUrl)) continue;
          }
          if (isGenericHeading(item.title) && !item.description) continue;
          if (!resolvedUrl && !item.description) continue;
          const imgs = item.image ? [this.imageIdForSrc(ctx, item.image.src)] : [];
          const e: VacancyEntity = {
            id: id(),
            title: item.title,
            description: item.description?.slice(0, 1200),
            confidence: resolvedUrl ? 0.7 : 0.55,
            status: resolvedUrl || item.description ? 'OK' : 'LOW_CONFIDENCE',
            sourceDocumentIds: [doc.id],
            sourceCollectionIds: [col.id],
            imageIds: imgs.filter(Boolean) as string[],
            evidence: [evidence('collection-item', item.title, 0.6, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl || doc.url })],
          };
          vacancies.push(e);
          if (resolvedUrl) byUrl.set(resolvedUrl, e);
        }
      }
    }

    return this.deduplicateEntities(vacancies) as VacancyEntity[];
  }

  extractProducts(ctx: EntityExtractionContext): ProductEntity[] {
    const products: ProductEntity[] = [];
    const byUrl = new Map<string, ProductEntity>();

    for (const doc of ctx.sourceDocuments) {
      const pc = ctx.pageClassifications.get(doc.id);
      if (pc?.type !== 'PRODUCT_DETAIL') continue;
      const title = isGenericHeading(doc.h1 || '') ? lastSegment(doc.url).replace(/[-_]/g, ' ') : cleanCompanyName(doc.h1 || doc.title);
      const desc = this.descriptionFromMainSections(doc, ctx, 'COMPANY_DESCRIPTION');
      const e: ProductEntity = {
        id: id(),
        title,
        description: desc,
        confidence: pc.confidence,
        status: desc ? 'OK' : 'LOW_CONFIDENCE',
        sourceDocumentIds: [doc.id],
        sourceSectionIds: doc.sections.filter((s) => s.region === 'main').map((s) => s.id),
        imageIds: this.imagesForDoc(ctx, doc, ['HERO_CANDIDATE', 'UNKNOWN']).map((i) => i.id),
        evidence: pc.evidence,
      };
      products.push(e);
      byUrl.set(doc.url, e);
    }

    for (const doc of ctx.sourceDocuments) {
      const colls = ctx.collectionClassifications.get(doc.id) || [];
      for (const col of doc.collections || []) {
        const cc = colls.find((c) => c.collectionId === col.id);
        if (cc?.type !== 'CONTENT_COLLECTION' || cc.contentSubtype !== 'PRODUCTS') continue;
        for (const item of col.items) {
          if (!item.title) continue;
          const resolvedUrl = item.url ? this.resolveUrl(item.url, ctx.baseUrl) : undefined;
          if (resolvedUrl) {
            try { if (new URL(resolvedUrl).pathname === new URL(doc.url).pathname) continue; } catch {}
            if (byUrl.has(resolvedUrl)) continue;
          }
          if (isGenericHeading(item.title) && !item.description) continue;
          if (!resolvedUrl && !item.description) continue;
          const imgs = item.image ? [this.imageIdForSrc(ctx, item.image.src)] : [];
          const e: ProductEntity = {
            id: id(),
            title: item.title,
            description: item.description?.slice(0, 1200),
            confidence: resolvedUrl ? 0.7 : 0.55,
            status: resolvedUrl || item.description ? 'OK' : 'LOW_CONFIDENCE',
            sourceDocumentIds: [doc.id],
            sourceCollectionIds: [col.id],
            imageIds: imgs.filter(Boolean) as string[],
            evidence: [evidence('collection-item', item.title, 0.6, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: resolvedUrl || doc.url })],
          };
          products.push(e);
          if (resolvedUrl) byUrl.set(resolvedUrl, e);
        }
      }
    }

    return this.deduplicateEntities(products) as ProductEntity[];
  }

  extractFacts(ctx: EntityExtractionContext): FactEntity[] {
    const facts: FactEntity[] = [];
    const seen = new Set<string>();

    for (const doc of ctx.sourceDocuments) {
      for (const dt of doc.evidence?.dates || []) {
        const isFounding = /foundingDate|startDate|founded|since|создан|основан|год основания|года|foundation/i.test(dt.type + ' ' + dt.context);
        if (isFounding && YEAR_RE.test(dt.text)) {
          const key = `FOUNDING_DATE:${dt.text}`;
          if (!seen.has(key)) {
            seen.add(key);
            facts.push({
              id: id(),
              type: 'FOUNDING_DATE',
              value: dt.text,
              confidence: dt.type === 'jsonld' ? 0.9 : 0.6,
              evidence: [evidence(dt.type, dt.text, dt.type === 'jsonld' ? 0.9 : 0.6, { sourceDocumentId: doc.id, context: dt.context })],
            });
          }
        }
      }

      const text = `${doc.title} ${doc.h1 || ''} ${doc.mainText || ''}`;
      const empMatch = text.match(EMPLOYEES_RE);
      if (empMatch) {
        const value = empMatch[0].trim();
        const key = `EMPLOYEE_COUNT:${value}`;
        if (!seen.has(key)) {
          seen.add(key);
          facts.push({ id: id(), type: 'EMPLOYEE_COUNT', value, confidence: 0.55, evidence: [evidence('text-match', value, 0.55, { sourceDocumentId: doc.id })] });
        }
      }

      const unpMatch = text.match(UNP_RE);
      if (unpMatch) {
        const key = `UNP:${unpMatch[0]}`;
        if (!seen.has(key)) {
          seen.add(key);
          facts.push({ id: id(), type: 'UNP', value: unpMatch[0], confidence: 0.5, evidence: [evidence('regex', unpMatch[0], 0.5, { sourceDocumentId: doc.id })] });
        }
      }
    }

    return facts;
  }

  extractRelationships(ctx: EntityExtractionContext): Relationship[] {
    const rels: Relationship[] = [];
    const pageMap = ctx.pageClassifications;
    for (const [docId, pc] of pageMap) {
      const doc = ctx.sourceDocuments.find((d) => d.id === docId);
      if (!doc) continue;
      for (const col of doc.collections || []) {
        const cc = (ctx.collectionClassifications.get(docId) || []).find((c) => c.collectionId === col.id);
        if (cc?.type !== 'CONTENT_COLLECTION') continue;
        for (const item of col.items) {
          if (!item.url) continue;
          const child = ctx.sourceDocuments.find((d) => sameUrl(d.url, item.url));
          if (!child) continue;
          const childPc = pageMap.get(child.id);
          const childType = childPc?.type;
          const relation = cc.contentSubtype === 'SERVICES' ? 'hasService' : cc.contentSubtype === 'PROJECTS' ? 'hasProject' : cc.contentSubtype === 'NEWS' ? 'hasArticle' : cc.contentSubtype === 'VACANCIES' ? 'hasVacancy' : cc.contentSubtype === 'PRODUCTS' ? 'hasProduct' : 'contains';
          rels.push({
            fromId: docId,
            fromType: pc.type,
            toId: child.id,
            toType: childType || 'OTHER',
            relation,
            evidence: [evidence('collection-link', item.title || item.url || '', 0.75, { sourceDocumentId: doc.id, sourceCollectionId: col.id, sourceUrl: item.url })],
          });
        }
      }
    }
    return rels;
  }

  private descriptionFromMainSections(doc: SourceDocument, ctx: EntityExtractionContext, preferredType: SectionClassification['type']): string | undefined {
    const sections = ctx.sectionClassifications.get(doc.id) || [];
    const parts: string[] = [];
    for (const sec of doc.sections) {
      const sc = sections.find((s) => s.sectionId === sec.id);
      if ((sc?.type === preferredType || sec.region === 'main') && sec.paragraphs.length) {
        parts.push(...sec.paragraphs);
      }
    }
    return parts.length ? parts.join(' ').slice(0, 1200) : undefined;
  }

  private imagesForDoc(ctx: EntityExtractionContext, doc: SourceDocument, allowedRoles: ImageCandidate['role'][]): ImageCandidate[] {
    return ctx.mediaCandidates.filter((i) => i.provenance.sourceDocumentIds?.includes(doc.id) && allowedRoles.includes(i.role));
  }

  private imageIdForSrc(ctx: EntityExtractionContext, src?: string): string | undefined {
    if (!src) return undefined;
    const img = ctx.mediaCandidates.find((i) => i.src === src);
    return img?.id;
  }

  private resolveUrl(url: string, baseUrl: string): string | undefined {
    if (!url) return undefined;
    try {
      const u = new URL(url, baseUrl);
      // remove fragment and trailing slash for stable identity
      const out = `${u.origin}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase() || u.origin;
      if (out === '/' || out === '') return undefined;
      return out;
    } catch { return url.toLowerCase().replace(/#$/, '').replace(/\/$/, '') || undefined; }
  }

  private deduplicateEntities<T extends { title: string; sourceDocumentIds: string[]; sourceSectionIds?: string[]; sourceCollectionIds?: string[]; evidence: Evidence[]; imageIds?: string[] }>(entities: T[]): T[] {
    const out: T[] = [];
    const byKey = new Map<string, T>();
    for (const e of entities) {
      const key = norm(e.title);
      const existing = byKey.get(key);
      if (existing) {
        existing.sourceDocumentIds = [...new Set([...existing.sourceDocumentIds, ...e.sourceDocumentIds])];
        existing.sourceSectionIds = [...new Set([...(existing.sourceSectionIds || []), ...(e.sourceSectionIds || [])])];
        existing.sourceCollectionIds = [...new Set([...(existing.sourceCollectionIds || []), ...(e.sourceCollectionIds || [])])];
        existing.imageIds = [...new Set([...(existing.imageIds || []), ...(e.imageIds || [])])];
        existing.evidence = [...existing.evidence, ...e.evidence];
        continue;
      }
      byKey.set(key, e);
      out.push(e);
    }
    return out;
  }

  private extractDate(ctx: EntityExtractionContext, doc: SourceDocument): { value: string; evidence: Evidence } | undefined {
    const dates = doc.evidence?.dates || [];
    for (const dt of dates) {
      if (/datePublished|startDate|article:published_time|time/.test(dt.type + ' ' + dt.context) && YEAR_RE.test(dt.text)) {
        return { value: dt.text, evidence: evidence(dt.type, dt.text, dt.type === 'jsonld' ? 0.9 : 0.75, { sourceDocumentId: doc.id, context: dt.context }) };
      }
    }
    // Look for visible article dates
    for (const sec of doc.sections) {
      for (const p of sec.paragraphs) {
        const m = p.match(/\b(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-](19|20)?\d{2}|(19|20)\d{2}[\.\/\-]\d{1,2}[\.\/\-]\d{1,2})\b/);
        if (m) return { value: m[0], evidence: evidence('visible-date', m[0], 0.5, { sourceDocumentId: doc.id, sourceSectionId: sec.id }) };
      }
    }
    return undefined;
  }

  private extractDateFromItem(item: any, doc: SourceDocument): { value: string; evidence: Evidence } | undefined {
    if (item.meta?.date && YEAR_RE.test(item.meta.date)) {
      return { value: item.meta.date, evidence: evidence('collection-meta-date', item.meta.date, 0.65, { sourceDocumentId: doc.id }) };
    }
    if (item.description && YEAR_RE.test(item.description)) {
      const m = item.description.match(/\b(19|20)\d{2}\b/);
      if (m) return { value: m[0], evidence: evidence('description-year', m[0], 0.4, { sourceDocumentId: doc.id }) };
    }
    return undefined;
  }
}
