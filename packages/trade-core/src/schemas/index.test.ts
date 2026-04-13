import { describe, it, expect } from 'vitest'
import {
  createPartySchema,
  updatePartySchema,
  createListingSchema,
  updateListingSchema,
  addListingMediaSchema,
  createDealSchema,
  transitionDealSchema,
  createQuoteSchema,
  transitionQuoteSchema,
  createFinancingSchema,
  createShipmentSchema,
  updateShipmentMilestoneSchema,
  uploadDocumentSchema,
  createCommissionSchema,
  finalizeCommissionSchema,
  paginationSchema,
} from './index'
import {
  TradeDealStage,
  TradeDocType,
  TradeListingStatus,
  TradeListingType,
  TradeMediaType,
  TradePartyRole,
  TradePartyStatus,
  TradeQuoteStatus,
} from '../enums'

const id1 = '11111111-1111-4111-8111-111111111111'
const id2 = '22222222-2222-4222-8222-222222222222'

describe('trade-core schemas', () => {
  it('applies defaults and coercions for common schemas', () => {
    const pagination = paginationSchema.parse({})
    expect(pagination).toEqual({ limit: 20, offset: 0 })

    const party = createPartySchema.parse({
      role: TradePartyRole.SELLER,
      name: 'Acme',
      contactEmail: 'seller@acme.test',
      companyName: 'Acme',
      country: 'USA',
    })
    expect(party.metadata).toEqual({})

    const listing = createListingSchema.parse({
      partyId: id1,
      listingType: TradeListingType.GENERIC,
      title: 'Lot A',
      currency: 'usd',
      askingPrice: '100.50',
    })
    expect(listing.currency).toBe('USD')
    expect(listing.description).toBe('')
    expect(listing.quantity).toBe(1)
  })

  it('validates updates, transitions, and document schemas', () => {
    const updatedParty = updatePartySchema.parse({
      id: id1,
      status: TradePartyStatus.ACTIVE,
      name: 'Updated',
    })
    expect(updatedParty.id).toBe(id1)

    const updatedListing = updateListingSchema.parse({
      id: id1,
      status: TradeListingStatus.ACTIVE,
    })
    expect(updatedListing.status).toBe(TradeListingStatus.ACTIVE)

    const media = addListingMediaSchema.parse({
      listingId: id1,
      mediaType: TradeMediaType.IMAGE,
      storageKey: 'media/a.png',
    })
    expect(media.sortOrder).toBe(0)

    const deal = createDealSchema.parse({
      sellerPartyId: id1,
      buyerPartyId: id2,
      totalValue: '1234.00',
      currency: 'zar',
    })
    expect(deal.currency).toBe('ZAR')

    const transition = transitionDealSchema.parse({
      dealId: id1,
      toStage: TradeDealStage.QUALIFIED,
    })
    expect(transition.metadata).toEqual({})

    const quote = createQuoteSchema.parse({
      dealId: id1,
      terms: { incoterm: 'FOB' },
      unitPrice: '10.00',
      quantity: 2,
      currency: 'usd',
    })
    expect(quote.currency).toBe('USD')

    const quoteTransition = transitionQuoteSchema.parse({
      quoteId: id1,
      toStatus: TradeQuoteStatus.SENT,
    })
    expect(quoteTransition.metadata).toEqual({})

    const financing = createFinancingSchema.parse({
      dealId: id1,
      terms: { apr: 3.4 },
    })
    expect(financing.provider).toBeUndefined()

    const shipment = createShipmentSchema.parse({
      dealId: id1,
      originCountry: 'ZAF',
      destinationCountry: 'USA',
    })
    expect(shipment.lane).toBeUndefined()

    const milestone = updateShipmentMilestoneSchema.parse({
      shipmentId: id1,
      milestoneName: 'booked',
    })
    expect(milestone.notes).toBeUndefined()

    const doc = uploadDocumentSchema.parse({
      dealId: id1,
      docType: TradeDocType.INVOICE,
      title: 'Invoice 1',
      storageKey: 'docs/1.pdf',
      contentHash: 'abc123',
    })
    expect(doc.docType).toBe(TradeDocType.INVOICE)

    const commission = createCommissionSchema.parse({
      dealId: id1,
      partyId: id2,
      policy: { pct: 4 },
      currency: 'eur',
    })
    expect(commission.currency).toBe('EUR')

    const finalized = finalizeCommissionSchema.parse({
      commissionId: id1,
      calculatedAmount: '48.00',
    })
    expect(finalized.calculatedAmount).toBe('48.00')
  })

  it('rejects invalid data on key branches', () => {
    expect(() => createListingSchema.parse({
      partyId: id1,
      listingType: TradeListingType.VEHICLE,
      title: 'Lot B',
      currency: 'USD',
      askingPrice: 'not-a-number',
    })).toThrow()

    expect(() => transitionDealSchema.parse({
      dealId: id1,
      toStage: 'bad_stage',
    })).toThrow()

    expect(() => finalizeCommissionSchema.parse({
      commissionId: id1,
      calculatedAmount: '12.999',
    })).toThrow()
  })
})
