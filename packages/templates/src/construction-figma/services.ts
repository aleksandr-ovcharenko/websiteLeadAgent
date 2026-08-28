import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';
import { renderText } from './shared.js';

export function renderServices(ctx: RenderContext): string {
  const items = ctx.services;
  if (items.length === 0) {
    return `<section class="section"><div class="container"><h1>Услуги</h1><p class="muted">Пока нет услуг.</p></div></section>`;
  }
  return `<section class="section"><div class="container"><h1>Услуги</h1><div class="grid">
    ${items.map((s: any) => `<div class="card">
      <h3>${escapeHtml(s.title)}</h3>
      <p class="muted">${escapeHtml(s.shortDescription || '')}</p>
    </div>`).join('')}
  </div>
  <div style="margin-top:24px;">
    ${items.map((s: any) => `<div style="margin-bottom:24px;"><h2>${escapeHtml(s.title)}</h2><p>${renderText((s.blocks || []).map((b: any) => b.content || '').join('\n\n'))}</p></div>`).join('')}
  </div>
  </div></section>`;
}
