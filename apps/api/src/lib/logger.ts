import { pino, type Logger } from 'pino'
import type { Env } from '../config/env'

export type { Logger }

/**
 * Structured JSON logs. Redaction is a safety net: code should never log tokens, keys or wallet
 * owner details in the first place.
 */
export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    base: { service: 'anypay-api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.accessToken',
        '*.access_token',
        '*.privateKey',
        '*.interactRef',
        '*.interact_ref',
      ],
      censor: '[redacted]',
    },
  })
}
