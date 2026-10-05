import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { pinoHttp } from 'pino-http'
import type { Logger } from '../lib/logger'

export const CORRELATION_HEADER = 'x-correlation-id'

// Reuse a caller's id only if it is short and plain, so it can't be used to inject into logs.
const SAFE_ID = /^[\w-]{8,64}$/

/** Ties one request's log lines together, and lets a user's error screen quote the id. */
export function correlationIdFor(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[CORRELATION_HEADER]
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader(CORRELATION_HEADER, id)
  return id
}

export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: correlationIdFor,
    // Hosting platforms poll /health constantly; logging it would bury real traffic.
    autoLogging: { ignore: (req) => req.url === '/health' },
    serializers: {
      // Path only: query strings can carry grant callback values (interact_ref, hash).
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  })
}
