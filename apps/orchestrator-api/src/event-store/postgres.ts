/**
 * Postgres-backed PlatformEventStore for the orchestrator.
 *
 * Implements the `@nzila/platform-event-fabric` `PlatformEventStore`
 * interface against the `orchestrator_platform_events` table created by
 * `migrations/platform/20260520_orchestrator_platform_events.sql`.
 *
 * ## Why
 *
 * The default in-memory store (see `createInMemoryEventStore` in
 * `@nzila/platform-event-fabric`) is single-replica and non-durable:
 *   - Events published on replica A are invisible to replica B.
 *   - All events are lost on process restart.
 *
 * For HA / multi-replica orchestrator deployments, the platform must
 * persist events to a store that is shared across replicas and survives
 * restarts. Postgres is the lowest-friction choice because the
 * orchestrator already declares a `DATABASE_URL` and a Drizzle client.
 *
 * ## Failure semantics
 *
 * `persist()` must NOT swallow errors. If the DB rejects an insert the
 * event bus must surface the failure to the caller so the publishing
 * code path can decide whether to retry, dead-letter, or abort the
 * surrounding business operation. The bus's `publish()` already awaits
 * `store.persist()` before notifying handlers — so a thrown error here
 * stops handler dispatch.
 *
 * ## Query semantics
 *
 * `query()` returns events with `created_at >= since`, ordered by
 * `created_at` ASC so replay observes monotonic causal order. The
 * optional `tenantId` filter is applied as a server-side WHERE so we
 * don't ship a tenant's neighbours over the wire.
 */
import { sql, type SQL } from 'drizzle-orm'
import type {
  PlatformEvent,
  PlatformEventMetadata,
  PlatformEventStore,
} from '@nzila/platform-event-fabric'

/**
 * Narrow shape of a Drizzle client we depend on — only `execute(sql)`.
 *
 * Accepting this instead of the full Drizzle type keeps the store
 * decoupled from the orchestrator's exact schema generic and makes it
 * trivial to mock in unit tests.
 */
export interface EventStoreDb {
  execute(query: SQL): Promise<unknown>
}

interface EventRow {
  id: string
  event_type: string
  tenant_id: string
  org_id: string | null
  actor_id: string
  correlation_id: string
  causation_id: string | null
  source: string
  schema_version: number
  payload: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string | Date
}

function rowToEvent(row: EventRow): PlatformEvent {
  const metadata: PlatformEventMetadata = {
    tenantId: row.tenant_id,
    orgId: row.org_id ?? undefined,
    actorId: row.actor_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id ?? undefined,
    source: row.source,
    version: row.schema_version,
  }
  return {
    id: row.id,
    type: row.event_type,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    metadata,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  }
}

/**
 * Create a Postgres-backed `PlatformEventStore`.
 *
 * @example
 *   import { getDb } from './db'
 *   import { setEventStore } from './platform'
 *   import { createPostgresEventStore } from './event-store/postgres'
 *
 *   const { db } = getDb()
 *   setEventStore(createPostgresEventStore(db))
 */
export function createPostgresEventStore(db: EventStoreDb): PlatformEventStore {
  return {
    async persist(event: PlatformEvent): Promise<void> {
      // Date.toString() is rejected by Postgres timestamptz; always cast
      // the ISO string explicitly. See user-memory note on postgres-js
      // date serialization.
      const createdAt = event.createdAt
      const md = event.metadata
      await db.execute(sql`
        INSERT INTO orchestrator_platform_events (
          id, event_type, tenant_id, org_id, actor_id,
          correlation_id, causation_id, source, schema_version,
          payload, metadata, created_at
        ) VALUES (
          ${event.id}::uuid,
          ${event.type},
          ${md.tenantId}::uuid,
          ${md.orgId ?? null}::uuid,
          ${md.actorId},
          ${md.correlationId}::uuid,
          ${md.causationId ?? null}::uuid,
          ${md.source},
          ${md.version},
          ${JSON.stringify(event.payload)}::jsonb,
          ${JSON.stringify(md)}::jsonb,
          ${createdAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `)
    },

    async query(
      eventType: string,
      since: string,
      tenantId?: string,
    ): Promise<readonly PlatformEvent[]> {
      const result = (await db.execute(sql`
        SELECT
          id, event_type, tenant_id, org_id, actor_id,
          correlation_id, causation_id, source, schema_version,
          payload, metadata, created_at
        FROM orchestrator_platform_events
        WHERE event_type = ${eventType}
          AND created_at >= ${since}::timestamptz
          ${tenantId ? sql`AND tenant_id = ${tenantId}::uuid` : sql``}
        ORDER BY created_at ASC
      `)) as unknown as EventRow[]

      // postgres-js returns rows as an array directly (not { rows: [...] }).
      // See user-memory note on Drizzle + postgres-js execute() pattern.
      const rows = Array.isArray(result) ? result : (result as { rows?: EventRow[] }).rows ?? []
      return rows.map(rowToEvent)
    },
  }
}
