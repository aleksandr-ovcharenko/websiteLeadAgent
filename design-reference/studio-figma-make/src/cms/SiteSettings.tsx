import { useState } from 'react'
import { Screen } from './types'
import { Button, Input, Select, Tabs, Switch, UnsavedBar, useToast, Toast } from './ui'

const TABS = ['General', 'Brand', 'SEO', 'Domain', 'Analytics']

interface SiteSettingsProps {
  onNavigate: (s: Screen) => void
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

export default function SiteSettings({ onNavigate }: SiteSettingsProps) {
  const [tab, setTab] = useState('General')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [companyName, setCompanyName] = useState('ООО «ГАРАНТ КАЧЕСТВА»')
  const [siteTitle, setSiteTitle] = useState('ГАРАНТ КАЧЕСТВА — строительная компания')
  const [language, setLanguage] = useState('ru')
  const [timezone, setTimezone] = useState('Europe/Minsk')
  const [primaryColor, setPrimaryColor] = useState('#16a34a')
  const [accentColor, setAccentColor] = useState('#1d4ed8')
  const [seoTitle, setSeoTitle] = useState('ГАРАНТ КАЧЕСТВА — строительная компания')
  const [seoDesc, setSeoDesc] = useState('Строительная компания с опытом более 20 лет. Работаем по всей Беларуси.')
  const [domain, setDomain] = useState('garantk.by')
  const [previewUrl, setPreviewUrl] = useState('https://preview.garantk.by')
  const [ga4Id, setGa4Id] = useState('G-XXXXXXXXXX')
  const [ym, setYm] = useState('')
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)

  const { toast, show } = useToast()
  const mark = () => setDirty(true)
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); setDirty(false); show('Settings saved') }, 700) }

  const LogoUpload = ({ label }: { label: string }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-gray-600">{label}</label>
      <div className="h-16 border border-dashed border-gray-300 rounded flex items-center justify-center text-[12px] text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors">
        Click to upload
      </div>
    </div>
  )

  return (
    <div className="p-5 max-w-[680px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Site Settings</h1>
          <p className="text-[12px] text-gray-400 mt-0.5 mono">garantk.by</p>
        </div>
        <Button variant="primary" onClick={save}>Save settings</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="border-b border-gray-200">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>

        <div className="p-5">
          {tab === 'General' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Site identity">
                <Input label="Company name" value={companyName} onChange={v => { setCompanyName(v); mark() }} />
                <Input label="Site title" value={siteTitle} onChange={v => { setSiteTitle(v); mark() }} hint="Shown in browser tabs and default SEO" />
              </SettingsGroup>
              <div className="border-t border-gray-100 pt-4">
                <SettingsGroup title="Locale">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Language" value={language} onChange={v => { setLanguage(v); mark() }} options={[{value:'ru',label:'Russian'},{value:'en',label:'English'},{value:'be',label:'Belarusian'}]} />
                    <Select label="Timezone" value={timezone} onChange={v => { setTimezone(v); mark() }} options={[{value:'Europe/Minsk',label:'Europe/Minsk (UTC+3)'},{value:'Europe/Moscow',label:'Moscow (UTC+3)'},{value:'UTC',label:'UTC'}]} />
                  </div>
                </SettingsGroup>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">Template</p>
                    <p className="text-[12px] text-gray-400 mono mt-0.5">construction-modern-v1</p>
                  </div>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Read only</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'Brand' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Logo files">
                <div className="grid grid-cols-2 gap-3">
                  <LogoUpload label="Logo (dark background)" />
                  <LogoUpload label="Logo (light background)" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <LogoUpload label="Compact logo" />
                  <LogoUpload label="Favicon (32×32)" />
                </div>
              </SettingsGroup>
              <div className="border-t border-gray-100 pt-4">
                <SettingsGroup title="Brand colors">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Primary color', val: primaryColor, set: setPrimaryColor },
                      { label: 'Accent color', val: accentColor, set: setAccentColor },
                    ].map(c => (
                      <div key={c.label} className="flex flex-col gap-1">
                        <label className="text-[12px] font-medium text-gray-600">{c.label}</label>
                        <div className="flex items-center gap-2 h-[30px] border border-gray-300 rounded px-2.5">
                          <input type="color" value={c.val} onChange={e => { c.set(e.target.value); mark() }} className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent" />
                          <span className="text-[12px] mono text-gray-700">{c.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsGroup>
              </div>
            </div>
          )}

          {tab === 'SEO' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Default metadata">
                <Input label="Default SEO title" value={seoTitle} onChange={v => { setSeoTitle(v); mark() }} hint="Used when a page doesn't specify its own title" />
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-gray-600">Meta description</label>
                  <textarea value={seoDesc} onChange={e => { setSeoDesc(e.target.value); mark() }} rows={3} className="w-full border border-gray-300 rounded text-[13px] text-gray-900 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-y leading-relaxed" />
                  <p className="text-[11px] text-gray-400 text-right">{seoDesc.length}/160</p>
                </div>
              </SettingsGroup>
              <div className="border-t border-gray-100 pt-4">
                <SettingsGroup title="Open Graph image">
                  <div className="h-24 border border-dashed border-gray-300 rounded flex items-center justify-center text-[12px] text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors">
                    Upload image (1200×630px recommended)
                  </div>
                </SettingsGroup>
              </div>
            </div>
          )}

          {tab === 'Domain' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Domain configuration">
                <Input label="Primary domain" value={domain} onChange={v => { setDomain(v); mark() }} hint="Do not include https://" />
                <Input label="Preview URL" value={previewUrl} onChange={v => { setPreviewUrl(v); mark() }} />
              </SettingsGroup>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">DNS records</p>
                <div className="bg-gray-50 border border-gray-200 rounded p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[12px] font-medium text-gray-700">DNS status</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Connected
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {[{type:'A', name:'@', value:'185.189.94.50'},{type:'CNAME', name:'www', value:'garantk.by'}].map(r => (
                      <div key={r.name} className="grid grid-cols-[40px_60px_1fr] gap-3 text-[12px] mono text-gray-600">
                        <span className="text-gray-400">{r.type}</span>
                        <span>{r.name}</span>
                        <span>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'Analytics' && (
            <div className="flex flex-col gap-5">
              <Switch checked={analyticsEnabled} onChange={v => { setAnalyticsEnabled(v); mark() }} label="Enable analytics tracking" />
              <div className={`flex flex-col gap-3.5 ${!analyticsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <SettingsGroup title="Tracking codes">
                  <Input label="Google Analytics 4 (Measurement ID)" value={ga4Id} onChange={v => { setGa4Id(v); mark() }} placeholder="G-XXXXXXXXXX" />
                  <Input label="Yandex Metrica (counter ID)" value={ym} onChange={v => { setYm(v); mark() }} placeholder="12345678" />
                </SettingsGroup>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-[12px] text-amber-700">Analytics runs only on the production domain — not on preview URLs.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <UnsavedBar dirty={dirty} saving={saving} onSave={save} />
      <Toast toast={toast} />
    </div>
  )
}
