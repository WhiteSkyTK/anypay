import { describe, expect, it } from 'vitest'
import { computeInteractHash, verifyInteractHash } from './interact-hash'

const input = {
  clientNonce: 'client-nonce',
  interactNonce: 'as-nonce',
  interactRef: 'ref-123',
  grantEndpoint: 'https://auth.interledger-test.dev/t1',
}
// Computed independently: base64(sha256("client-nonce\nas-nonce\nref-123\n<grant endpoint>")).
const EXPECTED = 'BdOvtg8K5o5W2r561kw23VlKnzfdqQcI6GDwjuSvQMk='

describe('computeInteractHash', () => {
  it('hashes the four values in spec order, joined by newlines', () => {
    expect(computeInteractHash(input)).toBe(EXPECTED)
  })
})

describe('verifyInteractHash', () => {
  it('accepts the hash with or without base64 padding', () => {
    expect(verifyInteractHash(input, EXPECTED)).toBe(true)
    expect(verifyInteractHash(input, EXPECTED.slice(0, -1))).toBe(true)
  })

  it("accepts a '+' that arrived as a space in the query string", () => {
    const withPlus = { ...input, interactRef: 'ref-0' }
    const hash = '2Ub7raN+tcckc4bos+1pJN8xozmt5gIa7zOFyftBg8g='
    expect(verifyInteractHash(withPlus, hash)).toBe(true)
    expect(verifyInteractHash(withPlus, hash.replaceAll('+', ' '))).toBe(true)
  })

  it.each([
    ['another interact_ref', { ...input, interactRef: 'ref-124' }],
    ['another client nonce', { ...input, clientNonce: 'replayed' }],
    ['another auth server', { ...input, grantEndpoint: 'https://auth.evil.example' }],
  ])('rejects a hash made for %s', (_case, other) => {
    expect(verifyInteractHash(other, EXPECTED)).toBe(false)
  })

  it.each(['', 'not-a-hash', EXPECTED.slice(1)])('rejects malformed hash %j', (hash) => {
    expect(verifyInteractHash(input, hash)).toBe(false)
  })
})
