/**
 * @nzila/platform-events — Drizzle-Backed Event Store
 *
 * Persists platform events to PostgreSQL via Drizzle ORM.
 * Uses the platform_events table for durable event storage.
 *
 * @module @nzila/platform-events/store
 */
import { eq, and, desc } from 'drizzle-orm'
import { pgTable, uuid, text, timestamp, jsonb, varchar, index } from 'drizzle-orm/pg-core'
import { createLogger } from '@nzila/os-core/telemetry'
import type { PlatformEvent, EventStorePorts } from './types'

const logger = createLogger('platform-events-store')

// ── Schema ──────────────────────────────────────────────────────────────────

/**
 * Platform events table — append-only event log.
 * Each row is an immutable event record.
 */
export const platformEvents = pgTable(
  'platform_events',
  {
    id: uuid('id').primaryKey(),
    type: varchar('type', { length: 256 }).notNull(),
    schemaVersion: varchar('schema_version', { length: 16 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    orgId: uuid('org_id').notNull(),
    actorId: text('actor_id').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    source: varchar('source', { length: 128 }).notNull(),
    traceId: text('trace_id'),
    spanId: text('span_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('platform_events_org_type_idx').on(table.orgId, table.type),
    index('platform_events_correlation_idx').on(table.correlationId),
    index('platform_events_created_idx').on(table.createdAt),
  ],
)

// ── Store Types ─────────────────────────────────────────────────────────────

/** Drizzle DB instance type — accepts a Drizzle PG instance */
type DrizzleDb = {
  insert: (table: typeof platformEvents) => {
    values: (data: Record<string, unknown>) => Promise<void>
  }
  select: () => {
    from: (table: typeof platformEvents) => {
      where: (...conditions: unknown[]) => {
        orderBy: (...orders: unknown[]) => {
          limit: (n: number) => Promise<Record<string, unknown>[]>
        }
      }
    }
  }
}

// ── Drizzle Event Store ─────────────────────────────────────────────────────

export interface DrizzleEventStoreOptions {
  db: DrizzleDb
}

/**
 * PostgreSQL-backed event store using Drizzle ORM.
 * Persists events to the platform_events table.
 */
export class DrizzleEventStore implements EventStorePorts {
  private readonly db: DrizzleDb

  constructor(options: DrizzleEventStoreOptions) {
    this.db = options.db
  }

  async persist(event: PlatformEvent): Promise<void> {
    logger.info('Persisting platform event', {
      eventId: event.id,
      eventType: event.type,
      orgId: event.metadata.orgId,
    })

    await this.db.insert(platformEvents).values({
      id: event.id,
      type: event.type,
      schemaVersion: event.schemaVersion,
      payload: event.payload,
      orgId: event.metadata.orgId,
      actorId: event.metadata.actorId,
      correlationId: event.metadata.correlationId,
      causationId: event.metadata.causationId,
      source: event.metadata.source,
      traceId: event.metadata.traceId,
      spanId: event.metadata.spanId,
      createdAt: new Date(event.createdAt),
    })
  }

  async queryByType(orgId: string, type: string, limit = 50): Promise<PlatformEvent[]> {
    const rows = await this.db
      .select()
      .from(platformEvents)
      .where(and(eq(platformEvents.orgId, orgId), eq(platformEvents.type, type)))
      .orderBy(desc(platformEvents.createdAt))
      .limit(limit)

    return rows.map(rowToEvent)
  }

  async queryByCorrelation(correlationId: string): Promise<PlatformEvent[]> {
    const rows = await this.db
      .select()
      .from(platformEvents)
      .where(eq(platformEvents.correlationId, correlationId))
      .orderBy(desc(platformEvents.createdAt))
      .limit(100)

    return rows.map(rowToEvent)
  }

  async count(orgId: string, type?: string): Promise<number> {
    const conditions = type
      ? and(eq(platformEvents.orgId, orgId), eq(platformEvents.type, type))
      : eq(platformEvents.orgId, orgId)

    const rows = await this.db
      .select()
      .from(platformEvents)
      .where(conditions)
      .orderBy(desc(platformEvents.createdAt))
      .limit(100_000)

    return rows.length
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToEvent(row: Record<string, unknown>): PlatformEvent {
  return {
    id: row.id as string,
    type: row.type as string,
    schemaVersion: row.schemaVersion as string,
    payload: row.payload as Record<string, unknown>,
    metadata: {
      orgId: row.orgId as string,
      actorId: row.actorId as string,
      correlationId: row.correlationId as string,
      causationId: (row.causationId as string) ?? null,
      source: row.source as string,
      traceId: (row.traceId as string) ?? null,
      spanId: (row.spanId as string) ?? null,
    },
    createdAt: row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt),
  }
}
