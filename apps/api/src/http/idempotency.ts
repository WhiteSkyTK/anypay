import { IdempotencyKeySchema } from '@anypay/shared'
import type { RequestHandler } from 'express'
import { createHash } from 'node:crypto'
import { AppError } from '../lib/errors'
import type { IdempotencyRepository } from '../repositories/idempotency-repository'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

const requestHash = (path: string, body: unknown) =>
  createHash('sha256').update(JSON.stringify({ path, body })).digest('hex')

/**
 * Required on every request that moves money or creates something (CLAUDE.md). A retry with the
 * same key gets the original response, so a phone that lost signal mid-request can safely try
 * again without paying twice. Server errors are forgotten, so their retries run again.
 */
export function idempotent(store: IdempotencyRepository, scope: string): RequestHandler {
  return async (req, res, next) => {
    const parsed = IdempotencyKeySchema.safeParse(req.get(IDEMPOTENCY_HEADER))
    if (!parsed.success) {
      return next(
        new AppError('idempotency_key_required', 'Send an Idempotency-Key header (a UUID)', 400),
      )
    }
    const key = parsed.data
    const begin = await store.begin(scope, key, requestHash(req.path, req.body))

    if (begin.kind === 'replay') {
      res.status(begin.statusCode).set('Idempotent-Replayed', 'true').type('json').send(begin.body)
      return
    }
    if (begin.kind === 'in_progress') {
      return next(new AppError('request_in_progress', 'This request is still being handled', 409))
    }
    if (begin.kind === 'mismatch') {
      return next(
        new AppError('idempotency_key_reused', 'This key was used for another request', 422),
      )
    }

    // Record the outcome before the client sees it, so an instant retry finds it.
    const send = res.json.bind(res)
    res.json = (body: unknown) => {
      const text = JSON.stringify(body)
      const persist =
        res.statusCode >= 500
          ? store.abandon(scope, key)
          : store.complete(scope, key, res.statusCode, text)
      persist.then(
        () => send(body),
        (error: unknown) => {
          req.log.error({ err: error }, 'Could not store the idempotent response')
          send(body)
        },
      )
      return res
    }
    next()
  }
}
