import { cms, t, tf, type CmsSection } from '../cms';

export function Contacts({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const c = cms.COMPANY;
  const rows: [string, string, string?][] = (
    [
      [t('contacts.phone'), c.phone, c.phoneHref],
      [t('contacts.email'), c.email, c.email ? `mailto:${c.email}` : undefined],
      [t('contacts.address'), c.address, undefined],
      [t('contacts.hours'), c.workingHours, undefined],
    ] as [string, string | undefined, string | undefined][]
  ).filter(([k, v]) => !!k && !!v) as [string, string, string?][];

  return (
    <section id={anchor} className="about" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || t('contacts.heading')}</h2>
      </div>
      {rows.length > 0 ? (
        <ul className="service-index" role="list">
          {rows.map(([k, v, href]) => (
            <li key={k} className="service-item" role="listitem">
              <div className="service-item__btn" style={{ cursor: 'default' }}>
                <span className="service-item__num">{k}</span>
                {href ? (
                  <a className="service-item__name" href={href} style={{ color: 'inherit', textDecoration: 'none' }}>{v}</a>
                ) : (
                  <span className="service-item__name">{v}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="about__text">{c.name}</p>
      )}
    </section>
  );
}
