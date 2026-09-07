import { useState, useRef, useEffect, ReactNode } from 'react'
import { IconX, IconCheck, IconAlert, IconLock, IconChevronDown } from './icons'

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'published' | 'draft' | 'archived' | 'active' | 'inactive' | 'completed' | 'in-progress'

const BADGE: Record<BadgeVariant, { cls: string; label: string }> = {
  published: { cls: 'bg-success-subtle text-success border border-success-subtle', label: 'Published' },
  draft: { cls: 'bg-surface-hover text-text-muted border border-border', label: 'Draft' },
  archived: { cls: 'bg-warning-subtle text-warning border border-warning-subtle', label: 'Archived' },
  active: { cls: 'bg-success-subtle text-success border border-success-subtle', label: 'Active' },
  inactive: { cls: 'bg-danger-subtle text-danger border border-danger-subtle', label: 'Inactive' },
  completed: { cls: 'bg-info-subtle text-info border border-info-subtle', label: 'Completed' },
  'in-progress': { cls: 'bg-warning-subtle text-warning border border-warning-subtle', label: 'In progress' },
}

export function Badge({ variant }: { variant: BadgeVariant }) {
  const b = BADGE[variant]
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium whitespace-nowrap leading-4 ${b.cls}`}>
      {b.label}
    </span>
  )
}

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface ButtonProps {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
  type?: 'button' | 'submit'
}

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-inverse hover:bg-accent-hover border border-accent hover:border-accent shadow-sm',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-raised hover:border-border',
  ghost: 'bg-transparent text-text-muted border border-transparent hover:bg-surface-hover hover:text-text',
  danger: 'bg-danger text-text-inverse border border-danger hover:bg-danger-hover hover:border-danger shadow-sm',
}

const BTN_SIZE: Record<string, string> = {
  sm: 'h-[26px] px-2.5 text-[12px] gap-1 font-medium',
  md: 'h-[30px] px-3 text-[13px] gap-1.5 font-medium',
}

export function Button({ variant = 'secondary', size = 'md', onClick, disabled, children, className = '', type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded transition-colors select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
    >
      {children}
    </button>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  id?: string
  hint?: string
  prefix?: string
  className?: string
  readOnly?: boolean
}

export function Input({ label, value, onChange, placeholder, type = 'text', id, hint, prefix, className = '', readOnly }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label htmlFor={inputId} className="text-[12px] font-medium text-text-muted">{label}</label>}
      <div className="flex items-center">
        {prefix && (
          <span className="inline-flex items-center px-2.5 h-[30px] rounded-l border border-r-0 border-border bg-surface-raised text-text-muted text-[12px] mono">{prefix}</span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`h-[30px] w-full border border-border text-[13px] text-text placeholder-text-subtle bg-surface px-2.5 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors ${prefix ? 'rounded-r' : 'rounded'} ${readOnly ? 'bg-surface-raised text-text-muted' : ''}`}
        />
      </div>
      {hint && <p className="text-[11px] text-text-subtle">{hint}</p>}
    </div>
  )
}

// ─── Textarea ────────────────────────────────────────────────────────────────

interface TextareaProps {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: string
  className?: string
}

export function Textarea({ label, value, onChange, placeholder, rows = 4, hint, className = '' }: TextareaProps) {
  const id = label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label htmlFor={id} className="text-[12px] font-medium text-text-muted">{label}</label>}
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-border rounded text-[13px] text-text placeholder-text-subtle bg-surface px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors resize-y leading-relaxed"
      />
      {hint && <p className="text-[11px] text-text-subtle">{hint}</p>}
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────────────────────

interface SelectProps {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function Select({ label, value, onChange, options, className = '' }: SelectProps) {
  const id = label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label htmlFor={id} className="text-[12px] font-medium text-text-muted">{label}</label>}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-[30px] w-full appearance-none border border-border rounded text-[13px] text-text bg-surface px-2.5 pr-7 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors cursor-pointer"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <IconChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
      </div>
    </div>
  )
}

// ─── Switch ──────────────────────────────────────────────────────────────────

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${checked ? 'bg-accent' : 'bg-surface-hover'}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-surface shadow-sm transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </button>
      {label && <span className="text-[13px] text-text">{label}</span>}
    </label>
  )
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${checked ? 'bg-accent border-accent' : 'bg-surface border-border hover:border-border'}`}
      >
        {checked && <IconCheck size={9} className="text-text-inverse" />}
      </div>
      {label && <span className="text-[13px] text-text">{label}</span>}
    </label>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex border-b border-border">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${active === tab ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text hover:border-border'}`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

// ─── Dropdown Menu ───────────────────────────────────────────────────────────

interface DropdownItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  divider?: boolean
}

export function DropdownMenu({ trigger, items }: { trigger: ReactNode; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-surface border border-border rounded shadow-md z-50 py-0.5">
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && i > 0 && <div className="my-0.5 border-t border-border" />}
              <button
                onClick={() => { item.onClick(); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors ${item.danger ? 'text-danger hover:bg-danger-subtle' : 'text-text hover:bg-surface-raised'}`}
              >
                {item.icon && <span className="flex-shrink-0 opacity-70">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-overlay/30" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold text-text text-[14px]">{title}</h3>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted transition-colors">
            <IconX size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

export function ConfirmDelete({ open, title, description, onConfirm, onCancel }: {
  open: boolean; title: string; description?: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-[13px] text-text-muted mb-5">{description || 'This action cannot be undone.'}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  )
}

// ─── Page Header ─────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <h1 className="text-[15px] font-semibold text-text leading-tight">{title}</h1>
        {subtitle && <p className="text-[12px] text-text-subtle mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ─── Search Input ─────────────────────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[30px] w-52 border border-border rounded text-[13px] text-text placeholder-text-subtle bg-surface pl-7 pr-3 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
      />
    </div>
  )
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

export function FilterTabs({ tabs, active, onChange }: { tabs: { label: string; value: string; count?: number }[]; active: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-px">
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 px-2.5 h-[26px] text-[12px] font-medium rounded transition-colors ${active === t.value ? 'bg-surface-inverse text-text-inverse' : 'text-text-muted hover:bg-surface-hover hover:text-text'}`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`text-[11px] px-1 rounded ${active === t.value ? 'bg-surface/20 text-text-inverse' : 'bg-surface-hover text-text-muted'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-8 h-8 rounded bg-surface-hover flex items-center justify-center mb-3">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-subtle)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-[13px] text-text-muted mb-3">{message}</p>
      {action}
    </div>
  )
}

// ─── DataTable ────────────────────────────────────────────────────────────────

export function DataTable({ head, rows, border = true }: { head: string[]; rows: ReactNode[][]; border?: boolean }) {
  return (
    <div className={`overflow-x-auto ${border ? 'bg-surface border border-border rounded' : ''}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {head.map(col => (
              <th key={col} className="text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-2 bg-surface-raised whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-raised/60 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-[13px] text-text align-middle">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section Card ────────────────────────────────────────────────────────────

export function Card({ title, children, className = '', actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <div className={`bg-surface border border-border rounded ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <h3 className="font-semibold text-[12px] text-text uppercase tracking-wide">{title}</h3>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Toast Notification ──────────────────────────────────────────────────────

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }
  return { toast, show }
}

export function Toast({ toast }: { toast: { message: string; type: 'success' | 'error' } | null }) {
  if (!toast) return null
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded shadow-lg text-[13px] font-medium border ${toast.type === 'success' ? 'bg-surface text-text border-border' : 'bg-surface text-text border-danger-subtle'}`}>
      {toast.type === 'success'
        ? <IconCheck size={14} className="text-success flex-shrink-0" />
        : <IconAlert size={14} className="text-danger flex-shrink-0" />
      }
      {toast.message}
    </div>
  )
}

// ─── Loading / Error States ───────────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 rounded-full border-2 border-border border-t-accent animate-spin" />
    </div>
  )
}

export function ErrorState({ message = 'An error occurred. Please try again.' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-2.5 text-center max-w-xs">
        <div className="w-8 h-8 rounded bg-danger-subtle flex items-center justify-center">
          <IconAlert size={15} className="text-danger" />
        </div>
        <p className="text-[13px] text-text-muted">{message}</p>
        <Button variant="secondary" size="sm" onClick={() => {}}>Try again</Button>
      </div>
    </div>
  )
}

export function PermissionDenied() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-2.5 text-center max-w-xs">
        <div className="w-8 h-8 rounded bg-surface-hover flex items-center justify-center">
          <IconLock size={15} className="text-text-subtle" />
        </div>
        <p className="font-semibold text-text text-[13px]">Access restricted</p>
        <p className="text-[12px] text-text-subtle leading-relaxed">You don't have permission to view this section. Contact your administrator.</p>
      </div>
    </div>
  )
}

// ─── Unsaved Changes Bar ──────────────────────────────────────────────────────

export function UnsavedBar({ dirty, saving, onSave }: { dirty: boolean; saving?: boolean; onSave: () => void }) {
  if (!dirty && !saving) return null
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-inverse text-text-inverse px-4 py-2 rounded shadow-xl text-[13px]">
      {saving ? (
        <>
          <div className="w-3 h-3 rounded-full border-2 border-text-inverse/30 border-t-white animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <span className="text-text-subtle">Unsaved changes</span>
          <button onClick={onSave} className="bg-surface text-text px-2.5 py-0.5 rounded text-[12px] font-medium hover:bg-surface-hover transition-colors">Save</button>
        </>
      )}
    </div>
  )
}

// ─── Section Label ────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-widest mb-1.5">{children}</p>
}

// ─── Field Row ────────────────────────────────────────────────────────────────

export function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-text-muted">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-text-subtle">{hint}</p>}
    </div>
  )
}

// ─── Toolbar (list page header row) ──────────────────────────────────────────

export function Toolbar({ title, actions, filters, search }: {
  title: string
  actions?: ReactNode
  filters?: ReactNode
  search?: ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="text-[15px] font-semibold text-text leading-tight">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {(filters || search) && (
        <div className="flex items-center gap-2">
          {filters}
          <div className="flex-1" />
          {search}
        </div>
      )}
    </div>
  )
}
