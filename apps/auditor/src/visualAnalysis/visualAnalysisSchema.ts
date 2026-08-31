import { z } from 'zod';

const numericScore = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  }
  return val;
}, z.number().int().min(1).max(10));

export const visualAnalysisResultSchema = z
  .object({
    modernity: z.number().int().min(1).max(10),
    visualQuality: z.number().int().min(1).max(10),
    mobileUX: z.number().int().min(1).max(10),
    trust: z.number().int().min(1).max(10),
    ctaQuality: z.number().int().min(1).max(10),
    contentStructure: z.number().int().min(1).max(10),
    visualHierarchy: z.number().int().min(1).max(10),
    brandConsistency: z.number().int().min(1).max(10),
    redesignPotential: z.number().int().min(1).max(10),

    problems: z.array(z.string().min(2)).max(6),
    strengths: z.array(z.string().min(2)).max(4),
    summary: z.string().min(5).max(300)
  })
  .strict();

// Provider-facing schema: accept numeric strings and longer summaries so we can
// safely normalize locally without wasting retries/quota.
export const visualAnalysisProviderResultSchema = z
  .object({
    modernity: numericScore,
    visualQuality: numericScore,
    mobileUX: numericScore,
    trust: numericScore,
    ctaQuality: numericScore,
    contentStructure: numericScore,
    visualHierarchy: numericScore,
    brandConsistency: numericScore,
    redesignPotential: numericScore,

    problems: z.array(z.string().min(2)).max(6),
    strengths: z.array(z.string().min(2)).max(4),
    summary: z.string().min(5).max(2000)
  })
  .strict();

export type VisualAnalysisResult = z.infer<typeof visualAnalysisResultSchema>;

export type VisualAnalysisInput = {
  leadId: string;
  companyName: string;
  categories: string[];
  url: string;

  crawl: unknown;
  lighthouse: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
  } | null;

  images: {
    desktopPngBase64: string;
    mobilePngBase64: string;
  };
};
