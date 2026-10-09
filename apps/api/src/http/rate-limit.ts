import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { AppError } from '../lib/errors'

/**
 * Per-IP limit for routes that create things or call out to wallets: blunts abuse of our Open
 * Payments client (each call is signed with AnyPay's key) without slowing a real queue.
 */
export function createRateLimit(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('rate_limited', 'Too many requests. Try again in a minute.', 429)),
  })
}
