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

export type PubStatus = 'published' | 'draft' | 'archived'
export type UserRole = 'Admin' | 'Editor'

export interface NavProps {
  onNavigate: (screen: Screen, id?: string) => void
  editingId?: string | null
}
