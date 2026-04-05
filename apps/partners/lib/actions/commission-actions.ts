/**
 * Partners Server Actions — Commissions.
 *
 * Commission ledger, payouts, and tier-based multipliers.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import { buildPartnerEvidencePack } from '@/lib/evidence'
import { tierMultiplier } from '@/lib/tier-gates'
import type { PartnerTier } from '@/components/partner/TierBadge'

/* ─── Types ─── */

export interface Commission {
  id: string
  dealId: string
  accountName: string
  partnerId: string
  partnerName: string | null
  baseAmount: number
  multiplier: number
  finalAmount: number
  currency: string
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  createdAt: Date
}

export interface CommissionSummary {
  totalEarned: number
  pending: number
  paidOut: number
  commissionCount: number
  currentMultiplier: number
}

/* ─── Queries ─── */

export async function listCommissions(opts?: {
  page?: number
  partnerId?: string
}): Promise<{ commissions: Commission[]; total: number }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        org_id as id,
        metadata->>'dealId' as "dealId",
        metadata->>'accountName' as "accountName",
        metadata->>'partnerId' as "partnerId",
        metadata->>'partnerName' as "partnerName",
        CAST(COALESCE(metadata->>'baseAmount', '0') AS NUMERIC) as "baseAmount",
        CAST(COALESCE(metadata->>'multiplier', '1') AS NUMERIC) as multiplier,
        CAST(COALESCE(metadata->>'finalAmount', '0') AS NUMERIC) as "finalAmount",
        COALESCE(metadata->>'currency', 'USD') as currency,
        metadata->>'status' as status,
        created_at as "createdAt"
      FROM audit_log
      WHERE action = 'commission.created' OR action = 'commission.updated'
      ORDER BY created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Commission[] }

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log WHERE action LIKE 'commission.%'`,
    )) as unknown as [{ total: number }]

    return {
      commissions: rows.rows ?? [],
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('listCommissions failed', { error })
    return { commissions: [], total: 0 }
  }
}

export async function getCommissionSummary(partnerTier?: string): Promise<CommissionSummary> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    const [totals] = (await platformDb.execute(
      sql`SELECT
        COALESCE(SUM(CAST(COALESCE(metadata->>'finalAmount', '0') AS NUMERIC)), 0) as total_earned,
        COALESCE(SUM(CAST(COALESCE(metadata->>'finalAmount', '0') AS NUMERIC))
          FILTER (WHERE metadata->>'status' = 'pending'), 0) as pending,
        COALESCE(SUM(CAST(COALESCE(metadata->>'finalAmount', '0') AS NUMERIC))
          FILTER (WHERE metadata->>'status' = 'paid'), 0) as paid_out,
        COUNT(*) as commission_count
      FROM audit_log WHERE action = 'commission.created'`,
    )) as unknown as [{ total_earned: number; pending: number; paid_out: number; commission_count: number }]

    const tier = (partnerTier ?? 'registered') as PartnerTier
    const mult = tierMultiplier(tier)

    return {
      totalEarned: Number(totals?.total_earned ?? 0),
      pending: Number(totals?.pending ?? 0),
      paidOut: Number(totals?.paid_out ?? 0),
      commissionCount: Number(totals?.commission_count ?? 0),
      currentMultiplier: mult,
    }
  } catch (error) {
    logger.error('getCommissionSummary failed', { error })
    return { totalEarned: 0, pending: 0, paidOut: 0, commissionCount: 0, currentMultiplier: 1.0 }
  }
}

/* ─── Mutations ─── */

export async function createCommission(data: {
  dealId: string
  accountName: string
  partnerId: string
  partnerName?: string
  baseAmount: number
  partnerTier: string
}): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    const mult = tierMultiplier(data.partnerTier as PartnerTier)
    const finalAmount = Math.round(data.baseAmount * mult * 100) / 100
    const commissionId = crypto.randomUUID()

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('commission.created', ${userId}, 'commission', ${commissionId},
        ${JSON.stringify({
          dealId: data.dealId,
          accountName: data.accountName,
          partnerId: data.partnerId,
          partnerName: data.partnerName ?? null,
          baseAmount: data.baseAmount,
          multiplier: mult,
          finalAmount,
          currency: 'USD',
          status: 'pending',
          tier: data.partnerTier,
        })}::jsonb)`,
    )

    await buildPartnerEvidencePack({
      actionId: crypto.randomUUID(),
      actionType: 'COMMISSION_CREATED',
      orgId: commissionId,
      executedBy: userId,
    })

    logger.info('Commission created', { commissionId, dealId: data.dealId, finalAmount })
    revalidatePath('/portal/commissions')
    revalidatePath('/admin/commissions')
    return { success: true }
  } catch (error) {
    logger.error('createCommission failed', { error })
    return { success: false }
  }
}

export async function approveCommissionPayout(
  commissionId: string,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('commission.updated', ${userId}, 'commission', ${commissionId},
        ${JSON.stringify({ status: 'paid', paidAt: new Date().toISOString() })}::jsonb)`,
    )

    logger.info('Commission payout approved', { commissionId, actorId: userId })
    revalidatePath('/admin/commissions')
    revalidatePath('/portal/commissions')
    return { success: true }
  } catch (error) {
    logger.error('approveCommissionPayout failed', { error })
    return { success: false }
  }
}
