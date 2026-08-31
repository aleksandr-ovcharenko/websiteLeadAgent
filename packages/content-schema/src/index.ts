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
  reviews: z.array(
    z.object({
      author: z.string().optional(),
      text: z.string(),
      rating: z.number().optional(),
    })
  ).default([]),
});

export const aboutBlockSchema = blockBaseSchema.extend({
  type: z.literal('about'),
  heading: z.string().optional(),
  content: z.string(),
  imageId: z.string().optional(),
});

export const vacanciesBlockSchema = blockBaseSchema.extend({
  type: z.literal('vacancies'),
  heading: z.string().optional(),
  limit: z.number().optional(),
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
  aboutBlockSchema,
  vacanciesBlockSchema,
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

export const contentVacancySchema = z.object({
  title: z.string(),
  slug: z.string(),
  location: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  conditions: z.string().optional(),
  contact: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceType: z.enum(['IMPORTED', 'MANUAL', 'AI_REWRITTEN']).default('IMPORTED'),
});

export interface ContentNavigationItem {
  label: string;
  url?: string;
  children?: ContentNavigationItem[];
}

export const contentNavigationItemSchema: z.ZodType<ContentNavigationItem> = z.lazy(() =>
  z.object({
    label: z.string(),
    url: z.string().optional(),
    children: z.array(contentNavigationItemSchema).default([]),
  })
);

export const contentContactsSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  workingHours: z.string().optional(),
  socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
});

export const contentBrandingSchema = z.object({
  companyName: z.string().optional(),
  logo: contentMediaSchema.optional(),
  favicon: contentMediaSchema.optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  defaultSeoTitle: z.string().optional(),
  defaultSeoDescription: z.string().optional(),
});

export const contentThemeSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  surfaceColor: z.string().optional(),
  textColor: z.string().optional(),
  mutedColor: z.string().optional(),
  borderColor: z.string().optional(),
  headingStyle: z.string().optional(),
  radiusScale: z.number().optional(),
  source: z.enum(['extracted', 'inferred', 'default']).default('default'),
});

export const contentHeroSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  imageId: z.string().optional(),
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaTarget: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
});

export const extractedContentSchema = z.object({
  company: z.object({
    name: z.string().optional(),
    shortName: z.string().optional(),
    description: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    workingHours: z.string().optional(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
    legalName: z.string().optional(),
    unp: z.string().optional(),
    founded: z.string().optional(),
    employees: z.string().optional(),
  }).default({}),
  theme: contentThemeSchema.default({}),
  hero: contentHeroSchema.default({}),
  about: z.object({
    heading: z.string().optional(),
    content: z.string().optional(),
    imageId: z.string().optional(),
  }).default({}),
  cta: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    buttonLabel: z.string().optional(),
    buttonUrl: z.string().optional(),
  }).default({}),
  homepageSections: z.array(z.object({
    type: z.enum(['hero', 'about', 'services', 'projects', 'news', 'vacancies', 'contacts', 'cta']),
    enabled: z.boolean().default(true),
    sortOrder: z.number().default(0),
    title: z.string().optional(),
    limit: z.number().optional(),
  })).default([
    { type: 'hero', enabled: true, sortOrder: 0 },
    { type: 'about', enabled: true, sortOrder: 1 },
    { type: 'services', enabled: true, sortOrder: 2 },
    { type: 'projects', enabled: true, sortOrder: 3 },
    { type: 'news', enabled: true, sortOrder: 4 },
    { type: 'contacts', enabled: true, sortOrder: 5 },
  ]),
  branding: contentBrandingSchema.default({}),
  navigation: z.array(contentNavigationItemSchema).default([]),
  pages: z.array(contentPageSchema).default([]),
  services: z.array(contentServiceSchema).default([]),
  projects: z.array(contentProjectSchema).default([]),
  news: z.array(contentNewsSchema).default([]),
  vacancies: z.array(contentVacancySchema).default([]),
  reviews: reviewsBlockSchema.shape.reviews.default([]),
  contacts: contentContactsSchema.default({}),
  media: z.array(contentMediaSchema).default([]),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ExtractedContent = z.infer<typeof extractedContentSchema>;
