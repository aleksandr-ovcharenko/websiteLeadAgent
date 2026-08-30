import { useState, useEffect } from 'react'

// ─── Logo assets ─────────────────────────────────────────────────────────────
// Customer logo is supplied by __CMS__.company.logoUrl; no hardcoded marks below.

// ─── Images (fallbacks) ─────────────────────────────────────────────────────
const DEFAULT_IMG = {
  hero:   'https://images.unsplash.com/photo-1766936587760-fcc13617ca3b?w=1400&h=1100&fit=crop&auto=format',
  proj1:  'https://images.unsplash.com/photo-1546414701-81cc6963c67f?w=1400&h=960&fit=crop&auto=format',
  proj2:  'https://images.unsplash.com/photo-1557761469-f29c6e201784?w=1400&h=960&fit=crop&auto=format',
  proj3:  'https://images.unsplash.com/photo-1694885169342-909981fb408a?w=900&h=640&fit=crop&auto=format',
  proj4:  'https://images.unsplash.com/photo-1669003750682-93cf2c65b9ca?w=900&h=640&fit=crop&auto=format',
  about:  'https://images.unsplash.com/photo-1600730424902-a3a3be6af112?w=1100&h=1400&fit=crop&auto=format',
  news1:  'https://images.unsplash.com/photo-1623489254637-a2dd8375243d?w=600&h=400&fit=crop&auto=format',
}

// ─── Fallback data used when no CMS payload is provided ───────────────────────
const DEFAULT_CMS = {
  PREVIEW_TOKEN: '',
  SITE_ID: '',
  route: '',
  subRoute: '',
  COMPANY: {
    name: 'Строительная компания',
    legalName: 'ООО «Строительная компания»',
    unp: '000000000',
    founded: '2000',
    employees: '50+',
    address: { zip: '', city: '', street: '', room: '', formatted: '' },
    hours: 'Пн–Пт: 9:00–18:00',
    phone: '+375 00 000-00-00',
    phoneHref: 'tel:+375000000000',
    domain: 'example.com',
    contacts: {
      general: [{ phone: '+375 00 000-00-00', href: 'tel:+375000000000', label: 'офис' }],
      procurement: [],
      email: 'info@example.com',
      tenderEmail: 'info@example.com',
    },
  },
  NAV: [
    { id: 'nav_1', label: 'Главная', href: '/', targetType: 'HOME', target: '', showInHeader: true, showInFooter: true, showOnHomepage: false },
    { id: 'nav_2', label: 'О компании', href: '#about', targetType: 'HOME_SECTION', target: 'ABOUT', showInHeader: true, showInFooter: true, showOnHomepage: true },
    { id: 'nav_3', label: 'Услуги', href: '#services', targetType: 'HOME_SECTION', target: 'SERVICES', showInHeader: true, showInFooter: true, showOnHomepage: true },
    { id: 'nav_4', label: 'Объекты', href: '#projects', targetType: 'HOME_SECTION', target: 'PROJECTS', showInHeader: true, showInFooter: true, showOnHomepage: true },
    { id: 'nav_5', label: 'Новости', href: '#news', targetType: 'HOME_SECTION', target: 'NEWS', showInHeader: true, showInFooter: true, showOnHomepage: true },
    { id: 'nav_6', label: 'Вакансии', href: '#vacancies', targetType: 'HOME_SECTION', target: 'VACANCIES', showInHeader: false, showInFooter: true, showOnHomepage: true },
    { id: 'nav_7', label: 'Контакты', href: '#contacts', targetType: 'HOME_SECTION', target: 'CONTACTS', showInHeader: true, showInFooter: true, showOnHomepage: true },
  ],
  PAGES: [],
  SERVICES: [],
  PROJECTS: [],
  NEWS_ITEMS: [],
  VACANCIES: [],
  PROCESS_STEPS: []
}

function getCmsData() {
  if (typeof window === 'undefined') return DEFAULT_CMS;
  const incoming = (window as any).__CMS__;
  if (!incoming) return DEFAULT_CMS;
  return { ...DEFAULT_CMS, ...incoming };
}

const cms = getCmsData();
const { COMPANY, NAV, PAGES, SERVICES, PROJECTS, NEWS_ITEMS, VACANCIES, PROCESS_STEPS } = cms;
const PREVIEW_TOKEN = (cms as any).PREVIEW_TOKEN || '';
const SITE_ID = (cms as any).SITE_ID || '';
const IMG = (cms as any).IMG || DEFAULT_IMG;

function navHref(label: string) {
  const found = (NAV || []).find((n: any) => n.label === label);
  if (found) return found.href;
  const base = PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}` : '/';
  return base;
}

function sectionHref(targetKey: string) {
  const key = targetKey.toUpperCase();
  const found = (NAV || []).find((n: any) => n.targetType === 'HOME_SECTION' && (n.target || '').toUpperCase() === key);
  if (found) return found.href;
  const base = PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}` : '';
  return `${base}/#${key.toLowerCase()}`;
}

function newsHref(slug: string) {
  return PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}/news/${slug}` : '#';
}

function projectHref(slug: string) {
  return PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}/projects/${slug}` : '#';
}

function serviceHref(slug: string) {
  return PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}/services/${slug}` : '#';
}

function vacancyHref(slug: string) {
  return PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}/vacancies/${slug}` : '#';
}

// ─── Shared font style ───────────────────────────────────────────────────────
const GEO: React.CSSProperties = { fontFamily: "'Geologica', sans-serif" }

// ─── Eyebrow label ───────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <div className="h-px w-8 shrink-0" style={{ background: 'var(--brass)' }} />
      <span className="text-[11px] uppercase tracking-[0.3em] font-medium" style={{ color: 'var(--muted)' }}>
        {children}
      </span>
    </div>
  )
}

// ─── Brand mark ──────────────────────────────────────────────────────────────
// Each variant maps to the actual approved logo PNG asset.
// Use the variant that matches the section background for correct contrast.
//
// On dark backgrounds : 'dark' | 'green' | 'circle-dark' | 'circle-green'
// On light backgrounds: 'outline' | 'outline-green' | 'white-dark' | 'white-green'
// No container        : 'bare' (dark ГК) | 'bare-green' (green ГК)

function BrandMark({
  size = 48,
  dark = false,
  style: extraStyle,
}: {
  size?: number
  dark?: boolean
  style?: React.CSSProperties
}) {
  const initial = (COMPANY.name || 'S').slice(0, 1).toUpperCase()
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Geologica', sans-serif",
        fontWeight: 700,
        fontSize: Math.round(size * 0.45),
        color: dark ? 'white' : 'var(--brand)',
        background: dark ? 'var(--brand)' : 'white',
        border: dark ? 'none' : '1px solid var(--border)',
        ...extraStyle,
      }}
    >
      {initial}
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: 'rgba(242,244,245,0.96)', backdropFilter: 'blur(8px)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-16 md:h-20 flex items-center justify-between gap-6">
        {/* Brand block */}
        <a href={PREVIEW_TOKEN ? `/showcase/${PREVIEW_TOKEN}` : '#'} className="flex items-center shrink-0 gap-3.5">
          <BrandMark size={44} dark />
          <div className="flex flex-col leading-none gap-1">
            <span
              className="text-[13px] font-bold tracking-[0.07em] uppercase leading-none"
              style={{ ...GEO, color: 'var(--fg)' }}
            >
              {COMPANY.name}
            </span>
            <span
              className="text-[9.5px] uppercase tracking-[0.22em] font-medium leading-none"
              style={{ color: 'var(--muted)' }}
            >
              строительная компания
            </span>
          </div>
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {(NAV || []).filter((n: any) => n.showInHeader).map((n: any) => (
            <a
              key={n.id}
              href={n.href}
              target={n.external ? '_blank' : undefined}
              rel={n.external ? 'noopener noreferrer' : undefined}
              className="text-[12px] uppercase tracking-[0.12em] font-medium transition-colors"
              style={{ color: 'var(--fg)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--brass)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg)')}
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-6 shrink-0">
          <a href={COMPANY.phoneHref} className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
            {COMPANY.phone}
          </a>
          <a
            href={navHref('Контакты')}
            className="px-5 py-2.5 text-[11px] uppercase tracking-[0.15em] font-semibold border transition-all"
            style={{ borderColor: 'var(--fg)', color: 'var(--fg)' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--fg)'
              el.style.color = 'var(--bg)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'
              el.style.color = 'var(--fg)'
            }}
          >
            Обсудить проект
          </a>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden flex flex-col justify-center gap-[5px] p-2 -mr-2"
          aria-label="Открыть меню"
        >
          <span
            className="block h-px w-6 transition-all duration-200 origin-center"
            style={{
              background: 'var(--fg)',
              transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none',
            }}
          />
          <span
            className="block h-px w-6 transition-all duration-200"
            style={{
              background: 'var(--fg)',
              opacity: menuOpen ? 0 : 1,
              transform: menuOpen ? 'scaleX(0)' : 'none',
            }}
          />
          <span
            className="block h-px w-6 transition-all duration-200 origin-center"
            style={{
              background: 'var(--fg)',
              transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none',
            }}
          />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className="lg:hidden overflow-hidden transition-all duration-300"
        style={{
          maxHeight: menuOpen ? '600px' : '0',
          background: 'var(--dark)',
        }}
      >
        <nav className="flex flex-col px-6 pt-2 pb-6">
          {(NAV || []).filter((n: any) => n.showInHeader).map((n: any, i: number) => (
            <a
              key={n.id}
              href={n.href}
              target={n.external ? '_blank' : undefined}
              rel={n.external ? 'noopener noreferrer' : undefined}
              onClick={() => setMenuOpen(false)}
              className="py-4 text-base font-medium uppercase tracking-[0.12em] border-b"
              style={{
                color: 'rgba(242,244,245,0.8)',
                borderColor: 'rgba(255,255,255,0.08)',
                animationDelay: `${i * 40}ms`,
              }}
            >
              {n.label}
            </a>
          ))}
          <div className="pt-7 flex flex-col gap-4">
            <a href={COMPANY.phoneHref} className="text-xl font-semibold" style={{ color: 'var(--brass)' }}>
              {COMPANY.phone}
            </a>
            <a
              href={navHref('Контакты')}
              onClick={() => setMenuOpen(false)}
              className="text-center py-3.5 border text-sm uppercase tracking-wider font-medium"
              style={{ borderColor: 'var(--brass)', color: 'var(--brass)' }}
            >
              Обсудить проект
            </a>
          </div>
        </nav>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ height: '100svh', minHeight: '640px', background: 'var(--dark)' }}
    >
      {/* Full-bleed background photo */}
      <img
        src="https://images.unsplash.com/photo-1669003154471-b72fe01a899d?w=1920&h=1080&fit=crop&auto=format"
        alt="Современный коммерческий объект — производственный комплекс"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'right center' }}
      />

      {/* Gradient stack:
          – strong left vignette creates a dark text zone while the building shows right
          – bottom anchor keeps headline area readable without crushing the image */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(to top, rgba(15,31,28,0.96) 0%, rgba(15,31,28,0.68) 35%, rgba(15,31,28,0.18) 62%, transparent 100%)',
            'linear-gradient(to right, rgba(15,31,28,0.82) 0%, rgba(15,31,28,0.45) 40%, rgba(15,31,28,0.1) 65%, transparent 85%)',
          ].join(', '),
        }}
      />

      {/* ── Right edge: vertical location text ── */}
      <div
        className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-4"
        style={{ zIndex: 2 }}
      >
        <div className="w-px h-16" style={{ background: 'rgba(242,244,245,0.2)' }} />
        <span
          className="text-[9px] uppercase tracking-[0.45em] font-medium"
          style={{
            color: 'rgba(242,244,245,0.35)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            letterSpacing: '0.45em',
          }}
        >
          Минск · Беларусь
        </span>
        <div className="w-px h-16" style={{ background: 'rgba(242,244,245,0.2)' }} />
      </div>

      {/* ── Main content — bottom-left anchored ── */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 md:px-16 lg:px-20"
        style={{ zIndex: 2, paddingBottom: 'clamp(3rem, 6vh, 5.5rem)' }}
      >
        {/* Brand signature — mark + company identity above the headline */}
        <div className="flex items-center gap-3 mb-7 md:mb-9">
          <BrandMark size={36} dark />
          <div className="flex flex-col leading-none gap-1">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'rgba(242,244,245,0.85)', fontFamily: "'Geologica', sans-serif" }}
            >
              {COMPANY.name}
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.3em] font-medium leading-none"
              style={{ color: 'rgba(242,244,245,0.4)' }}
            >
              Строительная компания · Беларусь
            </span>
          </div>
        </div>

        {/* Headline — architectural scale, each phrase its own visual weight */}
        <h1
          className="font-black text-white mb-8 md:mb-10"
          style={{
            ...GEO,
            fontSize: 'clamp(3.2rem, 8.5vw, 7.25rem)',
            lineHeight: 0.9,
            letterSpacing: '-0.02em',
            maxWidth: '880px',
          }}
        >
          <span className="block">Строим</span>
          <span className="block" style={{ color: 'var(--brass)' }}>объекты,</span>
          <span className="block">которые</span>
          <span
            className="block"
            style={{
              WebkitTextStroke: '2px rgba(242,244,245,0.6)',
              color: 'transparent',
              fontStyle: 'italic',
            }}
          >
            работают
          </span>
        </h1>

        {/* Sub-row: descriptor + CTAs side by side */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-14">
          <p
            className="text-sm md:text-base leading-relaxed shrink-0"
            style={{ color: 'rgba(242,244,245,0.55)', maxWidth: '320px' }}
          >
            Полный цикл — от проектирования до сдачи. Комплексное строительство, монтаж конструкций, инженерные решения.
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <a
              href={navHref('Контакты')}
              className="inline-flex items-center px-7 py-3.5 text-[11px] uppercase font-bold tracking-[0.18em] transition-all"
              style={{ background: 'var(--brass)', color: 'var(--dark)' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(242,244,245,1)'
                el.style.color = 'var(--dark)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'var(--brass)'
                el.style.color = 'var(--dark)'
              }}
            >
              Обсудить проект
            </a>
            <a
              href={navHref('Объекты')}
              className="group inline-flex items-center gap-2 text-sm font-medium pb-0.5 transition-colors"
              style={{ color: 'rgba(242,244,245,0.7)', borderBottom: '1px solid rgba(242,244,245,0.25)' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'white'
                el.style.borderBottomColor = 'rgba(242,244,245,0.6)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'rgba(242,244,245,0.7)'
                el.style.borderBottomColor = 'rgba(242,244,245,0.25)'
              }}
            >
              Наши объекты
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── Top-left architectural mark ── */}
      <div
        className="absolute top-6 left-6 sm:left-10 md:left-16 lg:left-20 w-8 h-8 border-t border-l"
        style={{ borderColor: 'rgba(19,163,74,0.5)', zIndex: 2 }}
      />

      {/* ── Large ghost monogram watermark — bottom-right atmosphere ── */}
      <div
        className="absolute bottom-0 right-0 hidden lg:block overflow-hidden pointer-events-none"
        style={{ zIndex: 1, width: 'clamp(280px, 28vw, 420px)', aspectRatio: '1', opacity: 0.07, marginBottom: '-8%', marginRight: '-6%' }}
      >
        <BrandMark
          size={420}
          style={{ width: '100%', height: '100%', opacity: 0.07, color: 'var(--brass)', background: 'transparent', border: 'none' }}
        />
      </div>
    </section>
  )
}

// ─── Projects section ─────────────────────────────────────────────────────────
function Projects() {
  const [hov, setHov] = useState<number | null>(null)

  if (PROJECTS.length === 0) {
    return null
  }

  return (
    <section id="projects" style={{ background: 'var(--bg)' }}>

      {/* ── Section header ── */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 pt-24 md:pt-36 pb-14 md:pb-20">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>Портфолио</Eyebrow>
            <h2 className="text-4xl md:text-5xl font-bold leading-[1.05]" style={{ ...GEO, color: 'var(--fg)' }}>
              Реализованные<br />объекты
            </h2>
          </div>
          <a
            href={navHref('Объекты')}
            className="hidden md:flex items-center gap-2 text-sm font-medium group transition-colors"
            style={{ color: 'var(--fg)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--brass)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg)')}
          >
            Все объекты
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>

      {/* ── Featured row 01 — meta left · image right ── */}
      <div
        className="max-w-[1280px] mx-auto border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr]">

          {/* Meta */}
          <div
            className="relative flex flex-col justify-between px-6 md:px-10 py-12 lg:py-16 overflow-hidden"
            style={{ minHeight: '420px' }}
          >
            {/* Decorative background number */}
            <span
              className="absolute -top-2 -left-3 select-none pointer-events-none font-black leading-none tabular-nums"
              style={{ ...GEO, fontSize: 'clamp(8rem, 18vw, 16rem)', color: 'var(--card-bg)', zIndex: 0 }}
              aria-hidden
            >
              01
            </span>

            {/* Content above the number */}
            <div className="relative" style={{ zIndex: 1 }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-6 shrink-0" style={{ background: 'var(--brass)' }} />
                <span className="text-[10px] uppercase tracking-[0.3em] font-semibold" style={{ color: 'var(--brass)' }}>
                  {PROJECTS[0].category}
                </span>
              </div>
              <h3
                className="font-bold leading-tight mb-5"
                style={{ ...GEO, color: 'var(--fg)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
              >
                {PROJECTS[0].title}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                <span>{PROJECTS[0].location}</span>
                <span style={{ color: 'var(--border)' }}>—</span>
                <span className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--brass)' }}
                  />
                  {PROJECTS[0].status}
                </span>
              </div>
            </div>

            {/* CTA pinned bottom */}
            <a
              href={projectHref(PROJECTS[0].slug)}
              className="relative inline-flex items-center gap-2 text-sm font-medium self-start group transition-colors"
              style={{ zIndex: 1, color: 'var(--fg)', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--brass)'
                el.style.borderBottomColor = 'var(--brass)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--fg)'
                el.style.borderBottomColor = 'var(--border)'
              }}
            >
              Подробнее об объекте
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </a>
          </div>

          {/* Image */}
          <div
            className="overflow-hidden"
            style={{ minHeight: '460px', background: '#4a5058' }}
            onMouseEnter={() => setHov(0)}
            onMouseLeave={() => setHov(null)}
          >
            <img
              src={PROJECTS[0].img}
              alt={PROJECTS[0].title}
              className="w-full h-full object-cover transition-transform duration-700"
              style={{ transform: hov === 0 ? 'scale(1.04)' : 'scale(1)' }}
            />
          </div>
        </div>
      </div>

      {/* ── Featured row 02 — image left · meta right ── */}
      <div
        className="max-w-[1280px] mx-auto border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr]">

          {/* Image */}
          <div
            className="overflow-hidden order-1 lg:order-none"
            style={{ minHeight: '420px', background: '#5a5a54' }}
            onMouseEnter={() => setHov(1)}
            onMouseLeave={() => setHov(null)}
          >
            <img
              src={PROJECTS[1].img}
              alt={PROJECTS[1].title}
              className="w-full h-full object-cover transition-transform duration-700"
              style={{ transform: hov === 1 ? 'scale(1.04)' : 'scale(1)' }}
            />
          </div>

          {/* Meta */}
          <div
            className="relative flex flex-col justify-between px-6 md:px-10 py-12 lg:py-16 overflow-hidden order-2 lg:order-none"
            style={{ minHeight: '420px' }}
          >
            <span
              className="absolute -top-2 -right-3 select-none pointer-events-none font-black leading-none tabular-nums text-right"
              style={{ ...GEO, fontSize: 'clamp(8rem, 18vw, 16rem)', color: 'var(--card-bg)', zIndex: 0 }}
              aria-hidden
            >
              02
            </span>

            <div className="relative" style={{ zIndex: 1 }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-6 shrink-0" style={{ background: 'var(--brass)' }} />
                <span className="text-[10px] uppercase tracking-[0.3em] font-semibold" style={{ color: 'var(--brass)' }}>
                  {PROJECTS[1].category}
                </span>
              </div>
              <h3
                className="font-bold leading-tight mb-5"
                style={{ ...GEO, color: 'var(--fg)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
              >
                {PROJECTS[1].title}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                <span>{PROJECTS[1].location}</span>
                <span style={{ color: 'var(--border)' }}>—</span>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--brass)' }} />
                  {PROJECTS[1].status}
                </span>
              </div>
            </div>

            <a
              href={projectHref(PROJECTS[1].slug)}
              className="relative inline-flex items-center gap-2 text-sm font-medium self-start group transition-colors"
              style={{ zIndex: 1, color: 'var(--fg)', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--brass)'
                el.style.borderBottomColor = 'var(--brass)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--fg)'
                el.style.borderBottomColor = 'var(--border)'
              }}
            >
              Подробнее об объекте
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── Secondary row: 03 & 04 — image above, caption below ── */}
      <div
        className="max-w-[1280px] mx-auto border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {PROJECTS.slice(2).map((project, i) => {
            const idx = i + 2
            const num = String(idx + 1).padStart(2, '0')
            return (
              <article
                key={project.id || project.slug || project.title}
                className="border-r last:border-r-0 sm:border-r"
                style={{ borderColor: 'var(--border)' }}
                onMouseEnter={() => setHov(idx)}
                onMouseLeave={() => setHov(null)}
              >
                {/* Image */}
                <div className="overflow-hidden" style={{ aspectRatio: '3/2', background: '#4a5058' }}>
                  <img
                    src={project.img}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700"
                    style={{ transform: hov === idx ? 'scale(1.04)' : 'scale(1)' }}
                  />
                </div>

                {/* Caption */}
                <div className="px-6 md:px-10 py-8 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <span
                      className="text-3xl font-black tabular-nums leading-none"
                      style={{ ...GEO, color: 'var(--border)' }}
                    >
                      {num}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.25em] font-medium mt-1"
                      style={{ color: 'var(--brass)' }}
                    >
                      {project.status}
                    </span>
                  </div>
                  <h3
                    className="text-xl font-bold mb-3 leading-snug"
                    style={{ ...GEO, color: 'var(--fg)' }}
                  >
                    <a href={projectHref(project.slug)} className="hover:text-[var(--brass)] transition-colors" style={{ color: 'var(--fg)' }}>
                      {project.title}
                    </a>
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {project.category} · {project.location}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* ── Bottom CTA row ── */}
      <div
        className="max-w-[1280px] mx-auto px-6 md:px-10 py-12 border-t flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Промышленное и гражданское строительство по всей Беларуси
        </p>
        <a
          href={navHref('Объекты')}
          className="inline-flex items-center gap-2 text-sm font-semibold group transition-colors"
          style={{ color: 'var(--fg)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--brass)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg)')}
        >
          Все объекты
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </a>
      </div>

    </section>
  )
}

// ─── Services section ─────────────────────────────────────────────────────────
function Services() {
  const [hov, setHov] = useState<number | null>(null)

  return (
    <section id="services" style={{ background: 'var(--dark)' }}>

      {/* ── Header ── */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 pt-24 md:pt-32 pb-14 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-24 items-end">
          <div>
            <div className="flex items-center gap-4 mb-5">
              <div className="h-px w-8 shrink-0" style={{ background: 'var(--brass)' }} />
              <span className="text-[11px] uppercase tracking-[0.3em] font-medium" style={{ color: 'rgba(242,244,245,0.4)' }}>
                Что мы делаем
              </span>
            </div>
            <h2
              className="font-bold leading-[1.05]"
              style={{ ...GEO, color: 'white', fontSize: 'clamp(2.5rem, 5vw, 3.5rem)' }}
            >
              Наши услуги
            </h2>
          </div>
          <p className="text-sm md:text-base leading-relaxed lg:pb-1" style={{ color: 'rgba(242,244,245,0.45)' }}>
            Полный спектр строительных и инженерных работ. Собственные специалисты, техника и контроль качества на каждом этапе.
          </p>
        </div>
      </div>

      {/* ── Service list ── */}
      <div className="max-w-[1280px] mx-auto border-t" style={{ borderColor: 'rgba(242,244,245,0.08)' }}>
        {SERVICES.map((s, i) => (
          <a
            key={s.id}
            href={serviceHref(s.slug)}
            className="block border-b"
            style={{ borderColor: 'rgba(242,244,245,0.08)' }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <div
              className="px-6 md:px-10 py-7 md:py-8 transition-colors duration-150"
              style={{
                display: 'grid',
                gridTemplateColumns: '3rem 1fr 2rem',
                alignItems: 'start',
                gap: '0 2rem',
                background: hov === i ? 'rgba(242,244,245,0.04)' : 'transparent',
              }}
            >
              {/* Number */}
              <span
                className="text-sm font-bold tabular-nums pt-0.5 transition-colors duration-150"
                style={{
                  fontFamily: 'monospace',
                  color: hov === i ? 'var(--brass)' : 'rgba(19,163,74,0.45)',
                }}
              >
                {s.num}
              </span>

              {/* Title + description */}
              <div>
                <h3
                  className="font-bold leading-snug mb-2 transition-colors duration-150"
                  style={{
                    ...GEO,
                    fontSize: 'clamp(1.05rem, 1.8vw, 1.3rem)',
                    color: hov === i ? 'white' : 'rgba(242,244,245,0.82)',
                  }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-sm leading-relaxed transition-colors duration-150"
                  style={{ color: hov === i ? 'rgba(242,244,245,0.58)' : 'rgba(242,244,245,0.32)' }}
                >
                  {s.desc}
                </p>
              </div>

              {/* Arrow */}
              <span
                className="text-base self-center transition-all duration-200"
                style={{
                  color: 'var(--brass)',
                  opacity: hov === i ? 1 : 0,
                  transform: hov === i ? 'translateX(0)' : 'translateX(-4px)',
                }}
              >
                →
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* ── Footer strip ── */}
      <div
        className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 border-t flex items-center justify-between gap-6"
        style={{ borderColor: 'rgba(242,244,245,0.08)' }}
      >
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: 'rgba(242,244,245,0.22)' }}>
          Собственные специалисты · Минск и регионы
        </p>
        <a
          href={navHref('Контакты')}
          className="text-sm font-medium transition-colors shrink-0"
          style={{ color: 'var(--brass)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'white')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--brass)')}
        >
          Обсудить задачу →
        </a>
      </div>

    </section>
  )
}

// ─── About section ────────────────────────────────────────────────────────────
const ABOUT_CAPABILITIES = [
  { n: '01', title: 'Комплексное строительство',    desc: 'Строительные, монтажные и инженерные работы' },
  { n: '02', title: 'Собственные ресурсы',           desc: 'Специалисты и необходимая строительная техника' },
  { n: '03', title: 'Ответственность за результат',  desc: 'Соблюдение требований проекта и строительных норм' },
]

function About() {
  return (
    <section
      id="about"
      className="border-t"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[58fr_42fr]">

          {/* ── LEFT: large photograph ── */}
          <div
            className="relative overflow-hidden order-1"
            style={{ minHeight: '560px', background: '#4a5058' }}
          >
            <img
              src={IMG.about}
              alt="Реализованный объект компании"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: 'center 40%' }}
            />

            {/* Bottom caption */}
            <div
              className="absolute bottom-0 left-0 right-0 px-8 py-6"
              style={{ background: 'linear-gradient(to top, rgba(15,31,28,0.72), transparent)' }}
            >
              <p
                className="text-[9px] uppercase tracking-[0.38em] font-medium"
                style={{ color: 'rgba(242,244,245,0.5)' }}
              >
                Реализованный объект · Гражданское строительство
              </p>
            </div>

            {/* Thin teal line at right edge — visual seam between photo and panel */}
            <div
              className="absolute top-0 right-0 bottom-0 w-px hidden lg:block"
              style={{ background: 'var(--border)' }}
            />
          </div>

          {/* ── RIGHT: editorial content panel ── */}
          <div
            className="relative flex flex-col justify-center px-8 md:px-12 lg:px-14 py-16 md:py-20 order-2"
            style={{
              background: 'var(--card-bg)',
              /* Architectural trust detail: faint blueprint grid */
              backgroundImage: [
                'linear-gradient(rgba(180,195,205,0.2) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(180,195,205,0.2) 1px, transparent 1px)',
              ].join(', '),
              backgroundSize: '52px 52px',
            }}
          >
            <BrandMark size={34} style={{ marginBottom: '0.75rem' }} />
            <Eyebrow>О компании</Eyebrow>

            <h2
              className="font-bold leading-[1.05] mb-6"
              style={{ ...GEO, color: 'var(--fg)', fontSize: 'clamp(1.75rem, 2.8vw, 2.35rem)' }}
            >
              Строительство<br />с ответственностью<br />за результат
            </h2>

            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
              {COMPANY.legalName} выполняет комплекс строительных, монтажных и инженерных работ — от подготовки и проектирования до реализации и сдачи объекта.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Работы выполняются с участием собственных специалистов и строительной техники, с соблюдением требований проекта, строительных норм и задач заказчика.
            </p>

            {/* Divider */}
            <div className="w-full h-px my-8" style={{ background: 'var(--border)' }} />

            {/* Capabilities — numbered rows, not cards */}
            <div>
              {ABOUT_CAPABILITIES.map(cap => (
                <div
                  key={cap.n}
                  className="flex items-start gap-5 py-4 border-b first:border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="text-[11px] font-bold tabular-nums shrink-0 mt-px"
                    style={{ fontFamily: 'monospace', color: 'var(--brass)', minWidth: '1.75rem' }}
                  >
                    {cap.n}
                  </span>
                  <div>
                    <p
                      className="text-sm font-semibold leading-snug mb-0.5"
                      style={{ ...GEO, color: 'var(--fg)' }}
                    >
                      {cap.title}
                    </p>
                    <p className="text-xs leading-snug" style={{ color: 'var(--muted)' }}>
                      {cap.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <a
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-medium mt-8 self-start group transition-colors"
              style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--brass)'
                el.style.borderBottomColor = 'var(--brass)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--fg)'
                el.style.borderBottomColor = 'var(--border)'
              }}
            >
              Подробнее о компании
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </a>
          </div>

        </div>
      </div>
    </section>
  )
}

// ─── Process section ──────────────────────────────────────────────────────────
function Process() {
  const [hov, setHov] = useState<number | null>(null)

  return (
    <section
      id="process"
      className="border-t"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-24 md:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-14 lg:gap-20 items-start">

          {/* ── LEFT: sticky editorial heading ── */}
          <div className="lg:sticky lg:top-28">
            <Eyebrow>Как мы работаем</Eyebrow>
            <h2
              className="font-bold leading-[1.0] mb-7"
              style={{ ...GEO, color: 'var(--fg)', fontSize: 'clamp(2.25rem, 4.5vw, 3.25rem)' }}
            >
              От идеи<br />до готового<br />объекта
            </h2>
            <div className="w-10 h-px mb-7" style={{ background: 'var(--brass)' }} />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)', maxWidth: '272px' }}>
              Полный цикл реализации — от проектирования и подготовительных работ до сдачи объекта заказчику.
            </p>
          </div>

          {/* ── RIGHT: vertical step list with timeline ── */}
          <div className="relative">

            {/* Continuous vertical line through step numbers (desktop only) */}
            <div
              className="absolute hidden lg:block"
              style={{
                left: '18px',
                top: '28px',
                bottom: '28px',
                width: '1px',
                background: `linear-gradient(to bottom, var(--border) 0%, var(--border) 100%)`,
              }}
            />

            {PROCESS_STEPS.map((step, i) => (
              <a
                key={step.n}
                href={step.href}
                className="relative flex gap-7 md:gap-9 py-8 md:py-10 border-t group"
                style={{ borderColor: 'var(--border)', display: 'flex', cursor: 'pointer' }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              >
                {/* Subtle hover tint */}
                <div
                  className="absolute inset-0 -mx-6 md:-mx-0 pointer-events-none transition-opacity duration-200"
                  style={{
                    background: 'rgba(19,163,74,0.04)',
                    opacity: hov === i ? 1 : 0,
                  }}
                />

                {/* Number column + timeline dot */}
                <div className="relative shrink-0 flex flex-col items-center" style={{ width: '36px' }}>
                  {/* Timeline marker square (desktop) */}
                  <div
                    className="hidden lg:block transition-all duration-200 shrink-0"
                    style={{
                      width: '9px',
                      height: '9px',
                      marginTop: '6px',
                      marginLeft: '1px',
                      border: `1px solid ${hov === i ? 'var(--brass)' : 'var(--border)'}`,
                      background: hov === i ? 'var(--brass)' : 'var(--bg)',
                    }}
                  />
                  {/* Large decorative number */}
                  <span
                    className="font-black tabular-nums leading-none transition-colors duration-200 lg:mt-3"
                    style={{
                      ...GEO,
                      fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                      color: hov === i ? 'var(--brass)' : 'var(--border)',
                    }}
                  >
                    {step.n}
                  </span>
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3
                    className="font-bold mb-3 leading-snug transition-colors duration-200"
                    style={{
                      ...GEO,
                      fontSize: 'clamp(1.05rem, 1.6vw, 1.2rem)',
                      color: hov === i ? 'var(--brass)' : 'var(--fg)',
                    }}
                  >
                    {step.label}
                  </h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--muted)' }}>
                    {step.desc}
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold transition-colors duration-200"
                    style={{ color: hov === i ? 'var(--brass)' : 'var(--muted)' }}
                  >
                    {step.linkLabel}
                    <span
                      className="inline-block transition-transform duration-200"
                      style={{ transform: hov === i ? 'translateX(4px)' : 'translateX(0)' }}
                    >
                      →
                    </span>
                  </span>
                </div>
              </a>
            ))}

            {/* Closing border */}
            <div className="border-t" style={{ borderColor: 'var(--border)' }} />
          </div>
        </div>
      </div>

      {/* ── Mobile: intentional vertical timeline (shown below lg, inside section) ── */}
      {/* Already handled above — the flex layout above reflows cleanly on mobile
          because gap-7 and py-8 give strong touch targets and the number column
          naturally sits left of content on all viewports. The timeline line is
          hidden below lg via the hidden/lg:block class on the line div.       */}
    </section>
  )
}

// ─── News section ─────────────────────────────────────────────────────────────
function News() {
  return (
    <section
      id="news"
      className="py-24 md:py-32 border-t"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="flex items-end justify-between mb-12">
          <div>
            <Eyebrow>Актуальное</Eyebrow>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ ...GEO, color: 'var(--fg)' }}>
              Новости
            </h2>
          </div>
          <a
            href={navHref('Новости')}
            className="hidden md:flex items-center gap-2 text-sm font-medium group transition-colors"
            style={{ color: 'var(--fg)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--brass)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg)')}
          >
            Все новости
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </a>
        </div>

        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {NEWS_ITEMS.map((item, i) => (
            <a
              key={item.id || item.slug || i}
              href={newsHref(item.slug)}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-10 py-6 border-b -mx-6 px-6 transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className="text-[11px] uppercase tracking-[0.22em] shrink-0 sm:w-28"
                style={{ color: 'var(--muted)' }}
              >
                {item.date}
              </span>
              <h3
                className="flex-1 text-base md:text-lg font-medium leading-snug transition-colors"
                style={{ color: 'var(--fg)' }}
              >
                {item.title}
              </h3>
              <span className="hidden sm:block transition-all text-sm" style={{ color: 'var(--muted)' }}>
                →
              </span>
            </a>
          ))}
        </div>

        <div className="mt-8 md:hidden">
          <a href={navHref('Новости')} className="text-sm font-medium transition-colors" style={{ color: 'var(--fg)' }}>
            Все новости →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── News detail ──────────────────────────────────────────────────────────────
function NewsDetail({ slug }: { slug: string }) {
  const item = NEWS_ITEMS.find(n => n.slug === slug)
  if (typeof document !== 'undefined' && item) {
    document.title = `${item.title} — ${COMPANY.name}`
  }
  if (!item) {
    return (
      <section id="news" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-[800px] mx-auto px-6 md:px-10">
          <h1 className="text-2xl font-bold" style={{ ...GEO, color: 'var(--fg)' }}>Новость не найдена</h1>
        </div>
      </section>
    )
  }
  return (
    <section id="news" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[800px] mx-auto px-6 md:px-10">
        <a href={sectionHref('NEWS')} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>← Назад к новостям</a>
        <article className="mt-8">
          {item.coverImageUrl ? (
            <div className="mb-8 overflow-hidden" style={{ aspectRatio: '3/2' }}>
              <img src={item.coverImageUrl} alt={item.title} className="w-full h-full object-cover" />
            </div>
          ) : null}
          <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: 'var(--muted)' }}>{item.date}</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-5" style={{ ...GEO, color: 'var(--fg)' }}>{item.title}</h1>
          {item.excerpt ? <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--muted)' }}>{item.excerpt}</p> : null}
          <div className="text-base leading-relaxed" style={{ color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{item.content}</div>
        </article>
      </div>
    </section>
  )
}

// ─── Project list ─────────────────────────────────────────────────────────────
function ProjectList() {
  if (typeof document !== 'undefined') document.title = `Объекты — ${COMPANY.name}`
  return (
    <section id="projects" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="mb-12">
          <Eyebrow>Портфолио</Eyebrow>
          <h2 className="text-4xl md:text-5xl font-bold leading-[1.05]" style={{ ...GEO, color: 'var(--fg)' }}>
            Реализованные<br />объекты
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t" style={{ borderColor: 'var(--border)' }}>
          {PROJECTS.map((p) => (
            <article
              key={p.id || p.slug || p.title}
              className="border-b md:border-r last:md:border-r-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <a href={projectHref(p.slug)} className="block transition-colors h-full" onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-bg)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <div className="overflow-hidden" style={{ aspectRatio: '3/2', background: '#4a5058' }}>
                  <img src={p.img} alt={p.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] font-medium mb-3" style={{ color: 'var(--muted)' }}>
                    <span>{p.category}</span>
                    <span style={{ color: 'var(--brass)' }}>{p.status}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 leading-snug" style={{ ...GEO, color: 'var(--fg)' }}>
                    {p.title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{p.excerpt || p.location}</p>
                </div>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Project detail ───────────────────────────────────────────────────────────
function ProjectDetail({ slug }: { slug: string }) {
  const p = PROJECTS.find(x => x.slug === slug)
  if (typeof document !== 'undefined' && p) {
    document.title = `${p.title} — ${COMPANY.name}`
  }
  if (!p) {
    return (
      <section id="projects" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-[900px] mx-auto px-6 md:px-10">
          <h1 className="text-2xl font-bold" style={{ ...GEO, color: 'var(--fg)' }}>Объект не найден</h1>
        </div>
      </section>
    )
  }
  return (
    <section id="projects" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[900px] mx-auto px-6 md:px-10">
        <a href={sectionHref('PROJECTS')} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>← Назад к объектам</a>
        <article className="mt-8">
          <div className="mb-8 overflow-hidden" style={{ aspectRatio: '3/2' }}>
            <img src={p.img} alt={p.title} className="w-full h-full object-cover" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: 'var(--muted)' }}>{p.category} · {p.location} · {p.status}</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-5" style={{ ...GEO, color: 'var(--fg)' }}>{p.title}</h1>
          {p.excerpt ? <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--muted)' }}>{p.excerpt}</p> : null}
          <div className="text-base leading-relaxed mb-10" style={{ color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{p.content}</div>
          {p.gallery && p.gallery.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {p.gallery.map((src: string, i: number) => (
                <img key={i} src={src} alt={`${p.title} ${i + 1}`} className="w-full h-48 object-cover" />
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}

// ─── Service list ─────────────────────────────────────────────────────────────
function ServiceList() {
  if (typeof document !== 'undefined') document.title = `Услуги — ${COMPANY.name}`
  return (
    <section id="services" className="py-24 md:py-32 border-t" style={{ background: 'var(--dark)' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="mb-12">
          <Eyebrow>Специализация</Eyebrow>
          <h2 className="text-4xl md:text-5xl font-bold" style={{ ...GEO, color: 'white' }}>
            Услуги
          </h2>
        </div>

        <div className="max-w-[1280px] mx-auto border-t" style={{ borderColor: 'rgba(242,244,245,0.08)' }}>
          {SERVICES.map((s) => (
            <a
              key={s.id}
              href={serviceHref(s.slug)}
              className="block border-b group transition-colors"
              style={{ borderColor: 'rgba(242,244,245,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div
                className="px-6 md:px-10 py-7 md:py-8"
                style={{ display: 'grid', gridTemplateColumns: '3rem 1fr 2rem', gap: '1.25rem', alignItems: 'center' }}
              >
                <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'monospace', color: 'var(--brass)' }}>{s.num}</span>
                <div>
                  <h3 className="font-bold mb-1" style={{ ...GEO, color: 'white' }}>{s.title}</h3>
                  <p className="text-sm" style={{ color: 'rgba(242,244,245,0.5)' }}>{s.desc}</p>
                </div>
                <span className="text-sm transition-transform group-hover:translate-x-1" style={{ color: 'var(--brass)' }}>→</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Service detail ───────────────────────────────────────────────────────────
function ServiceDetail({ slug }: { slug: string }) {
  const s = SERVICES.find(x => x.slug === slug)
  if (typeof document !== 'undefined' && s) {
    document.title = `${s.title} — ${COMPANY.name}`
  }
  if (!s) {
    return (
      <section id="services" className="py-24 md:py-32 border-t" style={{ background: 'var(--dark)' }}>
        <div className="max-w-[900px] mx-auto px-6 md:px-10">
          <h1 className="text-2xl font-bold" style={{ ...GEO, color: 'white' }}>Услуга не найдена</h1>
        </div>
      </section>
    )
  }
  return (
    <section id="services" className="py-24 md:py-32 border-t" style={{ background: 'var(--dark)' }}>
      <div className="max-w-[900px] mx-auto px-6 md:px-10">
        <a href={sectionHref('SERVICES')} className="text-sm font-medium" style={{ color: 'rgba(242,244,245,0.5)' }}>← Назад к услугам</a>
        <article className="mt-8">
          {s.img ? (
            <div className="mb-8 overflow-hidden" style={{ aspectRatio: '3/2' }}>
              <img src={s.img} alt={s.title} className="w-full h-full object-cover" />
            </div>
          ) : null}
          <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: 'var(--brass)' }}>Услуга</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-5" style={{ ...GEO, color: 'white' }}>{s.title}</h1>
          {s.desc ? <p className="text-lg leading-relaxed mb-8" style={{ color: 'rgba(242,244,245,0.6)' }}>{s.desc}</p> : null}
          <div className="text-base leading-relaxed" style={{ color: 'rgba(242,244,245,0.82)', whiteSpace: 'pre-wrap' }}>{s.content}</div>
        </article>
      </div>
    </section>
  )
}

// ─── News list ─────────────────────────────────────────────────────────────────
function NewsList() {
  if (typeof document !== 'undefined') document.title = `Новости — ${COMPANY.name}`
  return (
    <section id="news" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="mb-12">
          <Eyebrow>Актуальное</Eyebrow>
          <h2 className="text-4xl md:text-5xl font-bold" style={{ ...GEO, color: 'var(--fg)' }}>
            Новости
          </h2>
        </div>
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {NEWS_ITEMS.map((item) => (
            <a
              key={item.id || item.slug}
              href={newsHref(item.slug)}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-10 py-6 border-b -mx-6 px-6 transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-[11px] uppercase tracking-[0.22em] shrink-0 sm:w-28" style={{ color: 'var(--muted)' }}>{item.date}</span>
              <h3 className="flex-1 text-base md:text-lg font-medium" style={{ color: 'var(--fg)' }}>{item.title}</h3>
              <span className="hidden sm:block text-sm" style={{ color: 'var(--muted)' }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Page view ────────────────────────────────────────────────────────────────
function PageView({ slug }: { slug: string }) {
  const page = PAGES.find((p: any) => p.slug === slug)
  if (typeof document !== 'undefined' && page) {
    document.title = `${page.title} — ${COMPANY.name}`
  }
  if (!page) {
    return (
      <section className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-[900px] mx-auto px-6 md:px-10">
          <h1 className="text-2xl font-bold" style={{ ...GEO, color: 'var(--fg)' }}>Страница не найдена</h1>
        </div>
      </section>
    )
  }
  return (
    <section id={slug} className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[900px] mx-auto px-6 md:px-10">
        <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-6" style={{ ...GEO, color: 'var(--fg)' }}>{page.title}</h1>
        <div className="text-base leading-relaxed" style={{ color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{page.content}</div>
      </div>
    </section>
  )
}

// ─── Vacancy list ─────────────────────────────────────────────────────────────
function VacancyList() {
  if (typeof document !== 'undefined') document.title = `Вакансии — ${COMPANY.name}`
  return (
    <section id="vacancies" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-10" style={{ ...GEO, color: 'var(--fg)' }}>Вакансии</h2>
        {VACANCIES.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Нет открытых вакансий</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {VACANCIES.map((v: any) => (
              <a key={v.id} href={vacancyHref(v.slug)} className="block py-6 border-b transition-colors" style={{ borderColor: 'var(--border)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <h3 className="text-xl font-bold mb-1" style={{ ...GEO, color: 'var(--fg)' }}>{v.title}</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{v.location}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Vacancy detail ───────────────────────────────────────────────────────────
function VacancyDetail({ slug }: { slug: string }) {
  const v = VACANCIES.find((x: any) => x.slug === slug)
  if (typeof document !== 'undefined' && v) {
    document.title = `${v.title} — ${COMPANY.name}`
  }
  if (!v) {
    return (
      <section className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-[900px] mx-auto px-6 md:px-10">
          <h1 className="text-2xl font-bold" style={{ ...GEO, color: 'var(--fg)' }}>Вакансия не найдена</h1>
        </div>
      </section>
    )
  }
  return (
    <section id="vacancies" className="py-24 md:py-32 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-[900px] mx-auto px-6 md:px-10">
        <a href={sectionHref('VACANCIES')} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>← Назад к вакансиям</a>
        <h1 className="text-3xl md:text-4xl font-bold leading-tight mt-8 mb-5" style={{ ...GEO, color: 'var(--fg)' }}>{v.title}</h1>
        {v.location ? <p className="text-sm uppercase tracking-widest mb-6" style={{ color: 'var(--brass)' }}>{v.location}</p> : null}
        {v.description ? <div className="mb-6" style={{ color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{v.description}</div> : null}
        {v.requirements ? <><h3 className="font-bold mb-2" style={{ color: 'var(--fg)' }}>Требования</h3><p className="mb-6" style={{ color: 'var(--muted)' }}>{v.requirements}</p></> : null}
        {v.conditions ? <><h3 className="font-bold mb-2" style={{ color: 'var(--fg)' }}>Условия</h3><p className="mb-6" style={{ color: 'var(--muted)' }}>{v.conditions}</p></> : null}
        {v.contact ? <><h3 className="font-bold mb-2" style={{ color: 'var(--fg)' }}>Контакты</h3><p style={{ color: 'var(--muted)' }}>{v.contact}</p></> : null}
      </div>
    </section>
  )
}

// ─── CTA section ──────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section id="contacts" className="relative overflow-hidden" style={{ background: 'var(--dark)' }}>
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(200,213,206,1) 1px, transparent 1px), linear-gradient(90deg, rgba(200,213,206,1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-24 md:py-36 relative">

        {/* ── Section header ── */}
        <div className="flex items-center gap-3.5 mb-10">
          <BrandMark size={44} dark />
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] font-medium" style={{ color: 'rgba(242,244,245,0.4)' }}>
              {COMPANY.name} · Строительная компания
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-start">

          {/* ── Left: heading + address + hours ── */}
          <div>
            <h2
              className="font-bold leading-[1.0] mb-6"
              style={{ ...GEO, color: 'white', fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
            >
              Обсудим<br />
              <span style={{ color: 'var(--brass)' }}>ваш проект</span>
            </h2>
            <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgba(242,244,245,0.5)', maxWidth: '340px' }}>
              Оставьте заявку или свяжитесь с нами напрямую. Рассматриваем обращения в течение рабочего дня.
            </p>

            {/* Address block */}
            <div className="border-t border-b py-6 flex flex-col gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] uppercase tracking-[0.28em] font-medium mb-1" style={{ color: 'rgba(242,244,245,0.35)' }}>
                Адрес
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(242,244,245,0.65)' }}>
                {COMPANY.address.zip}, {COMPANY.address.city},<br />
                {COMPANY.address.street}, {COMPANY.address.room}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(242,244,245,0.38)' }}>
                {COMPANY.hours}
              </p>
            </div>

            {/* Tender invitation */}
            <div className="mt-8">
              <p className="text-[10px] uppercase tracking-[0.28em] font-medium mb-3" style={{ color: 'rgba(242,244,245,0.35)' }}>
                Пригласить на тендер
              </p>
              <a
                href={`mailto:${COMPANY.contacts.tenderEmail}?subject=Приглашение на тендер`}
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors pb-0.5"
                style={{ color: 'var(--brass)', borderBottom: '1px solid rgba(19,163,74,0.35)' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = 'white'
                  el.style.borderBottomColor = 'rgba(255,255,255,0.3)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = 'var(--brass)'
                  el.style.borderBottomColor = 'rgba(19,163,74,0.35)'
                }}
              >
                {COMPANY.contacts.tenderEmail} →
              </a>
            </div>
          </div>

          {/* ── Right: structured contact channels ── */}
          <div className="flex flex-col gap-8">

            {/* General / reception */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: 'rgba(242,244,245,0.35)' }}>
                Приёмная / Заказчикам
              </p>
              {COMPANY.contacts.general.map(c => (
                <div key={c.phone} className="flex items-baseline gap-3 mb-1">
                  <a
                    href={c.href}
                    className="text-2xl md:text-3xl font-semibold transition-colors"
                    style={{ ...GEO, color: 'white' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--brass)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'white')}
                  >
                    {c.phone}
                  </a>
                  {c.label && (
                    <span className="text-xs" style={{ color: 'rgba(242,244,245,0.35)' }}>{c.label}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Procurement department */}
            <div className="border-t pt-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: 'rgba(242,244,245,0.35)' }}>
                Отдел закупок
              </p>
              {COMPANY.contacts.procurement.map(c => (
                <a
                  key={c.phone}
                  href={c.href}
                  className="block text-lg font-medium transition-colors mb-1"
                  style={{ color: 'rgba(242,244,245,0.75)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(242,244,245,0.75)')}
                >
                  {c.phone}
                </a>
              ))}
            </div>

            {/* Email + CTA */}
            <div className="border-t pt-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: 'rgba(242,244,245,0.35)' }}>
                Email
              </p>
              <a
                href={`mailto:${COMPANY.contacts.email}`}
                className="text-xl font-medium transition-colors block mb-6"
                style={{ color: 'white' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--brass)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'white')}
              >
                {COMPANY.contacts.email}
              </a>
              <a
                href={`mailto:${COMPANY.contacts.email}`}
                className="inline-flex items-center gap-3 px-8 py-4 border text-[12px] uppercase tracking-[0.18em] font-semibold transition-all"
                style={{ borderColor: 'var(--brass)', color: 'var(--brass)' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'var(--brass)'
                  el.style.color = 'var(--dark)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'transparent'
                  el.style.color = 'var(--brass)'
                }}
              >
                Связаться с нами →
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
const FOOTER_DIM = 'rgba(242,244,245,0.6)'
const FOOTER_MUTED = 'rgba(242,244,245,0.32)'

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-sm transition-colors"
      style={{ color: FOOTER_DIM }}
      onMouseEnter={e => (e.currentTarget.style.color = 'white')}
      onMouseLeave={e => (e.currentTarget.style.color = FOOTER_DIM)}
    >
      {children}
    </a>
  )
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.25em] mb-5" style={{ color: FOOTER_MUTED }}>
      {children}
    </p>
  )
}

function Footer() {
  return (
    <footer className="border-t" style={{ background: 'var(--fg)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 pt-16 pb-10">

        {/* ── Main grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10 md:gap-8 mb-14">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-4 mb-6">
              <BrandMark size={52} dark />
              <div className="flex flex-col leading-none gap-1.5">
                <span className="text-[15px] font-bold tracking-[0.07em] uppercase leading-none" style={{ ...GEO, color: 'white' }}>
                  {COMPANY.name}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] font-medium leading-none" style={{ color: FOOTER_MUTED }}>
                  строительная компания
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: FOOTER_MUTED }}>
              {COMPANY.address.formatted || `${COMPANY.address.street}${COMPANY.address.room ? `, ${COMPANY.address.room}` : ''}` || ''}
            </p>
            <p className="text-xs" style={{ color: FOOTER_MUTED }}>
              {COMPANY.hours}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <FooterHeading>Компания</FooterHeading>
            <nav className="flex flex-col gap-3">
              {(NAV || []).filter((n: any) => n.showInFooter).map((n: any) => (
                <FooterLink key={n.id} href={n.href} target={n.external ? '_blank' : undefined} rel={n.external ? 'noopener noreferrer' : undefined}>{n.label}</FooterLink>
              ))}
            </nav>
          </div>

          {/* Services */}
          <div>
            <FooterHeading>Услуги</FooterHeading>
            <nav className="flex flex-col gap-3">
              {SERVICES.slice(0, 6).map(s => (
                <FooterLink key={s.id} href={serviceHref(s.slug)}>{s.title}</FooterLink>
              ))}
            </nav>
          </div>

          {/* Contacts — general */}
          <div>
            <FooterHeading>Приёмная</FooterHeading>
            <div className="flex flex-col gap-2 mb-6">
              {COMPANY.contacts.general.map(c => (
                <div key={c.phone}>
                  <a
                    href={c.href}
                    className="text-sm transition-colors block"
                    style={{ color: FOOTER_DIM }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                    onMouseLeave={e => (e.currentTarget.style.color = FOOTER_DIM)}
                  >
                    {c.phone}
                  </a>
                  {c.label && (
                    <span className="text-[10px]" style={{ color: FOOTER_MUTED }}>{c.label}</span>
                  )}
                </div>
              ))}
            </div>
            <FooterHeading>Email</FooterHeading>
            <a
              href={`mailto:${COMPANY.contacts.email}`}
              className="text-sm transition-colors"
              style={{ color: FOOTER_DIM }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = FOOTER_DIM)}
            >
              {COMPANY.contacts.email}
            </a>
          </div>

          {/* Contacts — procurement */}
          <div>
            <FooterHeading>Отдел закупок</FooterHeading>
            <div className="flex flex-col gap-2 mb-6">
              {COMPANY.contacts.procurement.map(c => (
                <a
                  key={c.phone}
                  href={c.href}
                  className="text-sm transition-colors block"
                  style={{ color: FOOTER_DIM }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={e => (e.currentTarget.style.color = FOOTER_DIM)}
                >
                  {c.phone}
                </a>
              ))}
            </div>
            <FooterHeading>Тендеры</FooterHeading>
            <a
              href={`mailto:${COMPANY.contacts.tenderEmail}?subject=Приглашение на тендер`}
              className="text-sm transition-colors"
              style={{ color: 'var(--brass)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--brass)')}
            >
              Пригласить на тендер →
            </a>
          </div>

        </div>

        {/* ── Bottom bar ── */}
        <div
          className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs" style={{ color: FOOTER_MUTED }}>
            © {COMPANY.founded}–2025 {COMPANY.legalName}. УНП {COMPANY.unp}. Все права защищены.
          </p>
          <div className="flex items-center gap-6">
            <a
              href={`https://${COMPANY.domain}`}
              className="text-xs transition-colors"
              style={{ color: FOOTER_MUTED }}
              onMouseEnter={e => (e.currentTarget.style.color = FOOTER_DIM)}
              onMouseLeave={e => (e.currentTarget.style.color = FOOTER_MUTED)}
            >
              {COMPANY.domain}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Home page sections ───────────────────────────────────────────────────────
const SECTION_KEYS = ['about', 'services', 'projects', 'news', 'vacancies', 'contacts']

function Home({ activeSection }: { activeSection?: string }) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (activeSection) {
      const el = document.getElementById(activeSection)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'auto' }), 50)
    } else if (window.location.hash) {
      const id = window.location.hash.slice(1)
      const el = document.getElementById(id)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'auto' }), 50)
    }
  }, [activeSection])

  return (
    <>
      <Hero />
      <About />
      <Services />
      <Projects />
      <Process />
      <News />
      <VacancyList />
      <CTA />
    </>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const route = (cms as any).route || ''
  const sub = (cms as any).subRoute || ''
  const isHomeSection = SECTION_KEYS.includes(route) && !sub
  const matchedPage = route ? PAGES.find((p: any) => p.slug === route) : null

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: 'var(--bg)', color: 'var(--fg)' }}>
      <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        {!route || isHomeSection ? (
          <Home activeSection={isHomeSection ? route : undefined} />
        ) : route === 'news' && sub ? (
          <NewsDetail slug={sub} />
        ) : route === 'projects' && sub ? (
          <ProjectDetail slug={sub} />
        ) : route === 'services' && sub ? (
          <ServiceDetail slug={sub} />
        ) : route === 'vacancies' && sub ? (
          <VacancyDetail slug={sub} />
        ) : matchedPage ? (
          <PageView slug={route} />
        ) : (
          <PageView slug={route} />
        )}
      </main>
      <Footer />
    </div>
  )
}
