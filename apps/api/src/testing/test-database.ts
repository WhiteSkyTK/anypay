import { randomBytes } from 'node:crypto'
import { type DatabaseHandle, migrate, openDatabase } from '../db/database'
import { TokenCipher } from '../lib/token-cipher'

/** A fresh, migrated, in-memory Postgres (PGlite) per test file: real SQL, no setup. */
export async function openTestDatabase(): Promise<DatabaseHandle> {
  const handle = await openDatabase()
  await migrate(handle.db)
  return handle
}

/** A cipher with a random key generated per run, so no key is ever committed. */
export const testCipher = () => new TokenCipher(randomBytes(32))

/** Rows from a raw `db.execute()` result: PGlite returns { rows }, postgres.js an array. */
export function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows: T[] }).rows ?? [])
}
