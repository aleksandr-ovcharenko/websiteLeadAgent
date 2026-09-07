import { createHash } from 'node:crypto';
import type { SourceContentGraph, CollectionClassification } from '../semantic/schema.js';
import type { SourceDocument } from '../types.js';

// ---------------------------------------------------------------------------
// SiteContentPlan V2 — generation-sufficient contract.
// V1 answered "what did we extract?". V2 adjudicates the available evidence
// (entities, page classifications, relationships, collections, URLs, titles)
// into the EXACT content the generator will render. No semantic decision is
// left to the generator.
// ---------------------------------------------------------------------------

export type ContentOrigin = 'SOURCE_FACT' | 'SOURCE_CONTENT' | 'GENERATED_PRESENTATION';
export type EntityType = 'service' | 'project' | 'product' | 'article' | 'news' | 'vacancy';

export interface PlannedEntity {
  id: string;
  type: EntityType;
  title: string;
  slug: string;
  summary?: string;
  /** Clean 1–2 sentence card copy — scraped body/nav/CTA fragments removed. */
  cardSummary?: string;
  attributes: Record<string, string>;
  primaryImage?: string;
  media: string[];
  sourceUrls: string[];
  detailUrl?: string;
  evidence: { type: string; value: string; sourceUrl?: string }[];
  origin: ContentOrigin;
  confidence: number;
  onHomepage: boolean;
}

export type DynamicKind = 'FAQ' | 'REVIEWS' | 'PRICING' | 'PROCESS' | 'ADVANTAGES' | 'TEAM' | 'PARTNERS' | 'STATS' | 'PROMOTION' | 'OTHER' | 'IGNORED';

export interface PlannedDynamicSection {
  id: string;
  kind: DynamicKind;
  heading?: string;
  items: { title?: string; text?: string; meta?: Record<string, string> }[];
  sourcePages: string[];
  ignoredReason?: string;
}

export type SiteArchetype = 'SERVICE_PORTFOLIO' | 'CATALOG' | 'CREATIVE_PORTFOLIO';

export interface PlanExperience {
  /** Generic structural archetype — drives composition, NOT a domain check. */
  archetype: SiteArchetype;
  archetypeReason: string;
  brand: { name: string; source: string };
  /** Grounded presentation copy — may be rewritten from source text but never invents facts. */
  presentation: {
    heroHeadline: string;
    heroSubheadline?: string;
    heroCtaLabel: string;
    heroCtaSecondary?: string;
    sectionIntros: Record<string, string>;
  };
  /** Ordered homepage composition — component ids the renderer understands. */
  composition: { component: string; heading: string; entityIds: string[]; dynamicSectionId?: string }[];
  /** Three distinct style presets for demo variants (existing preset ids). */
  stylePresets: string[];
  preferredPreset: string;
}

export interface SiteContentPlanV2 {
  version: '2.0';
  generatedAt: string;
  siteKey: string;
  baseUrl: string;
  sourceGraphHash?: string;
  language: string;
  siteIdentity: {
    displayName?: string;
    legalName?: string;
    description?: string;
    industry?: string;
    founded?: string;
    employees?: string;
    unp?: string;
    evidenceDocIds: string[];
  };
  contacts: {
    phones: { value: string; sourceUrl?: string }[];
    emails: { value: string; sourceUrl?: string }[];
    addresses: { value: string; sourceUrl?: string }[];
    socialLinks: { platform: string; url: string }[];
    workingHours?: string;
  };
  sourceNavigation: { label: string; url?: string; order: number }[];
  plannedNavigation: { label: string; route: string; order: number }[];
  plannedPages: { route: string; kind: 'home' | 'collection' | 'detail' | 'corporate' | 'contacts' | 'dynamic'; title: string; entityType?: EntityType; entityId?: string }[];
  homepage: {
    sourceSections: { sectionId: string; type: string; heading?: string; itemCount: number }[];
    plannedSections: { type: string; heading: string; origin: ContentOrigin; entityIds: string[]; dynamicSectionId?: string; rationale: string }[];
  };
  entities: PlannedEntity[];
  dynamicSections: PlannedDynamicSection[];
  media: { logo?: string; hero?: string; images: { id: string; src: string; role: string }[] };
  omittedContent: { what: string; reason: string }[];
  warnings: string[];
  readiness: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  readinessReasons: string[];
  experience?: PlanExperience;
  planHash?: string;
}

// --- generic non-entity filters (NOT domain-specific) -------------------------

// \b does not work after Cyrillic — use a letter lookahead instead.
const CTA_RE = /^(посмотреть|смотреть|смотрите|узнать|узнайте|заказать|записаться|получить|оставить|отправить|позвонить|рассчитать|подробнее|читать|все|view|see|get|order|read more|learn more|call|show|more)(?![\p{L}])/iu;
const CATEGORY_RE = /^(все|портфолио|ремонты|квартиры|коттеджи|фасады|дома|объекты|работы|проекты|услуги|новости|статьи|категории|все проекты|готовые объекты|пентхаусы|частные дома|apartments?|houses?|portfolio|works|all)$/iu;
const QUESTION_CTA_RE = /^(планируете|хотите|нужен|нужна|думаете|собираетесь)(?![\p{L}])/iu;

/** UI/taxonomy labels are never concrete entities. */
function isNonEntityTitle(title: string, selfIndexUrls: Set<string>, url?: string): string | null {
  const t = (title || '').trim();
  if (!t) return 'empty title';
  if (CATEGORY_RE.test(t)) return 'category/filter label';
  if (CTA_RE.test(t)) return 'CTA label';
  if (QUESTION_CTA_RE.test(t)) return 'CTA question';
  if (t.split(/\s+/).length > 14 && !url) return 'marketing paragraph, not an entity';
  if (url && selfIndexUrls.has(url.replace(/\/+$/, ''))) return 'self-reference to index page';
  return null;
}

const digits = (s: string) => s.replace(/\D/g, '');

/** Strip nav/CTA/contact/process fragments; keep at most ~2 clean sentences. */
export function cleanCardSummary(raw: string | undefined, title: string): string | undefined {
  if (!raw) return undefined;
  const JUNK = /запросить|оставьте заявку|позвоните|звоните|закажите|заказать|записаться|получить консультац|получить консультацию|узнать (цену|стоимость)|подробнее|читать далее|порядок выполнения|наши контакты|все права|cookie|карта сайта|политика конфиденциальности|✔|➔|✓|тариф|menu|меню|наверх|call us|order now|read more/i;
  const PHONE = /\+?\d[\d\s()\-]{6,}/;
  const sentences = raw.split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/(получить консультац\S*|заказать|закажите|узнать (цену|стоимость)|оставить заявку|подробнее|читать далее|✔|➔|✓|тариф\s*«[^»]*»).*$/iu, '').trim())
    .filter((s) => {
    if (!s || s.length < 12) return false;
    if (JUNK.test(s) || PHONE.test(s)) return false;
    if (normTitle(s).includes(normTitle(title))) return false; // repeated heading
    if (/^\d+\s*[.\)]/.test(s)) return false; // "1. тёплая встреча" list fragments
    return true;
  });
  const out = sentences.slice(0, 2).join(' ');
  return out.length >= 20 ? out.slice(0, 200) : undefined;
}
const normTitle = (t: string) => (t || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”'‘’`]/g, '').replace(/\s+/g, ' ').trim();
/** Strip brand suffix (" - Пазл Хаус") and feed prefixes ("ЖК Минска X", "От дизайнера X") for canonical matching. */
const stripBrand = (t: string, brand?: string) => {
  let s = normTitle(t);
  const b = normTitle(brand || '');
  if (b.length >= 3) {
    const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`[\\s\\-–—|]+${esc}$`), '');
  }
  s = s.replace(/^(от\s+\S+\s+|жк\s+\S+\s+|тренды\s+)/iu, '');
  return s;
};

export function slugify(input: string): string {
  const s = input.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return s || `item-${Math.random().toString(36).slice(2, 8)}`;
}

function isPlaceholderMedia(src?: string): boolean {
  if (!src) return true;
  if (src.startsWith('data:image/svg')) return true;
  if (/placeholder|blank|spacer|pixel|1x1|lazy/i.test(src)) return true;
  return false;
}

// Dynamic-section kind detection from generic heading/item-shape evidence.
const KIND_HEADING: [RegExp, DynamicKind][] = [
  [/вопрос|часто спрашивают|faq|q&a/iu, 'FAQ'],
  [/отзыв|review|testimonial/iu, 'REVIEWS'],
  [/цен|прайс|стоимост|тариф|price|pricing|cost/iu, 'PRICING'],
  [/этап|как мы работаем|порядок|процесс|стадии|process|how we work/iu, 'PROCESS'],
  [/команда|сотрудник|team/iu, 'TEAM'],
  [/партнер|partner|клиенты/iu, 'PARTNERS'],
  [/преимуществ|почему мы|advantage|benefit|наши плюсы/iu, 'ADVANTAGES'],
  [/акци|скидк|promo|promotion|спецпредлож/iu, 'PROMOTION'],
];

function detectDynamicKind(heading: string | undefined, items: any[], classification?: CollectionClassification): { kind: DynamicKind; ignored?: string } {
  if (classification) {
    if (classification.type === 'NAVIGATION') return { kind: 'IGNORED', ignored: 'navigation chrome' };
    if (classification.type === 'SOCIAL_LINKS') return { kind: 'IGNORED', ignored: 'social links chrome' };
    if (classification.type === 'LANGUAGE_SWITCHER' || classification.type === 'THEME_WIDGET') return { kind: 'IGNORED', ignored: 'utility chrome' };
    if (classification.type === 'ADVERTISEMENT') return { kind: 'IGNORED', ignored: 'advertisement' };
    // CONTENT_COLLECTION with an entity subtype is an entity source, not a dynamic section.
    if (classification.type === 'CONTENT_COLLECTION' && classification.contentSubtype && classification.contentSubtype !== 'OTHER' && classification.contentSubtype !== 'UNKNOWN') {
      return { kind: 'IGNORED', ignored: `entity source: ${classification.contentSubtype}` };
    }
  }
  const h = heading || '';
  for (const [re, kind] of KIND_HEADING) if (re.test(h)) return { kind };
  // Item-shape evidence.
  const texts = items.map((i) => (i.title || i.text || '').trim()).filter(Boolean);
  if (texts.length >= 2 && texts.filter((t) => t.endsWith('?')).length >= Math.ceil(texts.length / 2)) return { kind: 'FAQ' };
  if (texts.length >= 2 && texts.filter((t) => /\d/.test(t) && /[₽$€Br]|\d+\s*(м2|м²|%|лет|год)/iu.test(t)).length >= texts.length / 2) return { kind: 'STATS' };
  if (items.some((i) => i.rating != null || (i.meta && (i.meta.author || i.meta.rating)))) return { kind: 'REVIEWS' };
  if (items.length >= 2 && items.filter((i) => /(руб|₽|\$|€|br\b|р\.)/iu.test(i.meta?.price || i.description || '')).length >= items.length / 2) return { kind: 'PRICING' };
  return { kind: 'OTHER' };
}

// Articles (editorial/blog) vs News — path- and title-shape evidence.
const ARTICLE_PATH_RE = /blog|stati|statya|articles?|sovety|journal|polezn|gids?|guide/iu;
const ARTICLE_TITLE_RE = /^(как |что такое|почему |этапы|ошибки|топ-?\d|\d+ (способ|вещ|совет|ошиб|причин|признак))/iu;

// Company display name: prefer brand evidence over SEO titles.
const GENERIC_LOGO_WORD_RE = /^(logo|logotip|лого|логотип|лого\s*\w*|logo\s*\w*|\w+\s+logo|\w+\s+logotip|.*\b(logo|logotip|лого)\b.*)$/iu;
function isGenericLogoText(s?: string): boolean {
  const v = (s || '').trim();
  if (!v) return true;
  return GENERIC_LOGO_WORD_RE.test(v) || /^(image|img|icon|иконка|картинка|banner|баннер)/iu.test(v);
}
function domainBrand(baseUrl: string): string | undefined {
  try {
    const host = new URL(baseUrl).hostname.replace(/^www\./, '');
    const sld = host.split('.')[0];
    return sld ? sld.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
  } catch { return undefined; }
}

function bestDisplayName(graph: SourceContentGraph, docs: SourceDocument[], baseUrl = ''): { name?: string; src: string } {
  const home = docs.find((d) => d.isHomepage);
  // JSON-LD / structured organization name
  const jsonldName = (home?.structuredData || [])
    .map((s: any) => s?.data?.name || s?.data?.['@graph']?.find?.((x: any) => x?.name)?.name)
    .find(Boolean);
  const cand = [
    { v: graph.company?.displayName, src: 'graph.company' },
    { v: home?.openGraph?.['og:site_name'], src: 'og:site_name' },
    { v: jsonldName, src: 'jsonld' },
    ...(home?.evidence?.companyNameCandidates || []).map((c) => ({ v: c.text, src: `candidate:${c.source}` })),
    { v: home?.chrome?.logo?.alt, src: 'logo.alt' },
  ];
  const isSeoTitle = (s?: string) => !!s && (s.length > 60 || /[,|—–-]\s*(в|и|для|под|от)\s/iu.test(s) || /минск|беларусь|недорого|цены|заказать/iu.test(s) && s.length > 30);
  // Pure descriptor phrase ("Дизайн интерьера в Минске") is not a brand —
  // prefer a domain-derived brand over it.
  const isDescriptor = (s?: string) => !!s && /в\s+минск|в\s+беларус|под\s+ключ|заказать|купить|цены/iu.test(s) && !/[A-Z]{2,}|[A-ZА-Я][a-zа-я]+\s+[A-ZА-Я]/u.test(s.replace(/в\s+минск\w*/iu, ''));
  for (const c of cand) {
    const v = (c.v || '').trim();
    if (v && v.length >= 2 && v.length <= 60 && !isSeoTitle(v) && !isGenericLogoText(v) && !isDescriptor(v)) return { name: v, src: c.src };
  }
  const g = (graph.company?.displayName || '').trim();
  if (g && !isGenericLogoText(g) && !isDescriptor(g)) return { name: g.slice(0, 60), src: 'graph.company' };
  return { name: domainBrand(baseUrl), src: 'domain' };
}

export function buildSiteContentPlanV2(opts: {
  siteKey: string;
  baseUrl: string;
  graph: SourceContentGraph;
  documents: SourceDocument[];
  sourceGraphHash?: string;
}): SiteContentPlanV2 {
  const { graph, documents: docs } = opts;
  const warnings: string[] = [];
  const omittedContent: SiteContentPlanV2['omittedContent'] = [];
  const docById = new Map(docs.map((d) => [d.id, d]));
  const docByUrl = new Map(docs.map((d) => [d.url.replace(/\/+$/, ''), d]));
  const absUrl = (u?: string) => { if (!u) return ''; try { return new URL(u, opts.baseUrl).toString(); } catch { return ''; } };
  const homeDoc = docs.find((d) => d.isHomepage);
  const language = homeDoc?.language || 'ru';
  const identity = bestDisplayName(graph, docs, opts.baseUrl);

  const indexUrls = new Set(
    graph.pages.filter((p) => /_INDEX$/.test(p.classification.type)).map((p) => (docById.get(p.sourceDocumentId)?.url || '').replace(/\/+$/, '')).filter(Boolean)
  );

  // --- entity materialization -------------------------------------------------
  const entities: PlannedEntity[] = [];
  const seenKey = new Set<string>(); // type + normalized title/url
  const byTitleIdx = new Map<string, number>();
  const homeNorm = homeDoc?.url?.replace(/\/+$/, '');
  const isDetailUrl = (u?: string) => !!u && u.replace(/\/+$/, '') !== homeNorm && !indexUrls.has(u.replace(/\/+$/, ''));

  const docSummary = (d?: SourceDocument) => (d?.metaDescription || d?.sections?.find((s) => s.paragraphs?.length)?.paragraphs?.[0] || '').slice(0, 400) || undefined;
  // Site-wide chrome detection: an image stem present on many docs is decoration.
  const docStemFreq = new Map<string, number>();
  const stemOf = (u: string) => {
    let f = (u || '').split('/').pop() || '';
    try { f = decodeURIComponent(f); } catch { /* keep raw */ }
    return f.replace(/(\.(webp|avif|jpe?g|png|gif))+$/i, '').replace(/-?\d+x\d+$/, '').replace(/-\d+$/, '').toLowerCase();
  };
  for (const d of docs) for (const i of d.images || []) docStemFreq.set(stemOf(i.src || ''), (docStemFreq.get(stemOf(i.src || '')) || 0) + 1);
  const isChromeImage = (i: any) =>
    !isPlaceholderMedia(i.src || '')
    && !/лого|logo|icon|filler|placeholder|banner/i.test(i.alt || '')
    && !/filler|placeholder|blank\.|banner/i.test(i.src || '')
    && !((i.width || 0) > 0 && (i.width || 0) < 240 && (i.height || 0) < 240)
    && (docStemFreq.get(stemOf(i.src || '')) || 0) <= 2;
  const docImage = (d?: SourceDocument) => d?.images?.find(isChromeImage)?.src;
  const docAttrs = (d?: SourceDocument) => {
    const out: Record<string, string> = {};
    for (const s of d?.sections || []) for (const t of s.tables || []) for (const row of t.rows || []) {
      if (row.length >= 2 && row[0] && row[1] && !out[row[0]]) out[row[0].slice(0, 40)] = row[1].slice(0, 120);
    }
    return out;
  };

  const pushEntity = (type: EntityType, e: { id: string; title: string; sourceDocumentIds: string[]; imageIds?: string[]; description?: string; evidence?: any[] }, extra?: Partial<PlannedEntity>) => {
    const docIds = e.sourceDocumentIds || [];
    const urls = docIds.map((id) => docById.get(id)?.url).filter(Boolean) as string[];
    const detailUrl = urls.find((u) => !indexUrls.has(u.replace(/\/+$/, ''))) || urls[0];
    const key = `${type}:${(detailUrl || e.title).toLowerCase().replace(/\/+$/, '')}|${normTitle(e.title)}`;
    const keyByTitle = `${type}:t|${stripBrand(e.title, identity.name)}`;
    if (seenKey.has(key)) return;
    if (/^https?:\/\//.test(e.title.trim())) { omittedContent.push({ what: `${type}: "${e.title.slice(0, 60)}"`, reason: 'URL used as title' }); return; }
    const drop = isNonEntityTitle(e.title, indexUrls, isDetailUrl(detailUrl) ? detailUrl : undefined);
    if (drop) { omittedContent.push({ what: `${type}: "${e.title.slice(0, 60)}"`, reason: drop }); return; }
    const dupIdx = byTitleIdx.get(keyByTitle);
    if (dupIdx !== undefined) {
      // Same real object seen as teaser + detail — canonical detail wins.
      const ex = entities[dupIdx];
      if (isDetailUrl(detailUrl) && !isDetailUrl(ex.detailUrl)) {
        ex.detailUrl = detailUrl;
        ex.sourceUrls = urls;
        ex.summary ||= docSummary(docByUrl.get((detailUrl || '').replace(/\/+$/, '')));
        const img = docImage(docByUrl.get((detailUrl || '').replace(/\/+$/, '')));
        if (img) ex.primaryImage ||= img;
        ex.attributes = Object.keys(ex.attributes).length ? ex.attributes : docAttrs(docByUrl.get((detailUrl || '').replace(/\/+$/, '')));
      }
      ex.onHomepage = ex.onHomepage || (homeDoc ? docIds.includes(homeDoc.id) : false);
      return;
    }
    seenKey.add(key);
    byTitleIdx.set(keyByTitle, entities.length);
    const detailDoc = detailUrl ? docByUrl.get(detailUrl.replace(/\/+$/, '')) : undefined;
    // Media assignment priority: the entity's OWN detail-document images first,
    // then explicitly associated entity media (excluding logo/icon roles),
    // then sibling-doc images — never the site logo as an entity photo.
    const isLogoish = (src: string) => {
      const role = graph.media.find((m) => m.src === src)?.role;
      return role === 'LOGO' || /\.svg(\?|$)|logo|icon|sprite|removebg|cropped-|filler|placeholder|blank\.|\d{2,3}x\d{2,3}\.png/i.test(src);
    };
    const isDocLogoish = (i: any) =>
      /лого|logo|icon/i.test(i?.alt || '') || ((i?.width || 0) > 0 && (i?.width || 0) < 240 && (i?.height || 0) < 240);
    const entityMedia = ((e.imageIds || []).map((id) => absUrl(graph.media.find((m) => m.id === id)?.src)).filter(Boolean) as string[]).filter((s) => !isLogoish(s) && !isPlaceholderMedia(s));
    const docImages = (detailDoc?.images || []).filter((i) => !isDocLogoish(i) && isChromeImage(i)).map((i) => absUrl(i.src)).filter((s) => s && !isPlaceholderMedia(s) && !isLogoish(s));
    const media = [...docImages, ...entityMedia].filter((s) => !isPlaceholderMedia(s));
    const img = docImages[0] || entityMedia[0] || docImage(docIds.map((id) => docById.get(id)).find(Boolean) as any);
    entities.push({
      id: `${type}-${entities.length + 1}`,
      type,
      title: e.title.trim(),
      slug: slugify(e.title),
      summary: (() => {
        const raw = (e.description || docSummary(detailDoc))?.slice(0, 400);
        // a summary identical to the site-wide description is not entity copy
        if (raw && graph.company?.description && normTitle(raw) === normTitle(graph.company.description)) return undefined;
        return raw;
      })(),
      cardSummary: (() => {
        const raw = e.description || docSummary(detailDoc);
        if (raw && graph.company?.description && normTitle(raw) === normTitle(graph.company.description)) return undefined;
        return cleanCardSummary(raw, e.title);
      })(),
      attributes: extra?.attributes || docAttrs(detailDoc) || {},
      primaryImage: img ? absUrl(img) : undefined,
      media: media.filter((s) => !isPlaceholderMedia(s)),
      sourceUrls: urls,
      detailUrl,
      evidence: (e.evidence || []).slice(0, 6).map((x: any) => ({ type: x.type || 'TEXT', value: String(x.value || '').slice(0, 200), sourceUrl: x.sourceUrl })),
      origin: 'SOURCE_CONTENT',
      confidence: (e as any).confidence ?? 0.6,
      onHomepage: homeDoc ? docIds.includes(homeDoc.id) : false,
      ...extra,
    });
  };

  const addTyped = (type: EntityType, list: any[]) => list.forEach((e) => pushEntity(type, e));

  // 1) Graph entities — news split into articles when editorial evidence exists.
  addTyped('service', graph.services || []);
  addTyped('project', graph.projects || []);
  addTyped('product', graph.products || []);
  for (const n of graph.news || []) {
    const url = (docById.get(n.sourceDocumentIds?.[0] || '')?.url) || '';
    pushEntity(ARTICLE_PATH_RE.test(url) || ARTICLE_TITLE_RE.test(n.title) ? 'article' : 'news', n);
  }
  addTyped('vacancy', graph.vacancies || []);

  // 2) Homogeneous-collection consistency: entities sharing a sourceCollectionId
  //    must not split arbitrarily across types — dominant type wins.
  const byColl = new Map<string, PlannedEntity[]>();
  for (const e of entities) for (const cid of (graph.services || []).concat(graph.projects || [], graph.products || []).filter((x: any) => normTitle(x.title) === normTitle(e.title)).flatMap((x: any) => x.sourceCollectionIds || [])) {
    byColl.set(cid, [...(byColl.get(cid) || []), e]);
  }
  for (const [cid, list] of byColl) {
    const types = new Set(list.map((e) => e.type));
    if (types.size > 1) {
      const counts = new Map<EntityType, number>();
      for (const e of list) counts.set(e.type, (counts.get(e.type) || 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      for (const e of list) if (e.type !== dominant) {
        e.type = dominant;
        warnings.push(`homogeneous collection ${cid}: unified "${e.title}" to ${dominant}`);
      }
    }
  }

  // 3) Recovery: INDEX pages + collection items/section links + hasProject
  //    relationships materialize entities the entity arrays missed.
  const pageByDoc = new Map(graph.pages.map((p) => [p.sourceDocumentId, p]));
  const INDEX_TO_TYPE: Record<string, EntityType> = { PROJECTS_INDEX: 'project', PRODUCTS_INDEX: 'product', SERVICES_INDEX: 'service', NEWS_INDEX: 'news', VACANCIES_INDEX: 'vacancy' };
  for (const page of graph.pages) {
    const et = INDEX_TO_TYPE[page.classification.type];
    if (!et || page.classification.confidence < 0.6) continue;
    const doc = docById.get(page.sourceDocumentId);
    if (!doc) continue;
    const candidates = new Map<string, { title: string; url: string }>();
    // (a) collection items of ANY subtype on the index page
    for (const coll of doc.collections || []) {
      for (const it of coll.items || []) {
        if (!it.url || it.isGroup) continue;
        const abs = (() => { try { return new URL(it.url, doc.url).toString(); } catch { return ''; } })();
        if (!abs || !docByUrl.has(abs.replace(/\/+$/, ''))) continue;
        candidates.set(abs, { title: it.title || it.description || abs, url: abs });
      }
    }
    // (b) section links pointing at crawled detail docs
    for (const s of doc.sections || []) for (const l of s.links || []) {
      const href = (l as any).url || (l as any).href || '';
      const abs = (() => { try { return new URL(href, doc.url).toString(); } catch { return ''; } })();
      if (!abs || !docByUrl.has(abs.replace(/\/+$/, '')) || abs === doc.url) continue;
      const t = (l.text || '').trim();
      if (t && t.length > 2 && !/^(подробнее|читать|дальше|more|→)$/iu.test(t)) candidates.set(abs, { title: t, url: abs });
      else if (!candidates.has(abs)) candidates.set(abs, { title: '', url: abs });
    }
    // (c) hasProject-style relationships: detail doc → index page
    for (const r of graph.relationships || []) {
      if (r.toId !== page.sourceDocumentId && r.toId !== doc.url) continue;
      if (!/project/i.test(r.relation)) continue;
      const d = docById.get(r.fromId) || docByUrl.get((r.fromId || '').replace(/\/+$/, ''));
      if (d) candidates.set(d.url, { title: d.h1 || d.title || '', url: d.url });
    }
    // Detail docs already classified as a different kind of page are not
    // entity candidates (e.g. a CONTACTS page linked from a portfolio index).
    const navUrls = new Set(
      [...(homeDoc?.chrome?.nav?.primary || []), ...(homeDoc?.chrome?.nav?.secondary || []), ...(homeDoc?.chrome?.footer?.links || [])]
        .map((n: any) => (n.url || '').replace(/\/+$/, '')).filter(Boolean)
    );
    const BLOCKED_DETAIL_TYPES = new Set(['CONTACTS', 'LEGAL', 'ABOUT', 'HOME', 'NEWS_INDEX', 'NEWS_DETAIL', 'VACANCIES_INDEX', 'VACANCY_DETAIL', 'SERVICES_INDEX', 'SERVICE_DETAIL', 'PRODUCTS_INDEX', 'PRODUCT_DETAIL', 'PROJECTS_INDEX'].filter((t) => t !== INDEX_TO_TYPE[et]?.toUpperCase()));
    for (const cand of candidates.values()) {
      const dd = docByUrl.get(cand.url.replace(/\/+$/, ''))!;
      if (navUrls.has(dd.url.replace(/\/+$/, ''))) continue;
      const ddClass = pageByDoc.get(dd.id)?.classification.type;
      if (ddClass && BLOCKED_DETAIL_TYPES.has(ddClass)) continue;
      const title = cand.title || dd.h1 || dd.title || '';
      if (!title || title === dd.url) continue;
      pushEntity(et, { id: `rec-${dd.id}`, title, sourceDocumentIds: [dd.id] }, { confidence: Math.min(0.7, page.classification.confidence) });
    }
  }

  // --- canonical dedupe across types -----------------------------------------
  // Same real object can appear as project + product + recovered item.
  // Group by detail URL, else brand-stripped title; one canonical entity survives.
  const canonGroups = new Map<string, number[]>();
  entities.forEach((e, i) => {
    const ck = e.detailUrl ? `u:${e.detailUrl.replace(/\/+$/, '')}` : `t:${stripBrand(e.title, identity.name)}`;
    canonGroups.set(ck, [...(canonGroups.get(ck) || []), i]);
  });
  const dropIdx = new Set<number>();
  const hasCatalogAttrs = (e: PlannedEntity) => Object.keys(e.attributes).some((k) => /площадь|м2|м²|цен|стоимост|price|area|срок|размер|этаж/iu.test(k));
  for (const [ck, idxs] of canonGroups) {
    if (idxs.length <= 1) continue;
    const group = idxs.map((i) => entities[i]);
    // Type resolution: non-recovered (higher-confidence graph) members vote;
    // catalog-shaped items default to product; else majority.
    const conf = group.slice().sort((a, b) => b.confidence - a.confidence)[0];
    const counts = new Map<EntityType, number>();
    for (const e of group) counts.set(e.type, (counts.get(e.type) || 0) + (e.confidence >= 0.75 ? 2 : 1));
    let winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (group.every((e) => e.confidence < 0.75)) winner = group.some(hasCatalogAttrs) ? 'product' : winner;
    const keep = conf.type === winner ? conf : group.find((e) => e.type === winner) || conf;
    for (const e of group) {
      if (e === keep) continue;
      dropIdx.add(entities.indexOf(e));
      keep.onHomepage ||= e.onHomepage;
      keep.summary ||= e.summary;
      keep.primaryImage ||= e.primaryImage;
      for (const u of e.sourceUrls) if (!keep.sourceUrls.includes(u)) keep.sourceUrls.push(u);
      for (const m of e.media) if (!keep.media.includes(m)) keep.media.push(m);
      if (e.type !== winner) warnings.push(`canonical dedupe: "${e.title.slice(0, 50)}" (${e.type}) merged into ${winner} "${keep.title.slice(0, 50)}"`);
      else warnings.push(`duplicate removed: "${e.title.slice(0, 50)}" == "${keep.title.slice(0, 50)}"`);
    }
    if (keep.type !== winner) keep.type = winner;
  }
  for (const i of [...dropIdx].sort((a, b) => b - a)) entities.splice(i, 1);

  // --- homogeneous sibling collections ---------------------------------------
  // Items of ONE source collection are one homogeneous catalogue: never split
  // arbitrarily across entity types. Rebuild the link via item URLs.
  const entityByUrl = new Map<string, PlannedEntity>();
  for (const e of entities) if (e.detailUrl) entityByUrl.set(e.detailUrl.replace(/\/+$/, ''), e);
  for (const d of docs) {
    for (const c of d.collections || []) {
      const members = new Set<PlannedEntity>();
      for (const it of c.items || []) {
        if (!it.url || it.isGroup) continue;
        const abs = (() => { try { return new URL(it.url, d.url).toString().replace(/\/+$/, ''); } catch { return ''; } })();
        const e = abs && entityByUrl.get(abs);
        if (e) members.add(e);
      }
      const types = new Set([...members].map((e) => e.type));
      // Only unify project/product catalogue splits — a service listed in a
      // services collection stays a service even if it links a portfolio page.
      const CONTENT_SPLIT = new Set(['project', 'product']);
      if (members.size >= 3 && types.size > 1 && [...types].every((t) => CONTENT_SPLIT.has(t))) {
        const arr = [...members];
        const productEvidence = (e: PlannedEntity) =>
          hasCatalogAttrs(e) || /м2|м²|площадь|цен|руб|стоимост|конфигур|меняйте|выберите|вариант|комплектац/iu.test(`${e.summary || ''} ${e.title}`);
        const prodCount = arr.filter(productEvidence).length;
        const counts = new Map<EntityType, number>();
        for (const e of arr) counts.set(e.type, (counts.get(e.type) || 0) + 1);
        const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const winner: EntityType = prodCount * 2 >= arr.length ? 'product' : majority;
        for (const e of arr) if (e.type !== winner) {
          warnings.push(`homogeneous collection "${c.heading || c.id}": "${e.title.slice(0, 40)}" ${e.type}→${winner}`);
          e.type = winner;
        }
      }
    }
  }

  // --- contacts normalization ---------------------------------------------------
  const normContacts = (list: { value: string; evidence?: any }[] | undefined, key: (v: string) => string) => {
    const seen = new Map<string, { value: string; sourceUrl?: string }>();
    for (const c of list || []) {
      const k = key(c.value);
      if (!k || seen.has(k)) continue;
      seen.set(k, { value: c.value, sourceUrl: c.evidence?.sourceUrl });
    }
    return [...seen.values()];
  };
  const c = graph.contacts;
  const contacts = {
    phones: normContacts(c?.phones, (v) => digits(v).replace(/^8/, '7'))
      // full numbers first — truncated chrome fragments ("175 50 07") are secondary
      .sort((a, b) => digits(b.value).length - digits(a.value).length),
    emails: normContacts(c?.emails, (v) => v.toLowerCase().trim()),
    addresses: normContacts(c?.addresses, (v) => normTitle(v)),
    socialLinks: [...new Map((c?.socialLinks || []).map((s) => [s.url, { platform: s.platform, url: s.url }])).values()],
    workingHours: c?.workingHours?.value,
  };

  // --- dynamic sections: dedupe across pages ------------------------------------
  const dynSeen = new Map<string, PlannedDynamicSection>();
  for (const page of graph.pages) {
    const doc = docById.get(page.sourceDocumentId);
    if (!doc) continue;
    for (const cls of page.collections) {
      const raw = doc.collections?.find((x) => x.id === cls.collectionId);
      const items = (raw?.items || []).map((i: any) => ({ title: i.title || i.text, text: i.description, meta: i.meta }));
      const { kind, ignored } = detectDynamicKind(raw?.heading, raw?.items || [], cls);
      const itemKey = items.map((i) => normTitle(i.title || i.text || '')).sort().join('|').slice(0, 120);
      const key = `${kind}|${normTitle(raw?.heading || '')}|${itemKey}`;
      if (dynSeen.has(key)) {
        const ex = dynSeen.get(key)!;
        if (!ex.sourcePages.includes(doc.url)) ex.sourcePages.push(doc.url);
        continue;
      }
      dynSeen.set(key, {
        id: `dyn-${dynSeen.size + 1}`,
        kind,
        heading: raw?.heading,
        items: items.slice(0, 40),
        sourcePages: [doc.url],
        ignoredReason: ignored,
      });
    }
  }
  // Merge same-kind sections: keep the one with more items and cleaner titles.
  const KIND_DEFAULT_HEADING: Record<string, string> = {
    FAQ: 'Часто задаваемые вопросы', PROCESS: 'Как мы работаем', REVIEWS: 'Отзывы клиентов',
    ADVANTAGES: 'Преимущества', TEAM: 'Команда', PRICING: 'Цены', PARTNERS: 'Партнёры',
    STATS: 'Цифры', PROMOTION: 'Акции', OTHER: '', IGNORED: '',
  };
  const itemOk = (t: string) => {
    const x = (t || '').trim();
    return x.length >= 4 && !/[✔➔✓→]/.test(x) && !/\+?\d[\d\s()\-]{6,}/.test(x);
  };
  const quality = (d: PlannedDynamicSection) => d.items.filter((i) => itemOk(i.title || '')).length;
  const byKind = new Map<string, PlannedDynamicSection>();
  for (const d of [...dynSeen.values()]) {
    const keep = byKind.get(d.kind);
    if (!keep || quality(d) > quality(keep)) byKind.set(d.kind, d);
  }
  const dynamicSections = [...byKind.values()]
    .map((d) => {
      let items = d.items.filter((i) => itemOk(i.title || ''));
      if (d.kind === 'FAQ') items = items.filter((i) => (i.title || '').trim().endsWith('?') || (i.text || '').length > 20);
      // short titles are legitimate for names/prices (REVIEWS, PRICING, TEAM,
      // PARTNERS) — but for PROCESS/ADVANTAGES/OTHER a bare <10-char fragment
      // with no body text is nav chrome, not a step.
      else if (['PROCESS', 'ADVANTAGES', 'OTHER'].includes(d.kind))
        items = items.filter((i) => (i.title || '').trim().length >= 10 || (i.text || '').trim().length > 0);
      return {
        ...d,
        items,
        // heading must look like a section heading, not a captured item title
        heading: d.heading && detectDynamicKind(d.heading, [], { kind: d.kind } as any)?.kind === d.kind
          ? d.heading
          : KIND_DEFAULT_HEADING[d.kind] || d.heading,
      };
    })
    .filter((d) => d.items.length >= (d.kind === 'REVIEWS' ? 1 : 2) || d.kind === 'IGNORED');

  // --- pages ---------------------------------------------------------------------
  const L = language.startsWith('ru') ? {
    home: 'Главная', services: 'Услуги', projects: 'Проекты', products: 'Каталог', news: 'Новости', articles: 'Статьи', about: 'О компании', contacts: 'Контакты', vacancies: 'Вакансии',
  } : {
    home: 'Home', services: 'Services', projects: 'Projects', products: 'Catalog', news: 'News', articles: 'Articles', about: 'About', contacts: 'Contacts', vacancies: 'Careers',
  };

  const has = (t: EntityType) => entities.some((e) => e.type === t);
  const plannedPages: SiteContentPlanV2['plannedPages'] = [{ route: '/', kind: 'home', title: L.home }];
  const coll = (t: EntityType, route: string, title: string) => {
    if (!has(t)) return;
    plannedPages.push({ route, kind: 'collection', title, entityType: t });
    for (const e of entities.filter((x) => x.type === t)) plannedPages.push({ route: `${route}/${e.slug}`, kind: 'detail', title: e.title, entityType: t, entityId: e.id });
  };
  coll('service', '/services', L.services);
  coll('project', '/projects', L.projects);
  coll('product', '/products', L.products);
  coll('article', '/articles', L.articles);
  coll('news', '/news', L.news);
  coll('vacancy', '/vacancies', L.vacancies);
  if (graph.pages.some((p) => p.classification.type === 'ABOUT') || graph.company?.description) plannedPages.push({ route: '/about', kind: 'corporate', title: L.about });
  if (contacts.phones.length || contacts.emails.length || graph.pages.some((p) => p.classification.type === 'CONTACTS')) plannedPages.push({ route: '/contacts', kind: 'contacts', title: L.contacts });
  for (const d of dynamicSections.filter((d) => d.kind !== 'IGNORED' && d.kind !== 'OTHER')) {
    plannedPages.push({ route: `/${d.kind.toLowerCase()}`, kind: 'dynamic', title: d.heading || d.kind });
  }

  // --- planned navigation (internal semantic targets) ----------------------------
  const plannedNavigation = [{ label: L.home, route: '/', order: 0 }];
  const navPush = (route: string, label: string) => { if (plannedPages.some((p) => p.route === route) && !plannedNavigation.some((n) => n.route === route)) plannedNavigation.push({ label, route, order: plannedNavigation.length }); };
  navPush('/services', L.services); navPush('/projects', L.projects); navPush('/products', L.products);
  navPush('/about', L.about); navPush('/articles', L.articles); navPush('/news', L.news); navPush('/contacts', L.contacts);

  const sourceNavigation = (homeDoc?.chrome?.nav?.primary || []).slice(0, 14).map((n, i) => ({ label: n.label, url: n.url, order: i }));

  const matchedMedia: string[] = [];
  // --- boilerplate card copy ---------------------------------------------------
  // If >2 entities share an identical normalized summary it is site boilerplate,
  // not entity copy — drop it (UNKNOWN > WRONG).
  {
    const freq = new Map<string, number>();
    for (const e of entities) {
      const k = normTitle(e.cardSummary || '');
      if (k) freq.set(k, (freq.get(k) || 0) + 1);
    }
    for (const e of entities) {
      const k = normTitle(e.cardSummary || '');
      if (k && (freq.get(k) || 0) > 2) { e.cardSummary = undefined; }
    }
  }

  // --- filename↔slug media matching ------------------------------------------
  // Source filenames often mirror entity slugs ("promyshlenny-obekt-1.jpg" →
  // project "promyshlenny-obekt"). Grounded in the source URL itself.
  {
    const RU2LAT: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
    const translit = (s: string) => s.toLowerCase().split('').map((c) => RU2LAT[c] ?? c).join('');
    const pool = graph.media.map((m) => absUrl(m.src)).filter((s) => s && !isPlaceholderMedia(s) && !/\.svg(\?|$)/i.test(s));
    const stem = (u: string) => {
      let f = u.split('/').pop() || '';
      try { f = decodeURIComponent(f); } catch { /* keep raw */ }
      return f.replace(/(\.(webp|avif|jpe?g|png|gif))+$/i, '').replace(/-?\d+x\d+$/, '').replace(/-\d+$/, '').toLowerCase();
    };
    // reject site-wide chrome: a stem appearing as the ONLY image on many docs is decoration
    const stemFreq = new Map<string, number>();
    for (const d of docs) for (const i of d.images || []) stemFreq.set(stem(i.src || ''), (stemFreq.get(stem(i.src || '')) || 0) + 1);
    for (const e of entities) {
      if (e.primaryImage) continue;
      const slugs = [e.slug, translit(e.slug)].filter((x) => x && x.length >= 4);
      if (!slugs.length) continue;
      const skeleton = (x: string) => x.replace(/[aeiouy]/g, '');
      const hits = pool.filter((u) => {
        const f = stem(u);
        if (!f || (stemFreq.get(f) || 0) > 8) return false;
        return slugs.some((sl) => f.includes(sl) || sl.includes(f) || (skeleton(f).length >= 5 && (skeleton(f).includes(skeleton(sl)) || skeleton(sl).includes(skeleton(f)))));
      });
      const uniq = [...new Set(hits)];
      if (uniq.length) { e.primaryImage = uniq[0]; e.media = [...uniq.slice(0, 6), ...e.media]; }
    }
  }

  // --- homepage plan ----------------------------------------------------------------
  const sourceSections: SiteContentPlanV2['homepage']['sourceSections'] = [];
  const homePage = homeDoc && graph.pages.find((p) => p.sourceDocumentId === homeDoc.id);
  for (const s of homeDoc?.sections || []) {
    const cls = homePage?.sections.find((x) => x.sectionId === s.id);
    sourceSections.push({ sectionId: s.id, type: cls?.type || 'UNKNOWN', heading: s.heading, itemCount: s.collections?.length || 0 });
  }
  for (const coll2 of homeDoc?.collections || []) {
    const cls = homePage?.collections.find((x) => x.collectionId === coll2.id);
    sourceSections.push({ sectionId: coll2.id, type: `${cls?.type || 'UNKNOWN'}/${cls?.contentSubtype || ''}`, heading: coll2.heading, itemCount: coll2.items?.length || 0 });
  }

  const featured = (t: EntityType, n = 6) => entities.filter((e) => e.type === t).sort((a, b) => Number(b.onHomepage) - Number(a.onHomepage)).slice(0, n).map((e) => e.id);
  const plannedSections: SiteContentPlanV2['homepage']['plannedSections'] = [];
  plannedSections.push({ type: 'hero', heading: identity.name || '', origin: 'SOURCE_CONTENT', entityIds: [], rationale: 'site identity + hero media' });
  if (has('service')) plannedSections.push({ type: 'services', heading: L.services, origin: 'SOURCE_CONTENT', entityIds: featured('service'), rationale: 'primary business offering' });
  if (has('project')) plannedSections.push({ type: 'projects', heading: L.projects, origin: 'SOURCE_CONTENT', entityIds: featured('project'), rationale: 'representative portfolio subset; full collection on /projects' });
  if (has('product')) plannedSections.push({ type: 'products', heading: L.products, origin: 'SOURCE_CONTENT', entityIds: featured('product'), rationale: 'catalogue highlights; full catalogue on /products' });
  for (const d of dynamicSections) {
    if (['PROCESS', 'ADVANTAGES', 'REVIEWS', 'FAQ', 'TEAM', 'PRICING', 'PARTNERS', 'STATS'].includes(d.kind)) {
      plannedSections.push({ type: 'dynamic', heading: d.heading || d.kind, origin: 'SOURCE_CONTENT', entityIds: [], dynamicSectionId: d.id, rationale: `${d.kind} section preserved from source` });
    }
  }
  if (has('news')) plannedSections.push({ type: 'news', heading: L.news, origin: 'SOURCE_CONTENT', entityIds: featured('news', 3), rationale: 'latest news' });
  if (has('article')) plannedSections.push({ type: 'articles', heading: L.articles, origin: 'SOURCE_CONTENT', entityIds: featured('article', 3), rationale: 'editorial content teaser' });
  plannedSections.push({ type: 'contacts', heading: L.contacts, origin: 'SOURCE_FACT', entityIds: [], rationale: 'validated contacts' });

  // --- media --------------------------------------------------------------------------
  const media = {
    logo: absUrl(graph.media.find((m) => m.role === 'LOGO' && !isPlaceholderMedia(m.src))?.src || homeDoc?.chrome?.logo?.src) || undefined,
    // Business-relevant hero: explicit hero candidate → homepage content photo →
    // og:image → strongest project/product image. Never logo/icon.
    hero: (() => {
      const norm = (src?: string) => {
        if (!src) return undefined;
        try { return new URL(src, opts.baseUrl).toString(); } catch { return undefined; }
      };
      const pick = (src?: string) => {
        const u = norm(src);
        return u && !isPlaceholderMedia(u) && !/\.svg(\?|$)|logo|icon|sprite|removebg/i.test(u) ? u : undefined;
      };
      return pick(entities.find((e) => (e.type === 'project' || e.type === 'product') && e.primaryImage)?.primaryImage)
        || pick(graph.media.find((m) => m.role === 'HERO_CANDIDATE')?.src)
        || pick(homeDoc?.images?.find((i) => isChromeImage(i) && ((i.width || 0) >= 600 || i.width == null))?.src)
        || pick(homeDoc?.openGraph?.['og:image']);
    })(),
    images: (() => {
      const base = (graph.media || []).filter((m) => !isPlaceholderMedia(m.src) && m.role !== 'UTILITY_ICON' && m.role !== 'LANGUAGE_ICON')
        .map((m) => ({ id: m.id, src: absUrl(m.src) || m.src, role: m.role }));
      const seen = new Set(base.map((m) => m.src));
      // any entity-referenced src must be importable
      for (const e of entities) for (const src of [e.primaryImage, ...e.media]) {
        if (src && !seen.has(src) && !matchedMedia.includes(src)) matchedMedia.push(src);
      }
      const matched = matchedMedia.filter((src) => !seen.has(src)).map((src) => ({ id: `matched-${src}`, src, role: 'PROJECT_IMAGE' as const }));
      return [...matched, ...base].slice(0, 240);
    })(),
  };

  for (const rc of graph.rejectedCollections || []) omittedContent.push({ what: `collection ${rc.collectionId}`, reason: rc.reason });

  // --- readiness -----------------------------------------------------------------------
  const reasons: string[] = [];
  if (!homeDoc) reasons.push('no homepage SourceDocument');
  if (!identity.name) reasons.push('no company identity');
  if (!entities.length && !dynamicSections.some((d) => d.kind !== 'IGNORED')) reasons.push('no content entities or dynamic sections');
  if (!contacts.phones.length && !contacts.emails.length) reasons.push('no contacts');
  const readiness: SiteContentPlanV2['readiness'] = reasons.some((r) => /homepage|no content/i.test(r)) ? 'NOT_READY' : reasons.length ? 'READY_WITH_WARNINGS' : 'READY';
  warnings.push(...reasons);

  // --- experience / presentation layer -----------------------------------------
  const cnt = (t: EntityType) => entities.filter((e) => e.type === t).length;
  const identityText = `${graph.company?.industry || ''} ${graph.company?.description || ''} ${entities.slice(0, 8).map((e) => e.title).join(' ')}`;
  const isCreative = /дизайн|design|интерьер|архитект|студи|interior|studio/i.test(identityText);
  const archetype: SiteArchetype = cnt('product') >= 3 ? 'CATALOG' : isCreative && cnt('project') >= 1 ? 'CREATIVE_PORTFOLIO' : 'SERVICE_PORTFOLIO';
  const archetypeReason = cnt('product') >= 3
    ? `${cnt('product')} catalogue items dominate`
    : isCreative && cnt('project') >= 1
      ? `design/portfolio signals in identity + ${cnt('project')} projects`
      : 'service offering with portfolio';

  // Grounded hero copy: value proposition (first clean sentence of the company
  // description) as headline; brand + remaining context as subheadline.
  const brandName = identity.name || 'Компания';
  const descClean = cleanCardSummary(graph.company?.description || homeDoc?.metaDescription, brandName) || '';
  const firstSentence = (descClean.split(/(?<=[.!?])\s+/)[0] || '').replace(/[.!?]+$/, '');
  const heroHeadline = firstSentence && firstSentence.length <= 70 ? firstSentence : brandName;
  const heroSub = [brandName, descClean.slice(firstSentence.length).trim().replace(/^[.!?\s]+/, '').slice(0, 160)]
    .filter(Boolean).join(' — ').slice(0, 220) || undefined;

  // Dark-safe presets — light-theme presets break hardcoded light-on-dark sections.
  const ARCHETYPE_PRESETS: Record<SiteArchetype, string[]> = {
    SERVICE_PORTFOLIO: ['foret', 'atlas', 'ember'],
    CATALOG: ['atlas', 'foret', 'ember'],
    CREATIVE_PORTFOLIO: ['ember', 'foret', 'atlas'],
  };

  const DYN_COMP: Partial<Record<DynamicKind, string>> = {
    FAQ: 'faq', REVIEWS: 'reviews', PROCESS: 'process', ADVANTAGES: 'advantages',
    TEAM: 'team', PARTNERS: 'partners', STATS: 'stats', PRICING: 'pricing', PROMOTION: 'promotion',
  };
  const composition: PlanExperience['composition'] = [{ component: 'hero', heading: heroHeadline, entityIds: [] }];
  const feat = (t: EntityType, n = 6) => entities.filter((e) => e.type === t).sort((a, b) => Number(b.onHomepage) - Number(a.onHomepage)).slice(0, n);
  const orders: Record<SiteArchetype, EntityType[]> = {
    SERVICE_PORTFOLIO: ['service', 'project'],
    CATALOG: ['product'],
    CREATIVE_PORTFOLIO: ['project', 'service'],
  };
  for (const t of orders[archetype]) {
    if (feat(t).length) composition.push({ component: `${t}-grid`, heading: t === 'service' ? L.services : t === 'project' ? L.projects : L.products, entityIds: feat(t).map((e) => e.id) });
  }
  const seenDyn = new Set<string>();
  for (const d of dynamicSections) {
    const comp = DYN_COMP[d.kind];
    if (!comp || seenDyn.has(comp) || !d.items.length) continue;
    seenDyn.add(comp);
    composition.push({ component: comp, heading: d.heading || d.kind, entityIds: [], dynamicSectionId: d.id });
  }
  if (has('article')) composition.push({ component: 'article-list', heading: L.articles, entityIds: feat('article', 3).map((e) => e.id) });
  if (has('news')) composition.push({ component: 'news-list', heading: L.news, entityIds: feat('news', 3).map((e) => e.id) });
  if (graph.company?.description) composition.push({ component: 'about', heading: L.about, entityIds: [] });
  composition.push({ component: 'cta', heading: L.contacts, entityIds: [] });
  composition.push({ component: 'contacts', heading: L.contacts, entityIds: [] });

  const experience: PlanExperience = {
    archetype, archetypeReason,
    brand: { name: identity.name || 'Компания', source: identity.src },
    presentation: {
      heroHeadline,
      heroSubheadline: heroSub,
      heroCtaLabel: 'Связаться',
      heroCtaSecondary: archetype === 'CATALOG' ? 'Смотреть каталог' : archetype === 'CREATIVE_PORTFOLIO' ? 'Смотреть проекты' : 'Наши услуги',
      sectionIntros: {},
    },
    composition,
    stylePresets: ARCHETYPE_PRESETS[archetype],
    preferredPreset: ARCHETYPE_PRESETS[archetype][0],
  };

  const plan: SiteContentPlanV2 = {
    version: '2.0', generatedAt: new Date().toISOString(), siteKey: opts.siteKey, baseUrl: opts.baseUrl,
    sourceGraphHash: opts.sourceGraphHash, language,
    siteIdentity: {
      displayName: identity.name, legalName: graph.company?.legalName, description: graph.company?.description,
      industry: graph.company?.industry, founded: graph.company?.founded, employees: graph.company?.employees,
      unp: graph.company?.unp, evidenceDocIds: graph.company?.sourceDocumentIds || [],
    },
    contacts, sourceNavigation, plannedNavigation, plannedPages,
    homepage: { sourceSections, plannedSections },
    entities, dynamicSections, media, omittedContent, warnings, readiness, readinessReasons: reasons,
    experience,
  };
  plan.planHash = computePlanHashV2(plan);
  return plan;
}

export function computePlanHashV2(plan: SiteContentPlanV2): string {
  const { planHash: _d, ...rest } = plan as any;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
}

export function verifyPlanHashV2(plan: SiteContentPlanV2): boolean {
  return plan.planHash === computePlanHashV2(plan);
}
