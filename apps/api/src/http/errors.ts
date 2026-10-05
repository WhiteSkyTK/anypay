import type { ApiError } from '@anypay/shared'
import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../lib/errors'

// body-parser marks its own errors with a `type`; map the ones a client can cause.
const BODY_PARSER_CODES: Record<string, string> = {
  'entity.too.large': 'payload_too_large',
  'entity.parse.failed': 'invalid_json',
}

interface HttpLikeError {
  status: number
  type?: string
}

function isClientHttpError(error: unknown): error is HttpLikeError {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

/** Maps any thrown value to a status and a body that never leaks internals. */
export function toApiError(error: unknown): { status: number; body: ApiError['error'] } {
  if (error instanceof AppError) {
    return { status: error.status, body: { code: error.code, message: error.message } }
  }
  if (isClientHttpError(error)) {
    const code = BODY_PARSER_CODES[error.type ?? ''] ?? 'bad_request'
    return { status: error.status, body: { code, message: 'The request could not be processed' } }
  }
  return { status: 500, body: { code: 'internal_error', message: 'Something went wrong' } }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('not_found', `No route for ${req.method} ${req.path}`, 404))
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const { status, body } = toApiError(error)
  if (status >= 500) req.log.error({ err: error }, 'Request failed')
  const payload: ApiError = { error: body, correlationId: String(req.id) }
  res.status(status).json(payload)
}
