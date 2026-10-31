/**
 * Calendar Connection Sync Route
 *
 * POST /api/calendar-sync/connections/[id]/sync
 * Runs provider sync for a specific connection with org-scoped validation.
 */

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/db'
import { calendars, calendarEvents, externalCalendarConnections } from '@/db/schema/calendar-schema'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { withRLSContext } from '@/lib/db/with-rls-context'
import {
  importGoogleEvents,
  exportEventToGoogle,
} from '@/lib/external-calendar-sync/google-calendar-service'
import {
  importMicrosoftEvents,
  exportEventToMicrosoft,
} from '@/lib/external-calendar-sync/microsoft-calendar-service'
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'

export const dynamic = 'force-dynamic'

function getNextSyncAt(): Date {
  const minutes = Number.parseInt(process.env.CALENDAR_SYNC_INTERVAL_MINUTES || '30', 10)
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 30
  return new Date(Date.now() + safeMinutes * 60 * 1000)
}

const syncRequestSchema = z.object({
  localCalendarId: z.guid(),
  externalCalendarId: z.string().trim().min(1).max(255),
  mode: z.enum(['import', 'export', 'both']).optional(),
  localEventId: z.guid().optional(),
  since: z.string().datetime().optional(),
}).strict()

type SyncRouteParams = { id: string }

/** The connection's sync state and the audit record of that change commit together or not at all. */
async function recordConnectionState(
  actor: { organizationId: string; userId: string; connectionId: string },
  state: Partial<typeof externalCalendarConnections.$inferInsert>,
  audit: { action: string; details: Record<string, unknown> },
) {
  await withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    const [updated] = await tx
      .update(externalCalendarConnections)
      .set({ ...state, updatedAt: new Date() })
      .where(
        and(
          eq(externalCalendarConnections.id, actor.connectionId),
          eq(externalCalendarConnections.organizationId, actor.organizationId),
          eq(externalCalendarConnections.userId, actor.userId),
        ),
      )
      .returning({ id: externalCalendarConnections.id })
    // A disconnected/revoked connection cannot be reported as successfully synced.
    if (!updated) throw new Error('Calendar connection changed during sync')
    await persistAtomicAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      action: audit.action,
      resourceType: 'external_calendar_connections',
      resourceId: actor.connectionId,
      details: audit.details,
    })
  })
}

export const POST = withOrganizationAuth(async (request, context, params?: SyncRouteParams) => {
  try {
    if (!params?.id) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing connection ID')
    }

    const parsed = syncRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid sync payload',
        parsed.error.flatten(),
      )
    }

    const { organizationId, userId } = context
    if (!organizationId || !userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'An authenticated calendar owner is required')
    }
    const { localCalendarId, externalCalendarId, mode, localEventId, since } = parsed.data

    const [connection] = await db
      .select()
      .from(externalCalendarConnections)
      .where(
        and(
          eq(externalCalendarConnections.id, params.id),
          eq(externalCalendarConnections.organizationId, organizationId),
          eq(externalCalendarConnections.userId, userId),
          eq(externalCalendarConnections.isActive, true),
        ),
      )
      .limit(1)

    if (!connection) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Calendar connection not found')
    }
    if (connection.syncEnabled !== true) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Calendar sync is disabled for this connection')
    }
    // Request parameters cannot escalate an import-only grant into an export or vice versa.
    const configuredDirection = connection.syncDirection
    if (configuredDirection !== 'import' && configuredDirection !== 'export' && configuredDirection !== 'both') {
      return standardErrorResponse(ErrorCode.CONFLICT, 'Calendar sync direction is not configured')
    }
    const effectiveMode = mode ?? configuredDirection
    if (configuredDirection !== 'both' && effectiveMode !== configuredDirection) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Requested sync mode is not authorized by this connection')
    }

    const [calendar] = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(
        and(
          eq(calendars.id, localCalendarId),
          eq(calendars.organizationId, organizationId),
          eq(calendars.ownerId, userId),
        ),
      )
      .limit(1)

    if (!calendar) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Only the calendar owner can authorize provider sync',
      )
    }

    const sinceDate = since ? new Date(since) : undefined

    if ((effectiveMode === 'export' || effectiveMode === 'both') && !localEventId) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'localEventId is required for export mode',
      )
    }

    if (connection.provider !== 'google' && connection.provider !== 'microsoft') {
      return standardErrorResponse(
        ErrorCode.NOT_IMPLEMENTED,
        `Provider '${connection.provider}' is not supported for sync`,
      )
    }

    // The export services load the event by id alone, so the event must be proven to belong to this organization here.
    if (localEventId) {
      const [event] = await db
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(and(
          eq(calendarEvents.id, localEventId),
          eq(calendarEvents.organizationId, organizationId),
          eq(calendarEvents.calendarId, localCalendarId),
          eq(calendarEvents.organizerId, userId),
        ))
        .limit(1)
      if (!event) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Local event not found')
      }
    }

    // The sync imports and exports through an external provider, so its effect cannot commit with a database
    // transaction: the intent is recorded first (no record, no sync) and the outcome afterwards. The connection's own state
    // change (synced or failed) is a database row, so it is written in one transaction with its audit record.
    let results: Record<string, unknown>
    try {
      results = await performAuditedOperation(
        {
          organizationId,
          userId,
          action: 'calendar_sync.connection.sync',
          resourceType: 'external_calendar_connections',
          resourceId: connection.id,
          details: {
            provider: connection.provider,
            mode: effectiveMode,
            localCalendarId,
            externalCalendarId,
            localEventId: localEventId ?? null,
          },
        },
        async () => {
          const synced: Record<string, unknown> = {}
          const google = connection.provider === 'google'

          try {
            if (effectiveMode === 'import' || effectiveMode === 'both') {
              synced.import = google
                ? await importGoogleEvents(connection.id, localCalendarId, externalCalendarId, { timeMin: sinceDate })
                : await importMicrosoftEvents(connection.id, localCalendarId, externalCalendarId, { timeMin: sinceDate })
            }
            if ((effectiveMode === 'export' || effectiveMode === 'both') && localEventId) {
              synced.export = google
                ? await exportEventToGoogle(connection.id, localEventId, externalCalendarId)
                : await exportEventToMicrosoft(connection.id, localEventId, externalCalendarId)
            }
          } catch (providerError) {
            await recordConnectionState(
              { organizationId, userId, connectionId: connection.id },
              { syncStatus: 'failed', syncError: 'Provider sync failed' },
              { action: 'calendar_sync.connection.sync_failed', details: { provider: connection.provider, mode: effectiveMode } },
            )
            throw providerError
          }

          await recordConnectionState(
            { organizationId, userId, connectionId: connection.id },
            { lastSyncAt: new Date(), nextSyncAt: getNextSyncAt(), syncStatus: 'synced', syncError: null },
            { action: 'calendar_sync.connection.state_synced', details: { provider: connection.provider, mode: effectiveMode, imported: synced.import !== undefined, exported: synced.export !== undefined } },
          )

          return synced
        },
      )
    } catch (error) {
      const refused = operationAuditResponse(error)
      if (refused) return standardErrorResponse(ErrorCode.CONFLICT, refused.body.error.message)
      throw error
    }

    return standardSuccessResponse({
      connectionId: connection.id,
      provider: connection.provider,
      mode: effectiveMode,
      results,
    })
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Calendar sync failed')
  }
})
