import { Screen } from './types'
import { IconExternal, IconPlus, IconChevronRight } from './icons'
import { Badge } from './ui'

interface DashboardProps {
  onNavigate: (s: Screen) => void
}

const CONTENT_COUNTS = [
  { label: 'Pages', count: 8, screen: 'pages' as Screen },
  { label: 'Projects', count: 14, screen: 'projects' as Screen },
  { label: 'News', count: 6, screen: 'news' as Screen },
  { label: 'Services', count: 8, screen: 'services' as Screen },
  { label: 'Vacancies', count: 2, screen: 'vacancies' as Screen },
  { label: 'Media files', count: 74, screen: 'media' as Screen },
]

const RECENT = [
  { content: 'Производственный комплекс', type: 'Project', status: 'published' as const, updated: 'Today, 14:32', user: 'Admin' },
  { content: 'Новости компании', type: 'News', status: 'draft' as const, updated: 'Yesterday, 18:10', user: 'Editor' },
  { content: 'О компании', type: 'Page', status: 'published' as const, updated: 'Yesterday, 11:45', user: 'Admin' },
  { content: 'Земляные работы', type: 'Service', status: 'published' as const, updated: '22 Aug, 09:20', user: 'Admin' },
  { content: 'Геодезические работы', type: 'Service', status: 'draft' as const, updated: '21 Aug, 16:00', user: 'Editor' },
  { content: 'Открытие нового офиса в Бресте', type: 'News', status: 'published' as const, updated: '10 Aug, 14:00', user: 'Admin' },
]

const QUICK_ACTIONS: { label: string; screen: Screen }[] = [
  { label: 'Новая страница', screen: 'page-editor' },
  { label: 'Новость', screen: 'news-editor' },
  { label: 'Новый объект', screen: 'project-editor' },
  { label: 'Загрузить медиа', screen: 'media' },
]

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="p-5 max-w-[1100px]">
      {/* Page title */}
      <div className="mb-4">
        <h1 className="text-[15px] font-semibold text-gray-900">Dashboard</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Обзор сайта «ГАРАНТ КАЧЕСТВА»</p>
      </div>

      {/* Site status strip — single compact row */}
      <div className="bg-white border border-gray-200 rounded flex items-center gap-0 mb-4 overflow-hidden divide-x divide-gray-100">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-[12px] text-gray-500">Status</span>
          <span className="text-[13px] font-semibold text-gray-900">Active</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-[12px] text-gray-400">Template</span>
          <span className="text-[12px] font-medium text-gray-700 mono">construction-modern-v1</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-[12px] text-gray-400">Domain</span>
          <span className="text-[12px] font-medium text-gray-700 mono">garantk.by</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-[12px] text-gray-400">Last deploy</span>
          <span className="text-[12px] font-medium text-gray-700">Today, 14:35</span>
        </div>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-[#16a34a] hover:bg-emerald-50 transition-colors font-medium">
          <IconExternal size={12} />
          Open preview
        </button>
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-4 min-w-0">

          {/* Content overview + recent in one white surface */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            {/* Content counts — compact table */}
            <div className="border-b border-gray-100 grid grid-cols-6 divide-x divide-gray-100">
              {CONTENT_COUNTS.map(item => (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.screen)}
                  className="flex flex-col items-start px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-[22px] font-bold text-gray-900 tabular-nums leading-none">{item.count}</span>
                  <span className="text-[11px] text-gray-400 mt-1 group-hover:text-[#16a34a] transition-colors">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Recent activity */}
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Последние изменения</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Content', 'Type', 'Status', 'Updated', 'User'].map(col => (
                    <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50/60 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition-colors">
                    <td className="px-4 py-2">
                      <span className="text-[13px] font-medium text-gray-800">{row.content}</span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-gray-400">{row.type}</td>
                    <td className="px-4 py-2"><Badge variant={row.status} /></td>
                    <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{row.updated}</td>
                    <td className="px-4 py-2 text-[12px] text-gray-400">{row.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Quick actions */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Create</p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.screen)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 hover:text-[#16a34a] transition-colors text-left group"
                >
                  <IconPlus size={12} className="text-gray-400 group-hover:text-[#16a34a] transition-colors flex-shrink-0" />
                  {action.label}
                  <IconChevronRight size={12} className="ml-auto text-gray-300 group-hover:text-[#16a34a] transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Site info */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Site info</p>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              {[
                { label: 'Client', value: 'ООО «ГАРАНТ КАЧЕСТВА»' },
                { label: 'Industry', value: 'Construction' },
                { label: 'Created', value: '12 Jan 2024' },
                { label: 'Last deploy', value: 'Today, 14:35' },
                { label: 'Pages', value: '8 published' },
              ].map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{row.label}</span>
                  <span className="text-[12px] text-gray-700 font-medium text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
