import { useState, useEffect } from 'react'
import type { Screen } from './types'
import { StudioProvider, useStudio, type StudioUser } from './context'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Dashboard from './Dashboard'
import { PagesList, PageEditor } from './Pages'
import { ProjectsList, ProjectEditor } from './Projects'
import { NewsList, NewsEditor } from './News'
import { ServicesList, ServiceEditor } from './Services'
import { VacanciesList, VacancyEditor } from './Vacancies'
import Media from './Media'
import NavEditor from './NavEditor'
import Contacts from './Contacts'
import SiteSettings from './SiteSettings'
import Users from './Users'

const EDITOR_SCREENS: Screen[] = ['page-editor', 'project-editor', 'news-editor', 'service-editor', 'vacancy-editor']

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
  vacancies: 'Vacancies',
  'vacancy-editor': 'Vacancy Editor',
  media: 'Media',
  navigation: 'Navigation',
  contacts: 'Contacts',
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

export default function Studio({ siteId, user }: { siteId: string; user?: any }) {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [editingId, setEditingId] = useState<string | null>(null)

  const navigate = (s: Screen, id?: string) => {
    setScreen(s)
    setEditingId(id ?? null)
    const el = document.getElementById('cms-main')
    if (el) el.scrollTop = 0
  }

  const isEditor = EDITOR_SCREENS.includes(screen)
  const isFullHeight = isEditor || screen === 'media'

  return (
    <StudioProvider siteId={siteId} user={(user ?? null) as StudioUser | null}>
      <StudioInner screen={screen} />
      <div className="flex h-full bg-bg overflow-hidden">
        <Sidebar current={screen} onNavigate={navigate} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar onNavigate={navigate} />

          <main
            id="cms-main"
            className={`flex-1 ${isFullHeight ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
          >
            {screen === 'dashboard' && <Dashboard onNavigate={navigate} />}

            {screen === 'pages' && <PagesList onNavigate={navigate} />}
            {screen === 'page-editor' && <PageEditor pageId={editingId} onNavigate={navigate} />}

            {screen === 'projects' && <ProjectsList onNavigate={navigate} />}
            {screen === 'project-editor' && <ProjectEditor projectId={editingId} onNavigate={navigate} />}

            {screen === 'news' && <NewsList onNavigate={navigate} />}
            {screen === 'news-editor' && <NewsEditor newsId={editingId} onNavigate={navigate} />}

            {screen === 'services' && <ServicesList onNavigate={navigate} />}
            {screen === 'service-editor' && <ServiceEditor serviceId={editingId} onNavigate={navigate} />}

            {screen === 'vacancies' && <VacanciesList onNavigate={navigate} />}
            {screen === 'vacancy-editor' && <VacancyEditor vacancyId={editingId} onNavigate={navigate} />}

            {screen === 'media' && <Media onNavigate={navigate} />}
            {screen === 'navigation' && <NavEditor onNavigate={navigate} />}
            {screen === 'contacts' && <Contacts onNavigate={navigate} />}
            {screen === 'site-settings' && <SiteSettings onNavigate={navigate} />}
            {screen === 'users' && <Users onNavigate={navigate} />}
          </main>
        </div>
      </div>
    </StudioProvider>
  )
}
