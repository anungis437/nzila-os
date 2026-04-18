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
import { getCreatorPlan } from '@/lib/guards/plan-queries'
import { guardCreatorFeature } from '@/lib/guards/subscription-guards'
import { recordZongaPlatformFeeRevenue, recordZongaRevenueEvent } from '@/lib/pilot-metrics'

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
      FROM zonga_revenue_events WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number; streams: number; downloads: number; sync: number; event_count: number }]

    const recentEvents = (await platformDb.execute(
      sql`SELECT
        id, type, amount,
        asset_id as "assetId",
        asset_title as "assetTitle",
        creator_id as "creatorId",
        source,
        created_at as "createdAt"
      FROM zonga_revenue_events WHERE org_id = ${ctx.orgId}
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
  metadata?: Record<string, unknown>
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
        (id, org_id, type, amount, asset_id, asset_title, creator_id, source, created_by, created_at)
      VALUES (
        ${eventId}, ${ctx.orgId}, ${data.type}, ${data.amount},
        ${data.assetId}, ${data.assetTitle ?? null}, ${data.creatorId},
        ${data.source ?? null}, ${ctx.actorId}, NOW()
      )`,
    )

    // ── Ledger backing entry (enforces NO_REVENUE_WITHOUT_LEDGER invariant) ──
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('ledger.revenue.entry', 'system', 'ledger_entry', ${eventId}, ${ctx.orgId},
        ${JSON.stringify({
          revenueEventId: eventId,
          type: data.type,
          amount: data.amount,
          creatorId: data.creatorId,
          direction: 'credit',
          account: `creator:${data.creatorId}`,
          counterparty: 'platform:revenue',
        })}::jsonb)`,
    )

    // ── Audit trail (audit_log stays as audit-only) ──
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('revenue.recorded', ${ctx.actorId}, 'revenue_event', ${eventId},
        ${JSON.stringify({ ...data, id: eventId, orgId: ctx.orgId })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.REVENUE_RECORD,
      entityType: ZongaEntityType.REVENUE_EVENT,
      orgId: eventId,
      actorId: ctx.actorId,
      targetId: eventId,
      metadata: { type: data.type, amount: data.amount, orgId: ctx.orgId },
    })
    logger.info('Revenue event recorded', { ...auditEvent })

    const pack = buildEvidencePackFromAction({
      actionType: 'REVENUE_RECORDED',
      orgId: eventId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    recordZongaRevenueEvent(
      ctx.orgId,
      Number(data.amount),
      'gross_revenue',
      ctx.actorId,
      eventId,
      eventId,
    ).catch((metricErr) =>
      logger.warn('Pilot metric emit failed', { error: String(metricErr), metric: 'gross_revenue' }),
    )

    if (data.type === RevenueType.SUBSCRIPTION_SHARE) {
      recordZongaRevenueEvent(
        ctx.orgId,
        Number(data.amount),
        'subscription_revenue',
        ctx.actorId,
        eventId,
        eventId,
      ).catch((metricErr) =>
        logger.warn('Pilot metric emit failed', { error: String(metricErr), metric: 'subscription_revenue' }),
      )
    }

    const platformFeeRaw = data.metadata?.platformFeeAmount
    const platformFeeAmount = typeof platformFeeRaw === 'number' ? platformFeeRaw : Number(platformFeeRaw ?? 0)
    if (Number.isFinite(platformFeeAmount) && platformFeeAmount > 0) {
      recordZongaPlatformFeeRevenue(ctx.orgId, platformFeeAmount, ctx.actorId, eventId, eventId).catch((metricErr) =>
        logger.warn('Pilot metric emit failed', { error: String(metricErr), metric: 'platform_fee_revenue' }),
      )
    }

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

  // S2: Per-creator revenue breakdown requires label plan (advanced_analytics)
  const creatorPlan = await getCreatorPlan(ctx.actorId, ctx.orgId)
  const gate = guardCreatorFeature(creatorPlan.plan, 'advanced_analytics')
  if (!gate.passed) {
    logger.info('getRevenueByCreator blocked — label plan required', { plan: creatorPlan.plan })
    return []
  }

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        re.creator_id as "creatorId",
        COALESCE(c.display_name, re.creator_id) as "creatorName",
        COALESCE(SUM(re.amount), 0) as total,
        COUNT(*) as events
      FROM zonga_revenue_events re
      LEFT JOIN zonga_creators c ON c.id = re.creator_id AND c.org_id = ${ctx.orgId}
      WHERE re.org_id = ${ctx.orgId}
      GROUP BY re.creator_id, COALESCE(c.display_name, re.creator_id)
      ORDER BY total DESC
      LIMIT 50`,
    )) as unknown as Array<{ creatorId: string; creatorName: string; total: number; events: number }>

    return rows
  } catch (error) {
    logger.error('getRevenueByCreator failed', { error })
    return []
  }
}

export interface RevenueTelemetryDashboard {
  creatorSignups: number
  paidConversions: {
    captured: number
    totalIntents: number
    ratePct: number
  }
  mpesaSuccess: {
    captured: number
    total: number
    ratePct: number
  }
  stripeMrrUsd: number
  churn: {
    cancelledLast30d: number
  }
  cacBySource: Array<{
    source: string
    acquisitionCostUsd: number
    paidConversions: number
    cacUsd: number
  }>
}

export async function getRevenueTelemetryDashboard(periodDays = 30): Promise<RevenueTelemetryDashboard> {
  const ctx = await resolveOrgContext()
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString()

  const [
    creatorSignupsRows,
    conversionsRows,
    mpesaRows,
    stripeCreatorRows,
    stripeListenerRows,
    churnRows,
    cacRows,
  ] = await Promise.all([
    platformDb.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM zonga_creators
      WHERE org_id = ${ctx.orgId}
        AND created_at >= ${since}::timestamptz
    `) as Promise<Array<{ count: number }>>,

    platformDb.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'captured')::int AS captured
      FROM zonga_payment_intents
      WHERE org_id = ${ctx.orgId}
        AND created_at >= ${since}::timestamptz
    `) as Promise<Array<{ total: number; captured: number }>>,

    platformDb.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'captured')::int AS captured
      FROM zonga_payment_intents
      WHERE org_id = ${ctx.orgId}
        AND provider = 'vodacom_mpesa'
        AND created_at >= ${since}::timestamptz
    `) as Promise<Array<{ total: number; captured: number }>>,

    platformDb.execute(sql`
      SELECT COALESCE(SUM(CASE plan
        WHEN 'pro' THEN 29
        WHEN 'business' THEN 149
        WHEN 'label' THEN 499
        WHEN 'enterprise' THEN 999
        ELSE 0
      END), 0)::float AS mrr
      FROM zonga_creators
      WHERE org_id = ${ctx.orgId}
        AND subscription_status = 'active'
    `) as Promise<Array<{ mrr: number }>>,

    platformDb.execute(sql`
      SELECT (COUNT(*) FILTER (WHERE plan = 'premium') * 4.99)::float AS mrr
      FROM zonga_listeners
      WHERE subscription_status = 'active'
    `) as Promise<Array<{ mrr: number }>>,

    platformDb.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM zonga_payment_intents
      WHERE org_id = ${ctx.orgId}
        AND status = 'cancelled'
        AND updated_at >= ${since}::timestamptz
    `) as Promise<Array<{ count: number }>>,

    platformDb.execute(sql`
      SELECT
        COALESCE(metadata->>'source', 'unknown') AS source,
        COALESCE(SUM(NULLIF(metadata->>'acquisitionCostUsd', '')::numeric), 0)::float AS spend,
        COUNT(*) FILTER (WHERE status = 'captured')::int AS conversions
      FROM zonga_payment_intents
      WHERE org_id = ${ctx.orgId}
        AND created_at >= ${since}::timestamptz
      GROUP BY COALESCE(metadata->>'source', 'unknown')
      ORDER BY spend DESC
    `) as Promise<Array<{ source: string; spend: number; conversions: number }>>,
  ])

  const creatorSignups = Number(creatorSignupsRows[0]?.count ?? 0)
  const conversions = conversionsRows[0] ?? { total: 0, captured: 0 }
  const mpesa = mpesaRows[0] ?? { total: 0, captured: 0 }

  const conversionRate = Number(conversions.total) > 0
    ? (Number(conversions.captured) / Number(conversions.total)) * 100
    : 0

  const mpesaRate = Number(mpesa.total) > 0
    ? (Number(mpesa.captured) / Number(mpesa.total)) * 100
    : 0

  const stripeMrrUsd = Number(stripeCreatorRows[0]?.mrr ?? 0) + Number(stripeListenerRows[0]?.mrr ?? 0)

  return {
    creatorSignups,
    paidConversions: {
      captured: Number(conversions.captured ?? 0),
      totalIntents: Number(conversions.total ?? 0),
      ratePct: Number(conversionRate.toFixed(2)),
    },
    mpesaSuccess: {
      captured: Number(mpesa.captured ?? 0),
      total: Number(mpesa.total ?? 0),
      ratePct: Number(mpesaRate.toFixed(2)),
    },
    stripeMrrUsd: Number(stripeMrrUsd.toFixed(2)),
    churn: {
      cancelledLast30d: Number(churnRows[0]?.count ?? 0),
    },
    cacBySource: cacRows.map((row) => {
      const spend = Number(row.spend ?? 0)
      const conversionsCount = Number(row.conversions ?? 0)
      return {
        source: row.source,
        acquisitionCostUsd: Number(spend.toFixed(2)),
        paidConversions: conversionsCount,
        cacUsd: conversionsCount > 0 ? Number((spend / conversionsCount).toFixed(2)) : 0,
      }
    }),
  }
}
