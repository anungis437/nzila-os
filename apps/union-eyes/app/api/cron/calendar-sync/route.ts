/**
 * Calendar Sync Cron Runner
 *
 * POST /api/cron/calendar-sync
 * Processes due external calendar connections using nextSyncAt.
 */

import { NextRequest } from 'next/server'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { withApiAuth } from '@/lib/api-auth-guard'
import { db } from '@/db/db'
import { calendars, externalCalendarConnections } from '@/db/schema/calendar-schema'
import { importGoogleEvents } from '@/lib/external-calendar-sync/google-calendar-service'
import { importMicrosoftEvents } from '@/lib/external-calendar-sync/microsoft-calendar-service'
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'

export const dynamic = 'force-dynamic'

type SyncConnection = {
  id: string
  provider: string
  organizationId: string
  syncPastDays: number | null
  syncFutureDays: number | null
  calendarMappings: any
}

type CalendarMappingPair = {
  externalId: string
  localCalendarId: string
}

function parseLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('limit')
  const value = Number.parseInt(raw || '25', 10)
  if (!Number.isFinite(value) || value <= 0) return 25
  return Math.min(value, 100)
}

function getSyncIntervalMinutes(): number {
  const value = Number.parseInt(process.env.CALENDAR_SYNC_INTERVAL_MINUTES || '30', 10)
  return Number.isFinite(value) && value > 0 ? value : 30
}

function getRetryDelayMinutes(): number {
  const value = Number.parseInt(process.env.CALENDAR_SYNC_RETRY_MINUTES || '10', 10)
  return Number.isFinite(value) && value > 0 ? value : 10
}

function getMappingPairs(calendarMappings: any): CalendarMappingPair[] {
  const pairs: CalendarMappingPair[] = []

  if (Array.isArray(calendarMappings)) {
    for (const item of calendarMappings) {
      if (!item || typeof item !== 'object') continue
      const mapping = item as { externalId?: any; localCalendarId?: any }
      if (typeof mapping.externalId === 'string' && typeof mapping.localCalendarId === 'string') {
        pairs.push({
          externalId: mapping.externalId,
          localCalendarId: mapping.localCalendarId,
        })
      }
    }
  } else if (calendarMappings && typeof calendarMappings === 'object') {
    const objectMappings = calendarMappings as Record<string, unknown>
    for (const [key, value] of Object.entries(objectMappings)) {
      if (value && typeof value === 'object') {
        const mapping = value as { externalId?: any; localCalendarId?: any }
        if (typeof mapping.localCalendarId === 'string') {
          pairs.push({
            externalId: typeof mapping.externalId === 'string' ? mapping.externalId : key,
            localCalendarId: mapping.localCalendarId,
          })
        }
      }
    }
  }

  const deduped = new Map<string, CalendarMappingPair>()
  for (const pair of pairs) {
    deduped.set(`${pair.externalId}:${pair.localCalendarId}`, pair)
  }

  return Array.from(deduped.values())
}

async function processConnection(connection: SyncConnection) {
  const mappings = getMappingPairs(connection.calendarMappings)
  if (mappings.length === 0) {
    throw new Error('No calendar mappings configured')
  }

  const now = new Date()
  const timeMin = new Date(now.getTime() - (connection.syncPastDays ?? 30) * 24 * 60 * 60 * 1000)
  const timeMax = new Date(now.getTime() + (connection.syncFutureDays ?? 365) * 24 * 60 * 60 * 1000)

  let imported = 0
  let updated = 0
  let deleted = 0
  let skippedMappings = 0

  for (const mapping of mappings) {
    const [localCalendar] = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(
        and(
          eq(calendars.id, mapping.localCalendarId),
          eq(calendars.organizationId, connection.organizationId),
        ),
      )
      .limit(1)

    if (!localCalendar) {
      skippedMappings += 1
      continue
    }

    if (connection.provider === 'google') {
      const result = await importGoogleEvents(
        connection.id,
        mapping.localCalendarId,
        mapping.externalId,
        { timeMin, timeMax },
      )
      imported += Number(result.imported || 0)
      updated += Number(result.updated || 0)
      deleted += Number(result.deleted || 0)
      continue
    }

    if (connection.provider === 'microsoft') {
      const result = await importMicrosoftEvents(
        connection.id,
        mapping.localCalendarId,
        mapping.externalId,
        { timeMin, timeMax },
      )
      imported += Number(result.imported || 0)
      updated += Number(result.updated || 0)
      deleted += Number(result.deleted || 0)
      continue
    }

    throw new Error(`Unsupported calendar provider: ${connection.provider}`)
  }

  if (skippedMappings === mappings.length) {
    throw new Error('No valid local calendar mappings found for this organization')
  }

  await db
    .update(externalCalendarConnections)
    .set({
      lastSyncAt: now,
      nextSyncAt: new Date(now.getTime() + getSyncIntervalMinutes() * 60 * 1000),
      syncStatus: 'synced',
      syncError: null,
      updatedAt: now,
    })
    .where(eq(externalCalendarConnections.id, connection.id))

  return {
    connectionId: connection.id,
    provider: connection.provider,
    mappings: mappings.length,
    skippedMappings,
    imported,
    updated,
    deleted,
  }
}

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const limit = parseLimit(request)
    const now = new Date()

    const dueConnections = await db
      .select({
        id: externalCalendarConnections.id,
        provider: externalCalendarConnections.provider,
        organizationId: externalCalendarConnections.organizationId,
        syncPastDays: externalCalendarConnections.syncPastDays,
        syncFutureDays: externalCalendarConnections.syncFutureDays,
        calendarMappings: externalCalendarConnections.calendarMappings,
      })
      .from(externalCalendarConnections)
      .where(
        and(
          eq(externalCalendarConnections.isActive, true),
          eq(externalCalendarConnections.syncEnabled, true),
          or(
            isNull(externalCalendarConnections.nextSyncAt),
            lte(externalCalendarConnections.nextSyncAt, now),
          ),
          or(
            eq(externalCalendarConnections.provider, 'google'),
            eq(externalCalendarConnections.provider, 'microsoft'),
          ),
        ),
      )
      .limit(limit)

    const results = [] as Array<Record<string, unknown>>
    const failures = [] as Array<Record<string, unknown>>

    for (const connection of dueConnections) {
      try {
        results.push(await processConnection(connection))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error'

        await db
          .update(externalCalendarConnections)
          .set({
            syncStatus: 'failed',
            syncError: message,
            nextSyncAt: new Date(Date.now() + getRetryDelayMinutes() * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(externalCalendarConnections.id, connection.id))

        failures.push({ connectionId: connection.id, provider: connection.provider, error: message })
      }
    }

    return standardSuccessResponse({
      dueCount: dueConnections.length,
      syncedCount: results.length,
      failedCount: failures.length,
      results,
      failures,
    })
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to process calendar sync cron job', error)
  }
}, { cronAuth: true, requireAuth: false })
