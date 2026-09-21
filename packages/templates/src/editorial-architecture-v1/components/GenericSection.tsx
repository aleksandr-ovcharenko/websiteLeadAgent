import type { CmsSection } from '../cms';

// Degradation path for text/image/gallery and unknown block types:
// render whatever content exists — never a broken placeholder, never a crash.
export function GenericSection({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const images = section.imageUrls?.length ? section.imageUrls : (section.image ? [section.image] : []);
  const hasBody = !!(section.content || section.heading || images.length);
  if (!hasBody) return null;

  return (
    <section id={anchor} className="about" aria-labelledby={`${anchor}-heading`}>
      <div className="chapter">
        <span className="chapter__label">{chapter ? `Глава ${chapter}` : ''}</span>
        <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading || section.type}</h2>
      </div>
      {section.content && <p className="about__text">{section.content}</p>}
      {images.length > 0 && (
        <div className="detail__meta" style={{ marginTop: '1.5rem' }} aria-label={section.caption || 'Изображения'}>
          {images.map((src, i) => (
            <figure key={i} className="case__image" style={{ margin: 0 }}>
              <img src={src} alt={section.caption || section.heading || ''} loading="lazy" width="640" height="480" style={{ width: '100%', objectFit: 'cover' }} />
            </figure>
          ))}
        </div>
      )}
      {section.caption && <p className="about__text" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{section.caption}</p>}
    </section>
  );
}
