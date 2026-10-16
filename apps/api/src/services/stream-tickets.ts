import { randomBytes } from 'node:crypto'

const TICKET_TTL_MS = 60_000
// Far more than open feeds ever need; a flood of requests can't grow memory past this.
const MAX_TICKETS = 10_000

interface Ticket {
  shopId: string
  expiresAt: number
}

/**
 * Short-lived passes for a shop's live feed. EventSource can't send headers, so without these the
 * merchant token would travel in the feed's URL, where proxies and hosting logs can keep it. A
 * ticket opens the feed for one minute (any number of times, so the browser's own quick
 * reconnect works); after that the phone asks for a new one with its token, in a header.
 * In memory: fine for one API instance (see README, known limitations).
 */
export class StreamTickets {
  readonly #tickets = new Map<string, Ticket>()
  readonly #now: () => number

  constructor(now: () => number = Date.now) {
    this.#now = now
  }

  /** A new ticket for the shop's feed, and when it stops working. */
  issue(shopId: string): { ticket: string; expiresAt: Date } {
    this.#sweep()
    const ticket = randomBytes(24).toString('base64url')
    const expiresAt = this.#now() + TICKET_TTL_MS
    this.#tickets.set(ticket, { shopId, expiresAt })
    return { ticket, expiresAt: new Date(expiresAt) }
  }

  /** The shop whose feed this ticket opens, if it is still valid. */
  shopFor(ticket: string): string | undefined {
    const found = this.#tickets.get(ticket)
    if (!found) return undefined
    if (found.expiresAt > this.#now()) return found.shopId
    this.#tickets.delete(ticket)
    return undefined
  }

  /** Other phones were signed out: tickets they were given must stop working too. */
  revokeShop(shopId: string): void {
    for (const [ticket, found] of this.#tickets) {
      if (found.shopId === shopId) this.#tickets.delete(ticket)
    }
  }

  #sweep(): void {
    const now = this.#now()
    for (const [ticket, found] of this.#tickets) {
      if (found.expiresAt <= now) this.#tickets.delete(ticket)
    }
    // Still full: drop the oldest (a Map keeps insertion order).
    for (const ticket of this.#tickets.keys()) {
      if (this.#tickets.size < MAX_TICKETS) break
      this.#tickets.delete(ticket)
    }
  }
}
