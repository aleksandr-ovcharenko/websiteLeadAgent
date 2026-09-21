import type { CmsItem, CmsSection } from '../cms';

export function Projects({ section, anchor, chapter, onOpen }: { section: CmsSection; anchor: string; chapter?: string; onOpen: (index: number) => void }) {
  const items = section.items || [];
  if (!items.length) return null;
  const total = String(items.length).padStart(2, '0');

  return (
    <section id={anchor} className="projects" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? `Глава ${chapter}` : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || 'Объекты'}</h2>
      </div>

      {items.map((p: CmsItem, i: number) => (
        <article key={p.id} className={`case ${i % 2 === 0 ? 'case--a' : 'case--b'}`}>
          {p.image && (
            <figure className="case__image">
              <div className="reveal-mask">
                <img src={p.image} alt={p.title} loading="lazy" width="960" height="600" />
              </div>
              <figcaption className="case__image-cap">
                <span>Объект {String(i + 1).padStart(2, '0')} / {total}</span>
                {p.category && <span>{p.category}</span>}
              </figcaption>
            </figure>
          )}

          <div className="case__body">
            <div className="case__index">Объект {String(i + 1).padStart(2, '0')} / {total}</div>
            <h3 className="case__title">{p.title}</h3>
            {(p.excerpt || p.summary) && (
              <p className="case__note">{p.excerpt || p.summary}</p>
            )}
            <button className="case__action" type="button" onClick={() => onOpen(i)}>
              Открыть объект →
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
