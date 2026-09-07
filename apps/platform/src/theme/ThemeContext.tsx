import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

export const STORAGE_KEY = 'wla-theme'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference, prefersDark = getSystemTheme() === 'dark'): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  return prefersDark ? 'dark' : 'light'
}

export function readStoredPreference(store = typeof window !== 'undefined' ? localStorage : undefined): ThemePreference {
  const raw = store?.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function applyToDocument(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const pref = readStoredPreference()
    setPreferenceState(pref)
    setResolvedTheme(resolveTheme(pref))
  }, [])

  useEffect(() => {
    applyToDocument(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setResolvedTheme(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [preference])

  const setPreference = useCallback((p: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, p)
    setPreferenceState(p)
    setResolvedTheme(resolveTheme(p))
  }, [])

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
