/**
 * @nzila/zonga-events — Capacity Engine
 *
 * Hard-enforced capacity limits on ticket inventory.
 * No overselling — ever.
 */
import type { TicketInventory, TierCapacity, CapacityModel, TicketTier } from './types'

export interface CapacityCheck {
  readonly available: boolean
  readonly tier: TicketTier
  readonly requestedQuantity: number
  readonly availableQuantity: number
  readonly reason: string | null
}

/**
 * Check if a given quantity of tickets can be purchased for a tier.
 * Enforces hard capacity limits and per-order maximums.
 */
export function checkCapacity(
  inventory: TicketInventory,
  requestedQuantity: number,
  now?: Date,
): CapacityCheck {
  const currentTime = now ?? new Date()
  const available = inventory.totalQuantity - inventory.soldQuantity - inventory.reservedQuantity

  if (!inventory.isOnSale) {
    return {
      available: false,
      tier: inventory.tier,
      requestedQuantity,
      availableQuantity: available,
      reason: 'Tickets are not currently on sale',
    }
  }

  if (currentTime < inventory.salesStartAt) {
    return {
      available: false,
      tier: inventory.tier,
      requestedQuantity,
      availableQuantity: available,
      reason: `Sales start at ${inventory.salesStartAt.toISOString()}`,
    }
  }

  if (currentTime > inventory.salesEndAt) {
    return {
      available: false,
      tier: inventory.tier,
      requestedQuantity,
      availableQuantity: available,
      reason: 'Sales have ended',
    }
  }

  if (requestedQuantity > inventory.maxPerOrder) {
    return {
      available: false,
      tier: inventory.tier,
      requestedQuantity,
      availableQuantity: available,
      reason: `Maximum ${inventory.maxPerOrder} tickets per order`,
    }
  }

  if (requestedQuantity > available) {
    return {
      available: false,
      tier: inventory.tier,
      requestedQuantity,
      availableQuantity: available,
      reason: available === 0 ? 'Sold out' : `Only ${available} tickets remaining`,
    }
  }

  return {
    available: true,
    tier: inventory.tier,
    requestedQuantity,
    availableQuantity: available,
    reason: null,
  }
}

/**
 * Build a capacity model for an event across all tiers.
 */
export function buildCapacityModel(
  eventId: string,
  inventories: readonly TicketInventory[],
): CapacityModel {
  const tiers: TierCapacity[] = inventories
    .filter((inv) => inv.eventId === eventId)
    .map((inv) => ({
      tier: inv.tier,
      totalQuantity: inv.totalQuantity,
      soldQuantity: inv.soldQuantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: inv.totalQuantity - inv.soldQuantity - inv.reservedQuantity,
      price: 0, // set by pricing engine
      currency: 'USD',
    }))

  const totalCapacity = tiers.reduce((sum, t) => sum + t.totalQuantity, 0)

  return { eventId, totalCapacity, tiers }
}

/**
 * Compute sell-through rate for an event.
 */
export function computeSellThrough(model: CapacityModel): {
  totalCapacity: number
  totalSold: number
  sellThroughPercent: number
} {
  const totalSold = model.tiers.reduce((sum, t) => sum + t.soldQuantity, 0)
  const sellThroughPercent =
    model.totalCapacity > 0
      ? Math.round((totalSold / model.totalCapacity) * 10000) / 100
      : 0

  return { totalCapacity: model.totalCapacity, totalSold, sellThroughPercent }
}
