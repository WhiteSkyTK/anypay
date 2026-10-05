import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

/**
 * Moves focus to the new page's <h1> after client-side navigation, so screen reader and
 * keyboard users land on (and hear) the new page instead of staying on the old link.
 */
export function useRouteFocus(): void {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    document.querySelector<HTMLElement>('main h1')?.focus()
  }, [pathname])
}
