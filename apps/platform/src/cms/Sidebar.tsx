import { Screen } from './types'
import {
  IconHome, IconFile, IconNewspaper, IconBuilding, IconLayers,
  IconBriefcase, IconImage, IconMenu, IconPhone, IconSettings, IconUsers,
} from './icons'

interface SidebarProps {
  current: Screen
  onNavigate: (s: Screen) => void
}

type NavItem = { label: string; screen: Screen; icon: React.ReactNode }
type NavGroup = { section: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    section: 'Content',
    items: [
      { label: 'Pages', screen: 'pages', icon: <IconFile size={14} /> },
      { label: 'News', screen: 'news', icon: <IconNewspaper size={14} /> },
      { label: 'Projects', screen: 'projects', icon: <IconBuilding size={14} /> },
      { label: 'Services', screen: 'services', icon: <IconLayers size={14} /> },
      { label: 'Vacancies', screen: 'vacancies', icon: <IconBriefcase size={14} /> },
    ],
  },
  {
    section: 'Assets',
    items: [
      { label: 'Media', screen: 'media', icon: <IconImage size={14} /> },
    ],
  },
  {
    section: 'Site',
    items: [
      { label: 'Navigation', screen: 'navigation', icon: <IconMenu size={14} /> },
      { label: 'Contacts', screen: 'contacts', icon: <IconPhone size={14} /> },
      { label: 'Site Settings', screen: 'site-settings', icon: <IconSettings size={14} /> },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Users', screen: 'users', icon: <IconUsers size={14} /> },
    ],
  },
]

const EDITOR_SCREENS: Screen[] = ['page-editor', 'project-editor', 'news-editor', 'service-editor', 'vacancy-editor']
const PARENT: Partial<Record<Screen, Screen>> = {
  'page-editor': 'pages',
  'project-editor': 'projects',
  'news-editor': 'news',
  'service-editor': 'services',
  'vacancy-editor': 'vacancies',
}

export default function Sidebar({ current, onNavigate }: SidebarProps) {
  const activeScreen = EDITOR_SCREENS.includes(current) ? (PARENT[current] ?? current) : current

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-surface-inverse h-full overflow-y-auto border-r border-border/20">
      {/* Logo / brand */}
      <div className="px-4 py-3.5 border-b border-text-inverse/[0.06] flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-accent flex items-center justify-center flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="4" height="4" rx="0.8" fill="white" />
            <rect x="7" y="1" width="4" height="4" rx="0.8" fill="white" opacity="0.55" />
            <rect x="1" y="7" width="4" height="4" rx="0.8" fill="white" opacity="0.55" />
            <rect x="7" y="7" width="4" height="4" rx="0.8" fill="white" opacity="0.25" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-text-inverse text-[12px] font-semibold">WebsiteLeadAgent</p>
          <p className="text-text-inverse/35 text-[10px]">CMS Platform</p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="px-2.5 pt-2.5 pb-1">
        <NavBtn
          label="Dashboard"
          isActive={activeScreen === 'dashboard'}
          icon={<IconHome size={14} />}
          onClick={() => onNavigate('dashboard')}
        />
      </div>

      {/* Nav groups */}
      {NAV.map(group => (
        <div key={group.section} className="px-2.5 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-inverse/25 px-2 pt-3 pb-1.5">{group.section}</p>
          <div className="flex flex-col gap-px">
            {group.items.map(item => (
              <NavBtn
                key={item.screen}
                label={item.label}
                isActive={activeScreen === item.screen}
                icon={item.icon}
                onClick={() => onNavigate(item.screen)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex-1" />
    </aside>
  )
}

function NavBtn({ label, isActive, icon, onClick }: { label: string; isActive: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors text-left ${
        isActive
          ? 'bg-surface/[0.09] text-text-inverse'
          : 'text-text-inverse/55 hover:bg-surface/[0.05] hover:text-text-inverse/85'
      }`}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-success' : 'text-text-inverse/35'}`}>{icon}</span>
      {label}
      {isActive && <span className="ml-auto w-1 h-3 rounded-full bg-accent flex-shrink-0" />}
    </button>
  )
}
