import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * "Back" that always lands somewhere sensible. With history inside the app it goes back one step;
 * on a page opened directly (a QR code, a link, the wallet sending the customer back, a cold start)
 * there is nothing in the app to go back to, so it goes to `fallback` instead of leaving the app.
 * Installed apps on iPhone have no browser Back button at all, so every page without the tab bar
 * needs this.
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(() => {
    // React Router gives the first page of a visit the key 'default'.
    if (key === 'default') void navigate(fallback, { replace: true })
    else void navigate(-1)
  }, [key, navigate, fallback])
}
