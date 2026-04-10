/**
 * Zonga — Nzila OS Integration Layer
 *
 * Bridges Zonga to the broader Nzila OS platform:
 * - Governance event logging (sync log)
 * - Platform health reporting
 * - Cross-app event fabric (content published, payout completed, etc.)
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export type SyncEntityType =
  | 'track'
  | 'release'
  | 'event'
  | 'creator'
  | 'payout'
  | 'takedown'
  | 'moderation'
  | 'earnings'

export type SyncDirection = 'zonga_to_os' | 'os_to_zonga'
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'skipped'

/**
 * Record a sync event for Nzila OS interoperability.
 * Every material state change in Zonga pushes a record to the sync log,
 * enabling the platform's audit trail and cross-app observability.
 */
export async function recordSyncEvent(params: {
  entityType: SyncEntityType
  resourceId: string
  direction: SyncDirection
  action: string
  payload?: Record<string, unknown>
  orgId: string
}): Promise<{ ok: boolean; syncId?: string }> {
  const { entityType, resourceId, direction, action, payload, orgId } = params

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_nzila_sync_log (
      entity_type, entity_id, direction, action, payload, status, org_id
    ) VALUES (
      ${entityType}, ${resourceId}, ${direction}, ${action},
      ${payload ? JSON.stringify(payload) : null}::jsonb,
      'synced', ${orgId}
    )
    RETURNING id
  `)
  const syncId = (rows as unknown as Array<{ id: string }>)[0]?.id
  return { ok: true, syncId }
}

/**
 * Publish a platform event to the Nzila OS event fabric.
 * Used for cross-app observability and governance.
 */
export async function publishPlatformEvent(params: {
  eventType: string
  entityType: SyncEntityType
  resourceId: string
  orgId: string
  actorId: string
  data?: Record<string, unknown>
}): Promise<void> {
  const { eventType, entityType, resourceId, orgId, actorId, data } = params

  // Record in sync log
  await recordSyncEvent({
    entityType,
    resourceId,
    direction: 'zonga_to_os',
    action: eventType,
    payload: { actorId, ...data },
    orgId,
  })

  logger.info('Platform event published', { eventType, entityType, resourceId, actorId })
}

/**
 * Get recent sync events for operational monitoring.
 */
export async function getRecentSyncEvents(
  orgId: string,
  limit = 50,
): Promise<Array<{
  id: string
  entityType: SyncEntityType
  resourceId: string
  direction: SyncDirection
  action: string
  status: SyncStatus
  syncedAt: Date
}>> {
  const rows = await platformDb.execute(sql`
    SELECT id, entity_type, entity_id, direction, action, status, synced_at
    FROM zonga_nzila_sync_log
    WHERE org_id = ${orgId}
    ORDER BY synced_at DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    entityType: r.entity_type as SyncEntityType,
    resourceId: r.entity_id as string,
    direction: r.direction as SyncDirection,
    action: r.action as string,
    status: r.status as SyncStatus,
    syncedAt: new Date(r.synced_at as string),
  }))
}

/**
 * Get sync failure log for debugging.
 */
export async function getSyncFailures(
  orgId: string,
): Promise<Array<{
  id: string
  entityType: string
  resourceId: string
  action: string
  error: string
  failedAt: Date
}>> {
  const rows = await platformDb.execute(sql`
    SELECT id, entity_type, entity_id, action, payload, synced_at
    FROM zonga_nzila_sync_log
    WHERE org_id = ${orgId} AND status = 'failed'
    ORDER BY synced_at DESC
    LIMIT 100
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    entityType: r.entity_type as string,
    resourceId: r.entity_id as string,
    action: r.action as string,
    error: (r.payload as Record<string, unknown>)?.error as string ?? 'Unknown error',
    failedAt: new Date(r.synced_at as string),
  }))
}

// ── Pre-defined Event Types ─────────────────────────────────────────────────

export const ZONGA_PLATFORM_EVENTS = {
  TRACK_PUBLISHED: 'zonga.track.published',
  TRACK_SUSPENDED: 'zonga.track.suspended',
  RELEASE_PUBLISHED: 'zonga.release.published',
  EVENT_PUBLISHED: 'zonga.event.published',
  EVENT_COMPLETED: 'zonga.event.completed',
  PAYOUT_COMPLETED: 'zonga.payout.completed',
  PAYOUT_FAILED: 'zonga.payout.failed',
  TAKEDOWN_ENFORCED: 'zonga.takedown.enforced',
  TAKEDOWN_RESOLVED: 'zonga.takedown.resolved',
  CREATOR_REGISTERED: 'zonga.creator.registered',
  MODERATION_ESCALATED: 'zonga.moderation.escalated',
  SUSPICIOUS_ACTIVITY: 'zonga.safety.suspicious',
} as const
