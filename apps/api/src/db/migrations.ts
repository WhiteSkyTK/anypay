/**
 * Schema migrations, applied in order at startup and never edited once released: add a new entry
 * instead. Plain SQL (no drizzle-kit) keeps the toolchain small; each statement runs on its own
 * because Postgres prepared statements take one command at a time.
 */
export interface Migration {
  name: string
  statements: readonly string[]
}

export const MIGRATIONS: readonly Migration[] = [
  {
    name: '0001_shops_payments_idempotency',
    statements: [
      `CREATE TABLE shops (
        id text PRIMARY KEY,
        name text NOT NULL,
        wallet_address text NOT NULL,
        asset_code text NOT NULL,
        asset_scale integer NOT NULL,
        merchant_token_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE payments (
        id uuid PRIMARY KEY,
        shop_id text NOT NULL REFERENCES shops(id),
        status text NOT NULL,
        failure text,
        amount_value text NOT NULL,
        asset_code text NOT NULL,
        asset_scale integer NOT NULL,
        debit_value text,
        debit_asset_code text,
        debit_asset_scale integer,
        session_ciphertext text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      )`,
      'CREATE INDEX payments_shop_created_idx ON payments (shop_id, created_at)',
      'CREATE INDEX payments_status_idx ON payments (status)',
      `CREATE TABLE idempotency_keys (
        scope text NOT NULL,
        key text NOT NULL,
        request_hash text NOT NULL,
        status_code integer,
        response_body text,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (scope, key)
      )`,
    ],
  },
  {
    // Responses were stored in plain text before they were encrypted, including new shops'
    // merchant tokens. They are only a retry cache, so clearing them loses nothing.
    name: '0002_clear_plaintext_idempotency_responses',
    statements: ['DELETE FROM idempotency_keys'],
  },
  {
    name: '0003_tabs_vouchers',
    statements: [
      `CREATE TABLE tabs (
        id text PRIMARY KEY,
        shop_id text NOT NULL REFERENCES shops(id),
        status text NOT NULL,
        failure text,
        label text NOT NULL,
        cap_value text NOT NULL,
        cap_asset_code text NOT NULL,
        cap_asset_scale integer NOT NULL,
        shop_cap_value text,
        interval_start timestamptz NOT NULL,
        public_key jsonb NOT NULL,
        session_ciphertext text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      'CREATE INDEX tabs_shop_status_idx ON tabs (shop_id, status)',
      `CREATE TABLE vouchers (
        nonce text PRIMARY KEY,
        tab_id text NOT NULL REFERENCES tabs(id),
        amount_value text NOT NULL,
        signed_at timestamptz NOT NULL,
        signature text NOT NULL,
        status text NOT NULL,
        reason text,
        payment_id uuid REFERENCES payments(id),
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      'CREATE INDEX vouchers_tab_signed_idx ON vouchers (tab_id, signed_at)',
      'ALTER TABLE payments ADD COLUMN tab_id text REFERENCES tabs(id)',
    ],
  },
  {
    // The wallet refused a tab payment for its weekly limit: that week counts as full.
    name: '0004_tab_limit_reached',
    statements: ['ALTER TABLE tabs ADD COLUMN limit_reached_at timestamptz'],
  },
]
