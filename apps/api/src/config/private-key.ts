import { createPrivateKey, type KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { Env } from './env'

export class PrivateKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PrivateKeyError'
  }
}

/**
 * AnyPay's Open Payments signing key, from PRIVATE_KEY (base64 of the PEM file) or PRIVATE_KEY_PATH
 * (a gitignored .key file; relative paths start at the repo root). Error messages never include
 * key material.
 */
export function loadPrivateKey(
  env: Pick<Env, 'PRIVATE_KEY' | 'PRIVATE_KEY_PATH'>,
  repoRoot: string,
): KeyObject | undefined {
  let pem: string | undefined
  if (env.PRIVATE_KEY) {
    pem = Buffer.from(env.PRIVATE_KEY, 'base64').toString('utf8')
  } else if (env.PRIVATE_KEY_PATH) {
    const path = isAbsolute(env.PRIVATE_KEY_PATH)
      ? env.PRIVATE_KEY_PATH
      : join(repoRoot, env.PRIVATE_KEY_PATH)
    pem = readFileSync(path, 'utf8')
  }
  if (pem === undefined) return undefined

  let key: KeyObject
  try {
    key = createPrivateKey(pem)
  } catch {
    throw new PrivateKeyError('The Open Payments private key is not a valid PEM key')
  }
  // Open Payments signs with Ed25519; any other key type would fail on the first request.
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new PrivateKeyError('The Open Payments private key must be an Ed25519 key')
  }
  return key
}
