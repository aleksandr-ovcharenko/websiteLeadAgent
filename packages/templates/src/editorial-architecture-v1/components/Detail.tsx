import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cms, t, tf, type CmsItem } from '../cms';

interface Props {
  index: number;
  projects: CmsItem[];
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Detail({ index, projects, onClose, onNavigate }: Props) {
  const project = projects[index];
  const total = projects.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const root = document.getElementById('main');

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const dialog = document.getElementById('detail-dialog');
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
        ).filter((el) => !el.hasAttribute('disabled'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      root?.removeAttribute('inert');
      document.body.style.overflow = '';
      opener.current?.focus();
    };
  }, [onClose]);

  if (!project || !total) return null;

  return createPortal(
    <div id="detail-dialog" className="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <button ref={closeRef} className="detail__back" onClick={onClose}>
        ← {t('back.default')}
      </button>
      <div className="detail__inner">
        <div className="detail__head">
          <div>
            <div className="detail__index">{tf('detail.indexTemplate', { label: t('entity.project'), i: String(index + 1).padStart(2, '0'), n: String(total).padStart(2, '0') })}</div>
            <h2 id="detail-title" className="detail__title">{project.title}</h2>
          </div>
          {(project.excerpt || project.summary) && (
            <p className="detail__note">{project.excerpt || project.summary}</p>
          )}
        </div>

        {project.image && (
          <figure className="detail__image">
            <img src={project.image} alt={project.title} />
          </figure>
        )}

        {(project.gallery?.length || 0) > 0 && (
          <div className="detail__meta" aria-label={t('detail.galleryAria') || undefined}>
            {project.gallery!.map((src, gi) => (
              <img key={gi} src={src} alt={tf('detail.galleryAlt', { title: project.title, n: gi + 1 }) || project.title} loading="lazy" style={{ width: '100%', height: 'auto', aspectRatio: '4/3', objectFit: 'cover' }} />
            ))}
          </div>
        )}

        {(project.category || project.location) && (
          <div className="detail__meta" aria-label={t('detail.specsAria') || undefined}>
            {project.category && <div className="detail__meta-item"><b>{t('detail.category')}</b>{project.category}</div>}
            {project.location && <div className="detail__meta-item"><b>{t('detail.location')}</b>{project.location}</div>}
          </div>
        )}

        <div className="detail__actions">
          <button
            className="detail__nav"
            onClick={() => onNavigate((index - 1 + total) % total)}
            aria-label={t('detail.prevAria') || undefined}
          >
            {t('lightbox.prev')}
          </button>
          <button
            className="detail__nav"
            onClick={() => onNavigate((index + 1) % total)}
            aria-label={t('detail.nextAria') || undefined}
          >
            {t('lightbox.next')}
          </button>
          {project.href && (
            <a className="detail__cta" href={project.href}>{t('detail.pageCta')}</a>
          )}
          {cms.COMPANY.phone && (
            cms.COMPANY.phoneHref
              ? <a className="detail__cta" href={cms.COMPANY.phoneHref}>{cms.COMPANY.phone}</a>
              : <span className="detail__cta">{cms.COMPANY.phone}</span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
