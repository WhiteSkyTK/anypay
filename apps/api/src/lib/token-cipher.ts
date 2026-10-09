import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { AppError } from './errors'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // GCM's recommended nonce size
const TAG_BYTES = 16
const VERSION = 'v1'

/**
 * Encrypts secrets at rest (grant access tokens, continuation tokens, customer wallet) with
 * AES-256-GCM. GCM also authenticates, so a tampered row fails to decrypt instead of decrypting
 * to garbage. Format: `v1.<base64url(iv | tag | ciphertext)>`; the version leaves room to rotate.
 */
export class TokenCipher {
  readonly #key: Buffer

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error('TokenCipher needs a 32-byte key')
    this.#key = key
  }

  static fromBase64(key: string): TokenCipher {
    return new TokenCipher(Buffer.from(key, 'base64'))
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, this.#key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
    return `${VERSION}.${payload.toString('base64url')}`
  }

  decrypt(sealed: string): string {
    const [version, encoded] = sealed.split('.')
    if (version !== VERSION || !encoded) throw this.#unreadable()
    const payload = Buffer.from(encoded, 'base64url')
    const iv = payload.subarray(0, IV_BYTES)
    const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES)
    try {
      const decipher = createDecipheriv(ALGORITHM, this.#key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    } catch {
      throw this.#unreadable()
    }
  }

  #unreadable(): AppError {
    return new AppError('stored_data_unreadable', 'Stored payment data could not be read', 500)
  }
}
