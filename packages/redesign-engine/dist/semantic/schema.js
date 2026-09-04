import { z } from 'zod';
export const confidenceSchema = z.number().min(0).max(1);
export const provenanceSchema = z.object({
    sourceDocumentIds: z.array(z.string()),
    sourceSectionIds: z.array(z.string()).optional(),
    sourceCollectionIds: z.array(z.string()).optional(),
    sourceImageIds: z.array(z.string()).optional(),
    sourceUrls: z.array(z.string()).optional(),
    evidenceText: z.string().optional(),
});
export const evidenceSchema = z.object({
    type: z.string(),
    value: z.string(),
    confidence: confidenceSchema,
    sourceDocumentId: z.string().optional(),
    sourceSectionId: z.string().optional(),
    sourceCollectionId: z.string().optional(),
    sourceImageId: z.string().optional(),
    sourceUrl: z.string().optional(),
    context: z.string().optional(),
});
export const imageRoleSchema = z.enum([
    'LOGO',
    'HERO_CANDIDATE',
    'SERVICE_IMAGE',
    'PROJECT_IMAGE',
    'ARTICLE_IMAGE',
    'TEAM_IMAGE',
    'ADVERTISEMENT',
    'UTILITY_ICON',
    'LANGUAGE_ICON',
    'UNKNOWN',
]);
export const imageCandidateSchema = z.object({
    id: z.string(),
    src: z.string(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    role: imageRoleSchema,
    confidence: confidenceSchema,
    provenance: provenanceSchema,
});
export const pageTypeSchema = z.enum([
    'HOME',
    'ABOUT',
    'SERVICES_INDEX',
    'SERVICE_DETAIL',
    'PROJECTS_INDEX',
    'PROJECT_DETAIL',
    'NEWS_INDEX',
    'NEWS_DETAIL',
    'VACANCIES_INDEX',
    'VACANCY_DETAIL',
    'PRODUCTS_INDEX',
    'PRODUCT_DETAIL',
    'CONTACTS',
    'LEGAL',
    'OTHER',
]);
export const pageCategorySchema = z.enum(['HOME', 'CORPORATE', 'CONTENT', 'UTILITY']);
export const pageClassificationSchema = z.object({
    sourceDocumentId: z.string(),
    type: pageTypeSchema,
    category: pageCategorySchema.optional(),
    subType: z.string().optional(),
    confidence: confidenceSchema,
    evidence: z.array(evidenceSchema),
    breadcrumb: z.array(z.object({ label: z.string(), url: z.string().optional() })).optional(),
    navAncestry: z.array(z.string()).optional(),
});
export const collectionTypeSchema = z.enum([
    'CONTENT_COLLECTION',
    'NAVIGATION',
    'LANGUAGE_SWITCHER',
    'THEME_WIDGET',
    'UTILITY',
    'ADVERTISEMENT',
    'SOCIAL_LINKS',
    'PARTNER_LINKS',
    'UNKNOWN',
]);
export const contentSubtypeSchema = z.enum([
    'SERVICES',
    'PROJECTS',
    'NEWS',
    'VACANCIES',
    'PRODUCTS',
    'OTHER',
    'UNKNOWN',
]);
export const collectionClassificationSchema = z.object({
    collectionId: z.string(),
    type: collectionTypeSchema,
    contentSubtype: contentSubtypeSchema.optional(),
    confidence: confidenceSchema,
    reason: z.string(),
});
export const sectionTypeSchema = z.enum([
    'COMPANY_DESCRIPTION',
    'SERVICE_DESCRIPTION',
    'PROJECT_DESCRIPTION',
    'ARTICLE_BODY',
    'CONTACT_DETAILS',
    'HERO_CONTENT',
    'STATISTICS',
    'TESTIMONIAL',
    'TEAM',
    'CTA',
    'UTILITY',
    'NAVIGATION',
    'ADVERTISEMENT',
    'LANGUAGE_SWITCHER',
    'THEME_WIDGET',
    'UNKNOWN',
]);
export const sectionClassificationSchema = z.object({
    sectionId: z.string(),
    type: sectionTypeSchema,
    confidence: confidenceSchema,
    evidence: z.array(evidenceSchema),
});
export const entityStatusSchema = z.enum([
    'OK',
    'LOW_CONFIDENCE',
    'INSUFFICIENT_SOURCE_CONTENT',
    'REJECTED',
]);
export const baseEntitySchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    confidence: confidenceSchema,
    status: entityStatusSchema,
    sourceDocumentIds: z.array(z.string()),
    sourceSectionIds: z.array(z.string()).optional(),
    sourceCollectionIds: z.array(z.string()).optional(),
    imageIds: z.array(z.string()).optional(),
    evidence: z.array(evidenceSchema),
});
export const companyEntitySchema = baseEntitySchema.extend({
    displayName: z.string(),
    legalName: z.string().optional(),
    shortName: z.string().optional(),
    industry: z.string().optional(),
    founded: z.string().optional(),
    employees: z.string().optional(),
    unp: z.string().optional(),
});
export const contactValueSchema = z.object({
    value: z.string(),
    evidence: evidenceSchema,
});
export const contactsEntitySchema = z.object({
    id: z.string(),
    phones: z.array(contactValueSchema).optional(),
    emails: z.array(contactValueSchema).optional(),
    addresses: z.array(contactValueSchema).optional(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string(), evidence: evidenceSchema })).optional(),
    workingHours: z.object({ value: z.string(), evidence: evidenceSchema }).optional(),
    confidence: confidenceSchema,
    sourceDocumentIds: z.array(z.string()),
    evidence: z.array(evidenceSchema),
});
export const serviceEntitySchema = baseEntitySchema;
export const projectEntitySchema = baseEntitySchema.extend({
    location: z.string().optional(),
    category: z.string().optional(),
    projectStatus: z.string().optional(),
});
export const newsEntitySchema = baseEntitySchema.extend({
    date: z.string().nullable().optional(),
    author: z.string().optional(),
});
export const vacancyEntitySchema = baseEntitySchema.extend({
    location: z.string().optional(),
    employmentType: z.string().optional(),
});
export const productEntitySchema = baseEntitySchema;
export const factEntitySchema = z.object({
    id: z.string(),
    type: z.string(),
    value: z.string(),
    confidence: confidenceSchema,
    evidence: z.array(evidenceSchema),
});
export const qualitySchema = z.object({
    textCompleteness: z.number().min(0).max(1),
    semanticEvidenceStrength: z.number().min(0).max(1),
    contentDensity: z.number().min(0).max(1),
});
export const semanticPageSchema = z.object({
    sourceDocumentId: z.string(),
    classification: pageClassificationSchema,
    sections: z.array(sectionClassificationSchema),
    collections: z.array(collectionClassificationSchema),
    insufficientReason: z.string().optional(),
    quality: qualitySchema,
});
export const relationshipSchema = z.object({
    fromId: z.string(),
    fromType: z.string(),
    toId: z.string(),
    toType: z.string(),
    relation: z.string(),
    evidence: z.array(evidenceSchema),
});
export const sourceContentGraphSchema = z.object({
    version: z.string(),
    generatedAt: z.string(),
    provider: z.object({
        name: z.string(),
        model: z.string().optional(),
        promptVersion: z.string().optional(),
        temperature: z.number().optional(),
        confidenceThresholds: z.object({
            high: z.number().min(0).max(1).optional(),
            medium: z.number().min(0).max(1).optional(),
            low: z.number().min(0).max(1).optional(),
        }).optional(),
        confidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']).optional(),
    }),
    sourceDocumentIds: z.array(z.string()),
    baseUrl: z.string(),
    company: companyEntitySchema.optional(),
    contacts: contactsEntitySchema.optional(),
    pages: z.array(semanticPageSchema),
    services: z.array(serviceEntitySchema),
    projects: z.array(projectEntitySchema),
    news: z.array(newsEntitySchema),
    vacancies: z.array(vacancyEntitySchema),
    products: z.array(productEntitySchema),
    facts: z.array(factEntitySchema),
    media: z.array(imageCandidateSchema),
    relationships: z.array(relationshipSchema),
    rejectedCollections: z.array(z.object({
        collectionId: z.string(),
        type: collectionTypeSchema,
        confidence: confidenceSchema,
        reason: z.string(),
    })),
    warnings: z.array(z.string()),
});
