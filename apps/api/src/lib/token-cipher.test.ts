import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TokenCipher } from './token-cipher'

const cipher = new TokenCipher(randomBytes(32))
const SECRET = JSON.stringify({ accessToken: 'grant-token-value', wallet: 'https://wallet/x' })

describe('TokenCipher', () => {
  it('round-trips and never stores the plain text', () => {
    const sealed = cipher.encrypt(SECRET)
    expect(sealed.startsWith('v1.')).toBe(true)
    expect(sealed).not.toContain('grant-token-value')
    expect(cipher.decrypt(sealed)).toBe(SECRET)
  })

  it('uses a fresh IV each time, so equal inputs look different', () => {
    expect(cipher.encrypt(SECRET)).not.toBe(cipher.encrypt(SECRET))
  })

  it('detects tampering instead of returning garbage', () => {
    const sealed = cipher.encrypt(SECRET)
    // Flip a character in the middle: the last base64 character may only carry padding bits.
    const at = Math.floor(sealed.length / 2)
    const flipped = sealed[at] === 'A' ? 'B' : 'A'
    const tampered = sealed.slice(0, at) + flipped + sealed.slice(at + 1)
    expect(() => cipher.decrypt(tampered)).toThrow(/could not be read/)
  })

  it('refuses data sealed with another key', () => {
    const other = new TokenCipher(randomBytes(32))
    expect(() => other.decrypt(cipher.encrypt(SECRET))).toThrow(/could not be read/)
  })

  it.each(['', 'v2.abc', 'not-sealed'])('rejects malformed input %j', (input) => {
    expect(() => cipher.decrypt(input)).toThrow(/could not be read/)
  })

  it('requires a 32-byte key', () => {
    expect(() => new TokenCipher(randomBytes(16))).toThrow(/32-byte/)
    expect(TokenCipher.fromBase64(randomBytes(32).toString('base64'))).toBeInstanceOf(TokenCipher)
  })
})
