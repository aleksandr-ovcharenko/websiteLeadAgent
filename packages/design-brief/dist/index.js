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
// Add customer-agnostic brief fixtures under packages/design-brief/fixtures if needed.
