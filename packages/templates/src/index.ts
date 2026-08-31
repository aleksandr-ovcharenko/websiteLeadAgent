import { constructionModern } from './construction-modern/index.js';
import { constructionFigma } from './construction-figma/index.js';
import { constructionModernV1 } from './construction-modern-v1/index.js';
import { constructionIndustrialV1 } from './construction-industrial-v1/index.js';

export const templates: Record<string, typeof constructionModern> = {
  'construction-modern': constructionModern,
  'construction-figma': constructionFigma,
  'construction-modern-v1': constructionModernV1,
  'construction-industrial-v1': constructionIndustrialV1
};

export { constructionModern } from './construction-modern/index.js';
export { constructionFigma } from './construction-figma/index.js';
export { constructionModernV1 } from './construction-modern-v1/index.js';
export { constructionIndustrialV1 } from './construction-industrial-v1/index.js';
