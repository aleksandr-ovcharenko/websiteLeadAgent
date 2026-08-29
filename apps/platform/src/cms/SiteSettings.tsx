import { useState, useEffect } from 'react'
import { Screen } from './types'
import { useStudio } from './context'
import { api } from './api'
import { Button, Input, Select, Tabs, Switch, UnsavedBar, useToast, Toast } from './ui'

interface SiteSettingsProps {
  onNavigate: (s: Screen) => void
}

export default function SiteSettings({ onNavigate }: SiteSettingsProps) {
  const { siteId, site, settings, refresh } = useStudio()
  const [tab, setTab] = useState('General')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const { toast, show } = useToast()

  useEffect(() => {
    const contacts = typeof settings?.contacts === 'string' ? JSON.parse(settings.contacts) : settings?.contacts || {}
    setForm({
      companyName: settings?.companyName || '',
      siteTitle: settings?.siteTitle || '',
      language: settings?.language || 'ru',
      timezone: settings?.timezone || 'Europe/Minsk',
      primaryColor: settings?.primaryColor || '#16a34a',
      accentColor: settings?.accentColor || '#1d4ed8',
      seoTitle: settings?.seoTitle || '',
      seoDescription: settings?.seoDescription || '',
      domain: site?.domain || '',
      previewUrl: settings?.previewUrl || '',
      ga4Id: settings?.analytics?.ga4Id || '',
      ym: settings?.analytics?.ym || '',
      analyticsEnabled: settings?.analyticsEnabled || false,
      address: contacts.address || '',
      phone: contacts.phone || '',
      email: contacts.email || '',
      workingHours: contacts.workingHours || '',
    })
  }, [settings, site])

  const mark = () => setDirty(true)
  const update = (patch: Record<string, any>) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }

  const save = async () => {
    setSaving(true)
    const contacts = {
      address: form.address,
      phone: form.phone,
      email: form.email,
      workingHours: form.workingHours,
    }
    const payload = {
      companyName: form.companyName,
      siteTitle: form.siteTitle,
      language: form.language,
      timezone: form.timezone,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      domain: form.domain,
      previewUrl: form.previewUrl,
      contacts,
      analyticsEnabled: form.analyticsEnabled,
      analytics: { ga4Id: form.ga4Id, ym: form.ym },
    }
    try {
      await api.saveSettings(siteId, payload)
      await refresh()
      setDirty(false); show('Settings saved')
    } catch (e: any) { show(e.message || 'Failed to save') }
    setSaving(false)
  }

  const TABS = ['General', 'Brand', 'SEO', 'Domain', 'Analytics']

  const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  )

  return (
    <div className="p-5 max-w-[680px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Site Settings</h1>
          <p className="text-[12px] text-gray-400 mt-0.5 mono">{site?.domain || '—'}</p>
        </div>
        <Button variant="primary" onClick={save}>Save settings</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="border-b border-gray-200"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>

        <div className="p-5">
          {tab === 'General' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Site identity">
                <Input label="Company name" value={form.companyName || ''} onChange={v => update({ companyName: v })} />
                <Input label="Site title" value={form.siteTitle || ''} onChange={v => update({ siteTitle: v })} hint="Shown in browser tabs and default SEO" />
              </SettingsGroup>
              <div className="border-t border-gray-100 pt-4">
                <SettingsGroup title="Locale">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Language" value={form.language || 'ru'} onChange={v => update({ language: v })} options={[{ value: 'ru', label: 'Russian' }, { value: 'en', label: 'English' }, { value: 'be', label: 'Belarusian' }]} />
                    <Select label="Timezone" value={form.timezone || 'Europe/Minsk'} onChange={v => update({ timezone: v })} options={[{ value: 'Europe/Minsk', label: 'Europe/Minsk (UTC+3)' }, { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' }, { value: 'UTC', label: 'UTC' }]} />
                  </div>
                </SettingsGroup>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">Template</p>
                    <p className="text-[12px] text-gray-400 mono mt-0.5">{site?.templateId || '—'}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Read only</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'Brand' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Brand colors">
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Primary color', key: 'primaryColor' }, { label: 'Accent color', key: 'accentColor' }].map(c => (
                    <div key={c.key} className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-gray-600">{c.label}</label>
                      <div className="flex items-center gap-2 h-[30px] border border-gray-300 rounded px-2.5">
                        <input type="color" value={form[c.key] || '#000000'} onChange={e => update({ [c.key]: e.target.value })} className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-[12px] mono text-gray-700">{form[c.key] || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsGroup>
            </div>
          )}

          {tab === 'SEO' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Default metadata">
                <Input label="Default SEO title" value={form.seoTitle || ''} onChange={v => update({ seoTitle: v })} hint="Used when a page doesn't specify its own title" />
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-gray-600">Meta description</label>
                  <textarea value={form.seoDescription || ''} onChange={e => update({ seoDescription: e.target.value })} rows={3} className="w-full border border-gray-300 rounded text-[13px] text-gray-900 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-y leading-relaxed" />
                  <p className="text-[11px] text-gray-400 text-right">{(form.seoDescription || '').length}/160</p>
                </div>
              </SettingsGroup>
            </div>
          )}

          {tab === 'Domain' && (
            <div className="flex flex-col gap-5">
              <SettingsGroup title="Domain configuration">
                <Input label="Primary domain" value={form.domain || ''} onChange={v => update({ domain: v })} hint="Do not include https://" />
                <Input label="Preview URL" value={form.previewUrl || ''} onChange={v => update({ previewUrl: v })} />
              </SettingsGroup>
            </div>
          )}

          {tab === 'Analytics' && (
            <div className="flex flex-col gap-5">
              <Switch checked={!!form.analyticsEnabled} onChange={v => update({ analyticsEnabled: v })} label="Enable analytics tracking" />
              <div className={`flex flex-col gap-3.5 ${!form.analyticsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <SettingsGroup title="Tracking codes">
                  <Input label="Google Analytics 4 (Measurement ID)" value={form.ga4Id || ''} onChange={v => update({ ga4Id: v })} placeholder="G-XXXXXXXXXX" />
                  <Input label="Yandex Metrica (counter ID)" value={form.ym || ''} onChange={v => update({ ym: v })} placeholder="12345678" />
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
