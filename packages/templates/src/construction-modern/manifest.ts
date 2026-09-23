import type { TemplateManifest } from '../types.js';

// Legacy string-rendered template. Defaults preserve the pre-contract visual
// behaviour: shared.ts used `limit ?? 4` (services), `?? 3` (projects),
// `?? 6` (news).
export const constructionModernManifest: TemplateManifest = {
  id: 'construction-modern',
  name: 'Construction Modern',
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
