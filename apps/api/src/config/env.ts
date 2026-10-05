import { z } from 'zod'

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
)

// Browsers send Origin without a trailing slash, so 'http://localhost:5173/' must still match.
const origins = z
  .array(z.url({ protocol: /^https?$/ }))
  .min(1)
  .transform((urls) => urls.map((url) => new URL(url).origin))

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Web origins allowed by CORS. Comma-separated so a preview deploy can be added. */
  WEB_ORIGIN: csv.pipe(origins).default(['http://localhost:5173']),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DEMO_MODE: z.stringbool().default(false),

  // AnyPay's own Open Payments client identity. Optional, so the API still starts (and /health
  // works) without it; payment calls then fail with 'open_payments_not_configured'.
  CLIENT_WALLET_ADDRESS: z.url({ protocol: /^https$/ }).optional(),
  KEY_ID: z.string().optional(),
  /** Base64 of the private key PEM. Alternative: PRIVATE_KEY_PATH to a gitignored .key file. */
  PRIVATE_KEY: z.base64().optional(),
  PRIVATE_KEY_PATH: z.string().optional(),

  /**
   * SSRF allowlist: the only wallet hosts the API will ever call. Subdomains are included, because
   * a wallet's auth server lives next to it (ilp.interledger-test.dev → auth.interledger-test.dev).
   */
  ALLOWED_WALLET_HOSTS: csv.pipe(z.array(z.hostname()).min(1)).default(['interledger-test.dev']),
  /** AES-256-GCM key for grant tokens at rest: 32 random bytes, base64. */
  TOKEN_ENCRYPTION_KEY: z
    .base64()
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      error: 'Must be 32 bytes, base64-encoded',
    })
    .optional(),
  DATABASE_URL: z.url().optional(),

  /** Default wallets for `npm run demo:pay` (public addresses, like email addresses). */
  DEMO_CUSTOMER_WALLET: z.string().optional(),
  DEMO_MERCHANT_WALLET: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

export class EnvError extends Error {
  constructor(details: string) {
    super(`Invalid environment configuration:\n${details}`)
    this.name = 'EnvError'
  }
}

/**
 * Validates the environment once at startup so a misconfigured deploy fails loudly instead of
 * mid-payment. The error names the variables but never echoes their values (they may be secrets).
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // `KEY=` in a .env file means "not set", not "set to an empty string".
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const result = EnvSchema.safeParse(present)
  if (!result.success) throw new EnvError(z.prettifyError(result.error))
  return result.data
}
