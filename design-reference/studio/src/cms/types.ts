export type Screen =
  | 'dashboard'
  | 'pages'
  | 'page-editor'
  | 'projects'
  | 'project-editor'
  | 'news'
  | 'news-editor'
  | 'services'
  | 'service-editor'
  | 'vacancies'
  | 'vacancy-editor'
  | 'media'
  | 'navigation'
  | 'contacts'
  | 'site-settings'
  | 'users'

export type UserRole = 'super_admin' | 'site_admin' | 'editor'

export type ProductArea = 'hub' | 'radar' | 'factory' | 'forge' | 'studio'

export type PubStatus = 'published' | 'draft' | 'archived'

export interface SiteContext {
  id: string
  name: string
  domain: string
  initials: string
}

export interface NavProps {
  onNavigate: (screen: Screen, id?: string) => void
  editingId?: string | null
}
