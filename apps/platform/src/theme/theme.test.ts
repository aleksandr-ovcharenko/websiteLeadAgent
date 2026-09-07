import { describe, it, expect, beforeEach } from 'vitest'
import { readStoredPreference, resolveTheme, STORAGE_KEY, type ThemePreference } from './ThemeContext'

function createStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    get length() { return data.size },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    clear: () => data.clear(),
  } as unknown as Storage
}

describe('theme utilities', () => {
  describe('resolveTheme', () => {
    it('returns explicit light/dark preferences unchanged', () => {
      expect(resolveTheme('light', false)).toBe('light')
      expect(resolveTheme('light', true)).toBe('light')
      expect(resolveTheme('dark', false)).toBe('dark')
      expect(resolveTheme('dark', true)).toBe('dark')
    })

    it('falls back to system preference for system mode', () => {
      expect(resolveTheme('system', false)).toBe('light')
      expect(resolveTheme('system', true)).toBe('dark')
    })
  })

  describe('readStoredPreference', () => {
    it('returns system when no preference is stored', () => {
      expect(readStoredPreference(createStore())).toBe('system')
    })

    it.each<ThemePreference>(['light', 'dark', 'system'])('reads back %s', (value) => {
      const store = createStore({ [STORAGE_KEY]: value })
      expect(readStoredPreference(store)).toBe(value)
    })

    it('ignores invalid stored values', () => {
      const store = createStore({ [STORAGE_KEY]: 'purple' })
      expect(readStoredPreference(store)).toBe('system')
    })
  })
})
