import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CmsNavItem } from '../cms';

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function anchorOf(href: string): string | null {
  const i = href.indexOf('#');
  return i >= 0 ? href.slice(i + 1) : null;
}

export function Header({ nav, active, brand, mark, homeHref }: { nav: CmsNavItem[]; active: string; brand: string; mark?: string; homeHref?: string }) {
  const [open, setOpen] = useState(false);
  // openSub: id of the expanded parent (mobile accordion / desktop dropdown).
  const [openSub, setOpenSub] = useState<string | null>(null);
  const isMobile = useMedia('(max-width: 768px)');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openSub) { setOpenSub(null); return; }
        if (open) setOpen(false);
      }
      if (!open) return;
      if (e.key === 'Tab') {
        const nav = navRef.current;
        if (!nav) return;
        const focusable = Array.from(nav.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (openSub && navRef.current && !navRef.current.contains(e.target as Node)) setOpenSub(null);
    };

    if (open) {
      window.addEventListener('keydown', onKey);
      setTimeout(() => {
        navRef.current?.querySelector<HTMLElement>('button, a')?.focus();
      }, 10);
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    if (openSub) document.addEventListener('click', onClickOutside);

    wasOpen.current = open;
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClickOutside);
    };
  }, [open, openSub]);

  const jump = (id: string) => {
    setOpen(false);
    setOpenSub(null);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navInert = isMobile && !open;

  const renderLink = (item: CmsNavItem, isChild = false) => {
    const anchor = item.external ? null : anchorOf(item.href);
    const isActive = anchor ? active === anchor : false;
    return (
      <a
        key={item.id}
        href={item.href}
        className={`header__link ${isChild ? 'header__sublink' : ''} ${isActive ? 'header__link--active' : ''}`}
        tabIndex={navInert ? -1 : undefined}
        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={(e) => {
          if (anchor) { e.preventDefault(); jump(anchor); }
          else { setOpen(false); setOpenSub(null); }
        }}
      >
        {item.label}
      </a>
    );
  };

  return (
    <header className="header">
      <div className="header__inner">
        <a
          className="header__logo"
          href={homeHref || '#hero'}
          onClick={(e) => {
            const a = anchorOf(homeHref || '#hero');
            if (a) { e.preventDefault(); jump(a); }
          }}
        >
          {brand}
        </a>
        {mark && <span className="header__mark" aria-hidden="true">{mark}</span>}

        {nav.length > 0 && (
          <button
            ref={toggleRef}
            className="header__menu-toggle"
            aria-expanded={open}
            aria-controls="nav-menu"
            aria-haspopup="true"
            onClick={() => setOpen((s) => !s)}
          >
            {open ? 'Закрыть' : 'Меню'}
          </button>
        )}

        <nav
          id="nav-menu"
          ref={navRef}
          className={`header__nav ${open ? 'header__nav--open' : ''}`}
          aria-label="Главное меню"
          inert={navInert}
          aria-hidden={navInert || undefined}
        >
          {nav.map((item) => {
            const kids = item.children || [];
            if (!kids.length) return renderLink(item);

            const expanded = openSub === item.id;
            const subId = `submenu-${item.id}`;
            return (
              <div key={item.id} className={`header__item ${expanded ? 'header__item--open' : ''}`}>
                <div className="header__item-row">
                  {renderLink(item)}
                  <button
                    type="button"
                    className="header__sub-toggle"
                    aria-expanded={expanded}
                    aria-controls={subId}
                    aria-label={`${item.label}: подменю`}
                    tabIndex={navInert ? -1 : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSub(expanded ? null : item.id);
                    }}
                  >
                    <span aria-hidden="true">▾</span>
                  </button>
                </div>
                <ul
                  id={subId}
                  className="header__sub"
                  role="list"
                  hidden={!expanded}
                >
                  {kids.map((c) => (
                    <li key={c.id} className="header__subitem">{renderLink(c, true)}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
