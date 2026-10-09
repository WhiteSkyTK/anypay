import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

/** How long to wait for a page that loads data first (pay, receipt) to render its heading. */
const HEADING_WAIT_MS = 5000

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
    return focusHeadingWhenReady()
  }, [pathname])
}

function focusHeading(): boolean {
  const heading = document.querySelector<HTMLElement>('main h1')
  heading?.focus()
  return heading !== null
}

/** Focuses the heading now, or as soon as it renders. Returns a cleanup that stops waiting. */
export function focusHeadingWhenReady(): () => void {
  if (focusHeading()) return () => undefined
  const main = document.querySelector('main') ?? document.body
  const observer = new MutationObserver(() => {
    // A skeleton has nothing to focus, so focus inside <main> means the user moved it: leave it.
    if (main.contains(document.activeElement) || focusHeading()) observer.disconnect()
  })
  observer.observe(main, { childList: true, subtree: true })
  const timer = window.setTimeout(() => observer.disconnect(), HEADING_WAIT_MS)
  return () => {
    observer.disconnect()
    window.clearTimeout(timer)
  }
}
