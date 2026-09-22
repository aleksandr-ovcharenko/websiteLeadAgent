import { useState } from 'react';
import { t, tf, type CmsItem, type CmsSection } from '../cms';

function CaseArticle({ p, i, total, variant, onOpen }: { p: CmsItem; i: number; total: string; variant: string; onOpen: (index: number) => void }) {
  // V3.7.3 — a reserved media frame that fails to load degrades to the
  // text-only variant instead of leaving an empty column on screen.
  const [mediaFailed, setMediaFailed] = useState(false);
  const hasMedia = !!p.image && !mediaFailed;
  const indexLabel = tf('detail.indexTemplate', { label: t('entity.project'), i: String(i + 1).padStart(2, '0'), n: total });

  return (
    <article className={`case ${hasMedia ? variant : 'case--text'}`}>
      {hasMedia && (
        <figure className="case__image">
          <div className="reveal-mask">
            <img src={p.image} alt={p.title} loading="lazy" onError={() => setMediaFailed(true)} />
          </div>
          <figcaption className="case__image-cap">
            <span>{indexLabel}</span>
            {p.category && <span>{p.category}</span>}
          </figcaption>
        </figure>
      )}

      <div className="case__body">
        <div className="case__index">{indexLabel}</div>
        <h3 className="case__title">
          {/* The overlay stays, but the entity always carries a canonical
              route — the title is a real link to the detail page. */}
          {p.href ? <a className="case__title-link" href={p.href}>{p.title}</a> : p.title}
        </h3>
        {(p.excerpt || p.summary) && (
          <p className="case__note">{p.excerpt || p.summary}</p>
        )}
        <div className="case__actions">
          <button className="case__action" type="button" onClick={() => onOpen(i)}>
            {t('detail.openCta')}
          </button>
          {p.href && (
            <a className="case__action case__action--link" href={p.href}>
              {t('detail.pageCta')}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function Projects({ section, anchor, chapter, onOpen }: { section: CmsSection; anchor: string; chapter?: string; onOpen: (index: number) => void }) {
  const items = section.items || [];
  if (!items.length) return null;
  const total = String(items.length).padStart(2, '0');
  const allLabel = tf('viewAll.template', { name: (section.heading || t('collection.projects')).toLowerCase() });

  return (
    <section id={anchor} className="projects" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || t('collection.projects')}</h2>
      </div>

      {items.map((p: CmsItem, i: number) => (
        <CaseArticle key={p.id} p={p} i={i} total={total} variant={i % 2 === 0 ? 'case--a' : 'case--b'} onOpen={onOpen} />
      ))}

      {section.collectionHref && section.showAllLink !== false && allLabel && (
        <a className="section__all" href={section.collectionHref}>
          {allLabel} →
        </a>
      )}
    </section>
  );
}
