import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';
import { mediaUrl, renderText } from './shared.js';

export function renderProjects(ctx: RenderContext): string {
  const items = ctx.projects;
  if (items.length === 0) {
    return `<section class="section"><div class="container"><h1>Объекты</h1><p class="muted">Пока нет объектов.</p></div></section>`;
  }
  return `<section class="section"><div class="container"><h1>Объекты</h1><div class="grid">
    ${items.map((p: any) => `<a class="card" href="/projects/${escapeHtml(p.slug)}">
      ${p.coverImageId ? `<img src="${mediaUrl(ctx, p.coverImageId)}" alt="" style="margin-bottom:12px;" />` : ''}
      <h3>${escapeHtml(p.title)}</h3>
      <p class="muted">${escapeHtml(p.excerpt || '')}</p>
      ${p.location ? `<p class="muted">${escapeHtml(p.location)}</p>` : ''}
    </a>`).join('')}
  </div></div></section>`;
}

export function renderProject(ctx: RenderContext): string {
  const slug = ctx.subRoute;
  const p = ctx.projects.find((x: any) => x.slug === slug);
  if (!p) return `<section class="section"><div class="container"><h1>Объект не найден</h1></div></section>`;
  const gallery = (p.projectMedia || []).map((m: any) => m.media?.id ? mediaUrl(ctx, m.media.id) : '').filter(Boolean);
  return `<section class="section"><div class="container">
    <h1>${escapeHtml(p.title)}</h1>
    ${p.excerpt ? `<p class="muted">${escapeHtml(p.excerpt)}</p>` : ''}
    ${p.location ? `<p class="muted">${escapeHtml(p.location)}</p>` : ''}
    ${p.coverImageId ? `<img src="${mediaUrl(ctx, p.coverImageId)}" alt="" style="max-width:400px;" />` : ''}
    <p>${renderText((p.blocks || []).map((b: any) => b.content || '').join('\n\n'))}</p>
    ${gallery.length ? `<div class="grid" style="margin-top:24px;">${gallery.map((src: string) => `<img src="${src}" alt="" />`).join('')}</div>` : ''}
  </div></section>`;
}
