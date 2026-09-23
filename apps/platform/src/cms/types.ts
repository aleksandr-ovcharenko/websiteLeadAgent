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
  | 'products'
  | 'product-editor'
  | 'vacancies'
  | 'vacancy-editor'
  | 'media'
  | 'navigation'
  | 'contacts'
  | 'versions'
  | 'site-settings'
  | 'users'

export type PubStatus = 'published' | 'draft' | 'archived'
export type UserRole = 'Admin' | 'Editor'

export interface NavigateOpts {
  /** Screen the editor's Back control returns to (e.g. 'dashboard' from Recent changes). */
  returnTo?: Screen
}

export type Navigate = (screen: Screen, id?: string, opts?: NavigateOpts) => void

export interface NavProps {
  onNavigate: Navigate
  editingId?: string | null
}
