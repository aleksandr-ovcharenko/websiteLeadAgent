import { t, tf, type CmsSection } from '../cms';

// Degradation path for image/gallery and unknown block types:
// render whatever content exists — never a broken placeholder, never a crash.
// Internal block type names (text/gallery/services/…) are NEVER rendered as
// visible headings — they exist only in data-block-type for diagnostics.
export function GenericSection({ section, anchor, chapter }: { section: CmsSection; anchor: string; chapter?: string }) {
  const images = section.imageUrls?.length ? section.imageUrls : (section.image ? [section.image] : []);
  const hasBody = !!(section.content || section.heading || images.length);
  if (!hasBody) return null;

  return (
    <section
      id={anchor}
      className="about block"
      data-block-type={section.type}
      aria-labelledby={section.heading ? `${anchor}-heading` : undefined}
    >
      {section.heading ? (
        <div className="chapter">
          <span className="chapter__label">{chapter ? tf('chapter.label', { n: chapter }) : ''}</span>
          <h2 id={`${anchor}-heading`} className="chapter__title">{section.heading}</h2>
        </div>
      ) : null}
      {section.content?.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="about__text">{p.trim()}</p>
      ))}
      {images.length > 0 && (
        <div className="detail__meta" style={{ marginTop: '1.5rem' }} aria-label={section.caption || t('detail.galleryAria') || undefined}>
          {images.map((src, i) => (
            <figure key={i} className="case__image" style={{ margin: 0 }}>
              <img src={src} alt={section.caption || section.heading || ''} loading="lazy" style={{ width: '100%', height: 'auto', aspectRatio: '4/3', objectFit: 'cover' }} />
            </figure>
          ))}
        </div>
      )}
      {section.caption && <p className="about__text" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{section.caption}</p>}
    </section>
  );
}
