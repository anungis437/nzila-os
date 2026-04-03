/**
 * @nzila/zonga-events — Event Settlement Engine
 *
 * Integrates with @nzila/zonga-economics to compute event-specific
 * revenue splits (platform/promoter/artist), generate settlement records,
 * and reconcile event financials.
 */
import type {
  SplitRule,
  FeeRule,
  SplitCalculation,
  Currency,
} from '@nzila/zonga-economics'
import {
  applyFees,
  calculateSplits,
  DEFAULT_FEE_RULES,
  RevenueSource,
} from '@nzila/zonga-economics'
import type { EventSettlement, Event, TicketOrder } from './types'

// ── Types ─────────────────────────────────────────────────────────────────

export interface EventRevenueBreakdown {
  readonly eventId: string
  readonly ticketRevenue: number
  readonly orderCount: number
  readonly refundTotal: number
  readonly netRevenue: number
  readonly fees: number
  readonly splits: SplitCalculation
}

export interface SettlementReadiness {
  readonly ready: boolean
  readonly blockers: string[]
}

// ── Default Event Split Rules ─────────────────────────────────────────────

const now = new Date('2024-01-01')

/**
 * Standard event revenue splits.
 * These can be overridden per event agreement.
 * Platform share: 7.5% (commercial spec default).
 */
export const DEFAULT_EVENT_SPLITS: readonly SplitRule[] = [
  {
    id: 'evt-split-platform', orgId: '*', revenueSource: RevenueSource.TICKET_SALE,
    recipientAccountId: 'platform', recipientName: 'Platform',
    sharePercent: 7.5, priority: 0, isActive: true, effectiveFrom: now, effectiveUntil: null,
  },
  {
    id: 'evt-split-promoter', orgId: '*', revenueSource: RevenueSource.TICKET_SALE,
    recipientAccountId: 'promoter', recipientName: 'Promoter',
    sharePercent: 32.5, priority: 1, isActive: true, effectiveFrom: now, effectiveUntil: null,
  },
  {
    id: 'evt-split-artist', orgId: '*', revenueSource: RevenueSource.TICKET_SALE,
    recipientAccountId: 'artist', recipientName: 'Artist(s)',
    sharePercent: 60, priority: 2, isActive: true, effectiveFrom: now, effectiveUntil: null,
  },
] as const

/** Fee rules for ticket sales */
export const TICKET_FEE_RULES: readonly FeeRule[] = DEFAULT_FEE_RULES.filter(
  (r) => r.revenueSource === 'ticket_sale',
)

// ── Settlement Logic ──────────────────────────────────────────────────────

/**
 * Check whether an event is ready for settlement.
 * Must be completed/cancelled, all refunds processed, all scans finalized.
 */
export function checkSettlementReadiness(
  event: Event,
  pendingRefunds: number,
  pendingTransfers: number,
): SettlementReadiness {
  const blockers: string[] = []

  const terminalStatuses = ['completed', 'cancelled']
  if (!terminalStatuses.includes(event.status)) {
    blockers.push(`Event is still in "${event.status}" status — must be completed or cancelled`)
  }

  if (pendingRefunds > 0) {
    blockers.push(`${pendingRefunds} refund(s) still pending`)
  }

  if (pendingTransfers > 0) {
    blockers.push(`${pendingTransfers} ticket transfer(s) still pending`)
  }

  return { ready: blockers.length === 0, blockers }
}

/**
 * Compute full revenue breakdown for an event.
 */
export function computeEventRevenue(
  eventId: string,
  orders: readonly TicketOrder[],
  refundAmounts: readonly number[],
  splitRules?: readonly SplitRule[],
  feeRules?: readonly FeeRule[],
): EventRevenueBreakdown {
  const completedOrders = orders.filter((o) => o.status === 'confirmed')
  const ticketRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0)
  const refundTotal = refundAmounts.reduce((sum, r) => sum + r, 0)
  const netRevenue = Math.round((ticketRevenue - refundTotal) * 100) / 100

  const applicableFees = feeRules ?? [...TICKET_FEE_RULES]
  const rules = splitRules ?? [...DEFAULT_EVENT_SPLITS]

  const feeResult = applyFees({
    grossAmount: netRevenue,
    currency: 'USD' as Currency,
    revenueSource: RevenueSource.TICKET_SALE,
    rules: applicableFees,
  })

  const splits = calculateSplits({
    revenueEventId: `event-revenue-${eventId}`,
    grossAmount: netRevenue,
    currency: 'USD' as Currency,
    revenueSource: RevenueSource.TICKET_SALE,
    splitRules: rules,
    feeRules: applicableFees,
  })

  return {
    eventId,
    ticketRevenue,
    orderCount: completedOrders.length,
    refundTotal,
    netRevenue,
    fees: feeResult.fees.reduce((sum, f) => sum + f.amount, 0),
    splits,
  }
}

/**
 * Build an EventSettlement record from a revenue breakdown.
 */
export function buildEventSettlement(
  breakdown: EventRevenueBreakdown,
  artistId: string,
  _promoterId: string,
): EventSettlement {
  const artistSplit =
    breakdown.splits.distributions.find((d) => d.recipientName === 'Artist(s)')?.amount ?? 0
  const promoterSplit =
    breakdown.splits.distributions.find((d) => d.recipientName === 'Promoter')?.amount ?? 0
  const platformSplit =
    breakdown.splits.distributions.find((d) => d.recipientName === 'Platform')?.amount ?? 0

  return {
    eventId: breakdown.eventId,
    grossTicketSales: breakdown.ticketRevenue,
    totalRefunds: breakdown.refundTotal,
    totalChargebacks: 0,
    platformFees: platformSplit + breakdown.fees,
    promoterShare: promoterSplit,
    artistShares: [{ artistId, amount: artistSplit }],
    netRevenue: breakdown.netRevenue,
    currency: 'USD',
    settledAt: null,
  }
}
