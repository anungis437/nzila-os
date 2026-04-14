import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { recordPilotMetricEvent } from '@nzila/platform-pilot-metrics'
import { logger } from '@/lib/logger'

async function resolveActivePilotId(orgId: string): Promise<string | null> {
  const rows = (await platformDb.execute(sql`
    SELECT id
    FROM pilot_definitions
    WHERE org_id = ${orgId}::uuid
      AND app_scope = 'zonga'
      AND status = 'active'
    ORDER BY started_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `)) as unknown as Array<{ id: string }>

  return rows[0]?.id ?? null
}

async function emitZongaMetric(
  orgId: string,
  metricName: Parameters<typeof recordPilotMetricEvent>[0]['metricName'],
  valueNumeric: number,
  audit: {
    actorId?: string
    systemActorId?: `system:${string}`
    traceId: string
  },
  data: {
    metricType?: Parameters<typeof recordPilotMetricEvent>[0]['metricType']
    entityId?: string
    entityType?: string
    valueJson?: Record<string, unknown>
  } = {},
): Promise<void> {
  try {
    const pilotId = await resolveActivePilotId(orgId)
    if (!pilotId) return

    await recordPilotMetricEvent({
      orgId,
      pilotId,
      appScope: 'zonga',
      metricType: data.metricType ?? (metricName.includes('revenue') || metricName.includes('payout') || metricName.includes('tickets') ? 'revenue' : 'adoption'),
      metricName,
      valueNumeric,
      valueJson: data.valueJson,
      entityId: data.entityId,
      entityType: data.entityType,
      traceId: audit.traceId,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: audit.actorId,
      systemActorId: audit.systemActorId,
      traceId: audit.traceId,
      evidenceMetadata: { source: 'zonga', metricName },
    })
  } catch (error) {
    logger.warn('pilot metrics emit failed (zonga)', { error: String(error), metricName, orgId })
  }
}

export async function recordZongaEventCreated(orgId: string, eventId: string, actorId: string, traceId: string): Promise<void> {
  await emitZongaMetric(orgId, 'events_created', 1, {
    actorId,
    traceId,
  }, {
    metricType: 'operations',
    entityId: eventId,
    entityType: 'event',
  })
}

export async function recordZongaTicketSold(orgId: string, eventId: string, amount: number, actorId: string, traceId: string): Promise<void> {
  await emitZongaMetric(orgId, 'tickets_sold', 1, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId: eventId,
    entityType: 'event',
  })
  await emitZongaMetric(orgId, 'gross_ticket_revenue', amount, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId: eventId,
    entityType: 'event',
  })
}

export async function recordZongaAttendeeCheckin(orgId: string, eventId: string, actorId: string, traceId: string): Promise<void> {
  await emitZongaMetric(orgId, 'attendee_checkins', 1, {
    actorId,
    traceId,
  }, {
    metricType: 'operations',
    entityId: eventId,
    entityType: 'event',
  })
}

export async function recordZongaStreamStart(orgId: string, assetId: string, actorId: string, traceId: string): Promise<void> {
  await emitZongaMetric(orgId, 'stream_starts', 1, {
    actorId,
    traceId,
  }, {
    metricType: 'adoption',
    entityId: assetId,
    entityType: 'asset',
  })
}

export async function recordZongaReplayView(orgId: string, assetId: string, actorId: string, traceId: string): Promise<void> {
  await emitZongaMetric(orgId, 'replay_views', 1, {
    actorId,
    traceId,
  }, {
    metricType: 'adoption',
    entityId: assetId,
    entityType: 'asset',
  })
}

export async function recordZongaPlaybackWatch(
  orgId: string,
  assetId: string,
  durationMs: number,
  actorId: string,
  traceId: string,
  isReplay = false,
): Promise<void> {
  const watchMinutes = Math.max(0, durationMs / 60_000)
  await emitZongaMetric(orgId, 'stream_watch_minutes', watchMinutes, {
    actorId,
    traceId,
  }, {
    metricType: 'adoption',
    entityId: assetId,
    entityType: 'asset',
    valueJson: {
      durationMs,
      denominator: 1,
    },
  })
  await emitZongaMetric(orgId, 'avg_watch_time', watchMinutes, {
    actorId,
    traceId,
  }, {
    metricType: 'adoption',
    entityId: assetId,
    entityType: 'asset',
    valueJson: {
      durationMs,
      denominator: 1,
    },
  })

  if (isReplay) {
    await recordZongaReplayView(orgId, assetId, actorId, traceId)
  }
}

export async function recordZongaRevenueEvent(
  orgId: string,
  amount: number,
  eventType: 'gross_revenue' | 'net_revenue' | 'platform_fee_revenue' | 'payout_volume' | 'subscription_revenue',
  actorId: string,
  traceId: string,
  entityId?: string,
): Promise<void> {
  await emitZongaMetric(orgId, eventType, amount, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId,
    entityType: 'revenue_event',
  })

  await emitZongaMetric(orgId, 'transaction_count', 1, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId,
    entityType: 'revenue_event',
  })
}

export async function recordZongaCreatorPayout(
  orgId: string,
  creatorId: string,
  amount: number,
  actorId: string,
  traceId: string,
): Promise<void> {
  await emitZongaMetric(orgId, 'creator_payouts', amount, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId: creatorId,
    entityType: 'creator',
  })

  await emitZongaMetric(orgId, 'payout_volume', amount, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId: creatorId,
    entityType: 'creator',
  })
}

export async function recordZongaPlatformFeeRevenue(
  orgId: string,
  amount: number,
  actorId: string,
  traceId: string,
  entityId?: string,
): Promise<void> {
  if (amount <= 0) return
  await emitZongaMetric(orgId, 'platform_fee_revenue', amount, {
    actorId,
    traceId,
  }, {
    metricType: 'revenue',
    entityId,
    entityType: 'revenue_event',
  })
}

export async function recordZongaIntegrationHealth(orgId: string, deadLetters: number, retries: number, traceId: string): Promise<void> {
  await emitZongaMetric(orgId, 'dead_letter_count', deadLetters, {
    systemActorId: 'system:zonga-integration-health',
    traceId,
  }, {
    metricType: 'integration',
  })
  await emitZongaMetric(orgId, 'retry_count', retries, {
    systemActorId: 'system:zonga-integration-health',
    traceId,
  }, {
    metricType: 'integration',
  })
}
