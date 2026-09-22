import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CmsNavItem } from '../cms';
import { t, tf } from '../cms';

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
  // Tablet breakpoint: the desktop nav row is cramped well before 768px —
  // collapse into the toggle/accordion pattern at ≤1023px.
  const isMobile = useMedia('(max-width: 1023px)');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const subTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const wasOpen = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openSub) {
          const id = openSub;
          setOpenSub(null);
          subTriggerRefs.current.get(id)?.focus();
          return;
        }
        if (open) setOpen(false);
      }
      if (!open) return;
      if (e.key === 'Tab') {
        const nav = navRef.current;
        if (!nav) return;
        const focusable = Array.from(nav.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])'))
          .filter((el) => !el.closest('[hidden]'));
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

    // Escape/outside-click must work even when only a submenu is open and the
    // mobile menu itself is closed (desktop case) — listeners always active.
    window.addEventListener('keydown', onKey);
    if (open) {
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
          // Same-page anchors smooth-scroll; cross-page `#anchor` hrefs must
          // navigate normally — only intercept when the element exists here.
          if (anchor && document.getElementById(anchor)) {
            e.preventDefault();
            jump(anchor);
          } else {
            setOpen(false);
            setOpenSub(null);
          }
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

        {nav.length > 0 && isMobile && (
          <button
            ref={toggleRef}
            className="header__menu-toggle"
            aria-expanded={open}
            aria-controls="nav-menu"
            aria-haspopup="true"
            onClick={() => setOpen((s) => !s)}
          >
            {open ? t('menu.close') : t('menu.open')}
          </button>
        )}

        <nav
          id="nav-menu"
          ref={navRef}
          className={`header__nav ${open ? 'header__nav--open' : ''}`}
          aria-label={t('menu.aria') || undefined}
          inert={navInert}
          aria-hidden={navInert || undefined}
        >
          {nav.map((item) => {
            const kids = item.children || [];
            if (!kids.length) return renderLink(item);

            const expanded = openSub === item.id;
            const subId = `submenu-${item.id}`;
            // One disclosure trigger for the whole parent item: label + chevron
            // share a single hover/focus/expanded state. The parent's own href
            // becomes the first submenu entry ("Все услуги").
            const parentHref = item.href && !item.external ? item.href : null;
            return (
              <div key={item.id} className={`header__item ${expanded ? 'header__item--open' : ''}`}>
                <button
                  type="button"
                  ref={(el) => { if (el) subTriggerRefs.current.set(item.id, el); }}
                  className="header__link header__disclosure"
                  aria-expanded={expanded}
                  aria-controls={subId}
                  aria-haspopup="true"
                  tabIndex={navInert ? -1 : undefined}
                  onClick={() => setOpenSub(expanded ? null : item.id)}
                >
                  {item.label}
                  <svg className="header__chevron" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                    <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <ul
                  id={subId}
                  className="header__sub"
                  role="list"
                  hidden={!expanded}
                >
                  {parentHref && (
                    <li className="header__subitem">
                      {renderLink({ ...item, id: `${item.id}-all`, label: tf('navSubmenu.all', { name: item.label }) || item.label, children: undefined }, true)}
                    </li>
                  )}
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
