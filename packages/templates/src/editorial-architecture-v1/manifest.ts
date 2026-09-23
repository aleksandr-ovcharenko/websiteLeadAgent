import type { TemplateManifest } from '../types.js';

export const editorialArchitectureV1Manifest: TemplateManifest = {
  id: 'editorial-architecture-v1',
  name: 'Editorial Architecture v1',
  fallbackPrimaryColor: '#a8451e',
  supportedSectionTypes: [
    'hero',
    'about',
    'services',
    'projects',
    'products',
    'news',
    'vacancies',
    'contacts',
    'cta',
    'text',
    'image',
    'gallery',
    'certificates',
  ],
  sectionRendererMap: {
    hero: 'Hero',
    about: 'About',
    services: 'Services',
    projects: 'Projects',
    products: 'Products',
    news: 'EditorialList',
    vacancies: 'EditorialList',
    contacts: 'Contacts',
    cta: 'Finale',
    text: 'GenericContentSection',
    image: 'GenericContentSection',
    gallery: 'GenericContentSection',
    certificates: 'CertificatesSection',
  },
  collectionRendererMap: {
    services: 'Services',
    projects: 'Projects',
    news: 'EditorialList',
    vacancies: 'EditorialList',
  },
  // Sections resolve items through selectBlockItems, which honors section.limit.
  // When limit is absent the template historically showed everything — the
  // default preserves that while letting CMS cap each section.
  collectionSections: {
    services: { defaultLimit: 24, supportsLimit: true },
    projects: { defaultLimit: 24, supportsLimit: true },
    products: { defaultLimit: 24, supportsLimit: true },
    news: { defaultLimit: 24, supportsLimit: true },
    vacancies: { defaultLimit: 24, supportsLimit: true },
  },
  pageRenderer: 'PageView',
};
