import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cms, t, tf, type CmsEntity, type CmsCollection, type CmsItem, type CmsPage, type CmsSection } from '../cms';
import { GenericSection } from './GenericSection';

// ─── Shared bits ─────────────────────────────────────────────────────────────

function BodyText({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="about__text" style={{ marginBottom: '1rem' }}>{p.trim()}</p>
      ))}
    </>
  );
}

/** Renders mapped CMS page blocks (text/image/gallery/certificates/…). */
export function BlockList({ blocks }: { blocks?: CmsSection[] }) {
  if (!blocks?.length) return null;
  return (
    <>
      {blocks.map((b, i) => {
        const t = (b.type || '').toLowerCase();
        switch (t) {
          case 'certificates': return <CertificatesSection key={b.id || i} section={b} />;
          case 'richtext': case 'text': return <RichTextSection key={b.id || i} section={b} />;
          case 'processsteps': return <ProcessStepsSection key={b.id || i} section={b} />;
          case 'features': return <FeaturesSection key={b.id || i} section={b} />;
          case 'faq': return <FaqSection key={b.id || i} section={b} />;
          case 'reviews': return <ReviewsSection key={b.id || i} section={b} />;
          case 'cta': return <PageCta key={b.id || i} section={b} />;
          default: return <GenericSection key={b.id || i} section={b} anchor={`block-${b.id || i}`} />;
        }
      })}
    </>
  );
}

// ─── Typed content blocks (V3.6.2) ──────────────────────────────────────────

function BlockHead({ id, heading }: { id: string; heading?: string }) {
  if (!heading) return null;
  return <h2 id={id} className="block__title">{heading}</h2>;
}

function RichTextSection({ section }: { section: CmsSection }) {
  if (!section.content && !section.items?.length && !section.heading) return null;
  const id = `rich-${section.id}`;
  return (
    <section className="block rich" aria-labelledby={section.heading ? id : undefined}>
      <BlockHead id={id} heading={section.heading} />
      {section.content?.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="block__text">{p.trim()}</p>
      ))}
      {!!section.items?.length && (
        <ul className="block__list" role="list">
          {section.items.map((it: any, i: number) => (
            <li key={i}>{typeof it === 'string' ? it : (it.text || it.title)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProcessStepsSection({ section }: { section: CmsSection }) {
  const items = (section.items || []) as { title?: string; text?: string }[];
  if (!items.length) return null;
  const id = `steps-${section.id}`;
  return (
    <section className="block steps" aria-labelledby={section.heading ? id : undefined}>
      <BlockHead id={id} heading={section.heading} />
      <ol className="steps__list">
        {items.map((it, i) => (
          <li key={i} className="steps__item">
            <span className="steps__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <div>
              {it.title && <h3 className="steps__title">{it.title}</h3>}
              {it.text && <p className="block__text">{it.text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FeaturesSection({ section }: { section: CmsSection }) {
  const items = (section.items || []) as { title?: string; text?: string }[];
  if (!items.length) return null;
  const id = `feat-${section.id}`;
  return (
    <section className="block feats" aria-labelledby={section.heading ? id : undefined}>
      <BlockHead id={id} heading={section.heading} />
      <ul className="feats__list" role="list">
        {items.map((it, i) => (
          <li key={i} className="feats__item">
            {it.title && <h3 className="feats__title">{it.title}</h3>}
            {it.text && <p className="block__text">{it.text}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FaqSection({ section }: { section: CmsSection }) {
  const items = (section.items || []) as { question: string; answer: string }[];
  if (!items.length) return null;
  const id = `faq-${section.id}`;
  return (
    <section className="block faq" aria-labelledby={section.heading ? id : undefined}>
      <BlockHead id={id} heading={section.heading} />
      {section.content && <p className="block__text">{section.content}</p>}
      <div className="faq__list">
        {items.map((it, i) => (
          <details key={i} className="faq__item">
            <summary className="faq__q">
              <span>{it.question}</span>
              <span className="faq__chev" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </summary>
            <div className="faq__a">
              {it.answer.split(/\n{2,}/).map((p, j) => <p key={j} className="block__text">{p.trim()}</p>)}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ReviewsSection({ section }: { section: CmsSection }) {
  const items = (section.reviews || section.items || []) as { author?: string; text?: string; question?: string; rating?: number }[];
  const reviews = items.filter((r) => r.text || r.question);
  if (!reviews.length) return null;
  const id = `reviews-${section.id}`;
  return (
    <section className="block reviews" aria-labelledby={section.heading ? id : undefined}>
      <BlockHead id={id} heading={section.heading} />
      {section.content && <p className="block__text">{section.content}</p>}
      <div className="reviews__list">
        {reviews.map((r, i) => (
          <blockquote key={i} className="reviews__item">
            <p className="block__text">{r.text || r.question}</p>
            {r.author && <footer className="reviews__author">— {r.author}</footer>}
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function PageCta({ section }: { section: CmsSection }) {
  if (!section.title) return null;
  return (
    <section className="block pagecta">
      <div className="pagecta__inner">
        <div>
          <h2 className="pagecta__title">{section.title}</h2>
          {section.description && <p className="pagecta__desc">{section.description}</p>}
        </div>
        {/* A CTA without a real target renders no link — never '#' */}
        {section.buttonLabel && section.buttonUrl && (
          <a className="pagecta__btn" href={section.buttonUrl}>{section.buttonLabel}</a>
        )}
      </div>
    </section>
  );
}

// ─── Ordinary CMS page ───────────────────────────────────────────────────────

export function PageView({ page }: { page: CmsPage }) {
  return (
    <main id="main" className="page" data-route="PAGE" data-slug={page.slug}>
      <header className="page__head">
        <h1 className="page__title">{page.title}</h1>
      </header>
      <BlockList blocks={page.blocks} />
      {page.sourceUrl && t('source.link') && (
        <p className="page__source">
          <a href={page.sourceUrl} target="_blank" rel="noopener noreferrer">{t('source.link')}</a>
        </p>
      )}
    </main>
  );
}

// ─── Entity detail (service / project / news / vacancy / product) ────────────

const KIND_COPY_KEY: Record<string, string> = {
  SERVICE_DETAIL: 'entity.service',
  PROJECT_DETAIL: 'entity.project',
  NEWS_DETAIL: 'entity.news',
  VACANCY_DETAIL: 'entity.vacancy',
  PRODUCT_DETAIL: 'entity.product',
};

export function EntityDetailView({ entity }: { entity: CmsEntity }) {
  const kindLabel = t(KIND_COPY_KEY[entity.kind || ''] || '') || t('entity.default');
  const meta = [entity.category, entity.location, entity.date].filter(Boolean).join(' · ');
  return (
    <main id="main" className="page" data-route={entity.kind} data-slug={entity.slug}>
      {entity.backHref && (
        <a className="page__back" href={entity.backHref}>← {entity.backLabel || t('back.default')}</a>
      )}
      <header className="page__head">
        <div className="datum" aria-hidden="true"><span>{kindLabel}</span></div>
        <h1 className="page__title">{entity.title}</h1>
        {meta && <p className="page__meta">{meta}</p>}
        {(entity.summary || entity.excerpt) && <p className="page__lede">{entity.summary || entity.excerpt}</p>}
      </header>

      {entity.image && (
        <figure className="page__figure">
          <img src={entity.image} alt={entity.title} loading="eager" />
        </figure>
      )}

      {/* entity.content is textFrom(blocks) — rendering it alongside the
          block list would duplicate every paragraph. Only use it when the
          entity has no structured sections at all. */}
      {!entity.sections?.length && <BodyText text={entity.content} />}
      <BlockList blocks={entity.sections} />

      {(entity.gallery?.length || 0) > 0 && (
        <div className="detail__meta" aria-label={t('detail.galleryAria') || undefined}>
          {entity.gallery!.map((src, i) => (
            <figure key={i} className="case__image" style={{ margin: 0 }}>
              <img src={src} alt={tf('detail.entityIndexAlt', { title: entity.title, n: i + 1 }) || entity.title} loading="lazy" />
            </figure>
          ))}
        </div>
      )}

      {entity.sourceUrl && t('source.link') && (
        <p className="page__source">
          <a href={entity.sourceUrl} target="_blank" rel="noopener noreferrer">{t('source.link')}</a>
        </p>
      )}
    </main>
  );
}

// ─── Collection route (services / projects / news / vacancies) ───────────────

function Pager({ collection }: { collection: CmsCollection }) {
  if (!collection.pager?.length) return null;
  const prev = collection.pager.find((p) => p.page === collection.page - 1);
  const next = collection.pager.find((p) => p.page === collection.page + 1);
  const prevLabel = t('pager.prev');
  const nextLabel = t('pager.next');
  return (
    <nav className="pager" aria-label={t('pager.aria') || undefined}>
      {prev
        ? <a className="pager__link pager__prev" href={prev.href} rel="prev">{prevLabel}</a>
        : prevLabel && <span className="pager__link pager__prev is-disabled" aria-hidden="true">{prevLabel}</span>}
      {collection.pager.map((p) => (
        <a
          key={p.page}
          className={`pager__link${p.current ? ' is-current' : ''}`}
          href={p.href}
          aria-current={p.current ? 'page' : undefined}
        >{p.page}</a>
      ))}
      {next
        ? <a className="pager__link pager__next" href={next.href} rel="next">{nextLabel}</a>
        : nextLabel && <span className="pager__link pager__next is-disabled" aria-hidden="true">{nextLabel}</span>}
    </nav>
  );
}

export function CollectionView({ collection }: { collection: CmsCollection }) {
  return (
    <main id="main" className="page" data-route="COLLECTION" data-kind={collection.kind}>
      <header className="page__head">
        <h1 className="page__title">{collection.heading || t(`collection.${collection.kind}`)}</h1>
      </header>
      <BlockList blocks={collection.blocks?.filter((b) => b.type !== 'certificates')} />
      {collection.items.length > 0 && (
        <ul className="collection" role="list">
          {collection.items.map((item) => {
            const body = (
              <>
                {item.image && (
                  <span className="collection__thumb" aria-hidden="true">
                    <img src={item.image} alt="" loading="lazy" />
                  </span>
                )}
                <span className="collection__body">
                  <span className="collection__title">{item.title}</span>
                  {(item.summary || item.excerpt) && (
                    <span className="collection__excerpt">{item.summary || item.excerpt}</span>
                  )}
                  {item.date && <span className="collection__date">{item.date}</span>}
                </span>
                {item.href && <span className="collection__arrow" aria-hidden="true">→</span>}
              </>
            );
            return (
              <li key={item.id} className="collection__item">
                {/* Whole row is the anchor when the entity is routable —
                    never a hash-only dead link. */}
                {item.href ? (
                  <a className="collection__link" href={item.href}>{body}</a>
                ) : (
                  <div className="collection__link collection__link--static">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {collection.items.length === 0 && collection.totalItems > 0 && t('collection.empty') && (
        <p className="collection__empty">{t('collection.empty')}</p>
      )}
      <Pager collection={collection} />
      <BlockList blocks={collection.blocks?.filter((b) => b.type === 'certificates')} />
    </main>
  );
}

// ─── Certificates ────────────────────────────────────────────────────────────

function isPdf(src?: string, docType?: string) {
  return docType === 'pdf' || /\.pdf($|\?)/i.test(src || '');
}

export function CertificatesSection({ section }: { section: CmsSection }) {
  const items = (section.items || []) as CmsItem[];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!items.length) return null;
  return (
    <section className="certs" aria-labelledby={`certs-${section.id}-heading`}>
      {(section.heading || section.title) && (
        <h2 id={`certs-${section.id}-heading`} className="chapter__title">{section.heading || section.title}</h2>
      )}
      {section.description && <p className="about__text">{section.description}</p>}
      <ul className="certs__grid" role="list">
        {items.map((it, i) => (
          <li key={it.mediaId || i} className="certs__cell">
            <button
              type="button"
              className="certs__doc"
              onClick={() => setOpenIdx(i)}
              aria-label={tf('certs.openAria', { name: it.caption || tf('certs.docUntitled', { n: i + 1 }) }) || undefined}
            >
              {isPdf(it.src, it.docType) ? (
                <span className="certs__pdf" aria-hidden="true">
                  <span className="certs__pdf-badge">PDF</span>
                  <span className="certs__pdf-name">{it.caption || tf('certs.docUntitled', { n: i + 1 })}</span>
                </span>
              ) : (
                // Documents are never cover-cropped: contain inside a calm frame.
                <img src={it.src} alt={it.caption || tf('certs.docUntitled', { n: i + 1 })} loading="lazy" />
              )}
            </button>
            {it.caption && <p className="certs__caption">{it.caption}</p>}
          </li>
        ))}
      </ul>
      {openIdx !== null && (
        <CertLightbox items={items} index={openIdx} onClose={() => setOpenIdx(null)} onNavigate={setOpenIdx} />
      )}
    </section>
  );
}

function CertLightbox({ items, index, onClose, onNavigate }: {
  items: CmsItem[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const it = items[index];

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate(Math.min(items.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onNavigate(Math.max(0, index - 1));
      if (e.key === 'Tab') {
        const dlg = document.getElementById('cert-dialog');
        if (!dlg) return;
        const f = Array.from(dlg.querySelectorAll<HTMLElement>('button, a[href]')).filter((el) => !el.hasAttribute('disabled'));
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      opener.current?.focus();
    };
  }, [index, items.length, onClose, onNavigate]);

  useEffect(() => { setZoomed(false); }, [index]);
  if (!it) return null;

  return createPortal(
    <div id="cert-dialog" className="lightbox" role="dialog" aria-modal="true" aria-label={it.caption || tf('certs.docUntitled', { n: index + 1 }) || undefined}>
      <div className="lightbox__backdrop" onClick={onClose} />
      <div className="lightbox__panel">
        <div className="lightbox__bar">
          <span className="lightbox__count">{index + 1} / {items.length}</span>
          <div className="lightbox__actions">
            {!isPdf(it.src, it.docType) && (
              <button type="button" className="lightbox__btn" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed}>
                {zoomed ? t('lightbox.zoomFit') : t('lightbox.zoomIn')}
              </button>
            )}
            <a className="lightbox__btn" href={it.src} target="_blank" rel="noopener noreferrer">{t('lightbox.openOriginal')}</a>
            <a className="lightbox__btn" href={it.src} download>{t('lightbox.download')}</a>
            <button ref={closeRef} type="button" className="lightbox__btn" onClick={onClose}>{t('lightbox.close')}</button>
          </div>
        </div>
        <div className={`lightbox__stage ${zoomed ? 'lightbox__stage--zoomed' : ''}`} onClick={() => zoomed && setZoomed(false)}>
          {isPdf(it.src, it.docType) ? (
            <div className="certs__pdf certs__pdf--large" aria-hidden="true">
              <span className="certs__pdf-badge">PDF</span>
              <span className="certs__pdf-name">{it.caption || tf('certs.docUntitled', { n: index + 1 })}</span>
            </div>
          ) : (
            <img src={it.src} alt={it.caption || tf('certs.docUntitled', { n: index + 1 })} />
          )}
        </div>
        <div className="lightbox__foot">
          {it.caption && <span className="lightbox__caption">{it.caption}</span>}
          <div className="lightbox__nav">
            <button type="button" className="lightbox__btn" disabled={index === 0} onClick={() => onNavigate(index - 1)}>{t('lightbox.prev')}</button>
            <button type="button" className="lightbox__btn" disabled={index === items.length - 1} onClick={() => onNavigate(index + 1)}>{t('lightbox.next')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── 404 ─────────────────────────────────────────────────────────────────────

export function NotFoundView({ path }: { path: string }) {
  return (
    <main id="main" className="page page--404" data-route="NOT_FOUND">
      <header className="page__head">
        <div className="datum" aria-hidden="true"><span>{t('notFound.code') || '404'}</span></div>
        <h1 className="page__title">{t('notFound.title')}</h1>
        <p className="page__lede">{tf('notFound.lede', { path })}</p>
      </header>
      <p>
        <a className="page__home-link" href={cms.BASE || '/'}>{t('notFound.home')}</a>
      </p>
    </main>
  );
}
