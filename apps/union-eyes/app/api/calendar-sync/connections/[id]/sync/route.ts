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
  externalCalendarId: z.string().min(1),
  mode: z.enum(['import', 'export', 'both']).optional(),
  localEventId: z.guid().optional(),
  since: z.string().datetime().optional(),
})

type SyncRouteParams = { id: string }

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
    const { localCalendarId, externalCalendarId, mode, localEventId, since } = parsed.data

    const [connection] = await db
      .select()
      .from(externalCalendarConnections)
      .where(
        and(
          eq(externalCalendarConnections.id, params.id),
          eq(externalCalendarConnections.organizationId, organizationId),
          eq(externalCalendarConnections.isActive, true),
        ),
      )
      .limit(1)

    if (!connection) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Calendar connection not found')
    }

    const [calendar] = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(
        and(
          eq(calendars.id, localCalendarId),
          eq(calendars.organizationId, organizationId),
        ),
      )
      .limit(1)

    if (!calendar) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Local calendar is outside your organization scope',
      )
    }

    const effectiveMode = mode ?? (connection.syncDirection as 'import' | 'export' | 'both' | null) ?? 'import'
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
        .where(and(eq(calendarEvents.id, localEventId), eq(calendarEvents.organizationId, organizationId)))
        .limit(1)
      if (!event) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Local event not found')
      }
    }

    // The sync imports and exports through an external provider, so its effect cannot commit with a database
    // transaction: the intent is recorded first (no record, no sync) and the outcome afterwards.
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

          await db
            .update(externalCalendarConnections)
            .set({
              lastSyncAt: new Date(),
              nextSyncAt: getNextSyncAt(),
              syncStatus: 'synced',
              syncError: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(externalCalendarConnections.id, connection.id),
                eq(externalCalendarConnections.organizationId, organizationId),
              ),
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
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Calendar sync failed', error)
  }
})
