import { describe, expect, it } from 'vitest'
import { estimateCreatorEconomics } from '../creator-economics'

describe('estimateCreatorEconomics', () => {
  it('computes available payout after fees and collaborator splits', () => {
    const result = estimateCreatorEconomics({
      grossRevenueUsd: 1000,
      platformFeePct: 20,
      collaboratorRoyaltyPct: 25,
      priorPayoutsUsd: 300,
    })

    expect(result.netRevenueUsd).toBe(800)
    expect(result.creatorShareUsd).toBe(600)
    expect(result.availablePayoutUsd).toBe(300)
  })

  it('never returns negative payout availability', () => {
    const result = estimateCreatorEconomics({
      grossRevenueUsd: 300,
      platformFeePct: 10,
      collaboratorRoyaltyPct: 40,
      priorPayoutsUsd: 500,
    })

    expect(result.availablePayoutUsd).toBe(0)
  })
})
