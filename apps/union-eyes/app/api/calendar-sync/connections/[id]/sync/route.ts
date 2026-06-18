/**
 * Calendar Connection Sync Route
 *
 * POST /api/calendar-sync/connections/[id]/sync
 * Runs provider sync for a specific connection with org-scoped validation.
 */

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/db'
import { calendars, externalCalendarConnections } from '@/db/schema/calendar-schema'
import { withOrganizationAuth } from '@/lib/organization-middleware'
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
  localCalendarId: z.string().uuid(),
  externalCalendarId: z.string().min(1),
  mode: z.enum(['import', 'export', 'both']).optional(),
  localEventId: z.string().uuid().optional(),
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

    const { organizationId } = context
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
    const results: Record<string, unknown> = {}
    const sinceDate = since ? new Date(since) : undefined

    if ((effectiveMode === 'export' || effectiveMode === 'both') && !localEventId) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'localEventId is required for export mode',
      )
    }

    if (connection.provider === 'google') {
      if (effectiveMode === 'import' || effectiveMode === 'both') {
        results.import = await importGoogleEvents(
          connection.id,
          localCalendarId,
          externalCalendarId,
          { timeMin: sinceDate },
        )
      }
      if ((effectiveMode === 'export' || effectiveMode === 'both') && localEventId) {
        results.export = await exportEventToGoogle(connection.id, localEventId, externalCalendarId)
      }
    } else if (connection.provider === 'microsoft') {
      if (effectiveMode === 'import' || effectiveMode === 'both') {
        results.import = await importMicrosoftEvents(
          connection.id,
          localCalendarId,
          externalCalendarId,
          { timeMin: sinceDate },
        )
      }
      if ((effectiveMode === 'export' || effectiveMode === 'both') && localEventId) {
        results.export = await exportEventToMicrosoft(connection.id, localEventId, externalCalendarId)
      }
    } else {
      return standardErrorResponse(
        ErrorCode.NOT_IMPLEMENTED,
        `Provider '${connection.provider}' is not supported for sync`,
      )
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
      .where(eq(externalCalendarConnections.id, connection.id))

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
