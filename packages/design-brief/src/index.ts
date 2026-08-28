import { z } from 'zod';

export const designQualitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const designAvoidSchema = z.object({
  label: z.string(),
  reason: z.string().optional(),
});

export const designPrioritySchema = z.object({
  rank: z.number().int(),
  label: z.string(),
});

export const designBriefSchema = z.object({
  client: z.string(),
  companyName: z.string(),
  website: z.string().url(),
  industry: z.string(),
  qualities: z.array(designQualitySchema),
  visualPriorities: z.array(designPrioritySchema),
  avoid: z.array(designAvoidSchema),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
});

export const designTokenSchema = z.object({
  colors: z.record(z.string()).default({}),
  typography: z.record(z.any()).default({}),
  spacing: z.record(z.number()).default({}),
  sizes: z.record(z.any()).default({}),
  radii: z.record(z.any()).default({}),
  shadows: z.record(z.string()).default({}),
});

export const designSystemSchema = z.object({
  name: z.string(),
  tokens: designTokenSchema,
  breakpoints: z.object({
    mobile: z.number().default(640),
    tablet: z.number().default(1024),
    desktop: z.number().default(1440),
  }),
});

export type DesignBrief = z.infer<typeof designBriefSchema>;
export type DesignSystem = z.infer<typeof designSystemSchema>;

export { garantkDesignSystem } from './garantkDesignSystem.js';

export const garantkBrief: DesignBrief = {
  client: 'garantk.by',
  companyName: 'ООО «ГАРАНТ КАЧЕСТВА»',
  website: 'https://garantk.by/',
  industry: 'commercial / industrial construction',
  qualities: [
    { name: 'premium' },
    { name: 'architectural' },
    { name: 'modern' },
    { name: 'trustworthy' },
    { name: 'established' },
    { name: 'professional' },
    { name: 'restrained' },
    { name: 'visually strong' },
  ],
  visualPriorities: [
    { rank: 1, label: 'real company projects' },
    { rank: 2, label: 'strong architectural photography' },
    { rank: 3, label: 'typography' },
    { rank: 4, label: 'clear services' },
    { rank: 5, label: 'company credibility' },
    { rank: 6, label: 'clear CTA/contact' },
    { rank: 7, label: 'mobile quality' },
  ],
  avoid: [
    { label: 'generic Bootstrap appearance' },
    { label: 'generic AI landing-page appearance' },
    { label: 'SaaS dashboard aesthetics' },
    { label: 'excessive gradients' },
    { label: 'excessive rounded cards' },
    { label: 'random icons everywhere' },
    { label: 'fake statistics' },
    { label: 'fake customer logos' },
    { label: 'stock construction photos when real project photos exist' },
    { label: 'huge amounts of text on homepage' },
  ],
  targetAudience: 'commercial construction clients, industrial partners, government tenders, real estate developers',
  tone: 'serious, confident, experienced',
};
