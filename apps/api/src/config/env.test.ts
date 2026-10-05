import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv as parseDotEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { EnvError, parseEnv } from './env'

function envErrorMessage(source: NodeJS.ProcessEnv): string {
  try {
    parseEnv(source)
  } catch (error) {
    if (error instanceof EnvError) return error.message
    throw error
  }
  throw new Error('Expected parseEnv to fail')
}

describe('parseEnv', () => {
  it('accepts .env.example as-is, so a fresh copy always boots', () => {
    const example = readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8')
    expect(parseEnv(parseDotEnv(example))).toMatchObject({ PORT: 3000, DEMO_MODE: true })
  })

  it('starts with safe local defaults', () => {
    expect(parseEnv({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      WEB_ORIGIN: ['http://localhost:5173'],
      DEMO_MODE: false,
      ALLOWED_WALLET_HOSTS: ['interledger-test.dev'],
    })
  })

  it('treats empty values from .env as unset', () => {
    const env = parseEnv({ PORT: '', CLIENT_WALLET_ADDRESS: '', DEMO_MODE: '' })
    expect(env.PORT).toBe(3000)
    expect(env.CLIENT_WALLET_ADDRESS).toBeUndefined()
  })

  it('parses comma-separated lists and normalises origins', () => {
    const env = parseEnv({
      WEB_ORIGIN: 'https://anypay.example/, http://localhost:5173',
      ALLOWED_WALLET_HOSTS: 'ilp.interledger-test.dev, wallet.example.com',
    })
    expect(env.WEB_ORIGIN).toEqual(['https://anypay.example', 'http://localhost:5173'])
    expect(env.ALLOWED_WALLET_HOSTS).toEqual(['ilp.interledger-test.dev', 'wallet.example.com'])
  })

  it('parses booleans and numbers', () => {
    expect(parseEnv({ DEMO_MODE: 'true', PORT: '8080' })).toMatchObject({
      DEMO_MODE: true,
      PORT: 8080,
    })
  })

  it('accepts a 32-byte encryption key', () => {
    const key = Buffer.alloc(32, 7).toString('base64')
    expect(parseEnv({ TOKEN_ENCRYPTION_KEY: key }).TOKEN_ENCRYPTION_KEY).toBe(key)
  })

  it('names every invalid variable', () => {
    const message = envErrorMessage({
      PORT: 'abc',
      CLIENT_WALLET_ADDRESS: 'http://not-https.example/me',
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
    })
    expect(message).toContain('PORT')
    expect(message).toContain('CLIENT_WALLET_ADDRESS')
    expect(message).toContain('TOKEN_ENCRYPTION_KEY')
  })

  it('never echoes values, which may be secrets', () => {
    // Generated per run, so no secret-shaped literal lives in the repo (secret scanners flag those).
    const wrongLengthKey = randomBytes(24).toString('base64')
    expect(envErrorMessage({ TOKEN_ENCRYPTION_KEY: wrongLengthKey })).not.toContain(wrongLengthKey)
  })
})
