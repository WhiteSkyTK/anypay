import { z } from 'zod/mini'
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
  failure: z.optional(PaymentFailureSchema),
  /** What the shop asked for, in the shop's currency. */
  amount: MoneySchema,
  /** What the customer pays, fees and exchange included (once quoted). */
  debitAmount: z.optional(MoneySchema),
  /** Set when the payment settles a voucher from this tab (an offline sale), not a scan-and-pay. */
  tabId: z.optional(z.string()),
  createdAt: z.iso.datetime({ offset: true }),
  completedAt: z.optional(z.iso.datetime({ offset: true })),
})

export const ShopSchema = z.object({
  id: z.string(),
  name: z.string(),
  walletAddress: z.url(),
  assetCode: z.string(),
  assetScale: z.int(),
})

// Control characters and bidi overrides: invisible on screen, but they can make a name look like
// another shop's (or reverse part of it) on the poster and in customers' wallets.
const HIDDEN_CHARACTERS = /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u

export const ShopNameSchema = z.string().check(
  z.trim(),
  z.minLength(2, { error: 'errors.shopName.tooShort' }),
  z.maxLength(60, { error: 'errors.shopName.tooLong' }),
  z.refine((name) => !HIDDEN_CHARACTERS.test(name), { error: 'errors.shopName.characters' }),
)

/** At most nine whole digits (under one billion): far beyond any sale, safe for every currency. */
const MAX_WHOLE_DIGITS = 9

const wholeDigits = (amount: string) =>
  (amount.split(/[.,]/)[0] ?? '').replace(/^0+(?=\d)/, '').length

/** A decimal amount as typed on the keypad: '25', '25.5', '25,50'. */
export const DecimalAmountSchema = z.string().check(
  z.trim(),
  z.maxLength(20, { error: 'errors.money.tooLarge' }),
  z.regex(/^\d+(?:[.,]\d+)?$/, { error: 'errors.money.invalid' }),
  z.refine((amount) => wholeDigits(amount) <= MAX_WHOLE_DIGITS, { error: 'errors.money.tooLarge' }),
)

export const WalletLookupRequestSchema = z.object({ walletAddress: WalletAddressInputSchema })

export const WalletLookupResponseSchema = z.object({
  walletAddress: z.url(),
  publicName: z.optional(z.string()),
  assetCode: z.string(),
  assetScale: z.int(),
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

/**
 * "Sign out other phones": the token this phone will use from now on, chosen by the phone (32
 * random bytes, base64url), so a lost response can't leave it without a working token.
 */
export const ReplaceMerchantTokenRequestSchema = z.object({
  token: z.string().check(z.regex(/^[\w-]{43}$/)),
})

/** A one-minute pass that opens the shop's live feed, so the merchant token stays out of URLs. */
export const StreamTicketResponseSchema = z.object({
  ticket: z.string(),
  expiresAt: z.iso.datetime({ offset: true }),
})

export const CreatePaymentRequestSchema = z.object({
  amount: DecimalAmountSchema,
  customerWallet: WalletAddressInputSchema,
})

export const QuoteSchema = z.object({
  debitAmount: MoneySchema,
  receiveAmount: MoneySchema,
  expiresAt: z.optional(z.iso.datetime({ offset: true })),
})

export const CreatePaymentResponseSchema = z.object({
  payment: PaymentSummarySchema,
  quote: z.optional(QuoteSchema),
  /** Where the customer approves the payment in their own wallet. */
  consentUrl: z.optional(z.url()),
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
export type ReplaceMerchantTokenRequest = z.infer<typeof ReplaceMerchantTokenRequestSchema>
export type StreamTicketResponse = z.infer<typeof StreamTicketResponseSchema>
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>
export type Quote = z.infer<typeof QuoteSchema>
export type ShopPaymentsResponse = z.infer<typeof ShopPaymentsResponseSchema>
export type ConfigResponse = z.infer<typeof ConfigResponseSchema>
