export interface StudioUser {
  id: string;
  email: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
}

export type PubStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type UiStatus = 'published' | 'draft' | 'archived';

export function uiStatus(s?: PubStatus): UiStatus {
  if (s === 'PUBLISHED') return 'published';
  if (s === 'ARCHIVED') return 'archived';
  return 'draft';
}

export function apiStatus(s: UiStatus): PubStatus {
  if (s === 'published') return 'PUBLISHED';
  if (s === 'archived') return 'ARCHIVED';
  return 'DRAFT';
}

async function request(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, { credentials: 'include', ...init });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* no json */ }
  if (!res.ok) {
    throw new Error(json?.error || json?.message || res.statusText || `Request failed (${res.status})`);
  }
  return json;
}

export const api = {
  // Site
  getSite: (siteId: string) => request(`/api/cms/sites/${siteId}`) as Promise<any>,
  getSites: () => request('/api/cms/sites') as Promise<{ sites: any[] }>,
  getHubStats: () => request('/api/hub/stats') as Promise<any>,

  // Leads
  getLeads: (limit = 500, offset = 0) => request(`/api/leads?limit=${limit}&offset=${offset}`) as Promise<{ items: any[] }>,

  // Factory
  getFactoryRuns: () => request('/api/factory/runs') as Promise<{ runs: any[] }>,
  retryFactoryRun: (runId: string) => request(`/api/factory/runs/${runId}/retry`, { method: 'POST' }) as Promise<any>,

  // Discovery
  getDiscoveryProviders: () => request('/api/discovery/providers') as Promise<{ providers: any[] }>,
  getDiscoveryProvider: (id: string) => request(`/api/discovery/providers/${id}`) as Promise<{ provider: any }>,
  testDiscoveryProvider: (id: string) => request(`/api/discovery/providers/${id}/test`, { method: 'POST' }) as Promise<{ status: string; message: string }>,
  updateDiscoveryProviderConfig: (id: string, data: any) => request(`/api/discovery/providers/${id}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) as Promise<{ config: any }>,
  getDiscoveryPresets: () => request('/api/discovery/presets') as Promise<{ presets: any[] }>,
  createDiscoveryPreset: (data: any) => request('/api/discovery/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) as Promise<{ preset: any }>,
  updateDiscoveryPreset: (id: string, data: any) => request(`/api/discovery/presets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) as Promise<{ preset: any }>,
  deleteDiscoveryPreset: (id: string) => request(`/api/discovery/presets/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>,
  getDiscoverySettings: () => request('/api/discovery/settings') as Promise<{ settings: any }>,
  saveDiscoverySettings: (data: any) => request('/api/discovery/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) as Promise<{ settings: any }>,
  getDiscoveryRuns: (take = 50, skip = 0) => request(`/api/discovery/runs?take=${take}&skip=${skip}`) as Promise<{ items: any[]; count: number }>,
  getDiscoveryRun: (runId: string) => request(`/api/discovery/runs/${runId}`) as Promise<{ run: any }>,
  startDiscoveryRun: (data: any) => request('/api/discovery/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) as Promise<{ run: any; warning?: string }>,
  runDiscoveryAgain: (runId: string) => request(`/api/discovery/runs/${runId}/run-again`, { method: 'POST' }) as Promise<{ run: any; warning?: string }>,
  duplicateDiscoveryRun: (runId: string) => request(`/api/discovery/runs/${runId}/duplicate`) as Promise<any>,

  // Operations
  getOperationDefinitions: () => request('/api/operations/definitions') as Promise<{ operations: any[] }>,
  listOperations: (take = 50, skip = 0) => request(`/api/operations?take=${take}&skip=${skip}`) as Promise<{ items: any[]; count: number }>,
  getOperation: (runId: string) => request(`/api/operations/${runId}`) as Promise<{ run: any }>,
  getOperationEvents: (runId: string) => request(`/api/operations/${runId}/events`) as Promise<{ events: any[] }>,
  startOperation: (data: { operationId: string; input?: Record<string, any>; entityType?: string; entityId?: string; leadId?: string }) =>
    request('/api/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) as Promise<{ run: any }>,
  cancelOperation: (runId: string) => request(`/api/operations/${runId}/cancel`, { method: 'POST' }) as Promise<{ run: any }>,

  // Settings
  saveSettings: (siteId: string, data: any) => request(`/api/cms/sites/${siteId}/settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ settings: any }>,

  // Pages
  createPage: (siteId: string, data: any) => request(`/api/cms/sites/${siteId}/pages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ page: any }>,
  updatePage: (siteId: string, id: string, data: any) => request(`/api/cms/sites/${siteId}/pages/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ page: any }>,
  deletePage: (siteId: string, id: string) => request(`/api/cms/sites/${siteId}/pages/${id}`, { method: 'DELETE' }) as Promise<any>,

  // News
  createNews: (siteId: string, data: any) => request(`/api/cms/sites/${siteId}/news`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ news: any }>,
  updateNews: (siteId: string, id: string, data: any) => request(`/api/cms/sites/${siteId}/news/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ news: any }>,
  deleteNews: (siteId: string, id: string) => request(`/api/cms/sites/${siteId}/news/${id}`, { method: 'DELETE' }) as Promise<any>,

  // Projects
  createProject: (siteId: string, data: any) => request(`/api/cms/sites/${siteId}/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ project: any }>,
  updateProject: (siteId: string, id: string, data: any) => request(`/api/cms/sites/${siteId}/projects/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ project: any }>,
  deleteProject: (siteId: string, id: string) => request(`/api/cms/sites/${siteId}/projects/${id}`, { method: 'DELETE' }) as Promise<any>,

  // Services
  createService: (siteId: string, data: any) => request(`/api/cms/sites/${siteId}/services`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ service: any }>,
  updateService: (siteId: string, id: string, data: any) => request(`/api/cms/sites/${siteId}/services/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ service: any }>,
  deleteService: (siteId: string, id: string) => request(`/api/cms/sites/${siteId}/services/${id}`, { method: 'DELETE' }) as Promise<any>,

  // Vacancies
  createVacancy: (siteId: string, data: any) => request(`/api/cms/sites/${siteId}/vacancies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ vacancy: any }>,
  updateVacancy: (siteId: string, id: string, data: any) => request(`/api/cms/sites/${siteId}/vacancies/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ vacancy: any }>,
  deleteVacancy: (siteId: string, id: string) => request(`/api/cms/sites/${siteId}/vacancies/${id}`, { method: 'DELETE' }) as Promise<any>,

  // Menu
  getMenu: (siteId: string) => request(`/api/cms/sites/${siteId}/menu`) as Promise<{ items: any[] }>,
  saveMenu: (siteId: string, items: any[]) => request(`/api/cms/sites/${siteId}/menu`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items })
  }) as Promise<{ items: any[] }>,

  // Media
  getMedia: (siteId: string) => request(`/api/cms/sites/${siteId}/media`) as Promise<{ items: any[] }>,
  uploadMedia: (siteId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/api/cms/sites/${siteId}/media`, { method: 'POST', body: fd }) as Promise<{ media: any }>;
  },
  updateMedia: (siteId: string, id: string, data: { alt?: string; caption?: string }) => request(`/api/cms/sites/${siteId}/media/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ media: any }>,
  deleteMedia: (siteId: string, id: string) => request(`/api/cms/sites/${siteId}/media/${id}`, { method: 'DELETE' }) as Promise<any>,

  // Users
  getUsers: (siteId: string) => request(`/api/cms/sites/${siteId}/users`) as Promise<{ users: any[] }>,
  inviteUser: (siteId: string, data: { email: string; role: string }) => request(`/api/cms/sites/${siteId}/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ user: any }>,
  updateUser: (siteId: string, userId: string, data: { role: string }) => request(`/api/cms/sites/${siteId}/users/${userId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }) as Promise<{ user: any }>,
  deleteUser: (siteId: string, userId: string) => request(`/api/cms/sites/${siteId}/users/${userId}`, { method: 'DELETE' }) as Promise<any>,
};
