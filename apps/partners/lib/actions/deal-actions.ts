/**
 * Partners Server Actions — Deal Registration & Pipeline.
 *
 * Partners register deals for pipeline protection. Deals flow through:
 *   registered → submitted → approved → won/lost
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { sql, desc as _desc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import { buildPartnerEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface Deal {
  id: string
  accountName: string
  contactName: string
  contactEmail: string
  vertical: string
  estimatedArr: number
  expectedCloseDate: string
  notes: string | null
  stage: 'registered' | 'submitted' | 'approved' | 'won' | 'lost'
  partnerId: string
  partnerName: string | null
  registeredBy: string
  createdAt: Date
  updatedAt: Date | null
}

export interface DealListResult {
  deals: Deal[]
  total: number
  totalArr: number
}

export interface DealStats {
  registered: number
  submitted: number
  approved: number
  won: number
  lost: number
  totalArr: number
}

/* ─── Queries ─── */

export async function listDeals(opts?: {
  page?: number
  stage?: string
  search?: string
}): Promise<DealListResult> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        org_id as id,
        metadata->>'accountName' as "accountName",
        metadata->>'contactName' as "contactName",
        metadata->>'contactEmail' as "contactEmail",
        metadata->>'vertical' as vertical,
        CAST(COALESCE(metadata->>'estimatedArr', '0') AS NUMERIC) as "estimatedArr",
        metadata->>'expectedCloseDate' as "expectedCloseDate",
        metadata->>'notes' as notes,
        metadata->>'stage' as stage,
        metadata->>'partnerId' as "partnerId",
        metadata->>'partnerName' as "partnerName",
        actor_id as "registeredBy",
        created_at as "createdAt",
        metadata->>'updatedAt' as "updatedAt"
      FROM audit_log
      WHERE action = 'deal.registered' OR action = 'deal.updated'
      ORDER BY created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Deal[] }

    const [totals] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) as total,
        COALESCE(SUM(CAST(COALESCE(metadata->>'estimatedArr', '0') AS NUMERIC)), 0) as total_arr
      FROM audit_log WHERE action = 'deal.registered'`,
    )) as unknown as [{ total: number; total_arr: number }]

    return {
      deals: rows.rows ?? [],
      total: Number(totals?.total ?? 0),
      totalArr: Number(totals?.total_arr ?? 0),
    }
  } catch (error) {
    logger.error('listDeals failed', { error })
    return { deals: [], total: 0, totalArr: 0 }
  }
}

export async function getDealStats(): Promise<DealStats> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    const [stats] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) FILTER (WHERE metadata->>'stage' = 'registered') as registered,
        COUNT(*) FILTER (WHERE metadata->>'stage' = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE metadata->>'stage' = 'approved') as approved,
        COUNT(*) FILTER (WHERE metadata->>'stage' = 'won') as won,
        COUNT(*) FILTER (WHERE metadata->>'stage' = 'lost') as lost,
        COALESCE(SUM(CAST(COALESCE(metadata->>'estimatedArr', '0') AS NUMERIC)), 0) as total_arr
      FROM audit_log WHERE action = 'deal.registered' OR action = 'deal.updated'`,
    )) as unknown as [DealStats & { total_arr: number }]

    return {
      registered: Number(stats?.registered ?? 0),
      submitted: Number(stats?.submitted ?? 0),
      approved: Number(stats?.approved ?? 0),
      won: Number(stats?.won ?? 0),
      lost: Number(stats?.lost ?? 0),
      totalArr: Number(stats?.total_arr ?? 0),
    }
  } catch (error) {
    logger.error('getDealStats failed', { error })
    return { registered: 0, submitted: 0, approved: 0, won: 0, lost: 0, totalArr: 0 }
  }
}

/* ─── Mutations ─── */

export async function createDeal(data: {
  accountName: string
  contactName: string
  contactEmail: string
  vertical: string
  estimatedArr: number
  expectedCloseDate: string
  notes?: string
}): Promise<{ success: boolean; dealId?: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    const dealId = crypto.randomUUID()

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('deal.registered', ${userId}, 'deal', ${dealId},
        ${JSON.stringify({
          ...data,
          stage: 'submitted',
          partnerId: userId,
          registeredAt: new Date().toISOString(),
        })}::jsonb)`,
    )

    await buildPartnerEvidencePack({
      actionId: crypto.randomUUID(),
      actionType: 'DEAL_REGISTERED',
      orgId: dealId,
      executedBy: userId,
    })

    logger.info('Deal registered', { dealId, actorId: userId, accountName: data.accountName })
    revalidatePath('/portal/deals')
    return { success: true, dealId }
  } catch (error) {
    logger.error('createDeal failed', { error })
    return { success: false }
  }
}

export async function updateDealStage(
  dealId: string,
  stage: Deal['stage'],
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('deal.updated', ${userId}, 'deal', ${dealId},
        ${JSON.stringify({ stage, updatedAt: new Date().toISOString() })}::jsonb)`,
    )

    await buildPartnerEvidencePack({
      actionId: crypto.randomUUID(),
      actionType: 'DEAL_STAGE_UPDATED',
      orgId: dealId,
      executedBy: userId,
    })

    logger.info('Deal stage updated', { dealId, stage, actorId: userId })
    revalidatePath('/portal/deals')
    revalidatePath('/admin/partners')
    return { success: true }
  } catch (error) {
    logger.error('updateDealStage failed', { error })
    return { success: false }
  }
}
