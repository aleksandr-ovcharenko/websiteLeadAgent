import { useState, useEffect } from 'react'
import type { Screen, NavigateOpts } from './types'
import { EDITOR_SCREENS, STUDIO_SCREENS, parseStudioSearch, buildStudioSearch } from './studioNavigation'
import { StudioProvider, useStudio, type StudioUser } from './context'
import Sidebar from './Sidebar'
import Dashboard from './Dashboard'
import { PagesList, PageEditor } from './Pages'
import { ProjectsList, ProjectEditor } from './Projects'
import { NewsList, NewsEditor } from './News'
import { ServicesList, ServiceEditor } from './Services'
import { ProductsList, ProductEditor } from './Products'
import { VacanciesList, VacancyEditor } from './Vacancies'
import Media from './Media'
import NavEditor from './NavEditor'
import Contacts from './Contacts'
import SiteSettings from './SiteSettings'
import Versions from './RevisionHistory'
import Users from './Users'

const SCREEN_LABELS: Record<Screen, string> = {
  dashboard: 'Dashboard',
  pages: 'Pages',
  'page-editor': 'Page Editor',
  projects: 'Projects',
  'project-editor': 'Project Editor',
  news: 'News',
  'news-editor': 'News Editor',
  services: 'Services',
  'service-editor': 'Service Editor',
  products: 'Products',
  'product-editor': 'Product Editor',
  vacancies: 'Vacancies',
  'vacancy-editor': 'Vacancy Editor',
  media: 'Media',
  navigation: 'Navigation',
  contacts: 'Contacts',
  versions: 'Version History',
  'site-settings': 'Site Settings',
  users: 'Users'
};

function StudioInner({ screen }: { screen: Screen }) {
  const { site, settings } = useStudio();
  const siteName = site?.name || settings?.companyName || 'Studio';
  useEffect(() => {
    const part = SCREEN_LABELS[screen] || 'Studio';
    document.title = `${part} — ${siteName} — WebsiteLeadAgent`;
  }, [screen, siteName]);
  return null;
}

const VALID_SCREENS = new Set<string>(STUDIO_SCREENS);

function readUrlState() {
  return parseStudioSearch(typeof window !== 'undefined' ? window.location.search : '')
}

export default function Studio({ siteId, user }: { siteId: string; user?: any }) {
  const [screen, setScreen] = useState<Screen>(() => readUrlState().screen)
  const [editingId, setEditingId] = useState<string | null>(() => readUrlState().id)
  const [returnTo, setReturnTo] = useState<Screen | null>(() => readUrlState().returnTo)

  // Deep-link support: ?screen=…&edit=…&returnTo=… survives reload and is shareable.
  const navigate = (s: Screen, id?: string, opts?: NavigateOpts) => {
    setScreen(s)
    setEditingId(id ?? null)
    setReturnTo(opts?.returnTo ?? null)
    try {
      const u = new URL(window.location.href)
      // Merge: preserve unrelated params (e.g. embed flags), own screen/edit/returnTo.
      const next = new URLSearchParams(buildStudioSearch({ screen: s, id: id ?? null, returnTo: opts?.returnTo ?? null }))
      u.searchParams.forEach((v, k) => { if (!['screen', 'edit', 'returnTo'].includes(k)) next.set(k, v) })
      u.search = next.toString()
      window.history.pushState({}, '', u)
    } catch { /* non-browser env */ }
    const el = document.getElementById('cms-main')
    if (el) el.scrollTop = 0
  }

  useEffect(() => {
    const onPop = () => {
      const st = readUrlState()
      setScreen(st.screen)
      setEditingId(st.id)
      setReturnTo(st.returnTo)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const isEditor = EDITOR_SCREENS.includes(screen)
  const isFullHeight = isEditor || screen === 'media'

  return (
    <StudioProvider siteId={siteId} user={(user ?? null) as StudioUser | null}>
      <StudioInner screen={screen} />
      <div className="flex h-full bg-bg overflow-hidden">
        <Sidebar current={screen} onNavigate={navigate} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main
            id="cms-main"
            className={`flex-1 ${isFullHeight ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
          >
            {screen === 'dashboard' && <Dashboard onNavigate={navigate} />}

            {screen === 'pages' && <PagesList onNavigate={navigate} />}
            {screen === 'page-editor' && <PageEditor pageId={editingId} returnTo={returnTo} onNavigate={navigate} />}

            {screen === 'projects' && <ProjectsList onNavigate={navigate} />}
            {screen === 'project-editor' && <ProjectEditor projectId={editingId} returnTo={returnTo} onNavigate={navigate} />}

            {screen === 'news' && <NewsList onNavigate={navigate} />}
            {screen === 'news-editor' && <NewsEditor newsId={editingId} returnTo={returnTo} onNavigate={navigate} />}

            {screen === 'services' && <ServicesList onNavigate={navigate} />}
            {screen === 'products' && <ProductsList onNavigate={navigate} />}
            {screen === 'product-editor' && <ProductEditor productId={editingId} returnTo={returnTo} onNavigate={navigate} />}
            {screen === 'service-editor' && <ServiceEditor serviceId={editingId} returnTo={returnTo} onNavigate={navigate} />}

            {screen === 'vacancies' && <VacanciesList onNavigate={navigate} />}
            {screen === 'vacancy-editor' && <VacancyEditor vacancyId={editingId} returnTo={returnTo} onNavigate={navigate} />}

            {screen === 'media' && <Media onNavigate={navigate} />}
            {screen === 'navigation' && <NavEditor onNavigate={navigate} />}
            {screen === 'contacts' && <Contacts onNavigate={navigate} />}
            {screen === 'versions' && <Versions />}
            {screen === 'site-settings' && <SiteSettings onNavigate={navigate} />}
            {screen === 'users' && <Users onNavigate={navigate} />}
          </main>
        </div>
      </div>
    </StudioProvider>
  )
}
