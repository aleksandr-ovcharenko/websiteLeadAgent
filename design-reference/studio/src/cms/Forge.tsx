import { ProductArea, SiteContext } from './types'
import { IconExternal, IconEdit } from './icons'
import { Button } from './ui'

// ─── Mock data ────────────────────────────────────────────────────────────────

interface ForgeSite {
  id: string
  company: string
  domain: string
  initials: string
  generated: string
  pages: number
  status: 'active' | 'preview'
  runNumber: number
}

const FORGE_SITES: ForgeSite[] = [
  { id: '1', company: 'ГАРАНТ КАЧЕСТВА', domain: 'garantk.by', initials: 'ГК', generated: '29 Aug 2026', pages: 12, status: 'active', runNumber: 42 },
  { id: '2', company: 'Строй Инвест', domain: 'stroyinvest.by', initials: 'СИ', generated: '26 Aug 2026', pages: 9, status: 'active', runNumber: 41 },
  { id: '3', company: 'ТехноСтрой', domain: 'technostroy.by', initials: 'ТС', generated: '24 Aug 2026', pages: 7, status: 'preview', runNumber: 39 },
  { id: '4', company: 'РеноМастер', domain: 'reno-master.by', initials: 'РМ', generated: '21 Aug 2026', pages: 11, status: 'active', runNumber: 35 },
  { id: '5', company: 'КвартирРем', domain: '—', initials: 'КР', generated: '19 Aug 2026', pages: 8, status: 'preview', runNumber: 33 },
  { id: '6', company: 'ОтделкаПлюс', domain: 'otdelka-plus.by', initials: 'ОП', generated: '17 Aug 2026', pages: 10, status: 'active', runNumber: 31 },
  { id: '7', company: 'БелСтройГрупп', domain: 'bsg.by', initials: 'БС', generated: '14 Aug 2026', pages: 14, status: 'active', runNumber: 28 },
  { id: '8', company: 'ГеоСервис', domain: 'geoservice.by', initials: 'ГС', generated: '12 Aug 2026', pages: 6, status: 'preview', runNumber: 25 },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface ForgeProps {
  onNavigate: (area: ProductArea, siteId?: string) => void
  onEnterStudio: (site: SiteContext) => void
}

export default function Forge({ onNavigate, onEnterStudio }: ForgeProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7]">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 h-[46px] flex items-center gap-3">
        <span className="text-[13px] font-semibold text-gray-900">Forge</span>
        <span className="text-[12px] text-gray-400">Generated websites</span>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[12px] text-gray-400">
          <span>{FORGE_SITES.length} sites total</span>
          <span>·</span>
          <span className="text-emerald-600 font-medium">{FORGE_SITES.filter(s => s.status === 'active').length} active</span>
        </div>
      </div>

      {/* Site table */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[1060px]">
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Site', 'Domain', 'Pages', 'Status', 'Generated', 'Factory run', 'Actions'].map(col => (
                    <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FORGE_SITES.map(site => (
                  <tr key={site.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-[4px] bg-[#1a2332]/5 border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-gray-600">{site.initials}</span>
                        </div>
                        <span className="text-[13px] font-medium text-gray-900">{site.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {site.domain !== '—' ? (
                        <span className="flex items-center gap-1 text-[12px] text-gray-400 mono hover:text-[#16a34a] cursor-pointer transition-colors">
                          {site.domain}
                          <IconExternal size={10} />
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-300">No domain</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-500">{site.pages}</td>
                    <td className="px-4 py-2.5">
                      {site.status === 'active' ? (
                        <span className="flex items-center gap-1.5 text-[12px] text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                          Preview
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-400 whitespace-nowrap">{site.generated}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => onNavigate('factory')}
                        className="text-[12px] text-gray-400 mono hover:text-[#16a34a] transition-colors"
                      >
                        #{site.runNumber}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEnterStudio({
                            id: site.id,
                            name: site.company,
                            domain: site.domain !== '—' ? site.domain : site.company.toLowerCase().replace(/ /g, '') + '.by',
                            initials: site.initials,
                          })}
                          className="flex items-center gap-1.5 h-[24px] px-2.5 rounded border border-gray-200 text-[11px] font-medium text-gray-700 hover:border-[#16a34a] hover:text-[#16a34a] hover:bg-emerald-50/20 transition-colors"
                        >
                          <IconEdit size={10} />
                          Studio
                        </button>
                        <button className="flex items-center gap-1.5 h-[24px] px-2.5 rounded border border-gray-200 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors">
                          <IconExternal size={10} />
                          Showcase
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
