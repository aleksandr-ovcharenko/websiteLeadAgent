import { useEffect, useState, useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Mail,
  MapPin,
  Menu,
  Phone,
  X
} from 'lucide-react';

import { applySectionLimit } from '../sectionLimits.js';

const CMS = (typeof window !== 'undefined' && (window as any).__CMS__) || {};
const COPY: Record<string, string> = (CMS as any).COPY || {};

// CMS-owned furniture copy — a missing key renders the fallback literal or
// omits the optional element; the template never invents user-facing text.
const t = (key: string, fallback = ''): string => COPY[key] || fallback;
const tf = (key: string, params: Record<string, string | number>, fallback = ''): string => {
  const tpl = COPY[key];
  if (!tpl) return fallback;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
};

function Arrow() {
  return <ArrowUpRight aria-hidden="true" />;
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return pathname;
}

function useRoute() {
  return (typeof window !== 'undefined' && (window as any).__CMS_ROUTE__) || { route: '', subRoute: '' };
}

function Link({
  href,
  children,
  className,
  target,
  rel,
  onClick,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={href} className={className} target={target} rel={rel} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

function mediaUrl(id?: string | null) {
  if (!id) return '';
  // A bare `/<id>` is a guaranteed-broken URL — emit nothing rather than a
  // dead <img> when the media map lacks the row.
  return CMS.MEDIA?.[id]?.url || '';
}

function formatDate(d?: string | null) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const company = CMS.COMPANY || { name: '', industry: '', phone: '', email: '', address: { formatted: '', street: '' }, contacts: { general: [], email: '', social: [] }, hours: '' };
const nav = (CMS.NAV || []).filter((n: any) => n.showInHeader !== false).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
const services = (CMS.SERVICES || []).filter((s: any) => s.status === 'PUBLISHED' || s.status !== 'ARCHIVED');
const projects = (CMS.PROJECTS || []).filter((p: any) => p.status === 'PUBLISHED' || p.status !== 'ARCHIVED');
const news = (CMS.NEWS_ITEMS || []).filter((n: any) => n.status === 'PUBLISHED' || n.status !== 'ARCHIVED');
const pages = (CMS.PAGES || []).filter((p: any) => p.status === 'PUBLISHED' || p.status !== 'ARCHIVED');
const vacancies = (CMS.VACANCIES || []).filter((v: any) => v.status === 'PUBLISHED' || v.status !== 'ARCHIVED');

// Homepage collection previews honor each section's own `limit` (falling back
// to the manifest's declared default) via the shared contract.
function homeSectionItems(type: string, items: any[]): any[] {
  const section = (CMS.HOME_SECTIONS || []).find((s: any) => s?.type === type && s?.enabled !== false)
    || { type };
  return applySectionLimit(items, section, CMS.MANIFEST);
}

function isItemActive(item: any, pathname: string): boolean {
  if (!item.href) return false;
  return (
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(`${item.href}/`)) ||
    item.children?.some((child: any) => isItemActive(child, pathname))
  );
}

function NavigationBranch({ item, pathname, mobile = false, onNavigate }: { item: any; pathname: string; mobile?: boolean; onNavigate: () => void }) {
  const active = isItemActive(item, pathname);
  const children = (item.children || []).filter((n: any) => n.showInHeader !== false).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!children.length) {
    return (
      <Link href={item.href || '#'} className={active ? 'is-current' : ''} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} onClick={onNavigate}>
        {item.label}
      </Link>
    );
  }
  return (
    <details className={`nav-group ${active ? 'is-active' : ''}`} open={mobile ? active : undefined}>
      <summary>
        {item.href ? <Link href={item.href} onClick={onNavigate}>{item.label}</Link> : <span>{item.label}</span>}
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="nav-menu">{children.map((child: any) => <NavigationBranch key={`${item.label}-${child.label}`} item={child} pathname={pathname} mobile={mobile} onNavigate={onNavigate} />)}</div>
    </details>
  );
}

function Header() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenu(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const closeMenus = () => setMobileMenu(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="wordmark" onClick={closeMenus}>
          <span className="wordmark-mark">{(company.name || 'N').slice(0, 1)}</span>
          <span>{company.name || 'Company'}<span className="wordmark-sub">/ {company.industry || ''}</span></span>
        </Link>
        <nav className="main-nav" aria-label={t('menu.aria')}>
          {nav.map((item: any) => <NavigationBranch key={item.label} item={item} pathname={pathname} onNavigate={closeMenus} />)}
        </nav>
        <div className="header-actions">
          {company.phone ? <a className="header-phone" href={`tel:${company.phone}`}>{company.phone}</a> : null}
          <Link href="/contact" className="nav-contact">{t('cta.request')} <Arrow /></Link>
          <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X /> : <Menu />}<span>{t('menu.open')}</span>
          </button>
        </div>
      </div>
      <div className={`mobile-nav ${mobileMenu ? 'is-open' : ''}`} aria-hidden={!mobileMenu}>
        <div className="container mobile-nav-inner">
          <p className="eyebrow">{t('footer.navigation')}</p>
          {nav.map((item: any) => <NavigationBranch key={`mobile-${item.label}`} item={item} pathname={pathname} mobile onNavigate={closeMenus} />)}
          {company.phone ? <a className="mobile-phone" href={`tel:${company.phone}`}>{company.phone}</a> : null}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const h = CMS.HERO || {};
  const image = h.imageUrl || mediaUrl(h.imageId) || '';
  const title = h.title || company.name;
  const subtitle = h.subtitle || '';
  return (
    <section className="hero">
      {image ? <div className="hero-image hero__figure"><img src={image} alt={title} /></div> : null}
      <div className="hero-rule" />
      <div className="container hero-content">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">{company.industry}</p>
          <h1>{title}</h1>
          {subtitle ? <p className="hero-description">{subtitle}</p> : null}
          <div className="hero-actions">
            <Link className="button button-accent hero__cta" href="/contact">{t('cta.discuss')} <Arrow /></Link>
            <Link className="text-link hero-secondary" href="/projects">{t('cta.viewProjects')} <Arrow /></Link>
          </div>
        </div>
        <div className="hero-meta">
          <span>{tf('hero.statsServices', { n: (CMS.SERVICES || []).length })}</span>
          <span>{tf('hero.statsProjects', { n: (CMS.PROJECTS || []).length })}</span>
          {company.city ? <span>{company.city}</span> : null}
        </div>
      </div>
      <div className="hero-index">{tf('hero.index', { n: '01', total: String((CMS.HOME_SECTIONS || []).filter((s: any) => s?.enabled !== false).length || 4) })}</div>
    </section>
  );
}

function Intro() {
  const about = CMS.ABOUT || {};
  const text = about.text || (CMS.pages?.find((p: any) => p.isHomepage)?.content) || '';
  return (
    <section className="intro-section">
      <div className="container intro-grid">
        <p className="eyebrow">{tf('section.numberedEyebrow', { n: '01', name: t('section.about') })}</p>
        <div>
          <h2>{t('intro.title.pre')}<em>{t('intro.title.em')}</em>{t('intro.title.post')}</h2>
          <p className="large-copy">{company.name || t('about.companyHeading')} — {text}</p>
          <Link className="text-link" href="/about">{t('about.more')} <Arrow /></Link>
        </div>
      </div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, text, href, linkLabel = t('viewAll.default') }: { eyebrow: string; title: string; text?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="section-intro">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {text ? <p className="intro-copy">{text}</p> : null}
      {href ? <Link className="text-link" href={href}>{linkLabel} <Arrow /></Link> : null}
    </div>
  );
}

function ServiceCard({ service, number }: { service: any; number: string }) {
  const image = service.imageUrl || mediaUrl(service.imageId);
  const text = service.shortDescription || service.excerpt || '';
  return (
    <Link href={`/services/${service.slug}`} className="service-card">
      {image ? <div className="service-image"><img src={image} alt={service.title} /></div> : null}
      <div className="service-meta"><span>{number}</span><h3>{service.title}</h3><ArrowRight /></div>
      <p>{text}</p>
    </Link>
  );
}

function ProjectCard({ project, featured = false }: { project: any; featured?: boolean }) {
  const image = project.imageUrl || mediaUrl(project.coverImageId || project.imageId);
  const year = project.completionDate ? new Date(project.completionDate).getFullYear() : '';
  return (
    <Link href={`/projects/${project.slug}`} className={`project-card ${featured ? 'project-card-featured' : ''}`}>
      {image ? <div className="project-image"><img src={image} alt={project.title} /></div> : null}
      <div className="project-caption">
        <div>
          <p className="eyebrow">{project.category || t('entity.project')} / {year}</p>
          <h3>{project.title}</h3>
        </div>
        <p>{project.location || ''}</p>
      </div>
    </Link>
  );
}

function Services() {
  return (
    <section className="section-block">
      <div className="container">
        <SectionIntro eyebrow={t('industrial.servicesEyebrow')} title={t('industrial.servicesTitle')} text={t('industrial.servicesText')} href="/services" linkLabel={t('industrial.servicesLink')} />
        <div className="services-grid">{homeSectionItems('services', services).map((s: any, i: number) => <ServiceCard key={s.slug} service={s} number={String(i + 1).padStart(2, '0')} />)}</div>
      </div>
    </section>
  );
}

function Projects() {
  return (
    <section className="section-block">
      <div className="container">
        <SectionIntro eyebrow={t('industrial.projectsEyebrow')} title={t('industrial.projectsTitle')} text={t('industrial.projectsText')} href="/projects" linkLabel={t('industrial.projectsLink')} />
        <div className="projects-grid">{homeSectionItems('projects', projects).map((p: any) => <ProjectCard key={p.slug} project={p} featured />)}</div>
      </div>
    </section>
  );
}

function News() {
  if (!news.length) return null;
  return (
    <section className="section-block">
      <div className="container">
        <SectionIntro eyebrow={t('industrial.newsEyebrow')} title={t('industrial.newsTitle')} href="/news" linkLabel={t('industrial.newsLink')} />
        <div className="news-list">
          {homeSectionItems('news', news).map((item: any) => (
            <Link className="news-row" key={item.slug} href={`/news/${item.slug}`}>
              <span>{formatDate(item.publishedAt || item.date)}</span>
              <span>{item.category || t('about.companyHeading')}</span>
              <h3>{item.title}</h3>
              <Arrow />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactStrip() {
  return (
    <section className="contact-strip">
      <div className="container contact-inner">
        <div>
          <p className="eyebrow">{t('cta.eyebrow')}</p>
          <h2>{t('cta.heading.pre')}<br /><em>{t('cta.heading.em')}</em>{t('cta.heading.post')}</h2>
        </div>
        <Link className="button button-dark" href="/contact">{t('cta.contactUs')} <Arrow /></Link>
      </div>
    </section>
  );
}

function Footer() {
  const footerGroups = [
    { title: t('footer.navigation'), links: (CMS.NAV || []).filter((n: any) => n.showInFooter !== false).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((n: any) => [n.label, n.href]) },
    { title: t('about.companyHeading'), links: (CMS.PAGES || []).filter((p: any) => p.status !== 'ARCHIVED').slice(0, 4).map((p: any) => [p.title, `/${p.slug}`]) }
  ].filter((g) => g.links.length);
  return (
    <footer className="footer">
      <div className="container footer-lead">
        <div>
          <Link href="/" className="wordmark">
            <span className="wordmark-mark">{(company.name || 'N').slice(0, 1)}</span>
            <span>{company.name || 'Company'}<span className="wordmark-sub">/ {company.industry || ''}</span></span>
          </Link>
          <p className="footer-note">{company.tagline || t('footer.companyTagline')}</p>
        </div>
        {company.address?.formatted || company.address?.street ? (
          <div className="footer-contact">
            <p className="eyebrow">{t('contacts.office')}</p>
            <p>{(company.address?.formatted || company.address?.street).split('\n').slice(0, 2).join('<br />')}</p>
            {company.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : null}
          </div>
        ) : null}
        {company.phone ? (
          <div className="footer-contact">
            <p className="eyebrow">{t('contacts.phone')}</p>
            <a href={`tel:${company.phone}`}>{company.phone}</a>
            {company.hours ? <p>{company.hours}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="container footer-links">
        {footerGroups.map((group: any) => (
          <div key={group.title}>
            <p className="eyebrow">{group.title}</p>
            {group.links.map(([label, href]: [string, string]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>{tf('footer.copyrightShort', { year: new Date().getFullYear(), name: company.name })}</span>
        <span>{company.domain || ''}</span>
        <span>{t('footer.tagline')}</span>
      </div>
    </footer>
  );
}

function SiteShell({ children }: { children: React.ReactNode }) {
  return <><Header />{children}<Footer /></>;
}

function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="page-hero">
      <div className="container">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}

function ContactDetails() {
  const contacts = CMS.CONTACTS || {};
  return (
    <div className="contact-details">
      <div><MapPin /><p>{(company.address?.formatted || company.address?.street || '').replace(/\n/g, '<br />')}</p></div>
      <div><Phone /><p><a href={`tel:${company.phone}`}>{company.phone}</a><br />{company.hours}</p></div>
      <div><Mail /><p><a href={`mailto:${company.email}`}>{company.email}</a><br />{t('contacts.responseTime')}</p></div>
    </div>
  );
}

function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <main>
        <Intro />
        <Services />
        <Projects />
        <News />
      </main>
      <ContactStrip />
    </SiteShell>
  );
}

function CollectionPage({ type }: { type: 'services' | 'projects' | 'news' }) {
  const isServices = type === 'services';
  const isProjects = type === 'projects';
  const title = t(`collection.${type}Title`);
  const text = t(`collection.${type}Text`);
  const list = isServices ? services : isProjects ? projects : news;
  return (
    <SiteShell>
      <PageHero eyebrow={tf('collection.eyebrow', { name: t(`collection.${type}Name`) })} title={title} text={text} />
      <main className="collection-page">
        <div className="container">
          {isServices ? (
            <div className="services-grid">{list.map((s: any, i: number) => <ServiceCard key={s.slug} service={s} number={String(i + 1).padStart(2, '0')} />)}</div>
          ) : isProjects ? (
            <div className="projects-grid collection-projects">{list.map((p: any) => <ProjectCard key={p.slug} project={p} featured />)}</div>
          ) : (
            <div className="news-list">
              {list.map((item: any) => (
                <Link className="news-row" key={item.slug} href={`/news/${item.slug}`}>
                  <span>{formatDate(item.publishedAt || item.date)}</span>
                  <span>{item.category || t('about.companyHeading')}</span>
                  <h3>{item.title}</h3>
                  <Arrow />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <ContactStrip />
    </SiteShell>
  );
}

function DetailPage({ kind, slug }: { kind: 'service' | 'project' | 'news'; slug: string }) {
  const item = useMemo(() => {
    const list = kind === 'service' ? services : kind === 'project' ? projects : news;
    return list.find((x: any) => x.slug === slug) || list[0];
  }, [kind, slug]);
  if (!item) {
    return (
      <SiteShell>
        <PageHero eyebrow={t('notFound.eyebrow')} title={t('notFound.title')} text={t('notFound.detail')} />
      </SiteShell>
    );
  }
  const title = item.title;
  const text = kind === 'news' ? (item.excerpt || '') : (item.shortDescription || item.excerpt || item.description || '');
  const image = kind === 'service' ? (item.imageUrl || mediaUrl(item.imageId)) : kind === 'project' ? (item.imageUrl || mediaUrl(item.coverImageId || item.imageId)) : (item.imageUrl || mediaUrl(item.coverImageId));
  return (
    <SiteShell>
      <PageHero eyebrow={tf('detail.eyebrow', { kind: t(`entity.${kind}`), category: item.category || t('about.companyHeading') })} title={title} text={text} />
      <main className="detail-page">
        <div className="container detail-grid">
          {image ? <div className="detail-media"><img src={image} alt={title} /></div> : null}
          <article>
            <p className="eyebrow">{t('detail.approachEyebrow')}</p>
            <h2>{t('detail.approachTitle.pre')}<em>{t('detail.approachTitle.em')}</em></h2>
            <p className="large-copy">{item.content || text}</p>
            <Link className="button button-accent" href="/contact">{t('cta.discuss')} <Arrow /></Link>
          </article>
        </div>
      </main>
      <ContactStrip />
    </SiteShell>
  );
}

function PageView({ slug }: { slug: string }) {
  const page = pages.find((p: any) => p.slug === slug);
  if (!page) {
    return (
      <SiteShell>
        <PageHero eyebrow={t('notFound.eyebrow')} title={t('notFound.title')} text={tf('notFound.lede', { path: slug })} />
      </SiteShell>
    );
  }
  return (
    <SiteShell>
      <PageHero eyebrow={t('page.eyebrow')} title={page.title} text={page.seoDescription || ''} />
      <main className="generic-page">
        <div className="container narrow-copy">
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content || '') }} />
        </div>
      </main>
      <ContactStrip />
    </SiteShell>
  );
}

function VacanciesPage() {
  return (
    <SiteShell>
      <PageHero eyebrow={t('vacancies.eyebrow')} title={t('vacancies.title')} text={t('vacancies.text')} />
      <main className="collection-page">
        <div className="container vacancies-list">
          {vacancies.map((v: any) => (
            <Link key={v.slug} className="vacancy-row" href={`/vacancies/${v.slug}`}>
              <span>{v.location || ''} / {t('vacancy.fullTime')}</span>
              <h2>{v.title}</h2>
              <Arrow />
            </Link>
          )) || <p className="container">{t('vacancy.empty')}</p>}
        </div>
      </main>
      <ContactStrip />
    </SiteShell>
  );
}

function ContactPage() {
  return (
    <SiteShell>
      <PageHero eyebrow={t('contacts.eyebrow')} title={t('contacts.heroTitle')} text={t('contacts.heroText')} />
      <main className="contact-page">
        <div className="container contact-page-grid">
          <ContactDetails />
          <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
            <label>{t('form.name')}<input required name="name" /></label>
            <label>{t('form.email')}<input required type="email" name="email" /></label>
            <label>{t('form.message')}<textarea required name="message" rows={5} /></label>
            <button className="button button-accent" type="submit">{t('form.submit')} <Arrow /></button>
          </form>
        </div>
      </main>
    </SiteShell>
  );
}

export default function App() {
  const { route, subRoute } = useRoute();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = 'ru';
      document.title = `${company.name} — ${route ? route : t('nav.home')}`;
    }
  }, [route]);

  if (!route || route === '' || route === 'home') return <HomePage />;
  if (route === 'services') return subRoute ? <DetailPage kind="service" slug={subRoute} /> : <CollectionPage type="services" />;
  if (route === 'projects') return subRoute ? <DetailPage kind="project" slug={subRoute} /> : <CollectionPage type="projects" />;
  if (route === 'news') return subRoute ? <DetailPage kind="news" slug={subRoute} /> : <CollectionPage type="news" />;
  if (route === 'vacancies') return <VacanciesPage />;
  if (route === 'contact') return <ContactPage />;
  return <PageView slug={route} />;
}
