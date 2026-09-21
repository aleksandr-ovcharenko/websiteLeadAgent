import { cms, type CmsSection } from '../cms';

export function Contacts({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const c = cms.COMPANY;
  const rows: [string, string, string?][] = (
    [
      ['Телефон', c.phone, c.phoneHref],
      ['Email', c.email, c.email ? `mailto:${c.email}` : undefined],
      ['Адрес', c.address, undefined],
      ['Режим работы', c.workingHours, undefined],
    ] as [string, string | undefined, string | undefined][]
  ).filter(([, v]) => !!v) as [string, string, string?][];

  return (
    <section id={anchor} className="about" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? `Глава ${chapter}` : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || 'Контакты'}</h2>
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
