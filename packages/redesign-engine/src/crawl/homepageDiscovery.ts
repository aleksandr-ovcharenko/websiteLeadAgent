import type { CrawledPage, NavigationNode, HomepageCandidate } from '../types.js';

const HOME_LABELS = new Set([
  'home', 'main', 'index', 'start', 'главная', 'на главную', 'на главную страницу', 'основная',
  'startseite', 'willkommen', 'accueil', 'bienvenue'
]);

const GENERIC_DENY = new Set([
  'contact', 'contacts', 'контакты', 'контакт', 'kontakty', 'kontakt', 'kontakt',
  'news', 'blog', 'press', 'новости', 'новость', 'novost', 'novosti', 'aktuelles', 'neuigkeiten',
  'service', 'services', 'catalog', 'услуги', 'услуга', 'каталог', 'uslugi', 'usluga', 'leistungen', 'angebote',
  'about', 'about us', 'о компании', 'о нас', 'о предприятии', 'o-kompanii', 'o-nas', 'ueber-uns', 'ueber-uns', 'ueber',
  'vacancies', 'vacancy', 'career', 'careers', 'job', 'jobs', 'вакансии', 'вакансия', 'vakansii', 'rabota', 'arbeit', 'stellenangebote'
]);

function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
    return u.toString().replace(/\?$/, '');
  } catch {
    return url;
  }
}

function isHomeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '');
    return path === '' || path === '/';
  } catch {
    return false;
  }
}

function isHomeLabel(text?: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (HOME_LABELS.has(t)) return true;
  return /^(home|index|main|start|главная|основная|startseite|accueil|willkommen)$/.test(t);
}

function isGeneric(text?: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (GENERIC_DENY.has(t)) return true;
  for (const d of GENERIC_DENY) {
    if (t.includes(d)) return true;
  }
  return false;
}

function decodedUrl(url: string): string {
  try { return decodeURIComponent(url); } catch { return url; }
}

function urlContainsGeneric(url: string): boolean {
  const u = decodedUrl(url).toLowerCase();
  for (const d of GENERIC_DENY) {
    if (u.includes(d)) return true;
  }
  return false;
}

function flattenNav(nodes: NavigationNode[]): NavigationNode[] {
  const out: NavigationNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenNav(n.children));
  }
  return out;
}

export function discoverHomepage(
  pages: CrawledPage[],
  baseUrl: string,
  navigation: NavigationNode[],
  originRoot: string,
  warnings: string[]
): HomepageCandidate {
  const candidates = new Map<string, { page?: CrawledPage; index: number; score: number; reasons: string[] }>();

  function addScore(url: string, score: number, reason: string, page?: CrawledPage, index: number = -1) {
    const key = canonicalize(url);
    if (!key) return;
    const existing = candidates.get(key);
    if (existing) {
      existing.score += score;
      existing.reasons.push(`${score > 0 ? '+' : ''}${score}: ${reason}`);
      if (page && existing.index < 0) {
        existing.page = page;
        existing.index = index;
      }
    } else {
      candidates.set(key, { page, index, score, reasons: [`${score > 0 ? '+' : ''}${score}: ${reason}`] });
    }
  }

  // Base seed from the supplied lead.website.
  addScore(baseUrl, 0, 'lead.website seed');
  if (urlContainsGeneric(baseUrl)) {
    addScore(baseUrl, -15, 'lead.website URL contains generic page keyword');
  }

  // Origin root itself is a strong candidate even if it was not crawlable.
  addScore(originRoot, 20, 'origin root');

  // Score every crawled page.
  pages.forEach((p, i) => {
    if (isHomeUrl(p.url)) addScore(p.url, 25, 'URL is origin root or /index.html', p, i);
    if (p.canonicalUrl && isHomeUrl(p.canonicalUrl)) addScore(p.url, 15, 'rel=canonical points to root', p, i);
    if (p.logoHref && isHomeUrl(p.logoHref)) addScore(p.url, 20, 'logo/home link points to root', p, i);
    if (p.path === 'index') addScore(p.url, 5, 'slug is index', p, i);

    if (p.h1 && !isGeneric(p.h1) && p.h1.length > 1) addScore(p.url, 5, 'H1 is not generic', p, i);
    if (p.title && !isGeneric(p.title) && p.title.length > 1) addScore(p.url, 5, 'title is not generic', p, i);
    if (p.metaDescription && p.metaDescription.length > 10) addScore(p.url, 3, 'meta description present', p, i);

    if (isGeneric(p.h1) || isGeneric(p.title)) addScore(p.url, -25, 'H1/title is generic page name', p, i);
    if (urlContainsGeneric(p.url)) addScore(p.url, -20, 'URL contains generic page keyword', p, i);
  });

  // Score from navigation structure.
  const flatNav = flattenNav(navigation);
  for (const n of flatNav) {
    if (!n.url) continue;
    if (isHomeLabel(n.label)) addScore(n.url, 20, `nav label "${n.label}" indicates home`);
    if (n.source === 'header') addScore(n.url, 5, 'linked from header');
    if (n.source === 'sitemap') addScore(n.url, 2, 'linked from sitemap');
  }

  // Pick the highest-scoring candidate. Synthetic candidates (e.g. the origin root
  // inferred from the domain name) are allowed to win because they are a safer
  // homepage guess than a contacts/services/about page.
  let best: { url: string; score: number; reasons: string[]; page?: CrawledPage; index: number } | null = null;
  for (const [key, c] of candidates) {
    if (!best || c.score > best.score || (c.score === best.score && c.page && !best.page)) {
      best = { url: key, score: c.score, reasons: c.reasons, page: c.page, index: c.index };
    }
  }

  if (!best) {
    const fallback = canonicalize(originRoot);
    const reason = 'No homepage candidate found; fallback to origin root';
    warnings.push(reason);
    return { url: fallback, confidence: 0.1, reason, pageIndex: -1 };
  }

  const maxPossible = 100;
  const confidence = Math.max(0.1, Math.min(1, best.score / maxPossible));
  const reason = best.reasons.join('; ');

  if (!best.page) {
    warnings.push(`Homepage candidate ${best.url} was not crawled; using origin root`);
  } else if (confidence < 0.4) {
    warnings.push(`Low homepage confidence (${confidence.toFixed(2)}) for ${best.url}: ${reason}`);
  }

  return { url: best.url, confidence, reason, pageIndex: best.index };
}
