import { useRef, useEffect, useState } from 'react'
import { useTheme, type ThemePreference } from './ThemeContext'

const ICONS: Record<ThemePreference, string> = {
  light: '☀️',
  dark: '🌙',
  system: '🖥️',
}

const LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options: ThemePreference[] = ['system', 'light', 'dark']

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-[28px] px-2 rounded border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-raised transition-colors text-[12px]"
        aria-label="Appearance"
        title="Appearance"
      >
        <span>{ICONS[preference]}</span>
        <span className="hidden sm:inline">{LABELS[preference]}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-surface border border-border rounded shadow-lg z-50 py-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { setPreference(opt); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
                preference === opt ? 'text-text bg-surface-raised' : 'text-text-muted hover:text-text hover:bg-surface-raised'
              }`}
            >
              <span>{ICONS[opt]}</span>
              <span>{LABELS[opt]}</span>
              {preference === opt && <span className="ml-auto text-accent">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
