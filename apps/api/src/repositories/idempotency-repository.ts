import { and, eq, lt } from 'drizzle-orm'
import type { Database } from '../db/database'
import { idempotencyKeys } from '../db/schema'
import type { TokenCipher } from '../lib/token-cipher'

export type IdempotencyBegin =
  | { kind: 'started' }
  | { kind: 'replay'; statusCode: number; body: string }
  | { kind: 'in_progress' }
  | { kind: 'mismatch' }

/**
 * Remembers the response to each Idempotency-Key, so a retried request (a phone that lost signal
 * and tried again) gets the original result instead of creating a second payment. Responses are
 * stored encrypted: some carry secrets (a new shop's merchant token).
 */
export class IdempotencyRepository {
  readonly #db: Database
  readonly #cipher: TokenCipher

  constructor(db: Database, cipher: TokenCipher) {
    this.#db = db
    this.#cipher = cipher
  }

  /** Claims a key for this request, or reports what an earlier request with it did. */
  async begin(scope: string, key: string, requestHash: string): Promise<IdempotencyBegin> {
    // The insert is atomic, so two simultaneous retries can't both start.
    const inserted = await this.#db
      .insert(idempotencyKeys)
      .values({ scope, key, requestHash })
      .onConflictDoNothing()
      .returning()
    if (inserted.length > 0) return { kind: 'started' }

    const [existing] = await this.#db.select().from(idempotencyKeys).where(this.#match(scope, key))
    if (!existing) return this.begin(scope, key, requestHash) // abandoned in between: try again
    if (existing.requestHash !== requestHash) return { kind: 'mismatch' }
    if (existing.statusCode === null || existing.responseBody === null)
      return { kind: 'in_progress' }
    const body = this.#cipher.decrypt(existing.responseBody)
    return { kind: 'replay', statusCode: existing.statusCode, body }
  }

  async complete(scope: string, key: string, statusCode: number, body: string): Promise<void> {
    await this.#db
      .update(idempotencyKeys)
      .set({ statusCode, responseBody: this.#cipher.encrypt(body) })
      .where(this.#match(scope, key))
  }

  /** Forgets a key after a server error, so the client's retry runs again instead of replaying it. */
  async abandon(scope: string, key: string): Promise<void> {
    await this.#db.delete(idempotencyKeys).where(this.#match(scope, key))
  }

  /** Retries come within minutes; older records only keep secrets around. Returns how many went. */
  async purgeOlderThan(cutoff: Date): Promise<number> {
    const removed = await this.#db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.createdAt, cutoff))
      .returning({ key: idempotencyKeys.key })
    return removed.length
  }

  #match(scope: string, key: string) {
    return and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key))
  }
}
