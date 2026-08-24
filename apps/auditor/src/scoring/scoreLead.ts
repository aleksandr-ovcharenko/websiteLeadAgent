import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type LighthouseReportLike = {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  tbt: number | null;
};

type CrawlData = {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  lang: string | null;
  viewport: string | null;
  footerYears?: number[];
  pageYears?: number[];
  latestContentDate?: string | null;
  hasNewsSection?: boolean;
  counts: { forms: number; buttons: number; links: number; images: number };
  telLinks: string[];
  mailtoLinks: string[];
  socialLinks: string[];
};

type LeadBusinessSignals = {
  companyName: string;
  website: string | null;
  websiteDomain: string | null;
  phone: string | null;
  address: string | null;
};

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function safeAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export async function scoreLead(input: { leadId: string; lighthouse: LighthouseReportLike; lead: LeadBusinessSignals }) {
  const { leadId, lighthouse, lead } = input;

  let crawl: CrawlData | null = null;
  try {
    const crawlPath = join('data', 'audit', leadId, 'crawl.json');
    const raw = await readFile(crawlPath, 'utf-8');
    const parsedAny = JSON.parse(raw) as any;
    const parsed = ((parsedAny && typeof parsedAny === 'object' && 'crawl' in parsedAny ? parsedAny.crawl : parsedAny) ?? {}) as Partial<CrawlData>;
    crawl = {
      title: parsed.title ?? null,
      metaDescription: parsed.metaDescription ?? null,
      h1: parsed.h1 ?? null,
      lang: parsed.lang ?? null,
      viewport: parsed.viewport ?? null,
      footerYears: parsed.footerYears ?? [],
      pageYears: parsed.pageYears ?? [],
      latestContentDate: parsed.latestContentDate ?? null,
      hasNewsSection: parsed.hasNewsSection ?? false,
      counts: {
        forms: parsed.counts?.forms ?? 0,
        buttons: parsed.counts?.buttons ?? 0,
        links: parsed.counts?.links ?? 0,
        images: parsed.counts?.images ?? 0
      },
      telLinks: parsed.telLinks ?? [],
      mailtoLinks: parsed.mailtoLinks ?? [],
      socialLinks: parsed.socialLinks ?? []
    };
  } catch {
    crawl = null;
  }

  const weights = {
    performance: 0.55,
    seo: 0.20,
    accessibility: 0.15,
    bestPractices: 0.10
  };

  const lhScoreRaw =
    lighthouse.performance * weights.performance +
    lighthouse.seo * weights.seo +
    lighthouse.accessibility * weights.accessibility +
    lighthouse.bestPractices * weights.bestPractices;

  // Website quality score (100 = excellent modern website)
  let websiteBonus = 0;
  let websitePenalty = 0;

  if (crawl) {
    if (!crawl.title || crawl.title.trim().length < 5) websitePenalty += 6;
    if (!crawl.metaDescription || crawl.metaDescription.trim().length < 20) websitePenalty += 6;
    if (!crawl.h1 || crawl.h1.trim().length < 3) websitePenalty += 4;
    if (!crawl.viewport) websitePenalty += 8;

    const hasPhoneLink = crawl.telLinks.length > 0;
    const hasEmailLink = crawl.mailtoLinks.length > 0;
    const hasSocial = crawl.socialLinks.length > 0;
    const hasForm = crawl.counts.forms > 0;

    if (hasPhoneLink) websiteBonus += 2;
    if (hasEmailLink) websiteBonus += 1;
    if (hasSocial) websiteBonus += 1;
    if (hasForm) websiteBonus += 2;

    // If the page is extremely light on interactive elements, it's often a sign of a "brochure" outdated site.
    if (crawl.counts.links < 5) websitePenalty += 3;
    if (crawl.counts.buttons === 0 && !hasForm) websitePenalty += 2;

    // Freshness signals (weak, but useful): footer year / latest detected date / news section.
    const nowYear = new Date().getUTCFullYear();
    const maxFooterYear = Math.max(0, ...(crawl.footerYears ?? []));
    if (maxFooterYear >= nowYear) websiteBonus += 3;
    else if (maxFooterYear >= nowYear - 1) websiteBonus += 2;
    else if (maxFooterYear > 0 && maxFooterYear <= nowYear - 5) websitePenalty += 2;

    if (crawl.latestContentDate) {
      const ts = Date.parse(crawl.latestContentDate);
      const ageDays = Number.isFinite(ts) ? (Date.now() - ts) / (1000 * 60 * 60 * 24) : null;
      if (ageDays != null && ageDays <= 120) websiteBonus += 3;
      else if (ageDays != null && ageDays <= 365) websiteBonus += 2;
      else if (ageDays != null && ageDays >= 365 * 3) websitePenalty += 2;
    }

    if (crawl.hasNewsSection) websiteBonus += 1;
  }

  const websiteQualityScore = clampInt(lhScoreRaw + websiteBonus - websitePenalty, 0, 100);

  // Convert to "redesign opportunity" score.
  // 0 = no need, 100 = strong redesign need.
  const redesignOpportunityScore = clampInt(100 - websiteQualityScore, 0, 100);

  // Business score (100 = alive/valuable business)
  let businessScore = 0;
  if (lead.website) businessScore += 15;
  if (lead.phone) businessScore += 25;
  if (lead.address) businessScore += 20;

  if (crawl) {
    const hasTelLink = crawl.telLinks.length > 0;
    const hasMailtoLink = crawl.mailtoLinks.length > 0;
    const hasSocial = crawl.socialLinks.length > 0;
    const hasForms = crawl.counts.forms > 0;

    if (hasTelLink) businessScore += 10;
    if (hasMailtoLink) businessScore += 8;
    if (hasSocial) businessScore += 7;
    if (hasForms) businessScore += 5;

    // basic sign of "multiple services/pages" (we only have current page crawl)
    if (crawl.counts.links >= 15) businessScore += 5;
    if (crawl.counts.links >= 40) businessScore += 5;

    // site corresponds to company: token overlap between companyName and title/h1
    const companyTokens = normalizeTokens(lead.companyName);
    const pageTokens = normalizeTokens([crawl.title ?? '', crawl.h1 ?? ''].join(' '));
    const sim = jaccard(companyTokens, pageTokens);
    if (sim >= 0.12) businessScore += 10;
    if (sim >= 0.20) businessScore += 5;

    // Freshness as business-alive proxy.
    const nowYear = new Date().getUTCFullYear();
    const maxFooterYear = Math.max(0, ...(crawl.footerYears ?? []));
    if (maxFooterYear >= nowYear - 1) businessScore += 5;
    if (crawl.latestContentDate) {
      const ts = Date.parse(crawl.latestContentDate);
      const ageDays = Number.isFinite(ts) ? (Date.now() - ts) / (1000 * 60 * 60 * 24) : null;
      if (ageDays != null && ageDays <= 365) businessScore += 5;
    }
    if (crawl.hasNewsSection) businessScore += 2;
  }

  businessScore = clampInt(businessScore, 0, 100);

  // Final lead score: downrank "dead" businesses.
  const leadScore = clampInt((redesignOpportunityScore * businessScore) / 100, 0, 100);

  const details = {
    version: 'deterministic-v1',
    lighthouse: {
      performance: lighthouse.performance,
      seo: lighthouse.seo,
      accessibility: lighthouse.accessibility,
      bestPractices: lighthouse.bestPractices,
      lcp: lighthouse.lcp,
      cls: lighthouse.cls,
      inp: lighthouse.inp,
      fcp: lighthouse.fcp,
      tbt: lighthouse.tbt,
      weightedAvg: Math.round(lhScoreRaw)
    },
    crawl: crawl
      ? {
          titlePresent: Boolean(crawl.title),
          metaDescriptionPresent: Boolean(crawl.metaDescription),
          h1Present: Boolean(crawl.h1),
          viewportPresent: Boolean(crawl.viewport),
          counts: crawl.counts,
          hasTelLink: crawl.telLinks.length > 0,
          hasMailtoLink: crawl.mailtoLinks.length > 0,
          hasSocialLinks: crawl.socialLinks.length > 0
        }
      : null,
    adjustments: {
      websitePenalty,
      websiteBonus
    }
  };

  // A couple derived labels (handy later, optional)
  const notes = {
    primaryWeakness:
      lighthouse.performance < 40
        ? 'performance'
        : safeAvg([lighthouse.seo, lighthouse.accessibility, lighthouse.bestPractices]) < 70
          ? 'quality'
          : 'unknown'
  };

  return {
    leadScore,
    businessScore,
    websiteQualityScore,
    scoreDetails: { ...details, notes }
  };
}
