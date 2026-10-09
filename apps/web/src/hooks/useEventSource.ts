import { useEffect, useRef, useState } from 'react'

export type StreamState = 'connecting' | 'live' | 'reconnecting' | 'closed'

interface Options {
  /**
   * Start over after the browser gives up (an HTTP error, e.g. while the API restarts or a
   * sleeping host wakes), waiting a little longer each time. For streams that must stay up.
   */
  reconnectWhenClosed?: boolean
}

const FIRST_RETRY_MS = 2000
const MAX_RETRY_MS = 30_000

/**
 * Subscribes to a Server-Sent Events stream. The browser reconnects by itself after a drop
 * (state 'reconnecting'); 'closed' means it gave up, e.g. the server answered with an error.
 * Handlers can change between renders without reconnecting.
 */
export function useEventSource(
  url: string | null,
  handlers: Record<string, (data: unknown) => void>,
  { reconnectWhenClosed = false }: Options = {},
): StreamState {
  // The state is tagged with its URL, so a new URL reads as 'connecting' without an extra render.
  const [status, setStatus] = useState<{ url: string | null; state: StreamState }>({
    url,
    state: 'connecting',
  })
  const [attempt, setAttempt] = useState(0)
  const failures = useRef(0)
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!url) return
    const source = new EventSource(url)
    let retry: ReturnType<typeof setTimeout> | undefined
    source.onopen = () => {
      failures.current = 0
      setStatus({ url, state: 'live' })
    }
    source.onerror = () => {
      const closed = source.readyState === EventSource.CLOSED
      setStatus({ url, state: closed ? 'closed' : 'reconnecting' })
      if (!closed || !reconnectWhenClosed) return
      const delay = Math.min(FIRST_RETRY_MS * 2 ** failures.current, MAX_RETRY_MS)
      failures.current += 1
      retry = setTimeout(() => setAttempt((n) => n + 1), delay)
    }
    const listeners = Object.keys(handlersRef.current).map((event) => {
      const listener = (message: MessageEvent<string>) => {
        handlersRef.current[event]?.(JSON.parse(message.data) as unknown)
      }
      source.addEventListener(event, listener)
      return [event, listener] as const
    })
    return () => {
      clearTimeout(retry)
      listeners.forEach(([event, listener]) => source.removeEventListener(event, listener))
      source.close()
    }
  }, [url, attempt, reconnectWhenClosed])

  return status.url === url ? status.state : 'connecting'
}
