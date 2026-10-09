import type { Request, Response } from 'express'

const HEARTBEAT_MS = 25_000

export interface EventStream {
  send(event: string, data: unknown): void
  close(): void
}

/**
 * Server-Sent Events: the server pushes, phones never poll (low data). A comment line every 25 s
 * keeps mobile networks and proxies from closing an idle connection.
 */
export function openEventStream(req: Request, res: Response, onClose: () => void): EventStream {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies (nginx, some hosts) buffering the stream
  })
  res.flushHeaders()
  // Ask the browser to wait 3 s before reconnecting after a drop.
  res.write('retry: 3000\n\n')

  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    onClose()
    res.end()
  }
  req.on('close', close)

  return {
    send(event, data) {
      if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    },
    close,
  }
}
