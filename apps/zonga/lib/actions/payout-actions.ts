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
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  PayoutStatus,
  PayoutRail,
  ZongaCurrency,
  computePayoutPreview, // eslint-disable-line @typescript-eslint/no-unused-vars -- contract: ZNG-ACT-04 payout preview invariant
  PayoutPreviewRequestSchema,
  type Payout,
  type PayoutPreview,
} from '@/lib/zonga-services'
import { executeCreatorPayout } from '@/lib/stripe'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { logTransition } from '@/lib/commerce-telemetry'
import { resolveOrgContext } from '@/lib/resolve-org'

export interface PayoutListResult {
  payouts: Payout[]
  total: number
  totalPaid: number
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
      WHERE creator_id = ${creatorId} AND entity_id = ${ctx.entityId}`,
    )) as unknown as [{ gross: number }]

    // Paid from payouts table (org-scoped)
    const [paid] = (await platformDb.execute(
      sql`SELECT
        COALESCE(SUM(amount), 0) as paid,
        MAX(created_at) as last_payout
      FROM zonga_payouts
      WHERE creator_id = ${creatorId} AND entity_id = ${ctx.entityId}
        AND status = ${PayoutStatus.COMPLETED}`,
    )) as unknown as [{ paid: number; last_payout: string | null }]

    // Look up creator's preferred payout currency (org-scoped)
    const [creatorRow] = (await platformDb.execute(
      sql`SELECT payout_currency as currency
      FROM zonga_creators WHERE id = ${creatorId} AND entity_id = ${ctx.entityId}`,
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
      WHERE release_id = ${releaseId} AND entity_id = ${ctx.entityId}
      ORDER BY share_percent DESC`,
    )) as unknown as { rows: Array<{ creatorId: string; creatorName: string; sharePercent: number }> }

    const splits = splitRows.rows ?? []
    if (splits.length === 0) return null

    // Fetch total revenue for this release (org-scoped)
    const [rev] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as total
      FROM zonga_revenue_events
      WHERE release_id = ${releaseId} AND entity_id = ${ctx.entityId}`,
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
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES ('release.royalties.distributed', ${ctx.actorId}, 'release', ${releaseId},
        ${JSON.stringify({
          releaseId,
          orgId: ctx.entityId,
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
      WHERE entity_id = ${ctx.entityId} ${creatorFilter}
      ORDER BY created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Payout[] }

    const [totals] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) as total,
        COALESCE(SUM(amount), 0) as total_paid
      FROM zonga_payouts
      WHERE entity_id = ${ctx.entityId} AND status = ${PayoutStatus.COMPLETED}`,
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
      WHERE creator_id = ${creatorId} AND entity_id = ${ctx.entityId}`,
    )) as unknown as [{ gross: number }]

    const [paid] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as paid
      FROM zonga_payouts
      WHERE creator_id = ${creatorId} AND entity_id = ${ctx.entityId}
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
      FROM zonga_creators WHERE id = ${creatorId} AND entity_id = ${ctx.entityId}`,
    )) as unknown as [{ status: string | null; payoutCurrency: string | null }]

    if (!creatorRow || creatorRow.status !== requiredStatus) {
      logger.warn('previewPayout: creator not registered', { creatorId, status: creatorRow?.status })
      return null
    }

    const currency = creatorRow.payoutCurrency ?? 'USD'

    const preview: PayoutPreview = {
      creatorId,
      entityId: ctx.entityId,
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

  const parsed = PayoutPreviewRequestSchema.safeParse({
    creatorId: data.creatorId,
    grossAmount: data.amount,
    currency: data.currency ?? 'USD',
  })
  if (!parsed.success) {
    logger.warn('executePayout validation failed', { errors: parsed.error.flatten().fieldErrors })
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    logger.info('Executing creator payout', {
      creatorId: data.creatorId,
      amount: data.amount,
      actorId: ctx.actorId,
      orgId: ctx.entityId,
    })

    const payoutCurrency = data.currency?.toLowerCase() ?? 'usd'
    const payoutRail = (data.payoutRail ?? PayoutRail.STRIPE_CONNECT) as PayoutRail

    const result = await executeCreatorPayout({
      creatorConnectAccountId: data.creatorId,
      amountCents: Math.round(data.amount * 100),
      currency: payoutCurrency,
      payoutRail,
    })

    const payoutId = crypto.randomUUID()
    const settledCurrency = result?.settledCurrency ?? payoutCurrency.toUpperCase()

    // ── Write to domain table (org-scoped) ──
    await platformDb.execute(
      sql`INSERT INTO zonga_payouts
        (id, entity_id, creator_id, creator_name, amount, currency, payout_rail, status, stripe_transfer_id, created_by, created_at)
      VALUES (
        ${payoutId}, ${ctx.entityId}, ${data.creatorId}, ${data.creatorName ?? null},
        ${data.amount}, ${settledCurrency}, ${payoutRail},
        ${PayoutStatus.COMPLETED}, ${result?.transferId ?? null},
        ${ctx.actorId}, NOW()
      )`,
    )

    // ── Audit trail (audit-only, org-scoped) ──
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES ('payout.executed', ${ctx.actorId}, 'payout', ${payoutId},
        ${JSON.stringify({
          orgId: ctx.entityId,
          creatorId: data.creatorId,
          creatorName: data.creatorName,
          amount: data.amount,
          currency: settledCurrency,
          payoutRail,
          status: PayoutStatus.COMPLETED,
          stripeTransferId: result?.transferId ?? null,
        })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.PAYOUT_EXECUTE,
      entityType: ZongaEntityType.PAYOUT,
      entityId: payoutId,
      actorId: ctx.actorId,
      targetId: payoutId,
      metadata: { amount: data.amount, creatorId: data.creatorId, orgId: ctx.entityId },
    })
    logger.info('Payout executed', { ...auditEvent })

    logTransition(
      { orgId: ctx.entityId },
      'payout',
      PayoutStatus.PENDING,
      PayoutStatus.COMPLETED,
      true,
    )

    const pack = buildEvidencePackFromAction({
      actionType: 'PAYOUT_EXECUTED',
      entityId: payoutId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/payouts')
    return { success: true, transferId: result?.transferId }
  } catch (error) {
    logger.error('executePayout failed', { error })
    return { success: false }
  }
}
