import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/database'
import { idempotencyKeys } from '../db/schema'

export type IdempotencyBegin =
  | { kind: 'started' }
  | { kind: 'replay'; statusCode: number; body: string }
  | { kind: 'in_progress' }
  | { kind: 'mismatch' }

/**
 * Remembers the response to each Idempotency-Key, so a retried request (a phone that lost signal
 * and tried again) gets the original result instead of creating a second payment.
 */
export class IdempotencyRepository {
  readonly #db: Database

  constructor(db: Database) {
    this.#db = db
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
    return { kind: 'replay', statusCode: existing.statusCode, body: existing.responseBody }
  }

  async complete(scope: string, key: string, statusCode: number, body: string): Promise<void> {
    await this.#db
      .update(idempotencyKeys)
      .set({ statusCode, responseBody: body })
      .where(this.#match(scope, key))
  }

  /** Forgets a key after a server error, so the client's retry runs again instead of replaying it. */
  async abandon(scope: string, key: string): Promise<void> {
    await this.#db.delete(idempotencyKeys).where(this.#match(scope, key))
  }

  #match(scope: string, key: string) {
    return and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key))
  }
}
