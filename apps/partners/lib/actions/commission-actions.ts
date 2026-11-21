/**
 * Partners Server Actions — Commissions.
 *
 * Commission ledger, payouts, and tier-based multipliers.
 */
'use server'

import { resolveOrgContext } from '../resolve-org'
import { actionRows } from '../../queries/partner-action-facts'
import { currentDealParent, requireDealOrigin, scopedCommissions } from '../partner-action-scope'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import { tierMultiplier } from '@/lib/tier-gates'

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

export async function listCommissions(opts?: { page?: number; partnerId?: string }): Promise<{ commissions: Commission[]; total: number }> {
  const ctx = await resolveOrgContext({ scope: 'partner', partnerId: opts?.partnerId, allowPlatform: true })
  const page = z.number().int().positive().parse(opts?.page ?? 1)
  const from = sql`FROM (${scopedCommissions(ctx)}) commissions WHERE ${opts?.partnerId ? sql`"partnerId"=${opts.partnerId}` : sql`true`}`
  try {
    const commissions = actionRows<Commission>(await platformDb.execute(sql`SELECT * ${from} ORDER BY "createdAt" DESC,id LIMIT 25 OFFSET ${(page - 1) * 25}`))
    const [count] = actionRows<{ total: number }>(await platformDb.execute(sql`SELECT count(*) AS total ${from}`))
    return { commissions, total: Number(count?.total ?? 0) }
  } catch (error) {
    logger.error('listCommissions failed', { error })
    return { commissions: [], total: 0 }
  }
}

export async function getCommissionSummary(partnerTier?: string, partnerId?: string): Promise<CommissionSummary> {
  const ctx = await resolveOrgContext({ scope: 'partner', partnerId, allowPlatform: true })
  const currentMultiplier = ctx.scope === 'partner' ? tierMultiplier(ctx.partner.tier) : 1
  if (partnerTier && (ctx.scope !== 'partner' || partnerTier !== ctx.partner.tier))
    throw new Error('Commission tier must match the current partner record')
  try {
    const [totals] = actionRows<{ totalEarned: number; pending: number; paidOut: number; commissionCount: number }>(await platformDb.execute(sql`SELECT
      COALESCE(sum("finalAmount"),0) AS "totalEarned",
      COALESCE(sum("finalAmount") FILTER (WHERE status='pending'),0) AS pending,
      COALESCE(sum("finalAmount") FILTER (WHERE status='paid'),0) AS "paidOut",count(*) AS "commissionCount"
      FROM (${scopedCommissions(ctx)}) commissions`))
    return { totalEarned: Number(totals?.totalEarned ?? 0), pending: Number(totals?.pending ?? 0),
      paidOut: Number(totals?.paidOut ?? 0), commissionCount: Number(totals?.commissionCount ?? 0), currentMultiplier }
  } catch (error) {
    logger.error('getCommissionSummary failed', { error })
    return { totalEarned: 0, pending: 0, paidOut: 0, commissionCount: 0, currentMultiplier }
  }
}

export async function createCommission(data: {
  dealId: string; accountName: string; partnerId: string; partnerName?: string; baseAmount: number; partnerTier: string;
}): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext({ scope: 'platform' })
  const validated = z.object({ dealId: z.string().uuid(), accountName: z.string().min(1), partnerId: z.string().uuid(),
    partnerName: z.string().optional(), baseAmount: z.number().finite().positive(), partnerTier: z.string().min(1) }).strict().parse(data)
  const origin = await requireDealOrigin(ctx, validated.dealId)
  if (validated.partnerId !== origin.partner.id || validated.partnerTier !== origin.partner.tier
    || validated.accountName !== origin.metadata.accountName
    || (validated.partnerName !== undefined && validated.partnerName !== origin.partner.companyName))
    throw new Error('Commission parent and partner attribution must match the existing deal')
  try {
    const commissionId = crypto.randomUUID(), multiplier = tierMultiplier(origin.partner.tier)
    const inserted = actionRows<{ id: string }>(await platformDb.execute(sql`INSERT INTO public.audit_log (id,action,actor_id,entity_type,org_id,metadata)
      SELECT ${commissionId},'commission.created',${ctx.actorId},'commission',NULL,${JSON.stringify({
        dealId: origin.id, accountName: origin.metadata.accountName, partnerId: origin.partner.id,
        partnerName: origin.partner.companyName, baseAmount: validated.baseAmount, multiplier,
        finalAmount: Math.round(validated.baseAmount * multiplier * 100) / 100, currency: 'USD', status: 'pending', tier: origin.partner.tier,
      })}::jsonb WHERE ${currentDealParent(ctx, origin.id, origin.partner.id)} RETURNING id`))
    if (inserted.length !== 1) throw new Error('Current commission parent changed')
    revalidatePath('/portal/commissions')
    revalidatePath('/admin/commissions')
    return { success: true }
  } catch (error) {
    logger.error('createCommission failed', { error })
    return { success: false }
  }
}

export async function approveCommissionPayout(commissionId: string): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext({ scope: 'platform' })
  const rows = actionRows<Commission>(await platformDb.execute(sql`SELECT * FROM (${scopedCommissions(ctx)}) commissions WHERE id=${commissionId} LIMIT 2`))
  if (rows.length !== 1) throw new Error('Commission not found')
  const commission = rows[0], origin = await requireDealOrigin(ctx, commission.dealId)
  if (commission.partnerId !== origin.partner.id) throw new Error('Commission parent does not match')
  if (commission.status === 'approved') return { success: true }
  if (commission.status !== 'pending') throw new Error('Only a pending commission can be approved')
  try {
    // Approval records an operator decision. A payment or transfer requires its
    // own verified source and is not manufactured by this action.
    const inserted = actionRows<{ id: string }>(await platformDb.execute(sql`INSERT INTO public.audit_log (action,actor_id,entity_type,org_id,metadata)
      SELECT 'commission.updated',${ctx.actorId},'commission',NULL,${JSON.stringify({
        resourceId: commission.id, partnerId: origin.partner.id, dealId: origin.id,
        status: 'approved', approvedAt: new Date().toISOString(),
      })}::jsonb WHERE ${currentDealParent(ctx, origin.id, origin.partner.id)}
        AND EXISTS(SELECT 1 FROM (${scopedCommissions(ctx)}) current_commission WHERE current_commission.id=${commission.id}
          AND current_commission.status='pending' AND current_commission."partnerId"=${origin.partner.id}
          AND current_commission."dealId"=${origin.id}) RETURNING id`))
    if (inserted.length !== 1) throw new Error('Current pending commission changed')
    revalidatePath('/admin/commissions')
    revalidatePath('/portal/commissions')
    return { success: true }
  } catch (error) {
    logger.error('approveCommissionPayout failed', { error })
    return { success: false }
  }
}
