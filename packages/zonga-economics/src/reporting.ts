/**
 * @nzila/zonga-economics — Economics Reporting
 *
 * Aggregation and reporting types for dashboards: creator revenue
 * reports, org-level financial summaries, payout history,
 * and platform-wide metrics.
 *
 * All money values in integer minor units (cents).
 *
 * @module @nzila/zonga-economics/reporting
 */

import type { RevenueSource, Currency } from './types'

// ── Creator Revenue Report ──────────────────────────────────────────────────

export interface CreatorRevenueReport {
  readonly creatorId: string
  readonly orgId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly currency: Currency
  readonly grossRevenueMinor: number
  readonly platformFeesMinor: number
  readonly processingFeesMinor: number
  readonly taxesWithheldMinor: number
  readonly netRevenueMinor: number
  readonly revenueBySource: readonly RevenueBySource[]
  readonly payoutsSentMinor: number
  readonly pendingBalanceMinor: number
  readonly generatedAt: string
}

export interface RevenueBySource {
  readonly source: RevenueSource
  readonly grossMinor: number
  readonly feesMinor: number
  readonly netMinor: number
  readonly transactionCount: number
}

// ── Org Financial Summary ───────────────────────────────────────────────────

export interface OrgFinancialSummary {
  readonly orgId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly currency: Currency
  readonly totalGrossRevenueMinor: number
  readonly totalPlatformFeesMinor: number
  readonly totalProcessingFeesMinor: number
  readonly totalNetRevenueMinor: number
  readonly totalPayoutsMinor: number
  readonly activeCreators: number
  readonly activeListeners: number
  readonly topRevenueSource: RevenueSource | null
  readonly generatedAt: string
}

// ── Payout History ──────────────────────────────────────────────────────────

export interface PayoutHistoryEntry {
  readonly payoutId: string
  readonly creatorId: string
  readonly orgId: string
  readonly amountMinor: number
  readonly currency: Currency
  readonly provider: string
  readonly status: 'pending' | 'processing' | 'completed' | 'failed'
  readonly initiatedAt: string
  readonly completedAt: string | null
  readonly providerRef: string | null
}

// ── Platform Metrics ────────────────────────────────────────────────────────

export interface PlatformMetrics {
  readonly periodStart: string
  readonly periodEnd: string
  readonly totalRevenueMinor: number
  readonly totalPlatformFeesMinor: number
  readonly totalPayoutsMinor: number
  readonly avgRevenuePerCreatorMinor: number
  readonly avgRevenuePerListenerMinor: number
  readonly creatorCount: number
  readonly listenerCount: number
  readonly streamCount: number
  readonly ticketsSold: number
  readonly eventsHosted: number
  readonly generatedAt: string
}

// ── Report Generation (Pure Aggregation) ────────────────────────────────────

/**
 * Aggregate revenue entries into a by-source breakdown.
 */
export function aggregateRevenueBySource(
  entries: readonly {
    source: RevenueSource
    grossMinor: number
    feesMinor: number
    netMinor: number
  }[],
): readonly RevenueBySource[] {
  const map = new Map<
    RevenueSource,
    { grossMinor: number; feesMinor: number; netMinor: number; count: number }
  >()

  for (const entry of entries) {
    const existing = map.get(entry.source)
    if (existing) {
      existing.grossMinor += entry.grossMinor
      existing.feesMinor += entry.feesMinor
      existing.netMinor += entry.netMinor
      existing.count++
    } else {
      map.set(entry.source, {
        grossMinor: entry.grossMinor,
        feesMinor: entry.feesMinor,
        netMinor: entry.netMinor,
        count: 1,
      })
    }
  }

  return Array.from(map.entries())
    .map(([source, data]) => ({
      source,
      grossMinor: data.grossMinor,
      feesMinor: data.feesMinor,
      netMinor: data.netMinor,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.grossMinor - a.grossMinor)
}

/**
 * Build a creator revenue report from raw line items.
 */
export function buildCreatorRevenueReport(params: {
  creatorId: string
  orgId: string
  periodStart: string
  periodEnd: string
  currency: Currency
  lineItems: readonly {
    source: RevenueSource
    grossMinor: number
    feesMinor: number
    netMinor: number
  }[]
  payoutsSentMinor: number
  pendingBalanceMinor: number
}): CreatorRevenueReport {
  const bySource = aggregateRevenueBySource(params.lineItems)

  const totals = bySource.reduce(
    (acc, s) => {
      acc.gross += s.grossMinor
      acc.fees += s.feesMinor
      acc.net += s.netMinor
      return acc
    },
    { gross: 0, fees: 0, net: 0 },
  )

  return {
    creatorId: params.creatorId,
    orgId: params.orgId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    currency: params.currency,
    grossRevenueMinor: totals.gross,
    platformFeesMinor: totals.fees,
    processingFeesMinor: 0, // split from fees in future
    taxesWithheldMinor: 0,
    netRevenueMinor: totals.net,
    revenueBySource: bySource,
    payoutsSentMinor: params.payoutsSentMinor,
    pendingBalanceMinor: params.pendingBalanceMinor,
    generatedAt: new Date().toISOString(),
  }
}
