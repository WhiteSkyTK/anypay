import { useEffect } from 'react'
import { syncThemeColor } from '@/lib/theme'

/**
 * For full-bleed dark screens shown in either theme: tints the browser chrome (the iOS Safari
 * status bar, Android's address bar) and the overscroll area dark too, so no cream band shows
 * around the screen. index.html sets the same flag on '/' before first paint.
 */
export function useDarkChrome(): void {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.chrome = 'dark'
    syncThemeColor()

    return () => {
      delete root.dataset.chrome
      syncThemeColor()
    }
  }, [])
}
