import type { RequestHandler } from 'express'
import { AppError } from '../lib/errors'

export interface StreamLimits {
  /** Open streams per client IP. Generous: mobile networks put many phones behind one address. */
  perClient: number
  /** Open streams in total, across everyone. */
  total: number
}

/**
 * Live streams (SSE) hold a connection open for hours, so opening thousands of them is the
 * cheapest way to exhaust the server. This caps open streams per client and overall; a stream
 * frees its slot when it closes.
 */
export function limitStreams({ perClient, total }: StreamLimits): RequestHandler {
  const openPerClient = new Map<string, number>()
  let openTotal = 0
  return (req, res, next) => {
    const client = req.ip ?? 'unknown'
    const mine = openPerClient.get(client) ?? 0
    if (mine >= perClient || openTotal >= total) {
      return next(
        new AppError('too_many_streams', 'Too many live connections. Try again shortly.', 429),
      )
    }
    openPerClient.set(client, mine + 1)
    openTotal += 1
    res.once('close', () => {
      openTotal -= 1
      const left = (openPerClient.get(client) ?? 1) - 1
      if (left > 0) openPerClient.set(client, left)
      else openPerClient.delete(client)
    })
    next()
  }
}
