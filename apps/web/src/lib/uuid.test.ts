import { describe, expect, it } from 'vitest'
import { uuid } from './uuid'

const V4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/

describe('uuid', () => {
  it('returns a v4 UUID', () => {
    expect(uuid()).toMatch(V4)
  })

  it('still returns a v4 UUID where randomUUID is missing (plain http on a LAN phone)', () => {
    // Shadows the prototype method, as browsers do outside secure contexts.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const ids = new Set(Array.from({ length: 50 }, () => uuid()))
      expect(ids.size).toBe(50)
      for (const id of ids) expect(id).toMatch(V4)
    } finally {
      // Back to the prototype's implementation for the other tests.
      Reflect.deleteProperty(crypto, 'randomUUID')
    }
  })
})
