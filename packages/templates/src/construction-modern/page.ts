import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';
import { renderBlocks } from './shared.js';

export function renderPage(ctx: RenderContext, page: any): string {
  return `<section class="section"><div class="container">
    <h1>${escapeHtml(page.title)}</h1>
    ${renderBlocks(ctx, page.blocks || [])}
  </div></section>`;
}
