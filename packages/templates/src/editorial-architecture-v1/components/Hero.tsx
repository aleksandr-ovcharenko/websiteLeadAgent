import { t, type CmsSection } from '../cms';

export function Hero({ section, anchor, companyName }: { section: CmsSection; anchor: string; companyName: string }) {
  const title = section.title || companyName;
  // Deterministic length-based compact mode — never a domain check. Long
  // titles step down one rung on the type scale instead of filling the
  // viewport; text-wrap: balance keeps line counts even.
  const len = title.length;
  const titleClass =
    len > 72 ? 'hero__title hero__title--compact' :
    len > 44 ? 'hero__title hero__title--long' :
    'hero__title';

  return (
    <section id={anchor} className={`hero${section.image ? '' : ' hero--text'}`} aria-label={t('hero.aria') || undefined}>
      <div className="hero__left">
        <h1 className={titleClass}>{title}</h1>
        {section.subtitle && <p className="hero__lead">{section.subtitle}</p>}
        {section.buttonLabel && section.buttonUrl && (
          <a className="hero__cta" href={section.buttonUrl}>
            {section.buttonLabel}
          </a>
        )}
      </div>

      {section.image && (
        <figure className="hero__figure">
          <div className="reveal-mask">
            {/* No HTML width/height attrs: they map to presentational hints
                that override the CSS aspect-ratio box (V3.7.3 hero defect —
                height=960 pushed the H1 below the fold). */}
            <img
              className="hero__image"
              src={section.image}
              alt={title}
              loading="eager"
              fetchPriority="high"
            />
            <div className="hero__grid-overlay" aria-hidden="true" />
          </div>
          <figcaption className="hero__caption">
            {section.caption ? <span>{section.caption}</span> : null}
            <span>{companyName}</span>
          </figcaption>
        </figure>
      )}
    </section>
  );
}
