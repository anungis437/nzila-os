export interface CreatorEconomicsInput {
  grossRevenueUsd: number
  platformFeePct: number
  collaboratorRoyaltyPct: number
  priorPayoutsUsd: number
}

export interface CreatorEconomicsSnapshot {
  netRevenueUsd: number
  creatorShareUsd: number
  availablePayoutUsd: number
}

function toMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function estimateCreatorEconomics(input: CreatorEconomicsInput): CreatorEconomicsSnapshot {
  const netRevenue = input.grossRevenueUsd * (1 - input.platformFeePct / 100)
  const creatorShare = netRevenue * (1 - input.collaboratorRoyaltyPct / 100)
  const availablePayout = Math.max(0, creatorShare - input.priorPayoutsUsd)

  return {
    netRevenueUsd: toMoney(netRevenue),
    creatorShareUsd: toMoney(creatorShare),
    availablePayoutUsd: toMoney(availablePayout),
  }
}
