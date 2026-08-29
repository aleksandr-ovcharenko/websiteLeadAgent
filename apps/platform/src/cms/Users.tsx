import { useState } from 'react'
import { Screen } from './types'
import { IconTrash, IconPlus, IconCheck } from './icons'
import { Button, Input, useToast, Toast } from './ui'
import { useStudio, formatDate } from './context'
import { api } from './api'

interface UsersProps {
  onNavigate: (s: Screen) => void
}

const ROLES = [
  { value: 'ADMIN', label: 'Site admin' },
  { value: 'EDITOR', label: 'Editor' },
]

export default function Users({ onNavigate }: UsersProps) {
  const { siteId, users, user: currentUser, refresh, role } = useStudio()
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState('EDITOR')
  const [adding, setAdding] = useState(false)
  const { toast, show } = useToast()

  const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN'

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setAdding(true)
    try {
      await api.inviteUser(siteId, { email, role: newRole })
      setEmail(''); setNewRole('EDITOR')
      await refresh()
      show('User invited')
    } catch (err: any) { show(err.message || 'Failed to invite') }
    setAdding(false)
  }

  const updateRole = async (userId: string, role: string) => {
    try { await api.updateUser(siteId, userId, { role }); await refresh(); show('Role updated') } catch (err: any) { show(err.message || 'Failed') }
  }

  const remove = async (userId: string) => {
    if (!confirm('Remove this user from the site?')) return
    try { await api.deleteUser(siteId, userId); await refresh(); show('User removed') } catch (err: any) { show(err.message || 'Failed') }
  }

  return (
    <div className="p-5 max-w-[900px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Team</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Manage access to this site</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['User', 'Role', 'Added', ''].map(col => <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 whitespace-nowrap">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <p className="text-[13px] font-medium text-gray-900">{u.user?.email || u.email}</p>
                  {u.userId === currentUser?.id && <span className="text-[10px] text-gray-400">You</span>}
                </td>
                <td className="px-4 py-2">
                  {canManage ? (
                    <select value={u.role} onChange={e => updateRole(u.userId || u.id, e.target.value)} className="h-8 px-2 border border-gray-300 rounded text-[12px] bg-white">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  ) : (
                    <span className="text-[12px] text-gray-600">{ROLES.find(r => r.value === u.role)?.label || u.role}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[12px] text-gray-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  {canManage && u.userId !== currentUser?.id && (
                    <button onClick={() => remove(u.userId || u.id)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto"><IconTrash size={13} /></button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-gray-400">No team members yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="bg-white border border-gray-200 rounded p-4 flex items-end gap-3">
          <div className="flex-1"><Input label="Email" type="email" value={email} onChange={v => setEmail(v)} placeholder="colleague@example.com" /></div>
          <div>
            <label className="text-[12px] font-medium text-gray-600 block mb-1">Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="h-9 px-2 border border-gray-300 rounded text-[12px] bg-white">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <Button variant="primary" type="submit" disabled={adding} className="mb-0">{adding ? 'Adding…' : <><IconPlus size={12} />Invite</>}</Button>
        </form>
      )}

      <Toast toast={toast} />
    </div>
  )
}
