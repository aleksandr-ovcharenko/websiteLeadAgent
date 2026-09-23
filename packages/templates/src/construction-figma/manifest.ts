import type { TemplateManifest } from '../types.js';

// Legacy string-rendered template — same section contract as
// construction-modern (shared renderBlocks implementation).
export const constructionFigmaManifest: TemplateManifest = {
  id: 'construction-figma',
  name: 'Construction Figma',
  supportedSectionTypes: ['hero', 'services', 'projects', 'news', 'contacts', 'cta', 'text', 'image', 'gallery', 'reviews'],
  sectionRendererMap: {
    services: 'renderServicesBlock',
    projects: 'renderProjectsBlock',
    news: 'renderNewsBlock',
  },
  collectionRendererMap: {},
  collectionSections: {
    services: { defaultLimit: 4, supportsLimit: true },
    projects: { defaultLimit: 3, supportsLimit: true },
    news: { defaultLimit: 6, supportsLimit: true },
  },
};
