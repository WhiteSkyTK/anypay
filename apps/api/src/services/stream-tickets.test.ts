import { describe, expect, it } from 'vitest'
import { StreamTickets } from './stream-tickets'

describe('StreamTickets', () => {
  it('opens one shop’s feed for a minute, more than once (quick reconnects)', () => {
    let now = 1_000_000
    const tickets = new StreamTickets(() => now)
    const { ticket, expiresAt } = tickets.issue('SHOP1')
    expect(expiresAt.getTime()).toBe(now + 60_000)
    expect(tickets.shopFor(ticket)).toBe('SHOP1')
    expect(tickets.shopFor(ticket)).toBe('SHOP1')
    now += 60_000
    expect(tickets.shopFor(ticket)).toBeUndefined()
  })

  it('makes unguessable tickets', () => {
    const tickets = new StreamTickets()
    const issued = new Set(Array.from({ length: 50 }, () => tickets.issue('SHOP1').ticket))
    expect(issued.size).toBe(50)
    for (const ticket of issued) expect(ticket).toMatch(/^[\w-]{32}$/)
  })

  it('revokes only the signed-out shop’s tickets', () => {
    const tickets = new StreamTickets()
    const mine = tickets.issue('SHOP1').ticket
    const theirs = tickets.issue('SHOP2').ticket
    tickets.revokeShop('SHOP1')
    expect(tickets.shopFor(mine)).toBeUndefined()
    expect(tickets.shopFor(theirs)).toBe('SHOP2')
  })
})
