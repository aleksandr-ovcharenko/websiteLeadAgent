import { t, tf, type CmsSection } from '../cms';

// Generic editorial index for collection sections (news, vacancies).
// Entity-navigation contract: a routable item renders as ONE real anchor —
// the whole row is the link, the arrow is decorative inside it. Items
// without a route render as plain rows with no arrow (never href="#").
export function EditorialList({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const items = section.items || [];
  if (!items.length) return null;
  const allLabel = tf('viewAll.template', {
    name: (section.heading || t(`collection.${section.type || ''}`) || t('entity.default')).toLowerCase(),
  });

  const rowBody = (it: any, i: number) => (
    <>
      <span className="service-item__num">§{String(i + 1).padStart(2, '0')}</span>
      <span className="service-item__name">{it.title}</span>
      {(it.excerpt || it.summary || it.description) && (
        <span className="service-item__note">{it.excerpt || it.summary || it.description}</span>
      )}
      {(it.date || it.location) && (
        <span className="service-item__note">{[it.date, it.location].filter(Boolean).join(' · ')}</span>
      )}
    </>
  );

  return (
    <section id={anchor} className="services" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || t(`collection.${section.type || ''}`)}</h2>
      </div>

      <ul className="service-index" role="list">
        {items.map((it, i) => (
          <li key={it.id} className="service-item" role="listitem">
            {it.href ? (
              <a className="service-item__btn service-item__btn--link" href={it.href}>
                {rowBody(it, i)}
              </a>
            ) : (
              <div className="service-item__btn service-item__btn--static">{rowBody(it, i)}</div>
            )}
          </li>
        ))}
      </ul>

      {/* "Все …" only when the section actually truncates a longer collection
          and the block allows the link — never a decorative dead end. */}
      {section.collectionHref && section.showAllLink !== false && allLabel
        && (section.totalItems == null || section.totalItems > (section.items?.length || 0)) && (
        <a className="section__all" href={section.collectionHref}>
          {allLabel} →
        </a>
      )}
    </section>
  );
}
