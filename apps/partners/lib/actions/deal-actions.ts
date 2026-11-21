/**
 * Partners Server Actions — Deal Registration & Pipeline.
 *
 * Partners register deals for pipeline protection. Deals flow through:
 *   registered → submitted → approved → won/lost
 */
'use server'

import { resolveOrgContext } from '../resolve-org'
import { actionRows } from '../../queries/partner-action-facts'
import { dealResourceId, dealRootScope, requireDealOrigin, scopedDeals } from '../partner-action-scope'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

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

const stageSchema = z.enum(['registered', 'submitted', 'approved', 'won', 'lost'])
const createSchema = z.object({
  accountName: z.string().min(1), contactName: z.string().min(1), contactEmail: z.string().email(),
  vertical: z.string().min(1), estimatedArr: z.number().finite().positive(),
  expectedCloseDate: z.string().min(1), notes: z.string().optional(),
  partnerId: z.string().uuid().optional(),
}).strict()

export async function listDeals(opts?: { page?: number; stage?: string; search?: string; partnerId?: string }): Promise<DealListResult> {
  const ctx = await resolveOrgContext({ scope: 'partner', partnerId: opts?.partnerId, allowPlatform: true })
  const page = z.number().int().positive().parse(opts?.page ?? 1)
  const stage = opts?.stage ? stageSchema.parse(opts.stage) : null
  const search = opts?.search ?? ''
  try {
    const from = sql`FROM (${scopedDeals(ctx)}) deals WHERE ${stage ? sql`stage=${stage}` : sql`true`}
      AND ${search ? sql`"accountName" ILIKE ${`%${search}%`}` : sql`true`}
      AND ${ctx.scope === 'platform' && opts?.partnerId ? sql`"partnerId"=${opts.partnerId}` : sql`true`}`
    const deals = actionRows<Deal>(await platformDb.execute(sql`SELECT * ${from} ORDER BY "createdAt" DESC,id LIMIT 25 OFFSET ${(page - 1) * 25}`))
    const [total] = actionRows<{ total: number; totalArr: number }>(await platformDb.execute(sql`SELECT count(*) AS total,COALESCE(sum("estimatedArr"),0) AS "totalArr" ${from}`))
    return { deals, total: Number(total?.total ?? 0), totalArr: Number(total?.totalArr ?? 0) }
  } catch (error) {
    logger.error('listDeals failed', { error })
    return { deals: [], total: 0, totalArr: 0 }
  }
}

export async function getDealStats(partnerId?: string): Promise<DealStats> {
  const ctx = await resolveOrgContext({ scope: 'partner', partnerId, allowPlatform: true })
  try {
    const [stats] = actionRows<DealStats>(await platformDb.execute(sql`SELECT
      count(*) FILTER (WHERE stage='registered') AS registered,count(*) FILTER (WHERE stage='submitted') AS submitted,
      count(*) FILTER (WHERE stage='approved') AS approved,count(*) FILTER (WHERE stage='won') AS won,
      count(*) FILTER (WHERE stage='lost') AS lost,COALESCE(sum("estimatedArr"),0) AS "totalArr"
      FROM (${scopedDeals(ctx)}) deals WHERE ${ctx.scope === 'platform' && partnerId ? sql`"partnerId"=${partnerId}` : sql`true`}`))
    return { registered: Number(stats?.registered ?? 0), submitted: Number(stats?.submitted ?? 0),
      approved: Number(stats?.approved ?? 0), won: Number(stats?.won ?? 0), lost: Number(stats?.lost ?? 0), totalArr: Number(stats?.totalArr ?? 0) }
  } catch (error) {
    logger.error('getDealStats failed', { error })
    return { registered: 0, submitted: 0, approved: 0, won: 0, lost: 0, totalArr: 0 }
  }
}

export async function createDeal(data: {
  accountName: string; contactName: string; contactEmail: string; vertical: string;
  estimatedArr: number; expectedCloseDate: string; notes?: string; partnerId?: string;
}): Promise<{ success: boolean; dealId?: string }> {
  const ctx = await resolveOrgContext({ scope: 'partner', partnerId: data?.partnerId })
  const validated = createSchema.parse(data)
  try {
    const dealId = crypto.randomUUID()
    // A partner relationship is not an organization. The actual audit event ID
    // identifies this root; the partner and actor are recorded separately.
    const inserted = actionRows<{ id: string }>(await platformDb.execute(sql`INSERT INTO public.audit_log (id,action,actor_id,entity_type,org_id,metadata)
      SELECT ${dealId},'deal.registered',${ctx.actorId},'deal',NULL,${JSON.stringify({
        ...validated, dealId, partnerId: ctx.partner.id, partnerName: ctx.partner.companyName,
        stage: 'submitted', registeredAt: new Date().toISOString(),
      })}::jsonb WHERE EXISTS(SELECT 1 FROM public.partners p JOIN public.partner_users u ON u.partner_id=p.id
        WHERE p.id::text=${ctx.partner.id} AND p.status='active' AND u.user_id=${ctx.actorId}) RETURNING id`))
    if (inserted.length !== 1) throw new Error('Current partner authority changed')
    revalidatePath('/portal/deals')
    return { success: true, dealId }
  } catch (error) {
    logger.error('createDeal failed', { error })
    return { success: false }
  }
}

export async function updateDealStage(dealId: string, stage: Deal['stage'], partnerId?: string): Promise<{ success: boolean }> {
  const validated = stageSchema.parse(stage)
  const ctx = validated === 'approved'
    ? await resolveOrgContext({ scope: 'platform' })
    : await resolveOrgContext({ scope: 'partner', partnerId, allowPlatform: true })
  const origin = await requireDealOrigin(ctx, dealId)
  try {
    const inserted = actionRows<{ id: string }>(await platformDb.execute(sql`INSERT INTO public.audit_log (action,actor_id,entity_type,org_id,metadata)
      SELECT 'deal.updated',${ctx.actorId},'deal',NULL,${JSON.stringify({
        resourceId: origin.id, partnerId: origin.partner.id, stage: validated, updatedAt: new Date().toISOString(),
      })}::jsonb WHERE EXISTS(SELECT 1 FROM public.audit_log origin WHERE ${dealRootScope(ctx)} AND ${dealResourceId}=${origin.id}) RETURNING id`))
    if (inserted.length !== 1) throw new Error('Current deal authority changed')
    revalidatePath('/portal/deals')
    revalidatePath('/admin/partners')
    return { success: true }
  } catch (error) {
    logger.error('updateDealStage failed', { error })
    return { success: false }
  }
}
