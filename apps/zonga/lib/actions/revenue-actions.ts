/**
 * Zonga Server Actions — Revenue.
 *
 * Revenue event tracking, stream analytics, and per-creator breakdowns.
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
  RevenueType,
  RecordRevenueEventSchema,
  type RevenueEvent,
} from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { resolveOrgContext } from '@/lib/resolve-org'

export interface RevenueOverview {
  totalRevenue: number
  streamRevenue: number
  downloadRevenue: number
  syncRevenue: number
  eventCount: number
  recentEvents: RevenueEvent[]
}

export async function getRevenueOverview(): Promise<RevenueOverview> {
  const ctx = await resolveOrgContext()

  try {
    const [totals] = (await platformDb.execute(
      sql`SELECT
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(CASE WHEN type = ${RevenueType.STREAM} THEN amount END), 0) as streams,
        COALESCE(SUM(CASE WHEN type = ${RevenueType.DOWNLOAD} THEN amount END), 0) as downloads,
        COALESCE(SUM(CASE WHEN type = ${RevenueType.SYNC_LICENSE} THEN amount END), 0) as sync,
        COUNT(*) as event_count
      FROM zonga_revenue_events WHERE entity_id = ${ctx.entityId}`,
    )) as unknown as [{ total: number; streams: number; downloads: number; sync: number; event_count: number }]

    const recentEvents = (await platformDb.execute(
      sql`SELECT
        id, type, amount,
        asset_id as "assetId",
        asset_title as "assetTitle",
        creator_id as "creatorId",
        source,
        created_at as "createdAt"
      FROM zonga_revenue_events WHERE entity_id = ${ctx.entityId}
      ORDER BY created_at DESC LIMIT 25`,
    )) as unknown as { rows: RevenueEvent[] }

    return {
      totalRevenue: Number(totals?.total ?? 0),
      streamRevenue: Number(totals?.streams ?? 0),
      downloadRevenue: Number(totals?.downloads ?? 0),
      syncRevenue: Number(totals?.sync ?? 0),
      eventCount: Number(totals?.event_count ?? 0),
      recentEvents: recentEvents.rows ?? [],
    }
  } catch (error) {
    logger.error('getRevenueOverview failed', { error })
    return {
      totalRevenue: 0,
      streamRevenue: 0,
      downloadRevenue: 0,
      syncRevenue: 0,
      eventCount: 0,
      recentEvents: [],
    }
  }
}

export async function recordRevenueEvent(data: {
  type: string
  amount: number
  assetId: string
  assetTitle?: string
  creatorId: string
  source?: string
}): Promise<{ success: boolean; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const parsed = RecordRevenueEventSchema.safeParse(data)
  if (!parsed.success) {
    logger.warn('recordRevenueEvent validation failed', { errors: parsed.error.flatten().fieldErrors })
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    const eventId = crypto.randomUUID()

    // ── Write to domain table (org-scoped, append-only) ──
    await platformDb.execute(
      sql`INSERT INTO zonga_revenue_events
        (id, entity_id, type, amount, asset_id, asset_title, creator_id, source, created_by, created_at)
      VALUES (
        ${eventId}, ${ctx.entityId}, ${data.type}, ${data.amount},
        ${data.assetId}, ${data.assetTitle ?? null}, ${data.creatorId},
        ${data.source ?? null}, ${ctx.actorId}, NOW()
      )`,
    )

    // ── Audit trail (audit_log stays as audit-only) ──
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES ('revenue.recorded', ${ctx.actorId}, 'revenue_event', ${eventId},
        ${JSON.stringify({ ...data, id: eventId, orgId: ctx.entityId })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.REVENUE_RECORD,
      entityType: ZongaEntityType.REVENUE_EVENT,
      entityId: eventId,
      actorId: ctx.actorId,
      targetId: eventId,
      metadata: { type: data.type, amount: data.amount, orgId: ctx.entityId },
    })
    logger.info('Revenue event recorded', { ...auditEvent })

    const pack = buildEvidencePackFromAction({
      actionType: 'REVENUE_RECORDED',
      entityId: eventId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/revenue')
    return { success: true }
  } catch (error) {
    logger.error('recordRevenueEvent failed', { error })
    return { success: false }
  }
}

export async function getRevenueByCreator(): Promise<
  Array<{ creatorId: string; creatorName: string; total: number; events: number }>
> {
  const ctx = await resolveOrgContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        re.creator_id as "creatorId",
        COALESCE(c.display_name, re.creator_id) as "creatorName",
        COALESCE(SUM(re.amount), 0) as total,
        COUNT(*) as events
      FROM zonga_revenue_events re
      LEFT JOIN zonga_creators c ON c.id = re.creator_id AND c.entity_id = ${ctx.entityId}
      WHERE re.entity_id = ${ctx.entityId}
      GROUP BY re.creator_id, COALESCE(c.display_name, re.creator_id)
      ORDER BY total DESC
      LIMIT 50`,
    )) as unknown as { rows: Array<{ creatorId: string; creatorName: string; total: number; events: number }> }

    return rows.rows ?? []
  } catch (error) {
    logger.error('getRevenueByCreator failed', { error })
    return []
  }
}
