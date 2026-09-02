import { useState } from 'react'
import { Screen, ProductArea, UserRole, SiteContext } from './cms/types'
import ProductHeader from './cms/ProductHeader'
import Sidebar from './cms/Sidebar'
import Hub from './cms/Hub'
import Radar from './cms/Radar'
import Factory from './cms/Factory'
import Forge from './cms/Forge'
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

const ALL_SITES: SiteContext[] = [
  { id: '1', name: 'ГАРАНТ КАЧЕСТВА', domain: 'garantk.by', initials: 'ГК' },
  { id: '2', name: 'Строй Инвест', domain: 'stroyinvest.by', initials: 'СИ' },
  { id: '3', name: 'МеталлСтрой', domain: 'metalstroy.by', initials: 'МС' },
]

const ROLE_CYCLE: UserRole[] = ['super_admin', 'site_admin', 'editor']

export default function App() {
  // Level 1 — product area
  const [productArea, setProductArea] = useState<ProductArea>('hub')

  // Level 2 — Studio internal screen
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Shared state
  const [currentSite, setCurrentSite] = useState<SiteContext>(ALL_SITES[0])
  const [userRole, setUserRole] = useState<UserRole>('super_admin')

  // Navigate between product areas; optionally set active site (Forge → Studio)
  const navigateArea = (area: ProductArea, site?: SiteContext) => {
    // Non-super-admin users stay in Studio
    if (userRole !== 'super_admin' && area !== 'studio') return
    setProductArea(area)
    if (area === 'studio') {
      if (site) setCurrentSite(site)
      setScreen('dashboard')
      setEditingId(null)
    }
  }

  // Navigate within Studio
  const navigate = (s: Screen, id?: string) => {
    setScreen(s)
    setEditingId(id ?? null)
    const el = document.getElementById('cms-main')
    if (el) el.scrollTop = 0
  }

  const toggleRole = () => {
    setUserRole(r => {
      const next = ROLE_CYCLE[(ROLE_CYCLE.indexOf(r) + 1) % ROLE_CYCLE.length]
      // Non-super-admin always land in Studio
      if (next !== 'super_admin') setProductArea('studio')
      return next
    })
  }

  const isEditor = EDITOR_SCREENS.includes(screen)
  const isFullHeight = isEditor || screen === 'media'

  return (
    <div className="flex flex-col h-full bg-[#f4f5f7] overflow-hidden">
      {/* Level 1 — WLA product header */}
      <ProductHeader
        productArea={productArea}
        currentSite={currentSite}
        availableSites={ALL_SITES}
        userRole={userRole}
        onNavigate={navigateArea}
        onSiteChange={setCurrentSite}
        onRoleToggle={toggleRole}
      />

      {/* Level 1 — product area routing */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {productArea === 'hub' && (
          <Hub onNavigate={area => navigateArea(area)} />
        )}

        {productArea === 'radar' && (
          <Radar onNavigate={area => navigateArea(area)} />
        )}

        {productArea === 'factory' && (
          <Factory onNavigate={area => navigateArea(area)} />
        )}

        {productArea === 'forge' && (
          <Forge
            onNavigate={area => navigateArea(area)}
            onEnterStudio={site => navigateArea('studio', site)}
          />
        )}

        {/* Level 2 — Studio */}
        {productArea === 'studio' && (
          <>
            <Sidebar current={screen} onNavigate={navigate} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <main
                id="cms-main"
                className={`flex-1 ${isFullHeight ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
              >
                {screen === 'dashboard'      && <Dashboard onNavigate={navigate} />}
                {screen === 'pages'          && <PagesList onNavigate={navigate} />}
                {screen === 'page-editor'    && <PageEditor pageId={editingId} onNavigate={navigate} />}
                {screen === 'projects'       && <ProjectsList onNavigate={navigate} />}
                {screen === 'project-editor' && <ProjectEditor projectId={editingId} onNavigate={navigate} />}
                {screen === 'news'           && <NewsList onNavigate={navigate} />}
                {screen === 'news-editor'    && <NewsEditor newsId={editingId} onNavigate={navigate} />}
                {screen === 'services'       && <ServicesList onNavigate={navigate} />}
                {screen === 'service-editor' && <ServiceEditor serviceId={editingId} onNavigate={navigate} />}
                {screen === 'vacancies'      && <VacanciesList onNavigate={navigate} />}
                {screen === 'vacancy-editor' && <VacancyEditor vacancyId={editingId} onNavigate={navigate} />}
                {screen === 'media'          && <Media onNavigate={navigate} />}
                {screen === 'navigation'     && <NavEditor onNavigate={navigate} />}
                {screen === 'contacts'       && <Contacts onNavigate={navigate} />}
                {screen === 'site-settings'  && <SiteSettings onNavigate={navigate} />}
                {screen === 'users'          && <Users onNavigate={navigate} />}
              </main>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
