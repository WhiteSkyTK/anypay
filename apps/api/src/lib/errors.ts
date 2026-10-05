/**
 * An error that is safe to show to the client: the code drives a specific UI state in the web
 * app (e.g. 'quote_expired'), the message is a short English fallback.
 */
export class AppError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

/** Marks scaffolded methods that a later roadmap phase fills in. */
export class NotImplementedError extends AppError {
  constructor(feature: string) {
    super('not_implemented', `${feature} is not implemented yet`, 501)
    this.name = 'NotImplementedError'
  }
}
