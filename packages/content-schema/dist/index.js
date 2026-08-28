import { z } from 'zod';
export const blockBaseSchema = z.object({
    id: z.string().optional(),
});
export const heroBlockSchema = blockBaseSchema.extend({
    type: z.literal('hero'),
    title: z.string(),
    subtitle: z.string().optional(),
    imageId: z.string().optional(),
    buttonLabel: z.string().optional(),
    buttonUrl: z.string().optional(),
});
export const textBlockSchema = blockBaseSchema.extend({
    type: z.literal('text'),
    heading: z.string().optional(),
    content: z.string(),
});
export const imageBlockSchema = blockBaseSchema.extend({
    type: z.literal('image'),
    imageId: z.string(),
    caption: z.string().optional(),
});
export const galleryBlockSchema = blockBaseSchema.extend({
    type: z.literal('gallery'),
    imageIds: z.array(z.string()).default([]),
});
export const servicesBlockSchema = blockBaseSchema.extend({
    type: z.literal('services'),
    limit: z.number().optional(),
    heading: z.string().optional(),
});
export const projectsBlockSchema = blockBaseSchema.extend({
    type: z.literal('projects'),
    limit: z.number().optional(),
    heading: z.string().optional(),
});
export const newsBlockSchema = blockBaseSchema.extend({
    type: z.literal('news'),
    limit: z.number().optional(),
    heading: z.string().optional(),
});
export const reviewsBlockSchema = blockBaseSchema.extend({
    type: z.literal('reviews'),
    reviews: z.array(z.object({
        author: z.string().optional(),
        text: z.string(),
        rating: z.number().optional(),
    })).default([]),
});
export const ctaBlockSchema = blockBaseSchema.extend({
    type: z.literal('cta'),
    title: z.string(),
    description: z.string().optional(),
    buttonLabel: z.string().optional(),
    buttonUrl: z.string().optional(),
});
export const contactsBlockSchema = blockBaseSchema.extend({
    type: z.literal('contacts'),
    heading: z.string().optional(),
});
export const contentBlockSchema = z.union([
    heroBlockSchema,
    textBlockSchema,
    imageBlockSchema,
    galleryBlockSchema,
    servicesBlockSchema,
    projectsBlockSchema,
    newsBlockSchema,
    reviewsBlockSchema,
    ctaBlockSchema,
    contactsBlockSchema,
]);
export const contentMediaSchema = z.object({
    id: z.string().optional(),
    sourceUrl: z.string().optional(),
    filename: z.string(),
    originalFilename: z.string().optional(),
    mimeType: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    dataBase64: z.string().optional(),
});
export const contentPageSchema = z.object({
    title: z.string(),
    slug: z.string(),
    sourceUrl: z.string().optional(),
    sourceType: z.enum(['IMPORTED', 'MANUAL', 'AI_REWRITTEN']).default('IMPORTED'),
    isHomepage: z.boolean().default(false),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    blocks: z.array(contentBlockSchema).default([]),
});
export const contentServiceSchema = z.object({
    title: z.string(),
    slug: z.string(),
    shortDescription: z.string().optional(),
    blocks: z.array(contentBlockSchema).default([]),
    sourceUrl: z.string().optional(),
    sourceType: z.enum(['IMPORTED', 'MANUAL', 'AI_REWRITTEN']).default('IMPORTED'),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    image: contentMediaSchema.optional(),
});
export const contentProjectSchema = z.object({
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().optional(),
    category: z.string().optional(),
    location: z.string().optional(),
    completionDate: z.string().optional(),
    blocks: z.array(contentBlockSchema).default([]),
    sourceUrl: z.string().optional(),
    sourceType: z.enum(['IMPORTED', 'MANUAL', 'AI_REWRITTEN']).default('IMPORTED'),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    coverImage: contentMediaSchema.optional(),
    gallery: z.array(contentMediaSchema).default([]),
});
export const contentNewsSchema = z.object({
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().optional(),
    publishedAt: z.string().optional(),
    blocks: z.array(contentBlockSchema).default([]),
    sourceUrl: z.string().optional(),
    sourceType: z.enum(['IMPORTED', 'MANUAL', 'AI_REWRITTEN']).default('IMPORTED'),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    coverImage: contentMediaSchema.optional(),
});
export const contentContactsSchema = z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    workingHours: z.string().optional(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
});
export const contentBrandingSchema = z.object({
    companyName: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    defaultSeoTitle: z.string().optional(),
    defaultSeoDescription: z.string().optional(),
});
export const extractedContentSchema = z.object({
    company: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        workingHours: z.string().optional(),
        socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
    }).default({}),
    branding: contentBrandingSchema.default({}),
    pages: z.array(contentPageSchema).default([]),
    services: z.array(contentServiceSchema).default([]),
    projects: z.array(contentProjectSchema).default([]),
    news: z.array(contentNewsSchema).default([]),
    reviews: reviewsBlockSchema.shape.reviews.default([]),
    contacts: contentContactsSchema.default({}),
    media: z.array(contentMediaSchema).default([]),
});
