import { z } from 'zod';

// Canonical composition contract for Page.blocks.
// - id: stable block identifier (persisted across Studio save/load round-trips)
// - enabled: visibility toggle; disabled blocks keep their data but don't render
// - displayVariant: optional template-level presentation variant
// - .passthrough(): unknown fields must survive Studio/API round-trips
export const blockBaseSchema = z.object({
  id: z.string().optional(),
  enabled: z.boolean().optional(),
  displayVariant: z.string().optional(),
}).passthrough();

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

// Collection blocks select CMS entities: optional heading, limit and
// explicit selectedItemIds (order preserved). limit is nullable because
// Studio historically writes `null` for "all items".
const collectionFields = {
  limit: z.number().nullable().optional(),
  heading: z.string().optional(),
  selectedItemIds: z.array(z.string()).optional(),
};

export const servicesBlockSchema = blockBaseSchema.extend({
  type: z.literal('services'),
  ...collectionFields,
});

export const projectsBlockSchema = blockBaseSchema.extend({
  type: z.literal('projects'),
  ...collectionFields,
});

export const newsBlockSchema = blockBaseSchema.extend({
  type: z.literal('news'),
  ...collectionFields,
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
  ...collectionFields,
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

// Unknown block types (e.g. legacy team/stats/map written by older Studio
// versions) are not part of the canonical schema, but they must survive
// open/save round-trips instead of being silently dropped or rejected.
const KNOWN_BLOCK_TYPES: readonly string[] = [
  'hero', 'text', 'image', 'gallery', 'services', 'projects',
  'news', 'reviews', 'about', 'vacancies', 'cta', 'contacts',
];

export const unknownBlockSchema = z.object({
  // Excludes canonical types so a malformed known block still fails the union.
  type: z.string().min(1).refine((t) => !KNOWN_BLOCK_TYPES.includes(t), {
    message: 'known block type must validate against its own schema',
  }),
  id: z.string().optional(),
  enabled: z.boolean().optional(),
}).passthrough();

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
  unknownBlockSchema,
]);

export const SUPPORTED_BLOCK_TYPES = KNOWN_BLOCK_TYPES;

const blockTypeSchemas: Record<string, z.ZodTypeAny> = {
  hero: heroBlockSchema,
  text: textBlockSchema,
  image: imageBlockSchema,
  gallery: galleryBlockSchema,
  services: servicesBlockSchema,
  projects: projectsBlockSchema,
  news: newsBlockSchema,
  reviews: reviewsBlockSchema,
  about: aboutBlockSchema,
  vacancies: vacanciesBlockSchema,
  cta: ctaBlockSchema,
  contacts: contactsBlockSchema,
};

export interface BlockValidationResult {
  ok: boolean;
  errors: string[];
  blocks: any[];
}

// Runtime validation for CMS writes. Known block types are validated against
// their canonical schema; unknown types are preserved verbatim (with a stable
// type/id/enabled shape) so they are never silently dropped.
export function validateContentBlocks(input: unknown): BlockValidationResult {
  if (!Array.isArray(input)) {
    return { ok: false, errors: ['blocks must be an array'], blocks: [] };
  }
  const errors: string[] = [];
  const blocks: any[] = [];
  input.forEach((b, i) => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      errors.push(`blocks[${i}]: must be an object`);
      return;
    }
    const type = (b as any).type;
    if (typeof type !== 'string' || !type.trim()) {
      errors.push(`blocks[${i}]: missing or invalid "type"`);
      return;
    }
    const schema = blockTypeSchemas[type];
    if (!schema) {
      const res = unknownBlockSchema.safeParse(b);
      if (!res.success) {
        errors.push(`blocks[${i}] (${type}): ${res.error.issues.map((x) => x.message).join('; ')}`);
        return;
      }
      blocks.push({ ...res.data, enabled: res.data.enabled !== false });
      return;
    }
    const res = schema.safeParse(b);
    if (!res.success) {
      errors.push(
        `blocks[${i}] (${type}): ${res.error.issues.map((x) => `${x.path.join('.') || 'root'} — ${x.message}`).join('; ')}`,
      );
      return;
    }
    blocks.push({ ...res.data, enabled: res.data.enabled !== false });
  });
  return { ok: errors.length === 0, errors, blocks };
}

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

export const contentProductSchema = z.object({
  title: z.string(),
  slug: z.string(),
  summary: z.string().optional(),
  attributes: z.record(z.string(), z.string()).default({}),
  blocks: z.array(contentBlockSchema).default([]),
  sourceUrl: z.string().optional(),
  sourceType: z.enum(['IMPORTED', 'MANUAL', 'AI_REWRITTEN']).default('IMPORTED'),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  coverImage: contentMediaSchema.optional(),
  gallery: z.array(contentMediaSchema).default([]),
});

export const dynamicSectionSchema = z.object({
  kind: z.string(),
  heading: z.string().optional(),
  items: z.array(z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    meta: z.record(z.string(), z.string()).optional(),
  })).default([]),
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
    type: z.enum(['hero', 'about', 'services', 'projects', 'products', 'news', 'articles', 'vacancies', 'contacts', 'cta', 'dynamic']),
    enabled: z.boolean().default(true),
    sortOrder: z.number().default(0),
    title: z.string().optional(),
    sectionType: z.string().optional(),
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
  products: z.array(contentProductSchema).default([]),
  dynamicSections: z.array(dynamicSectionSchema).default([]),
  news: z.array(contentNewsSchema).default([]),
  vacancies: z.array(contentVacancySchema).default([]),
  reviews: reviewsBlockSchema.shape.reviews.default([]),
  contacts: contentContactsSchema.default({}),
  media: z.array(contentMediaSchema).default([]),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ExtractedContent = z.infer<typeof extractedContentSchema>;
