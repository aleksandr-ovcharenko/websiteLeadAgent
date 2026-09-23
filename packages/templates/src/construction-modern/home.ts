import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';
import { renderBlocks } from './shared.js';

export function renderHome(ctx: RenderContext): string {
  const home = ctx.pages.find((p: any) => p.isHomepage) || ctx.pages[0] || { title: '', seoDescription: '' };
  const heroTitle = (home.title || ctx.site?.name || '').split(/\||-|–/)[0].trim();
  const heroBody = home.seoDescription || ctx.settings?.defaultSeoDescription || '';
  const heroBlock = {
    type: 'hero',
    tag: 'СТРОИТЕЛЬНАЯ КОМПАНИЯ',
    title: heroTitle,
    body: heroBody,
    buttonLabel: 'Обсудить проект',
    buttonUrl: '/contacts'
  };
  // Configured homepage sections own their per-section limits/selection; the
  // resolved HomepageSection carries `limit` + `selectedItemIds` + `block`.
  const configured = (ctx.homepageSections || [])
    .filter((s: any) => s && s.enabled !== false && s.type !== 'hero')
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((s: any) => ({ ...(s.block || {}), type: s.type, limit: s.limit ?? s.block?.limit, selectedItemIds: s.selectedItemIds ?? s.block?.selectedItemIds }));
  const blocks = [
    heroBlock,
    ...(configured.length ? configured : [{ type: 'services' }, { type: 'projects' }])
  ];
  return renderBlocks(ctx, blocks);
}
