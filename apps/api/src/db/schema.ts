import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Keep in sync with migrations.ts: tests run every repository against the real schema, so a
// mismatch fails CI.

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const shops = pgTable('shops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  walletAddress: text('wallet_address').notNull(),
  assetCode: text('asset_code').notNull(),
  assetScale: integer('asset_scale').notNull(),
  /** SHA-256 of the merchant token; the token itself is only ever on the merchant's phone. */
  merchantTokenHash: text('merchant_token_hash').notNull(),
  createdAt: createdAt(),
})

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id),
    status: text('status').notNull(),
    failure: text('failure'),
    // Money as minor-unit strings, never floats (CLAUDE.md money rule).
    amountValue: text('amount_value').notNull(),
    assetCode: text('asset_code').notNull(),
    assetScale: integer('asset_scale').notNull(),
    debitValue: text('debit_value'),
    debitAssetCode: text('debit_asset_code'),
    debitAssetScale: integer('debit_asset_scale'),
    /**
     * The whole PaymentSession, AES-256-GCM encrypted: it holds grant tokens and the customer's
     * wallet address, so neither is ever stored in clear text.
     */
    sessionCiphertext: text('session_ciphertext').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** Set when this payment settles a tab voucher (an offline sale). */
    tabId: text('tab_id'),
  },
  (table) => [
    index('payments_shop_created_idx').on(table.shopId, table.createdAt),
    index('payments_status_idx').on(table.status),
  ],
)

/** A customer's tab at one shop: a weekly-capped outgoing-payment grant plus a device key. */
export const tabs = pgTable(
  'tabs',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id),
    status: text('status').notNull(),
    failure: text('failure'),
    label: text('label').notNull(),
    /** The weekly cap the customer approved, in their currency. */
    capValue: text('cap_value').notNull(),
    capAssetCode: text('cap_asset_code').notNull(),
    capAssetScale: integer('cap_asset_scale').notNull(),
    /** The same cap in the shop's currency (a fixed-send quote), once the tab is active. */
    shopCapValue: text('shop_cap_value'),
    intervalStart: timestamp('interval_start', { withTimezone: true }).notNull(),
    /** The public half of the customer's device key (JWK); vouchers are checked against it. */
    publicKey: jsonb('public_key').notNull(),
    /** Customer wallet, consent request and grant tokens, AES-256-GCM encrypted. */
    sessionCiphertext: text('session_ciphertext').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tabs_shop_status_idx').on(table.shopId, table.status)],
)

/** Every voucher a server has seen, keyed by nonce: whichever phone syncs first wins. */
export const vouchers = pgTable(
  'vouchers',
  {
    nonce: text('nonce').primaryKey(),
    tabId: text('tab_id')
      .notNull()
      .references(() => tabs.id),
    /** In the shop's minor units, as signed. */
    amountValue: text('amount_value').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
    signature: text('signature').notNull(),
    /** 'settling' (paid or being paid; see the payment) or 'rejected' (see reason). */
    status: text('status').notNull(),
    reason: text('reason'),
    paymentId: uuid('payment_id').references(() => payments.id),
    createdAt: createdAt(),
  },
  (table) => [index('vouchers_tab_signed_idx').on(table.tabId, table.signedAt)],
)

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    /** SHA-256 of the request, so a reused key with a different body is refused. */
    requestHash: text('request_hash').notNull(),
    /** Null while the first request is still running. */
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
)

export const schemaMigrations = pgTable('schema_migrations', {
  name: text('name').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
})
