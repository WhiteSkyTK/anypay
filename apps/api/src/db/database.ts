import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { mkdirSync } from 'node:fs'
import { lockDataDir } from './data-dir-lock'
import { MIGRATIONS, type Migration } from './migrations'
import * as schema from './schema'

/** Works the same on PGlite and on a real Postgres server; repositories only see this. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface DatabaseHandle {
  db: Database
  kind: 'postgres' | 'pglite'
  close(): Promise<void>
}

export interface OpenDatabaseOptions {
  /** A postgres:// URL (Neon, Supabase…). */
  url?: string
  /** Folder for the embedded PGlite database; omit for an in-memory one (tests). */
  dataDir?: string
}

/**
 * Real Postgres when DATABASE_URL is set; otherwise PGlite, Postgres compiled to WebAssembly,
 * so a fresh clone (or a judge's laptop) runs with no database to install. Same SQL either way.
 */
export async function openDatabase(options: OpenDatabaseOptions = {}): Promise<DatabaseHandle> {
  if (options.url) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import('postgres'),
      import('drizzle-orm/postgres-js'),
    ])
    // prepare: false keeps it working behind transaction-mode poolers (Neon, Supabase).
    const client = postgres(options.url, { max: 5, prepare: false })
    return { db: drizzle(client, { schema }), kind: 'postgres', close: () => client.end() }
  }
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ])
  if (!options.dataDir) {
    const client = new PGlite()
    await client.waitReady
    return { db: drizzle(client, { schema }), kind: 'pglite', close: () => client.close() }
  }
  mkdirSync(options.dataDir, { recursive: true })
  // Before PGlite touches the folder: a second process on the same files would corrupt them.
  const unlock = await lockDataDir(options.dataDir)
  try {
    const client = new PGlite(options.dataDir)
    await client.waitReady
    const close = () => client.close().finally(unlock)
    return { db: drizzle(client, { schema }), kind: 'pglite', close }
  } catch (error) {
    unlock()
    throw error
  }
}

// Any fixed number: makes concurrent API instances apply migrations one at a time.
const MIGRATION_LOCK_ID = 7_402_011

/** Applies migrations that haven't run yet, each in its own transaction. Returns their names. */
export async function migrate(
  db: Database,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<string[]> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const appliedNow: string[] = []
  for (const migration of migrations) {
    const applied = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`)
      const done = await tx
        .select()
        .from(schema.schemaMigrations)
        .where(sql`${schema.schemaMigrations.name} = ${migration.name}`)
      if (done.length > 0) return false
      for (const statement of migration.statements) await tx.execute(sql.raw(statement))
      await tx.insert(schema.schemaMigrations).values({ name: migration.name })
      return true
    })
    if (applied) appliedNow.push(migration.name)
  }
  return appliedNow
}
