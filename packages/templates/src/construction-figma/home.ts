import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';
import { renderBlocks } from './shared.js';

export function renderHome(ctx: RenderContext): string {
  const home = ctx.pages.find((p: any) => p.isHomepage) || ctx.pages[0] || { title: '', seoDescription: '' };
  const heroTitle = (home.title || ctx.site?.name || '').split(/\||-|–/)[0].trim();
  const heroBody = home.seoDescription || ctx.settings?.defaultSeoDescription || '';
  const blocks = [
    {
      type: 'hero',
      tag: 'СТРОИТЕЛЬНАЯ КОМПАНИЯ',
      title: heroTitle,
      body: heroBody,
      buttonLabel: 'Обсудить проект',
      buttonUrl: '/contacts'
    },
    { type: 'services' },
    { type: 'projects' }
  ];
  return renderBlocks(ctx, blocks);
}
