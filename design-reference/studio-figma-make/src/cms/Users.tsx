import { useState } from 'react'
import { Screen } from './types'
import { IconPlus, IconMore, IconEdit, IconTrash } from './icons'
import { Button, DropdownMenu, Modal, Input, Select, useToast, Toast, Toolbar } from './ui'

interface UserItem {
  id: string; name: string; email: string; role: 'Admin' | 'Editor'; status: 'active' | 'inactive'; lastLogin: string
}

const USERS_DATA: UserItem[] = [
  { id: '1', name: 'Иван Петров', email: 'ivan@garantk.by', role: 'Admin', status: 'active', lastLogin: 'Today, 14:32' },
  { id: '2', name: 'Мария Сидорова', email: 'maria@garantk.by', role: 'Editor', status: 'active', lastLogin: 'Yesterday, 10:15' },
  { id: '3', name: 'Алексей Новиков', email: 'alexey@garantk.by', role: 'Editor', status: 'inactive', lastLogin: '10 Aug' },
]

interface UsersProps {
  onNavigate: (s: Screen) => void
}

export default function Users({ onNavigate }: UsersProps) {
  const [users, setUsers] = useState(USERS_DATA)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Editor')
  const { toast, show } = useToast()

  const handleInvite = () => {
    if (!inviteEmail) return
    show(`Invitation sent to ${inviteEmail}`)
    setInviteEmail('')
    setInviteOpen(false)
  }

  const toggleStatus = (id: string) => setUsers(u => u.map(x => x.id === id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x))
  const changeRole = (id: string) => setUsers(u => u.map(x => x.id === id ? { ...x, role: x.role === 'Admin' ? 'Editor' : 'Admin' } : x))
  const removeUser = (id: string) => setUsers(u => u.filter(x => x.id !== id))

  return (
    <div className="p-5 max-w-[820px]">
      <Toolbar
        title="Users"
        actions={
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            <IconPlus size={12} />
            Invite user
          </Button>
        }
      />

      <div className="bg-white border border-gray-200 rounded overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['Name', 'Email', 'Role', 'Status', 'Last login', ''].map(col => (
                <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 ${user.role === 'Admin' ? 'bg-[#1a2332]' : 'bg-gray-400'}`}>
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-[13px] font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-[12px] text-gray-400 mono">{user.email}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium leading-4 ${user.role === 'Admin' ? 'bg-[#1a2332] text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`flex items-center gap-1.5 text-[12px] ${user.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${user.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {user.status === 'active' ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{user.lastLogin}</td>
                <td className="px-4 py-2 w-10 text-right">
                  <DropdownMenu
                    trigger={<button className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"><IconMore size={13} /></button>}
                    items={[
                      { label: 'Change role', icon: <IconEdit size={12} />, onClick: () => changeRole(user.id) },
                      { label: user.status === 'active' ? 'Disable access' : 'Enable access', icon: <IconEdit size={12} />, onClick: () => toggleStatus(user.id) },
                      { label: 'Remove', icon: <IconTrash size={12} />, onClick: () => removeUser(user.id), danger: true, divider: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { role: 'Admin', desc: 'Full access to all settings, content, and user management.' },
          { role: 'Editor', desc: 'Can create and edit content. Cannot change site settings or manage users.' },
        ].map(r => (
          <div key={r.role} className="bg-white border border-gray-200 rounded p-3.5">
            <p className="text-[13px] font-semibold text-gray-800 mb-1">{r.role}</p>
            <p className="text-[12px] text-gray-400 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} title="Invite user" onClose={() => setInviteOpen(false)}>
        <div className="flex flex-col gap-3.5">
          <Input label="Email address" type="email" value={inviteEmail} onChange={setInviteEmail} placeholder="colleague@company.com" />
          <Select label="Role" value={inviteRole} onChange={setInviteRole} options={[{value:'Editor',label:'Editor'},{value:'Admin',label:'Admin'}]} />
          <p className="text-[12px] text-gray-400 leading-relaxed">An invitation will be sent to this address with instructions to create an account.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleInvite}>Send invitation</Button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  )
}
