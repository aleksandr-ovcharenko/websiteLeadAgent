import { useState } from 'react';
import { t, tf, type CmsSection } from '../cms';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const isFinePointer = () => window.matchMedia(FINE_POINTER).matches;

export function Services({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const items = section.items || [];
  // First state is always filled — never an empty preview.
  const [active, setActive] = useState(0);
  const current = items[Math.min(active, items.length - 1)];

  if (!items.length) return null;

  const allLabel = tf('viewAll.template', { name: (section.heading || t('collection.services')).toLowerCase() });

  return (
    <section id={anchor} className="services" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || t('collection.services')}</h2>
      </div>

      <div className="services__layout">
        <ul className="service-index" role="list">
          {items.map((s, i) => {
            const isActive = active === i;
            const preview = () => { if (isFinePointer()) setActive(i); };
            const inner = (
              <>
                <span className="service-item__num">§{String(i + 1).padStart(2, '0')}</span>
                <span className="service-item__name">{s.title}</span>
                {s.summary && <span className="service-item__note">{s.summary}</span>}
                {s.image && isActive && (
                  <span id={`service-fig-${i}`} className="service-item__img" aria-hidden="true">
                    <img src={s.image} alt="" loading="lazy" />
                  </span>
                )}
              </>
            );
            return (
              <li key={s.id} className={`service-item ${isActive ? 'service-item--active' : ''}`} role="listitem">
                {/* Routable service → the whole row is a real link; hover still
                    drives the preview. Without a route it stays a preview
                    toggle — never a dead anchor. */}
                {s.href ? (
                  <a
                    className="service-item__btn service-item__btn--link"
                    href={s.href}
                    onMouseEnter={preview}
                    onFocus={() => setActive(i)}
                  >
                    {inner}
                  </a>
                ) : (
                  <button
                    className="service-item__btn"
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActive(i)}
                    onMouseEnter={preview}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {items.some((s) => s.image) && (
          <figure className="services__figure" aria-label={t('services.figureAria') || undefined}>
            {items.map((s, i) => (
              s.image && (
                <img
                  key={s.id}
                  className={active === i ? 'service-preview--visible' : ''}
                  src={s.image}
                  alt={s.title}
                  aria-hidden={active !== i}
                  loading="lazy"
                />
              )
            ))}
            <figcaption className="services__figure-cap">
              <span>{String(active + 1).padStart(2, '0')}</span>
              <span>{current?.title || ''}</span>
            </figcaption>
          </figure>
        )}
      </div>

      {section.collectionHref && section.showAllLink !== false && allLabel && (
        <a className="section__all" href={section.collectionHref}>
          {allLabel} →
        </a>
      )}
    </section>
  );
}
