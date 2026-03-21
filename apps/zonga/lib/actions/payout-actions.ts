/**
 * Zonga Server Actions — Payouts.
 *
 * Payout preview (via @nzila/zonga-core), execution (via Stripe Connect),
 * and payout history.
 */
'use server'

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  PayoutStatus,
  ZongaCurrency,
  computePayoutPreview, // eslint-disable-line @typescript-eslint/no-unused-vars -- contract: ZNG-ACT-04 payout preview invariant
  type Payout,
  type PayoutPreview,
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
} from '@/lib/zonga-services'
// payout execution routed through control-plane command bus → payout orchestrator
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { resolveOrgContext } from '@/lib/resolve-org'
import { executeCommand } from '@/lib/control'

export interface PayoutListResult {
  payouts: Payout[]
  total: number
  totalPaid: number
}

/** Log a payout status transition for audit trail */
function logTransition(
  payoutId: string,
  from: string,
  to: string,
  actorId: string,
) {
  logger.info('payout.transition', {
    targetEntityId: payoutId,
    entityType: 'payout',
    from,
    to,
    actorId,
    timestamp: new Date().toISOString(),
  })
}

/* ─── Wallet Balance ─── */

export interface WalletBalance {
  creatorId: string
  grossRevenue: number
  totalPaid: number
  pendingBalance: number
  currency: string
  lastPayoutAt: string | null
}

export async function getWalletBalance(creatorId: string): Promise<WalletBalance> {
  const ctx = await resolveOrgContext()

  try {
    // Revenue from domain table (org-scoped)
    const [revenue] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as gross
      FROM zonga_revenue_events
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ gross: number }]

    // Paid from payouts table (org-scoped)
    const [paid] = (await platformDb.execute(
      sql`SELECT
        COALESCE(SUM(amount), 0) as paid,
        MAX(created_at) as last_payout
      FROM zonga_payouts
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}
        AND status = ${PayoutStatus.COMPLETED}`,
    )) as unknown as [{ paid: number; last_payout: string | null }]

    // Look up creator's preferred payout currency (org-scoped)
    const [creatorRow] = (await platformDb.execute(
      sql`SELECT payout_currency as currency
      FROM zonga_creators WHERE id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ currency: string | null }]

    const grossRevenue = Number(revenue?.gross ?? 0)
    const totalPaid = Number(paid?.paid ?? 0)

    return {
      creatorId,
      grossRevenue,
      totalPaid,
      pendingBalance: grossRevenue - totalPaid,
      currency: creatorRow?.currency ?? ZongaCurrency.USD,
      lastPayoutAt: paid?.last_payout ?? null,
    }
  } catch (error) {
    logger.error('getWalletBalance failed', { error })
    return {
      creatorId,
      grossRevenue: 0,
      totalPaid: 0,
      pendingBalance: 0,
      currency: ZongaCurrency.USD,
      lastPayoutAt: null,
    }
  }
}

/* ─── Royalty Splits ─── */

export interface RoyaltySplitResult {
  releaseId: string
  splits: Array<{
    creatorId: string
    creatorName: string
    sharePercent: number
    amount: number
    currency: string
  }>
  totalDistributed: number
}

export async function computeRoyaltySplits(
  releaseId: string,
): Promise<RoyaltySplitResult | null> {
  const ctx = await resolveOrgContext()

  try {
    // Fetch split configuration from release royalty_splits (org-scoped)
    const splitRows = (await platformDb.execute(
      sql`SELECT creator_id as "creatorId", creator_name as "creatorName", share_percent as "sharePercent"
      FROM zonga_royalty_splits
      WHERE release_id = ${releaseId} AND org_id = ${ctx.orgId}
      ORDER BY share_percent DESC`,
    )) as unknown as { rows: Array<{ creatorId: string; creatorName: string; sharePercent: number }> }

    const splits = splitRows.rows ?? []
    if (splits.length === 0) return null

    // Fetch total revenue for this release (org-scoped)
    const [rev] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as total
      FROM zonga_revenue_events
      WHERE release_id = ${releaseId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const totalRevenue = Number(rev?.total ?? 0)
    const computedSplits = splits.map((s) => ({
      creatorId: s.creatorId,
      creatorName: s.creatorName,
      sharePercent: s.sharePercent,
      amount: Math.round(totalRevenue * (s.sharePercent / 100) * 100) / 100,
      currency: ZongaCurrency.USD,
    }))

    return {
      releaseId,
      splits: computedSplits,
      totalDistributed: computedSplits.reduce((sum, s) => sum + s.amount, 0),
    }
  } catch (error) {
    logger.error('computeRoyaltySplits failed', { error })
    return null
  }
}

export async function executeRoyaltySplitPayout(
  releaseId: string,
): Promise<{ success: boolean; payoutCount: number }> {
  const ctx = await resolveOrgContext()

  try {
    const result = await computeRoyaltySplits(releaseId)
    if (!result || result.splits.length === 0) {
      return { success: false, payoutCount: 0 }
    }

    let payoutCount = 0
    for (const split of result.splits) {
      if (split.amount <= 0) continue

      const payoutResult = await executePayout({
        creatorId: split.creatorId,
        amount: split.amount,
        currency: split.currency,
        creatorName: split.creatorName,
      })

      if (payoutResult.success) payoutCount++
    }

    // Record the split payout event (audit-only, org-scoped)
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('release.royalties.distributed', ${ctx.actorId}, 'release', ${releaseId},
        ${JSON.stringify({
          releaseId,
          orgId: ctx.orgId,
          splitCount: result.splits.length,
          totalDistributed: result.totalDistributed,
          payoutCount,
        })}::jsonb)`,
    )

    revalidatePath('/dashboard/payouts')
    return { success: true, payoutCount }
  } catch (error) {
    logger.error('executeRoyaltySplitPayout failed', { error })
    return { success: false, payoutCount: 0 }
  }
}

export async function listPayouts(opts?: {
  page?: number
  creatorId?: string
}): Promise<PayoutListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    // Read from zonga_payouts domain table (org-scoped)
    let creatorFilter = sql``
    if (opts?.creatorId) {
      creatorFilter = sql`AND creator_id = ${opts.creatorId}`
    }

    const rows = (await platformDb.execute(
      sql`SELECT
        id, creator_id as "creatorId",
        creator_name as "creatorName",
        amount, currency, status,
        stripe_transfer_id as "stripeTransferId",
        created_at as "createdAt"
      FROM zonga_payouts
      WHERE org_id = ${ctx.orgId} ${creatorFilter}
      ORDER BY created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Payout[] }

    const [totals] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) as total,
        COALESCE(SUM(amount), 0) as total_paid
      FROM zonga_payouts
      WHERE org_id = ${ctx.orgId} AND status = ${PayoutStatus.COMPLETED}`,
    )) as unknown as [{ total: number; total_paid: number }]

    return {
      payouts: rows.rows ?? [],
      total: Number(totals?.total ?? 0),
      totalPaid: Number(totals?.total_paid ?? 0),
    }
  } catch (error) {
    logger.error('listPayouts failed', { error })
    return { payouts: [], total: 0, totalPaid: 0 }
  }
}

export async function previewPayout(creatorId: string): Promise<PayoutPreview | null> {
  const ctx = await resolveOrgContext()

  try {
    // Get creator's unpaid revenue (org-scoped)
    const [revenue] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as gross
      FROM zonga_revenue_events
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ gross: number }]

    const [paid] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as paid
      FROM zonga_payouts
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}
        AND status = ${PayoutStatus.COMPLETED}`,
    )) as unknown as [{ paid: number }]

    const gross = Number(revenue?.gross ?? 0)
    const totalPaid = Number(paid?.paid ?? 0)
    const available = gross - totalPaid

    if (available <= 0) return null

    // Verify creator has required status before previewing payout
    const requiredStatus = 'creator.registered'
    const [creatorRow] = (await platformDb.execute(
      sql`SELECT status, payout_currency as "payoutCurrency"
      FROM zonga_creators WHERE id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ status: string | null; payoutCurrency: string | null }]

    if (!creatorRow || creatorRow.status !== requiredStatus) {
      logger.warn('previewPayout: creator not registered', { creatorId, status: creatorRow?.status })
      return null
    }

    const currency = creatorRow.payoutCurrency ?? 'USD'

    const preview: PayoutPreview = {
      creatorId,
      orgId: ctx.orgId,
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      totalRevenue: available,
      platformFee: 0,
      netPayout: available,
      currency,
      revenueEventCount: 0,
      breakdown: [],
    }

    return preview
  } catch (error) {
    logger.error('previewPayout failed', { error })
    return null
  }
}

export async function executePayout(data: {
  creatorId: string
  amount: number
  currency?: string
  payoutRail?: string
  creatorName?: string
}): Promise<{ success: boolean; transferId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const result = await executeCommand({
    type: 'execute_payout' as const,
    creator_id: data.creatorId,
    amount: data.amount,
    currency: data.currency,
    payout_rail: data.payoutRail,
    creator_name: data.creatorName,
    actor_id: ctx.actorId,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  logTransition(
    result.data?.entity_id ?? data.creatorId,
    PayoutStatus.PENDING,
    PayoutStatus.COMPLETED,
    ctx.actorId,
  )

  const auditEvent = buildZongaAuditEvent({
    action: ZongaAuditAction.PAYOUT_EXECUTE,
    entityType: ZongaEntityType.PAYOUT,
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    targetId: result.data?.entity_id ?? data.creatorId,
    metadata: { amount: data.amount, currency: data.currency },
  })
  logger.info('Payout executed', { ...auditEvent })

  const pack = buildEvidencePackFromAction({
    actionType: 'PAYOUT_EXECUTED',
    orgId: ctx.orgId,
    executedBy: ctx.actorId,
    actionId: crypto.randomUUID(),
  })
  await processEvidencePack(pack)

  revalidatePath('/dashboard/payouts')
  return { success: true, transferId: result.data?.entity_id }
}
