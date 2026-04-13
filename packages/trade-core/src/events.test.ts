import { describe, it, expect } from 'vitest'
import { TradeEventTypes } from './events'

describe('trade event constants', () => {
  it('exposes stable event names', () => {
    expect(TradeEventTypes.DEAL_CREATED).toBe('trade.deal.created')
    expect(TradeEventTypes.QUOTE_ACCEPTED).toBe('trade.quote.accepted')
    expect(TradeEventTypes.SHIPMENT_DELIVERED).toBe('trade.shipment.delivered')
    expect(TradeEventTypes.LISTING_UPDATED).toBe('trade.listing.updated')
  })
})
