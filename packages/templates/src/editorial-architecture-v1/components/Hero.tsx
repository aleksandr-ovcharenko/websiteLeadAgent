import type { CmsSection } from '../cms';

export function Hero({ section, anchor, companyName }: { section: CmsSection; anchor: string; companyName: string }) {
  const title = section.title || companyName;

  return (
    <section id={anchor} className="hero" aria-label="Начало">
      <div className="hero__left">
        <h1 className="hero__title">{title}</h1>
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
            <img
              className="hero__image"
              src={section.image}
              alt={title}
              loading="eager"
              fetchPriority="high"
              width="1280"
              height="960"
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
