import { useState } from 'react'
import { Screen } from './cms/types'
import Sidebar from './cms/Sidebar'
import TopBar from './cms/TopBar'
import Dashboard from './cms/Dashboard'
import { PagesList, PageEditor } from './cms/Pages'
import { ProjectsList, ProjectEditor } from './cms/Projects'
import { NewsList, NewsEditor } from './cms/News'
import { ServicesList, ServiceEditor } from './cms/Services'
import { VacanciesList, VacancyEditor } from './cms/Vacancies'
import Media from './cms/Media'
import NavEditor from './cms/NavEditor'
import Contacts from './cms/Contacts'
import SiteSettings from './cms/SiteSettings'
import Users from './cms/Users'

const EDITOR_SCREENS: Screen[] = ['page-editor', 'project-editor', 'news-editor', 'service-editor', 'vacancy-editor']

export default function App() {
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
    <div className="flex h-full bg-[#f4f5f7] overflow-hidden">
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
  )
}
