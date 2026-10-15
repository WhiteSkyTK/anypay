import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy } from './csp.ts'

describe('contentSecurityPolicy', () => {
  it('allows scripts only from this site and data only to this site and the API', () => {
    const policy = contentSecurityPolicy('https://anypay-api.onrender.com/')
    expect(policy).toContain("script-src 'self';")
    expect(policy).not.toMatch(/script-src[^;]*unsafe/)
    expect(policy).toContain("connect-src 'self' https://anypay-api.onrender.com;")
    expect(policy).toContain("object-src 'none'")
  })

  it('keeps data on this site when the API shares its origin', () => {
    expect(contentSecurityPolicy(undefined)).toContain("connect-src 'self';")
  })
})
