import { useLayoutEffect } from 'react'

/**
 * Removes the start-up mark (index.html) as the first screen, or its error page, is about to paint:
 * a layout effect, so the two never show together and nothing on the page moves.
 */
export function useHideSplash(): void {
  useLayoutEffect(() => {
    document.getElementById('splash')?.remove()
  }, [])
}
