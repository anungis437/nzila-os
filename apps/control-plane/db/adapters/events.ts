import 'server-only'
import { logger } from '@/lib/telemetry'
import { db } from '@nzila/db'
import { sql } from 'drizzle-orm'
import { dealEngineEvents } from './schemas'
import type { PlatformEventStore, PlatformEvent } from '@nzila/platform-event-fabric'

export function createDbEventStore(): PlatformEventStore {
  return {
    async persist(event: PlatformEvent): Promise<void> {
      try {
        await db.insert(dealEngineEvents).values({
          id: event.id,
          type: event.type,
          payload: event.payload as Record<string, unknown>,
          metadata: event.metadata as unknown as Record<string, unknown>,
          createdAt: new Date(event.createdAt),
        })
      } catch (err) {
        logger.error('[EVENT-STORE] persist failed', { id: event.id, type: event.type, error: err })
      }
    },

    async query(
      eventType: string,
      since: string,
      tenantId?: string,
    ): Promise<readonly PlatformEvent[]> {
      try {
        const sinceDate = new Date(since)
        const rows = await db
          .select()
          .from(dealEngineEvents)
          .where(
            sql`${dealEngineEvents.type} = ${eventType} AND ${dealEngineEvents.createdAt} >= ${sinceDate}`,
          )
          .orderBy(dealEngineEvents.createdAt)
          .limit(500)

        return rows
          .map((r) => ({
            id: r.id,
            type: r.type,
            payload: r.payload as Record<string, unknown>,
            metadata: r.metadata as PlatformEvent['metadata'],
            createdAt: r.createdAt.toISOString(),
          }))
          .filter((e) => !tenantId || e.metadata.tenantId === tenantId)
      } catch (err) {
        logger.error('[EVENT-STORE] query failed', { eventType, since, error: err })
        return []
      }
    },
  }
}
