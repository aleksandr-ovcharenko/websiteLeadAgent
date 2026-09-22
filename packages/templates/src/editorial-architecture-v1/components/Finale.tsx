import { cms, t, tf, type CmsNavItem, type CmsSection } from '../cms';

export function Finale({ section, anchor, chapter, nav }: { section?: CmsSection; anchor: string; chapter?: string; nav?: CmsNavItem[] }) {
  const c = cms.COMPANY;

  return (
    <>
      <section id={anchor} className="finale" aria-labelledby={`${anchor}-heading`}>
        <div className="finale__inner">
          <div className="datum" aria-hidden="true" style={{ marginBottom: '2rem' }}>
            <span>{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
          </div>
          {(section?.title || section?.heading) && (
            <h2 id={`${anchor}-heading`} className="finale__statement">
              {section?.title || section?.heading}
            </h2>
          )}
          {section?.description && <p className="about__text">{section.description}</p>}
          {(section?.buttonLabel && section?.buttonUrl) && (
            <a className="finale__cta" href={section.buttonUrl}>
              {section.buttonLabel}
            </a>
          )}
          {c.phone && (
            <p className="finale__contact">
              {t('contacts.phone')}: {c.phoneHref ? <a href={c.phoneHref}>{c.phone}</a> : c.phone}
            </p>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="footer__inner">
          <span>{c.name}</span>
          {nav && nav.length > 0 && (
            <nav className="footer__nav" aria-label={t('footer.aria') || undefined}>
              {nav.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="footer__link"
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
          {c.address && <span>{c.address}</span>}
        </div>
      </footer>
    </>
  );
}
