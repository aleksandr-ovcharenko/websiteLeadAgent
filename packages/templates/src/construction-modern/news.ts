import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';
import { mediaUrl, renderText } from './shared.js';

export function renderNews(ctx: RenderContext): string {
  const items = ctx.news;
  if (items.length === 0) {
    return `<section class="section"><div class="container"><h1>Новости</h1><p class="muted">Пока нет новостей.</p></div></section>`;
  }
  return `<section class="section"><div class="container"><h1>Новости</h1><div class="grid">
    ${items.map((n: any) => `<a class="card" href="/news/${escapeHtml(n.slug)}">
      ${n.coverImageId ? `<img src="${mediaUrl(ctx, n.coverImageId)}" alt="" style="margin-bottom:12px;" />` : ''}
      <h3>${escapeHtml(n.title)}</h3>
      <p class="muted">${escapeHtml(n.excerpt || '')}</p>
    </a>`).join('')}
  </div></div></section>`;
}

export function renderNewsPost(ctx: RenderContext): string {
  const slug = ctx.subRoute;
  const n = ctx.news.find((x: any) => x.slug === slug);
  if (!n) return `<section class="section"><div class="container"><h1>Новость не найдена</h1></div></section>`;
  return `<section class="section"><div class="container">
    <h1>${escapeHtml(n.title)}</h1>
    ${n.excerpt ? `<p class="muted">${escapeHtml(n.excerpt)}</p>` : ''}
    ${n.coverImageId ? `<img src="${mediaUrl(ctx, n.coverImageId)}" alt="" style="max-width:400px;" />` : ''}
    <p>${renderText((n.blocks || []).map((b: any) => b.content || '').join('\n\n'))}</p>
  </div></section>`;
}
