import { createHash, timingSafeEqual } from 'node:crypto'

export interface InteractHashInput {
  /** The nonce we sent in interact.finish. */
  clientNonce: string
  /** The nonce the auth server returned in interact.finish. */
  interactNonce: string
  /** The interact_ref query parameter on the callback. */
  interactRef: string
  /** The grant endpoint we sent the request to (the wallet's authServer). */
  grantEndpoint: string
}

/**
 * The callback `hash`: base64 SHA-256 of the four values joined by newlines
 * (https://openpayments.dev/identity/hash-verification/). It proves the redirect really came
 * from the customer's auth server, for this grant, and wasn't forged by someone else.
 */
export function computeInteractHash(input: InteractHashInput): string {
  const base = [input.clientNonce, input.interactNonce, input.interactRef, input.grantEndpoint]
  return createHash('sha256').update(base.join('\n')).digest('base64')
}

// The spec text says unpadded base64 but its example uses padded; and a '+' that arrives
// unescaped in a query string decodes as a space. Normalise both before comparing.
function normalise(hash: string): string {
  let end = hash.length
  while (end > 0 && hash[end - 1] === '=') end--
  return hash.slice(0, end).replaceAll(' ', '+')
}

export function verifyInteractHash(input: InteractHashInput, receivedHash: string): boolean {
  const expected = Buffer.from(normalise(computeInteractHash(input)))
  const received = Buffer.from(normalise(receivedHash))
  // Constant-time compare, so the check doesn't leak how much of a guessed hash was right.
  return expected.length === received.length && timingSafeEqual(expected, received)
}
