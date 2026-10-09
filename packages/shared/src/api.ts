import { z } from 'zod'
import { MoneySchema, WalletAddressInputSchema } from './schemas'

// The HTTP contract between the web app and the API. Both sides parse with these schemas, so a
// change on one side that the other doesn't expect fails loudly in tests instead of in a shop.

/** Steps of an online payment (the API's state machine), in order. */
export const PaymentStatusSchema = z.enum([
  'created',
  'incoming-payment-created',
  'quoted',
  'awaiting-consent',
  'sending',
  'completed',
  'failed',
])

/** Every way a payment can fail; each has its own message in the app. */
export const PaymentFailureSchema = z.enum([
  'consent_declined',
  'consent_invalid',
  'consent_timeout',
  'quote_expired',
  'insufficient_funds',
  'grant_limit',
  'payment_failed',
  'timeout',
])

/** What anyone with the (unguessable) payment id, or the shop's merchant, may see. */
export const PaymentSummarySchema = z.object({
  id: z.uuid(),
  shopId: z.string(),
  shopName: z.string(),
  status: PaymentStatusSchema,
  failure: PaymentFailureSchema.optional(),
  /** What the shop asked for, in the shop's currency. */
  amount: MoneySchema,
  /** What the customer pays, fees and exchange included (once quoted). */
  debitAmount: MoneySchema.optional(),
  createdAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).optional(),
})

export const ShopSchema = z.object({
  id: z.string(),
  name: z.string(),
  walletAddress: z.url(),
  assetCode: z.string(),
  assetScale: z.number().int(),
})

export const ShopNameSchema = z
  .string()
  .trim()
  .min(2, { error: 'errors.shopName.tooShort' })
  .max(60, { error: 'errors.shopName.tooLong' })

/** A decimal amount as typed on the keypad: '25', '25.5', '25,50'. */
export const DecimalAmountSchema = z
  .string()
  .trim()
  .max(20, { error: 'errors.money.tooLarge' })
  .regex(/^\d+(?:[.,]\d+)?$/, { error: 'errors.money.invalid' })

export const WalletLookupRequestSchema = z.object({ walletAddress: WalletAddressInputSchema })

export const WalletLookupResponseSchema = z.object({
  walletAddress: z.url(),
  publicName: z.string().optional(),
  assetCode: z.string(),
  assetScale: z.number().int(),
})

export const CreateShopRequestSchema = z.object({
  name: ShopNameSchema,
  walletAddress: WalletAddressInputSchema,
})

export const CreateShopResponseSchema = z.object({
  shop: ShopSchema,
  /** Proves this phone runs the shop: needed for the live feed and CSV. Shown once. */
  merchantToken: z.string(),
})

export const CreatePaymentRequestSchema = z.object({
  amount: DecimalAmountSchema,
  customerWallet: WalletAddressInputSchema,
})

export const QuoteSchema = z.object({
  debitAmount: MoneySchema,
  receiveAmount: MoneySchema,
  expiresAt: z.iso.datetime({ offset: true }).optional(),
})

export const CreatePaymentResponseSchema = z.object({
  payment: PaymentSummarySchema,
  quote: QuoteSchema.optional(),
  /** Where the customer approves the payment in their own wallet. */
  consentUrl: z.url().optional(),
})

export const ShopPaymentsResponseSchema = z.object({
  payments: z.array(PaymentSummarySchema),
  /** Sum of completed payments in the period, in the shop's currency. */
  total: MoneySchema,
})

export const ConfigResponseSchema = z.object({
  demoMode: z.boolean(),
  version: z.string(),
})

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>
export type PaymentFailure = z.infer<typeof PaymentFailureSchema>
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>
export type Shop = z.infer<typeof ShopSchema>
export type WalletLookupResponse = z.infer<typeof WalletLookupResponseSchema>
export type CreateShopRequest = z.infer<typeof CreateShopRequestSchema>
export type CreateShopResponse = z.infer<typeof CreateShopResponseSchema>
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>
export type Quote = z.infer<typeof QuoteSchema>
export type ShopPaymentsResponse = z.infer<typeof ShopPaymentsResponseSchema>
export type ConfigResponse = z.infer<typeof ConfigResponseSchema>
