import { useState } from 'react'
import { Screen } from './types'
import { IconPlus, IconTrash } from './icons'
import { Button, Input, Textarea, UnsavedBar, useToast, Toast } from './ui'

interface Department { id: string; name: string; phones: string[]; email: string }

interface ContactsProps {
  onNavigate: (s: Screen) => void
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-4 flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

export default function Contacts({ onNavigate }: ContactsProps) {
  const [companyName, setCompanyName] = useState('ООО «ГАРАНТ КАЧЕСТВА»')
  const [address, setAddress] = useState('220075, г. Минск, ул. Промышленная, 12')
  const [hours, setHours] = useState('Пн–Пт: 9:00–18:00, Сб: 10:00–15:00')
  const [receptionPhones, setReceptionPhones] = useState(['+375 17 200-10-20', '+375 29 123-45-67'])
  const [receptionEmail, setReceptionEmail] = useState('info@garantk.by')
  const [procPhones, setProcPhones] = useState(['+375 17 200-10-25'])
  const [procEmail, setProcEmail] = useState('tender@garantk.by')
  const [tenderEmail, setTenderEmail] = useState('zakupki@garantk.by')
  const [departments, setDepartments] = useState<Department[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast, show } = useToast()

  const mark = () => setDirty(true)
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); setDirty(false); show('Contacts saved') }, 700) }

  const PhoneList = ({ phones, setter }: { phones: string[]; setter: (p: string[]) => void }) => (
    <div className="flex flex-col gap-1.5">
      {phones.map((phone, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={phone}
            onChange={e => { const n=[...phones]; n[i]=e.target.value; setter(n); mark() }}
            placeholder="+375 __ ___-__-__"
            className="h-[30px] flex-1 border border-gray-300 rounded text-[13px] text-gray-900 placeholder-gray-400 px-2.5 focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] mono"
          />
          {phones.length > 1 && (
            <button onClick={() => { setter(phones.filter((_,j)=>j!==i)); mark() }} className="w-7 h-[30px] flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
              <IconTrash size={12} />
            </button>
          )}
        </div>
      ))}
      <button onClick={() => { setter([...phones, '']); mark() }} className="self-start flex items-center gap-1 text-[11px] text-[#16a34a] hover:text-[#15803d] transition-colors mt-0.5">
        <IconPlus size={10} />
        Add phone
      </button>
    </div>
  )

  return (
    <div className="p-5 max-w-[660px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Contacts</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Company contact information</p>
        </div>
        <Button variant="primary" onClick={save}>Save contacts</Button>
      </div>

      <div className="flex flex-col gap-3">
        <SectionBlock title="General">
          <Input label="Company name" value={companyName} onChange={v => { setCompanyName(v); mark() }} />
          <Textarea label="Address" value={address} onChange={v => { setAddress(v); mark() }} rows={2} />
          <Input label="Working hours" value={hours} onChange={v => { setHours(v); mark() }} />
        </SectionBlock>

        <SectionBlock title="Reception">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-gray-600">Phones</label>
            <PhoneList phones={receptionPhones} setter={setReceptionPhones} />
          </div>
          <Input label="Email" type="email" value={receptionEmail} onChange={v => { setReceptionEmail(v); mark() }} />
        </SectionBlock>

        <SectionBlock title="Procurement department">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-gray-600">Phones</label>
            <PhoneList phones={procPhones} setter={setProcPhones} />
          </div>
          <Input label="Email" type="email" value={procEmail} onChange={v => { setProcEmail(v); mark() }} />
        </SectionBlock>

        <SectionBlock title="Tender contact">
          <Input label="Email" type="email" value={tenderEmail} onChange={v => { setTenderEmail(v); mark() }} />
        </SectionBlock>

        {departments.map((dept, di) => (
          <SectionBlock key={dept.id} title={dept.name || 'New department'}>
            <div className="flex items-center justify-between mb-1">
              <span />
              <button onClick={() => { setDepartments(d => d.filter(x => x.id !== dept.id)); mark() }} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <IconTrash size={11} />
                Remove
              </button>
            </div>
            <Input label="Department name" value={dept.name} onChange={v => { setDepartments(d => d.map((x,i)=>i===di?{...x,name:v}:x)); mark() }} />
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-gray-600">Phones</label>
              <PhoneList phones={dept.phones} setter={phones => { setDepartments(d => d.map((x,i)=>i===di?{...x,phones}:x)) }} />
            </div>
            <Input label="Email" type="email" value={dept.email} onChange={v => { setDepartments(d => d.map((x,i)=>i===di?{...x,email:v}:x)); mark() }} />
          </SectionBlock>
        ))}

        <button
          onClick={() => { setDepartments(d => [...d, { id: `dept-${Date.now()}`, name: '', phones: [''], email: '' }]); mark() }}
          className="flex items-center justify-center gap-2 h-9 rounded border border-dashed border-gray-300 text-[12px] text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] hover:bg-emerald-50/30 transition-colors"
        >
          <IconPlus size={12} />
          Add department
        </button>
      </div>

      <UnsavedBar dirty={dirty} saving={saving} onSave={save} />
      <Toast toast={toast} />
    </div>
  )
}
