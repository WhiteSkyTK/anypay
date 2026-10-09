import { useEffect, useRef, useState } from 'react'

export type StreamState = 'connecting' | 'live' | 'reconnecting' | 'closed'

/**
 * Subscribes to a Server-Sent Events stream. The browser reconnects by itself after a drop
 * (state 'reconnecting'); 'closed' means it gave up, e.g. the server answered with an error.
 * Handlers can change between renders without reconnecting.
 */
export function useEventSource(
  url: string | null,
  handlers: Record<string, (data: unknown) => void>,
): StreamState {
  // The state is tagged with its URL, so a new URL reads as 'connecting' without an extra render.
  const [status, setStatus] = useState<{ url: string | null; state: StreamState }>({
    url,
    state: 'connecting',
  })
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!url) return
    const source = new EventSource(url)
    source.onopen = () => setStatus({ url, state: 'live' })
    source.onerror = () =>
      setStatus({
        url,
        state: source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting',
      })
    const listeners = Object.keys(handlersRef.current).map((event) => {
      const listener = (message: MessageEvent<string>) => {
        handlersRef.current[event]?.(JSON.parse(message.data) as unknown)
      }
      source.addEventListener(event, listener)
      return [event, listener] as const
    })
    return () => {
      listeners.forEach(([event, listener]) => source.removeEventListener(event, listener))
      source.close()
    }
  }, [url])

  return status.url === url ? status.state : 'connecting'
}
