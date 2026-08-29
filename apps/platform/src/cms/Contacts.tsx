import { useState, useEffect } from 'react'
import { Screen } from './types'
import { useStudio } from './context'
import { api } from './api'
import { Input, Button, useToast, Toast } from './ui'

interface ContactsProps {
  onNavigate: (s: Screen) => void
}

interface ContactSection {
  label?: string
  value?: string
}

interface ContactsData {
  address?: string
  phone?: string
  email?: string
  workingHours?: string
  reception?: ContactSection
  procurement?: ContactSection
  tender?: ContactSection
  departments?: { name?: string; phone?: string; email?: string }[]
}

export default function Contacts({ onNavigate }: ContactsProps) {
  const { siteId, settings, refresh } = useStudio()
  const [data, setData] = useState<ContactsData>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { toast, show } = useToast()

  useEffect(() => {
    const contacts = typeof settings?.contacts === 'string' ? JSON.parse(settings.contacts) : settings?.contacts || {}
    setData(contacts)
  }, [settings])

  const patch = (partial: ContactsData) => { setData(d => ({ ...d, ...partial })); setDirty(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveSettings(siteId, { contacts: data })
      await refresh()
      setDirty(false); show('Contacts saved')
    } catch (e: any) { show(e.message || 'Failed to save') }
    setSaving(false)
  }

  return (
    <div className="p-5 max-w-[680px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Contacts</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Edit phone, email, address and departments</p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save contacts'}</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Address" value={data.address || ''} onChange={v => patch({ address: v })} />
          <Input label="Working hours" value={data.workingHours || ''} onChange={v => patch({ workingHours: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={data.phone || ''} onChange={v => patch({ phone: v })} />
          <Input label="Email" value={data.email || ''} onChange={v => patch({ email: v })} />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Departments</p>
          <div className="flex flex-col gap-3">
            {(data.departments || []).map((dept, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 items-end">
                <Input label="Name" value={dept.name || ''} onChange={v => { const d = [...(data.departments || [])]; d[i] = { ...dept, name: v }; patch({ departments: d }) }} />
                <Input label="Phone" value={dept.phone || ''} onChange={v => { const d = [...(data.departments || [])]; d[i] = { ...dept, phone: v }; patch({ departments: d }) }} />
                <div className="flex items-center gap-2">
                  <Input label="Email" value={dept.email || ''} onChange={v => { const d = [...(data.departments || [])]; d[i] = { ...dept, email: v }; patch({ departments: d }) }} />
                  <button onClick={() => { const d = [...(data.departments || [])]; d.splice(i, 1); patch({ departments: d }) }} className="text-red-500 text-[12px] mb-2">Remove</button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => patch({ departments: [...(data.departments || []), { name: '', phone: '', email: '' }] })}>Add department</Button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Sections</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Reception label" value={data.reception?.label || ''} onChange={v => patch({ reception: { ...data.reception, label: v } })} />
            <Input label="Reception value" value={data.reception?.value || ''} onChange={v => patch({ reception: { ...data.reception, value: v } })} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Input label="Procurement label" value={data.procurement?.label || ''} onChange={v => patch({ procurement: { ...data.procurement, label: v } })} />
            <Input label="Procurement value" value={data.procurement?.value || ''} onChange={v => patch({ procurement: { ...data.procurement, value: v } })} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Input label="Tender label" value={data.tender?.label || ''} onChange={v => patch({ tender: { ...data.tender, label: v } })} />
            <Input label="Tender value" value={data.tender?.value || ''} onChange={v => patch({ tender: { ...data.tender, value: v } })} />
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
