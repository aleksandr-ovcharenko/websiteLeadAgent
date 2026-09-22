import { t, tf, type CmsSection } from '../cms';

// Catalog products index — linked cards, same pattern as CollectionView.
// Products are navigable entities, so unlike the services hover-index each
// card is an anchor to the product's own route.
export function Products({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const items = section.items || [];
  if (!items.length) return null;
  const allLabel = tf('viewAll.template', { name: (section.heading || t('collection.products')).toLowerCase() });

  return (
    <section id={anchor} className="services" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || t('collection.products')}</h2>
      </div>

      <ul className="collection" role="list">
        {items.map((it: any) => {
          const body = (
            <>
              {it.image && (
                <span className="collection__thumb" aria-hidden="true">
                  <img src={it.image} alt="" loading="lazy" />
                </span>
              )}
              <span className="collection__body">
                <span className="collection__title">{it.title}</span>
                {it.summary && <span className="collection__excerpt">{it.summary}</span>}
              </span>
              {it.href && <span className="collection__arrow" aria-hidden="true">→</span>}
            </>
          );
          return (
            <li key={it.id} className="collection__item" role="listitem">
              {/* Never href="#" — an unroutable product renders as a static
                  card with no arrow instead of a dead link. */}
              {it.href ? (
                <a className="collection__link" href={it.href}>{body}</a>
              ) : (
                <div className="collection__link collection__link--static">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      {section.collectionHref && section.showAllLink !== false && allLabel && (
        <a className="section__all" href={section.collectionHref}>
          {allLabel} →
        </a>
      )}
    </section>
  );
}
