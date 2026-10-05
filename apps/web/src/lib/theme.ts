export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark']

// The inline script in index.html applies the theme before first paint using the same key and
// colours (tokens.test.ts checks they stay in sync).
export const THEME_STORAGE_KEY = 'anypay.theme'
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f5f2ea', dark: '#0f1211' }

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode)
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

/** Storage can throw (private mode, blocked site data), so the theme degrades to 'system'. */
export function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function storeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Not persisted, but still applied for this visit.
  }
}

export function applyTheme(theme: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.classList.toggle('dark', theme === 'dark')
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}
