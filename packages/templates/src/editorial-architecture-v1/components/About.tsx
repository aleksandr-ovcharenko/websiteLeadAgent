import { cms, t, tf, type CmsItem, type CmsSection } from '../cms';

export function About({ section, anchor, chapter, services }: { section: CmsSection; anchor: string; chapter?: string; services: CmsItem[] }) {
  const company = cms.COMPANY;
  const content = section.content || '';
  const paragraphs = content.split(/\n+/).map((s) => s.trim()).filter(Boolean);

  const facts: [string, string][] = (
    [
      [t('about.founded'), company.founded],
      [t('about.team'), company.employees],
      [t('about.unp'), company.unp],
      [t('about.address'), company.address],
    ] as [string, string | undefined][]
  ).filter(([k, v]) => !!k && !!v) as [string, string][];

  return (
    <section id={anchor} className="about" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || t('about.companyHeading')}</h2>
      </div>

      <div className="about__layout">
        <div>
          {paragraphs.length > 0 ? (
            paragraphs.slice(0, 3).map((p, i) => (
              <p key={i} className={i === 0 ? 'about__quote' : 'about__text'}>{i === 0 ? `«${p.replace(/^«|»$/g, '')}»` : p}</p>
            ))
          ) : (
            <p className="about__text">{company.legalName || company.name}</p>
          )}
          {section.image && (
            <figure className="case__image" style={{ marginTop: '2rem' }}>
              <div className="reveal-mask">
                <img src={section.image} alt={section.heading || company.name} loading="lazy" />
              </div>
            </figure>
          )}
        </div>

        <aside className="about__aside">
          {services.length > 0 && (
            <>
              <p className="about__aside-label">{t('about.directions')}</p>
              <ul className="about__aside-list">
                {services.map((s) => <li key={s.id}>{s.title}</li>)}
              </ul>
            </>
          )}
          {facts.length > 0 && (
            <div className="detail__meta" style={{ marginTop: '1.5rem' }} aria-label={t('about.factsAria') || undefined}>
              {facts.map(([k, v]) => (
                <div className="detail__meta-item" key={k}><b>{k}</b>{v}</div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
