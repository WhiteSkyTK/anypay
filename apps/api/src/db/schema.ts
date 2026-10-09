import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
  },
  (table) => [
    index('payments_shop_created_idx').on(table.shopId, table.createdAt),
    index('payments_status_idx').on(table.status),
  ],
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
