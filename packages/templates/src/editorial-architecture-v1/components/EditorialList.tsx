import type { CmsSection } from '../cms';

// Generic editorial index for collection sections (news, vacancies).
export function EditorialList({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const items = section.items || [];
  if (!items.length) return null;

  return (
    <section id={anchor} className="services" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? `Глава ${chapter}` : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || section.type}</h2>
      </div>

      <ul className="service-index" role="list">
        {items.map((it, i) => (
          <li key={it.id} className="service-item" role="listitem">
            <div className="service-item__btn" style={{ cursor: 'default' }}>
              <span className="service-item__num">§{String(i + 1).padStart(2, '0')}</span>
              <span className="service-item__name">{it.title}</span>
              {(it.excerpt || it.summary || it.description) && (
                <span className="service-item__note">{it.excerpt || it.summary || it.description}</span>
              )}
              {(it.date || it.location) && (
                <span className="service-item__note">{[it.date, it.location].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
