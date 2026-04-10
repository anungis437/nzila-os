/**
 * Zonga — Earnings Ledger
 *
 * Double-entry-style ledger for revenue attribution.
 * Every cent is accounted for: gross → platform fee → creator net.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { EarningsSource, EarningsBalance } from './types'
import { PLATFORM_FEE_PCT } from './types'

export interface RecordEarningsParams {
  orgId: string
  creatorId: string
  source: EarningsSource
  referenceId: string
  referenceType: string
  grossAmount: number
  currency: string
}

/**
 * Record an earnings entry with automatic platform fee calculation.
 * Respects revenue split rules if they exist for the content.
 */
export async function recordEarnings(params: RecordEarningsParams): Promise<{ ok: boolean; entryId?: string }> {
  const { orgId, creatorId, source, referenceId, referenceType, grossAmount, currency } = params

  const feePct = PLATFORM_FEE_PCT[source] ?? 30
  const platformFee = Math.round(grossAmount * feePct) / 100
  const netAmount = grossAmount - platformFee
  const period = new Date().toISOString().substring(0, 7) // YYYY-MM

  // Check for split rules on this content
  const splitRows = await platformDb.execute(sql`
    SELECT recipient_id, split_percentage
    FROM zonga_revenue_split_rules
    WHERE content_id = ${referenceId} AND org_id = ${orgId}
  `)
  const splits = splitRows as unknown as Array<{ recipient_id: string; split_percentage: number }>

  if (splits.length > 0) {
    // Distribute net amount according to splits
    for (const split of splits) {
      const splitAmount = Math.round(netAmount * split.split_percentage) / 100

      await platformDb.execute(sql`
        INSERT INTO zonga_earnings_entries (
          org_id, creator_id, source, reference_id, reference_type,
          gross_amount, platform_fee, net_amount, currency, period
        ) VALUES (
          ${orgId}, ${split.recipient_id}, ${source}, ${referenceId}, ${referenceType},
          ${grossAmount * split.split_percentage / 100},
          ${platformFee * split.split_percentage / 100},
          ${splitAmount}, ${currency}, ${period}
        )
      `)
    }

    logger.info('Split earnings recorded', { referenceId, splits: splits.length })
    return { ok: true }
  }

  // No splits — full amount to the creator
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_earnings_entries (
      org_id, creator_id, source, reference_id, reference_type,
      gross_amount, platform_fee, net_amount, currency, period
    ) VALUES (
      ${orgId}, ${creatorId}, ${source}, ${referenceId}, ${referenceType},
      ${grossAmount}, ${platformFee}, ${netAmount}, ${currency}, ${period}
    )
    RETURNING id
  `)
  const entryId = (rows as unknown as Array<{ id: string }>)[0]?.id

  return { ok: true, entryId }
}

/**
 * Get earnings balance for a creator.
 */
export async function getEarningsBalance(creatorId: string, orgId: string): Promise<EarningsBalance> {
  const balanceRows = await platformDb.execute(sql`
    SELECT
      COALESCE(SUM(net_amount), 0)::numeric as total_earned,
      COALESCE(
        (SELECT SUM(amount) FROM zonga_payout_requests
         WHERE creator_id = ${creatorId} AND org_id = ${orgId}
         AND status IN ('completed')),
        0
      )::numeric as total_paid,
      COALESCE(
        (SELECT SUM(amount) FROM zonga_payout_requests
         WHERE creator_id = ${creatorId} AND org_id = ${orgId}
         AND status IN ('requested', 'approved', 'processing')),
        0
      )::numeric as pending_payouts,
      (SELECT currency FROM zonga_earnings_entries
       WHERE creator_id = ${creatorId} AND org_id = ${orgId}
       LIMIT 1) as currency
    FROM zonga_earnings_entries
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
  `)

  const b = (balanceRows as unknown as Array<Record<string, unknown>>)[0]
  const totalEarned = Number(b?.total_earned ?? 0)
  const totalPaid = Number(b?.total_paid ?? 0)
  const pendingPayouts = Number(b?.pending_payouts ?? 0)

  return {
    creatorId,
    orgId,
    currency: (b?.currency as string) ?? 'USD',
    totalEarned,
    totalPaid,
    pendingBalance: totalEarned - totalPaid,
    availableBalance: totalEarned - totalPaid - pendingPayouts,
  }
}

/**
 * Get earnings history for a creator, grouped by period.
 */
export async function getEarningsHistory(
  creatorId: string,
  orgId: string,
  limit = 12,
): Promise<Array<{
  period: string
  source: EarningsSource
  entryCount: number
  totalGross: number
  totalFees: number
  totalNet: number
  currency: string
}>> {
  const rows = await platformDb.execute(sql`
    SELECT
      period,
      source,
      COUNT(*)::int as entry_count,
      SUM(gross_amount)::numeric as total_gross,
      SUM(platform_fee)::numeric as total_fees,
      SUM(net_amount)::numeric as total_net,
      currency
    FROM zonga_earnings_entries
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
    GROUP BY period, source, currency
    ORDER BY period DESC, source
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    period: r.period as string,
    source: r.source as EarningsSource,
    entryCount: r.entry_count as number,
    totalGross: Number(r.total_gross),
    totalFees: Number(r.total_fees),
    totalNet: Number(r.total_net),
    currency: r.currency as string,
  }))
}

/**
 * Get top earning content for a creator.
 */
export async function getTopEarningContent(
  creatorId: string,
  orgId: string,
  limit = 10,
): Promise<Array<{
  referenceId: string
  referenceType: string
  totalNet: number
  currency: string
  playCount: number
}>> {
  const rows = await platformDb.execute(sql`
    SELECT
      e.reference_id,
      e.reference_type,
      SUM(e.net_amount)::numeric as total_net,
      e.currency,
      COALESCE(
        (SELECT COUNT(*)::int FROM zonga_playback_events p WHERE p.track_id = e.reference_id),
        0
      ) as play_count
    FROM zonga_earnings_entries e
    WHERE e.creator_id = ${creatorId} AND e.org_id = ${orgId}
    GROUP BY e.reference_id, e.reference_type, e.currency
    ORDER BY total_net DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    referenceId: r.reference_id as string,
    referenceType: r.reference_type as string,
    totalNet: Number(r.total_net),
    currency: r.currency as string,
    playCount: (r.play_count as number) ?? 0,
  }))
}
