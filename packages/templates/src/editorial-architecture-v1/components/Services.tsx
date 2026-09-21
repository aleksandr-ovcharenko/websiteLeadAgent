import { useState } from 'react';
import type { CmsSection } from '../cms';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const isFinePointer = () => window.matchMedia(FINE_POINTER).matches;

export function Services({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const items = section.items || [];
  // First state is always filled — never an empty preview.
  const [active, setActive] = useState(0);
  const current = items[Math.min(active, items.length - 1)];

  if (!items.length) return null;

  return (
    <section id={anchor} className="services" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? `Глава ${chapter}` : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || 'Услуги'}</h2>
      </div>

      <div className="services__layout">
        <ul className="service-index" role="list">
          {items.map((s, i) => {
            const isActive = active === i;
            return (
              <li key={s.id} className={`service-item ${isActive ? 'service-item--active' : ''}`} role="listitem">
                <button
                  className="service-item__btn"
                  type="button"
                  aria-expanded={isActive}
                  aria-controls={isActive ? `service-fig-${i}` : undefined}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => { if (isFinePointer()) setActive(i); }}
                >
                  <span className="service-item__num">§{String(i + 1).padStart(2, '0')}</span>
                  <span className="service-item__name">{s.title}</span>
                  {s.summary && <span className="service-item__note">{s.summary}</span>}
                  {s.image && isActive && (
                    <span id={`service-fig-${i}`} className="service-item__img" aria-hidden="true">
                      <img src={s.image} alt="" loading="lazy" width="600" height="240" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {items.some((s) => s.image) && (
          <figure className="services__figure" aria-label="Иллюстрация активной услуги">
            {items.map((s, i) => (
              s.image && (
                <img
                  key={s.id}
                  className={active === i ? 'service-preview--visible' : ''}
                  src={s.image}
                  alt={s.title}
                  aria-hidden={active !== i}
                  loading="lazy"
                  width="720"
                  height="900"
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
    </section>
  );
}
