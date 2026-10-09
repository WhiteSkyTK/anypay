import type { z } from 'zod'
import { AppError } from '../lib/errors'

/**
 * Parses untrusted input (body, query, params) with a shared zod schema. The error message is the
 * schema's i18n key (e.g. 'errors.walletAddress.format'), so the web app shows it in the user's
 * language.
 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const field = issue?.path.join('.')
  const message = issue?.message.startsWith('errors.')
    ? issue.message
    : `Invalid ${field || 'request'}`
  throw new AppError('invalid_request', message, 400)
}
