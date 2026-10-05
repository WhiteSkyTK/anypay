import { useEffect, useSyncExternalStore } from 'react'
import {
  applyTheme,
  readStoredMode,
  resolveTheme,
  storeMode,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/theme'

// One module-level store, so the shell and the settings screen always agree on the theme.
const listeners = new Set<() => void>()
let currentMode: ThemeMode | undefined

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function getMode(): ThemeMode {
  currentMode ??= readStoredMode()
  return currentMode
}

function getPrefersDark(): boolean {
  return darkQuery().matches
}

function subscribe(listener: () => void): () => void {
  const query = darkQuery()
  listeners.add(listener)
  query.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    query.removeEventListener('change', listener)
  }
}

function setMode(mode: ThemeMode): void {
  currentMode = mode
  storeMode(mode)
  listeners.forEach((listener) => listener())
}

/** Theme preference (System / Light / Dark); follows the OS live while set to System. */
export function useTheme(): { mode: ThemeMode; resolved: ResolvedTheme; setMode: typeof setMode } {
  const mode = useSyncExternalStore(subscribe, getMode)
  const prefersDark = useSyncExternalStore(subscribe, getPrefersDark)
  const resolved = resolveTheme(mode, prefersDark)

  useEffect(() => applyTheme(resolved), [resolved])

  return { mode, resolved, setMode }
}
