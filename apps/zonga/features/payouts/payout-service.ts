/**
 * Zonga — Payout Service
 *
 * Handles payout requests, approval workflow, and Stripe execution.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { PayoutRequest, PayoutStatus } from './types'
import { PAYOUT_TRANSITIONS, MIN_PAYOUT_THRESHOLD } from './types'
import { getEarningsBalance } from './earnings-ledger'

export interface RequestPayoutParams {
  creatorId: string
  orgId: string
  amount: number
  currency: string
}

export interface PayoutResult {
  ok: boolean
  payoutId?: string
  error?: string
}

/**
 * Request a payout. Validates minimum threshold and available balance.
 */
export async function requestPayout(params: RequestPayoutParams): Promise<PayoutResult> {
  const { creatorId, orgId, amount, currency } = params

  // Validate minimum threshold
  const minThreshold = MIN_PAYOUT_THRESHOLD[currency] ?? 25
  if (amount < minThreshold) {
    return { ok: false, error: `Minimum payout is ${minThreshold} ${currency}` }
  }

  // Check available balance
  const balance = await getEarningsBalance(creatorId, orgId)
  if (amount > balance.availableBalance) {
    return { ok: false, error: `Insufficient balance. Available: ${balance.availableBalance} ${currency}` }
  }

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_payout_requests (
      creator_id, org_id, amount, currency, status
    ) VALUES (
      ${creatorId}, ${orgId}, ${amount}, ${currency}, 'requested'
    )
    RETURNING id
  `)
  const payoutId = (rows as unknown as Array<{ id: string }>)[0]?.id

  logger.info('Payout requested', { payoutId, creatorId, amount, currency })
  return { ok: true, payoutId }
}

/**
 * Transition payout through approval pipeline.
 */
export async function transitionPayoutState(params: {
  payoutId: string
  orgId: string
  targetState: PayoutStatus
  actorId: string
  stripeTransferId?: string
  failureReason?: string
}): Promise<PayoutResult> {
  const { payoutId, orgId, targetState, actorId, stripeTransferId, failureReason } = params

  const rows = await platformDb.execute(sql`
    SELECT status FROM zonga_payout_requests
    WHERE id = ${payoutId} AND org_id = ${orgId}
  `)
  const payout = (rows as unknown as Array<{ status: string }>)[0]
  if (!payout) return { ok: false, error: 'Payout not found' }

  const currentState = payout.status as PayoutStatus
  const allowed = PAYOUT_TRANSITIONS[currentState]

  if (!allowed?.includes(targetState)) {
    return { ok: false, error: `Cannot transition from "${currentState}" to "${targetState}"` }
  }

  await platformDb.execute(sql`
    UPDATE zonga_payout_requests
    SET status = ${targetState},
        stripe_transfer_id = COALESCE(${stripeTransferId ?? null}, stripe_transfer_id),
        failure_reason = ${failureReason ?? null},
        processed_at = CASE WHEN ${targetState} IN ('completed', 'failed') THEN now() ELSE processed_at END,
        updated_at = now()
    WHERE id = ${payoutId} AND org_id = ${orgId}
  `)

  logger.info('Payout state transition', { payoutId, from: currentState, to: targetState, actorId })
  return { ok: true, payoutId }
}

/**
 * Get pending payout requests for admin approval queue.
 */
export async function getPendingPayouts(orgId: string): Promise<PayoutRequest[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_payout_requests
    WHERE org_id = ${orgId} AND status IN ('requested', 'approved')
    ORDER BY created_at
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map(mapPayoutRow)
}

/**
 * Get payout history for a creator.
 */
export async function getPayoutHistory(creatorId: string, orgId: string): Promise<PayoutRequest[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_payout_requests
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT 50
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map(mapPayoutRow)
}

/**
 * Create a payout batch for bulk processing.
 */
export async function createPayoutBatch(
  orgId: string,
  payoutIds: string[],
): Promise<{ ok: boolean; batchId?: string }> {
  if (payoutIds.length === 0) return { ok: false }

  // Calculate batch totals
  const statsRows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as payout_count,
      SUM(amount)::numeric as total_amount,
      currency
    FROM zonga_payout_requests
    WHERE id = ANY(${payoutIds}::uuid[])
      AND org_id = ${orgId}
      AND status = 'approved'
    GROUP BY currency
  `)
  const stats = (statsRows as unknown as Array<Record<string, unknown>>)[0]
  if (!stats) return { ok: false }

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_payout_batches (
      org_id, payout_count, total_amount, currency, status
    ) VALUES (
      ${orgId},
      ${stats.payout_count as number},
      ${Number(stats.total_amount)},
      ${stats.currency as string},
      'pending'
    )
    RETURNING id
  `)
  const batchId = (rows as unknown as Array<{ id: string }>)[0]?.id

  // Mark payouts as processing, linked to batch
  await platformDb.execute(sql`
    UPDATE zonga_payout_requests
    SET status = 'processing', updated_at = now()
    WHERE id = ANY(${payoutIds}::uuid[])
      AND org_id = ${orgId}
      AND status = 'approved'
  `)

  logger.info('Payout batch created', { batchId, count: stats.payout_count })
  return { ok: true, batchId }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapPayoutRow(r: Record<string, unknown>): PayoutRequest {
  return {
    id: r.id as string,
    creatorId: r.creator_id as string,
    orgId: r.org_id as string,
    amount: Number(r.amount),
    currency: r.currency as string,
    status: r.status as PayoutStatus,
    stripeTransferId: r.stripe_transfer_id as string | undefined,
    failureReason: r.failure_reason as string | undefined,
    requestedAt: new Date(r.created_at as string),
    processedAt: r.processed_at ? new Date(r.processed_at as string) : undefined,
  }
}
