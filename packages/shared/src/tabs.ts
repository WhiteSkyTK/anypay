import { z } from 'zod/mini'
import { DecimalAmountSchema } from './api'
import { MoneySchema, WalletAddressInputSchema } from './schemas'

// The HTTP contract for the Offline Digital Tab (Feature 4). See voucher.ts for the protocol.

/** The P-256 public half of the customer's device key, as a JWK. */
export const PublicKeyJwkSchema = z.object({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: z.string().check(z.regex(/^[\w-]{43}$/)),
  y: z.string().check(z.regex(/^[\w-]{43}$/)),
})

export const TabStatusSchema = z.enum(['awaiting-consent', 'active', 'failed'])

export const TabFailureSchema = z.enum(['consent_declined', 'consent_invalid', 'consent_timeout'])

export const OpenTabRequestSchema = z.object({
  customerWallet: WalletAddressInputSchema,
  /** Most the tab may take per week, in the customer's own currency (what they approve). */
  weeklyCap: DecimalAmountSchema,
  /** The name the shop sees for this tab, e.g. "Thabo". */
  label: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, { error: 'errors.tabLabel.required' }),
      z.maxLength(30, { error: 'errors.tabLabel.tooLong' }),
    ),
  publicKey: PublicKeyJwkSchema,
})

/** A tab as its customer sees it. */
export const TabSummarySchema = z.object({
  id: z.string(),
  shopId: z.string(),
  shopName: z.string(),
  label: z.string(),
  status: TabStatusSchema,
  failure: z.optional(TabFailureSchema),
  /** The weekly cap the customer approved, in their currency. */
  cap: MoneySchema,
  /** The same cap in the shop's currency (fees and exchange included), once the tab is active. */
  shopCap: z.optional(MoneySchema),
  /** What is left this week, in the shop's currency. */
  remaining: z.optional(MoneySchema),
  /** When the current week started; the cap resets every 7 days from here. */
  weekStartedAt: z.iso.datetime({ offset: true }),
})

export const OpenTabResponseSchema = z.object({
  tab: TabSummarySchema,
  /** Where the customer approves the weekly cap in their own wallet. */
  consentUrl: z.optional(z.url()),
})

/** What a shop's phone keeps so it can check vouchers with no signal. */
export const ShopTabSchema = z.object({
  id: z.string(),
  label: z.string(),
  publicKey: PublicKeyJwkSchema,
  shopCap: MoneySchema,
  remaining: MoneySchema,
  weekStartedAt: z.iso.datetime({ offset: true }),
})

export const ShopTabsResponseSchema = z.object({ tabs: z.array(ShopTabSchema) })

/** A voucher as either phone sends it (the tab id is in the URL). */
export const VoucherSubmissionSchema = z.object({
  shopId: z.string().check(z.regex(/^[\w-]{1,32}$/)),
  amount: z.string().check(z.regex(/^[1-9]\d{0,17}$/)),
  nonce: z.string().check(z.regex(/^[\w-]{12,32}$/)),
  ts: z.int().check(z.positive()),
  signature: z.string().check(z.regex(/^[\w-]{86}$/)),
})

export const VoucherRejectionSchema = z.enum([
  'expired',
  'cap_reached',
  'tab_inactive',
  'grant_limit',
  'insufficient_funds',
  'payment_failed',
  'timeout',
])

export const VoucherStatusSchema = z.object({
  nonce: z.string(),
  tabId: z.string(),
  amount: MoneySchema,
  /** settling: being paid; settled: the shop has the money; rejected: never will (see reason). */
  status: z.enum(['settling', 'settled', 'rejected']),
  reason: z.optional(VoucherRejectionSchema),
  paymentId: z.optional(z.uuid()),
})

export type PublicKeyJwkInput = z.infer<typeof PublicKeyJwkSchema>
export type TabStatus = z.infer<typeof TabStatusSchema>
export type TabFailure = z.infer<typeof TabFailureSchema>
export type OpenTabRequest = z.infer<typeof OpenTabRequestSchema>
export type TabSummary = z.infer<typeof TabSummarySchema>
export type OpenTabResponse = z.infer<typeof OpenTabResponseSchema>
export type ShopTab = z.infer<typeof ShopTabSchema>
export type ShopTabsResponse = z.infer<typeof ShopTabsResponseSchema>
export type VoucherSubmission = z.infer<typeof VoucherSubmissionSchema>
export type VoucherRejection = z.infer<typeof VoucherRejectionSchema>
export type VoucherStatus = z.infer<typeof VoucherStatusSchema>
