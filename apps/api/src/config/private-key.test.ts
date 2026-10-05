import { generateKeyPairSync, type KeyObject } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPrivateKey, PrivateKeyError } from './private-key'

// Keys are generated per run: no key material is ever committed, not even for tests.
const toPem = (key: KeyObject) => key.export({ type: 'pkcs8', format: 'pem' }).toString()
const pemOf = (type: 'ed25519' | 'ed448') =>
  toPem(
    type === 'ed25519'
      ? generateKeyPairSync('ed25519').privateKey
      : generateKeyPairSync('ed448').privateKey,
  )

describe('loadPrivateKey', () => {
  it('returns nothing when no key is configured', () => {
    expect(loadPrivateKey({}, '/repo')).toBeUndefined()
  })

  it('loads a base64-encoded PEM from PRIVATE_KEY', () => {
    const key = loadPrivateKey(
      { PRIVATE_KEY: Buffer.from(pemOf('ed25519')).toString('base64') },
      '/repo',
    )
    expect(key?.asymmetricKeyType).toBe('ed25519')
  })

  it('loads a key file relative to the repo root', () => {
    const root = mkdtempSync(join(tmpdir(), 'anypay-key-'))
    writeFileSync(join(root, 'app.key'), pemOf('ed25519'))
    expect(loadPrivateKey({ PRIVATE_KEY_PATH: 'app.key' }, root)?.asymmetricKeyType).toBe('ed25519')
    expect(loadPrivateKey({ PRIVATE_KEY_PATH: join(root, 'app.key') }, '/elsewhere')).toBeDefined()
  })

  it('rejects keys Open Payments cannot sign with', () => {
    const otherType = Buffer.from(pemOf('ed448')).toString('base64')
    expect(() => loadPrivateKey({ PRIVATE_KEY: otherType }, '/repo')).toThrow(PrivateKeyError)
  })

  it('rejects garbage without echoing it', () => {
    // Built at run time: a literal PEM header in the repo trips secret scanners, even around garbage.
    const label = 'PRIVATE KEY'
    const pem = `-----BEGIN ${label}-----\nnot-a-key\n-----END ${label}-----`
    const garbage = Buffer.from(pem).toString('base64')
    expect(() => loadPrivateKey({ PRIVATE_KEY: garbage }, '/repo')).toThrow(/not a valid PEM key/)
    try {
      loadPrivateKey({ PRIVATE_KEY: garbage }, '/repo')
    } catch (error) {
      expect((error as Error).message).not.toContain('not-a-key')
    }
  })
})
