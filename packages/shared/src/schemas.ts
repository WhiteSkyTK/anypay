import { z } from 'zod'
import type { Money } from './money'

// Error messages are i18n keys, so the web app can show them in the user's language.

/** Non-negative integer minor units as Open Payments sends them: no sign, no leading zeros. */
export const MinorUnitsSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, { error: 'errors.money.minorUnits' })

export const MoneySchema = z.object({
  value: MinorUnitsSchema,
  assetCode: z.string().min(1).max(16),
  assetScale: z.number().int().min(0).max(18),
}) satisfies z.ZodType<Money>

/**
 * What a merchant types or a QR code carries: a payment pointer ($ilp.interledger-test.dev/alice)
 * or its https:// form. Only a shape check: the API's WalletAddressResolver does the SSRF-safe one.
 */
export const WalletAddressInputSchema = z
  .string()
  .trim()
  .min(1, { error: 'errors.walletAddress.required' })
  .max(512, { error: 'errors.walletAddress.tooLong' })
  .refine((value) => value.startsWith('$') || value.startsWith('https://'), {
    error: 'errors.walletAddress.format',
  })

/** Client-generated UUID sent as the Idempotency-Key header on every request that moves money. */
export const IdempotencyKeySchema = z.uuid({ error: 'errors.idempotencyKey' })

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
})

/** Every API error has this shape, so the web app can map `code` to a clear UI state. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  correlationId: z.string().optional(),
})

export type WalletAddressInput = z.infer<typeof WalletAddressInputSchema>
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>
export type ApiError = z.infer<typeof ApiErrorSchema>
