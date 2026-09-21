import { useCallback, useEffect, useMemo, useState } from 'react';
import { cms, type CmsSection } from './cms';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Services } from './components/Services';
import { Projects } from './components/Projects';
import { Detail } from './components/Detail';
import { About } from './components/About';
import { EditorialList } from './components/EditorialList';
import { Contacts } from './components/Contacts';
import { Finale } from './components/Finale';
import { GenericSection } from './components/GenericSection';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Anchor ids per section type — nav targets and IntersectionObserver keys.
// First section of a type gets the clean anchor; later ones are suffixed.
function anchorAssigner() {
  const seen = new Set<string>();
  return (s: CmsSection, i: number): string => {
    const byType: Record<string, string> = {
      hero: 'hero', services: 'services', projects: 'projects', about: 'about',
      contacts: 'contact', cta: 'contact', news: 'news', vacancies: 'vacancies',
    };
    const baseName = byType[s.type] || `section-${s.type || 'block'}`;
    const anchor = seen.has(baseName) ? `${baseName}-${i}` : baseName;
    seen.add(anchor);
    return anchor;
  };
}

function App() {
  const [active, setActive] = useState('hero');
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const sections = cms.SECTIONS || [];
  const projectsSection = sections.find((s) => s.type === 'projects');
  const projects = projectsSection?.items || [];
  const servicesSection = sections.find((s) => s.type === 'services');

  // Chapter numbering follows the resolved composition order.
  const chapters = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    sections.forEach((s) => {
      if (s.type !== 'hero') {
        m.set(s.id, ROMAN[n] || String(n + 1));
        n += 1;
      }
    });
    return m;
  }, [sections]);

  const anchors = useMemo(() => {
    const assign = anchorAssigner();
    return sections.map((s, i) => assign(s, i));
  }, [sections]);

  // Canonical navigation comes from CMS MenuItem records (cms.NAV).
  // Homepage sections are never used as a hidden second menu.
  const navHeader = cms.NAV?.header || [];
  const navFooter = cms.NAV?.footer || [];

  useEffect(() => {
    document.documentElement.classList.add('js-reveal');

    const ids = anchors;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-40% 0px -50% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed');
            revealObs.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    document.querySelectorAll('.reveal-mask').forEach((el) => revealObs.observe(el));

    return () => {
      obs.disconnect();
      revealObs.disconnect();
    };
  }, [anchors]);

  const openDetail = useCallback((index: number) => {
    const apply = () => setDetailIndex(index);
    if (document.startViewTransition) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }, []);

  const closeDetail = useCallback(() => {
    const apply = () => setDetailIndex(null);
    if (document.startViewTransition) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }, []);

  const renderSection = (s: CmsSection, i: number) => {
    const anchor = anchors[i];
    const chapter = chapters.get(s.id);
    switch (s.type) {
      case 'hero':
        return <Hero key={s.id} section={s} anchor={anchor} companyName={cms.COMPANY.name} />;
      case 'services':
        return <Services key={s.id} section={s} anchor={anchor} chapter={chapter} />;
      case 'projects':
        return <Projects key={s.id} section={s} anchor={anchor} chapter={chapter} onOpen={openDetail} />;
      case 'about':
        return <About key={s.id} section={s} anchor={anchor} chapter={chapter} services={servicesSection?.items || []} />;
      case 'news':
      case 'vacancies':
        return <EditorialList key={s.id} section={s} anchor={anchor} chapter={chapter} />;
      case 'contacts':
        return <Contacts key={s.id} section={s} anchor={anchor} chapter={chapter} />;
      case 'cta':
        return <Finale key={s.id} section={s} anchor={anchor} chapter={chapter} nav={navFooter} />;
      default:
        // Unknown/unsupported block types degrade to a generic section — never crash.
        return <GenericSection key={s.id} section={s} anchor={anchor} chapter={chapter} />;
    }
  };

  const hasCtaOrContacts = sections.some((s) => s.type === 'cta' || s.type === 'contacts');

  return (
    <>
      <Header nav={navHeader} active={active} brand={cms.COMPANY.name} mark={cms.COMPANY.address || ''} homeHref="#hero" />
      <main id="main">
        {sections.map(renderSection)}
        {!hasCtaOrContacts && <Finale section={undefined} anchor="contact" chapter={chapters.get('__finale')} nav={navFooter} />}
      </main>
      {detailIndex !== null && (
        <Detail index={detailIndex} projects={projects} onClose={closeDetail} onNavigate={openDetail} />
      )}
    </>
  );
}

export default App;
