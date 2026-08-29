import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, type StudioUser, type PubStatus, uiStatus } from './api';

export type { StudioUser } from './api';

export interface StudioData {
  siteId: string;
  site: any;
  settings: any;
  pages: any[];
  news: any[];
  projects: any[];
  services: any[];
  media: any[];
  menu: any[];
  vacancies: any[];
  users: any[];
  user: StudioUser | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const StudioContext = createContext<StudioData | null>(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}

export function formatDate(d?: string | Date | null) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatBytes(b?: number) {
  if (b == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = b;
  while (size > 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function siteRole(user: StudioUser | null, siteUsers: any[]): StudioData['role'] {
  if (user?.globalRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  const su = siteUsers.find((s: any) => s.userId === user?.id);
  if (su?.role === 'ADMIN') return 'ADMIN';
  return 'EDITOR';
}

export function StudioProvider({ siteId, user, children }: { siteId: string; user: StudioUser | null; children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [pages, setPages] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSite(siteId);
      setSite(data.site);
      setSettings(data.site?.siteSettings || {});
      setPages(data.pages || []);
      setNews(data.news || []);
      setProjects(data.projects || []);
      setServices(data.services || []);
      setMedia(data.media || []);
      setMenu(data.menu || []);
      setVacancies(data.vacancies || []);
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load site');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const role = siteRole(user, users);

  const value: StudioData = {
    siteId, site, settings, pages, news, projects, services, media, menu, vacancies, users,
    user, role, loading, error, refresh: load
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
