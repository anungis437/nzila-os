import { describe, expect, it } from 'vitest'
import { CreateEventSchema, PurchaseTicketSchema, ScanTicketSchema } from './types'
describe('Zod 4 event ingress compatibility', () => {
  it('retains event date coercion and default description', () => {
    const event = { orgId: 'org-1', type: 'concert', title: 'Concert', venueId: 'venue-1', startsAt: '2026-01-01', endsAt: '2026-01-02', artistIds: ['artist-1'] }
    expect(CreateEventSchema.parse(event).startsAt).toBeInstanceOf(Date)
    expect(CreateEventSchema.parse(event).description).toBe('')
    expect(CreateEventSchema.safeParse({ ...event, artistIds: [] }).success).toBe(false)
    expect(CreateEventSchema.safeParse({ ...event, startsAt: 'invalid-date' }).success).toBe(false)
  })
  it('enforces ticket quantity bounds and scan defaults', () => {
    const order = { eventId: 'event-1', buyerId: 'buyer-1', buyerEmail: 'buyer@example.com', items: [{ tier: 'general', quantity: 1, holderName: 'Buyer', holderEmail: 'buyer@example.com' }] }
    expect(PurchaseTicketSchema.safeParse(order).success).toBe(true)
    expect(PurchaseTicketSchema.safeParse({ ...order, items: [{ ...order.items[0], quantity: 11 }] }).success).toBe(false)
    expect(ScanTicketSchema.parse({ ticketId: 'ticket-1', eventId: 'event-1', scannedBy: 'staff-1' }).offlineSync).toBe(false)
  })
})
