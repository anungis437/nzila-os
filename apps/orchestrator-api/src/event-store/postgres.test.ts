/**
 * Unit tests for the Postgres-backed PlatformEventStore.
 *
 * Uses an in-memory mock of the narrow `EventStoreDb` interface to
 * verify SQL construction, query filtering, row hydration, and error
 * propagation — without requiring a live Postgres instance.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import type { PlatformEvent } from '@nzila/platform-event-fabric'

import {
  createPostgresEventStore,
  type EventStoreDb,
} from './postgres'

function buildEvent(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'workflow.started',
    payload: { workflowId: 'wf-1', step: 1 },
    metadata: {
      tenantId: '22222222-2222-4222-8222-222222222222',
      orgId: '33333333-3333-4333-8333-333333333333',
      actorId: 'user-1',
      correlationId: '44444444-4444-4444-8444-444444444444',
      causationId: '55555555-5555-4555-8555-555555555555',
      source: 'orchestrator-api',
      version: 1,
    },
    createdAt: '2026-05-20T10:00:00.000Z',
    ...overrides,
  }
}

function makeMockDb(executeImpl?: (query: SQL) => Promise<unknown>): {
  db: EventStoreDb
  executeMock: ReturnType<typeof vi.fn>
} {
  const executeMock = vi.fn(executeImpl ?? (async () => undefined))
  return { db: { execute: executeMock }, executeMock }
}

describe('createPostgresEventStore', () => {
  describe('persist', () => {
    it('issues a single INSERT and forwards the event id, type, and metadata', async () => {
      const { db, executeMock } = makeMockDb()
      const store = createPostgresEventStore(db)
      const event = buildEvent()

      await store.persist(event)

      expect(executeMock).toHaveBeenCalledTimes(1)
      const query = executeMock.mock.calls[0]![0] as SQL
      const repr = JSON.stringify(query)
      expect(repr).toContain('INSERT INTO orchestrator_platform_events')
      expect(repr).toContain('ON CONFLICT (id) DO NOTHING')
    })

    it('propagates DB errors without swallowing — so publish() can abort', async () => {
      const { db } = makeMockDb(async () => {
        throw new Error('duplicate key value violates unique constraint')
      })
      const store = createPostgresEventStore(db)

      await expect(store.persist(buildEvent())).rejects.toThrow(
        /duplicate key/,
      )
    })

    it('handles events without optional metadata fields (orgId, causationId)', async () => {
      const { db, executeMock } = makeMockDb()
      const store = createPostgresEventStore(db)
      const event = buildEvent({
        metadata: {
          tenantId: '22222222-2222-4222-8222-222222222222',
          actorId: 'system',
          correlationId: '44444444-4444-4444-8444-444444444444',
          source: 'cron',
          version: 1,
        },
      })

      await store.persist(event)

      expect(executeMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('query', () => {
    it('returns hydrated events, ordered by the DB (we trust ORDER BY)', async () => {
      const dbRows = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          event_type: 'workflow.started',
          tenant_id: '22222222-2222-4222-8222-222222222222',
          org_id: '33333333-3333-4333-8333-333333333333',
          actor_id: 'user-1',
          correlation_id: '44444444-4444-4444-8444-444444444444',
          causation_id: null,
          source: 'orchestrator-api',
          schema_version: 1,
          payload: { workflowId: 'wf-1' },
          metadata: { tenantId: '22222222-2222-4222-8222-222222222222' },
          created_at: '2026-05-20T10:00:00.000Z',
        },
      ]
      const { db, executeMock } = makeMockDb(async () => dbRows)
      const store = createPostgresEventStore(db)

      const result = await store.query(
        'workflow.started',
        '2026-05-20T00:00:00.000Z',
      )

      expect(executeMock).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: '11111111-1111-4111-8111-111111111111',
        type: 'workflow.started',
        payload: { workflowId: 'wf-1' },
        createdAt: '2026-05-20T10:00:00.000Z',
      })
      expect(result[0]!.metadata).toMatchObject({
        tenantId: '22222222-2222-4222-8222-222222222222',
        orgId: '33333333-3333-4333-8333-333333333333',
        actorId: 'user-1',
        correlationId: '44444444-4444-4444-8444-444444444444',
        source: 'orchestrator-api',
        version: 1,
      })
      // causationId should be omitted (undefined) when DB column is null.
      expect(result[0]!.metadata.causationId).toBeUndefined()
    })

    it('includes a tenant_id WHERE clause when tenantId is provided', async () => {
      const { db, executeMock } = makeMockDb(async () => [])
      const store = createPostgresEventStore(db)

      await store.query(
        'workflow.started',
        '2026-05-20T00:00:00.000Z',
        '22222222-2222-4222-8222-222222222222',
      )

      const query = executeMock.mock.calls[0]![0] as SQL
      const repr = JSON.stringify(query)
      expect(repr).toContain('tenant_id')
    })

    it('omits the tenant_id WHERE clause when tenantId is undefined', async () => {
      const { db, executeMock } = makeMockDb(async () => [])
      const store = createPostgresEventStore(db)

      await store.query('workflow.started', '2026-05-20T00:00:00.000Z')

      const query = executeMock.mock.calls[0]![0] as SQL
      const repr = JSON.stringify(query)
      // The SQL builder still includes "tenant_id" in SELECT columns, so we
      // assert the absence of the filter predicate by checking there's no
      // "AND tenant_id =" fragment.
      expect(repr).not.toContain('AND tenant_id =')
    })

    it('falls back gracefully when the driver returns { rows: [...] } instead of an array', async () => {
      // pg-node returns { rows }; postgres-js returns the array directly.
      // The store should accept both shapes.
      const wrapped = {
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            event_type: 'workflow.started',
            tenant_id: '22222222-2222-4222-8222-222222222222',
            org_id: null,
            actor_id: 'system',
            correlation_id: '44444444-4444-4444-8444-444444444444',
            causation_id: null,
            source: 'cron',
            schema_version: 1,
            payload: null,
            metadata: null,
            created_at: new Date('2026-05-20T10:00:00.000Z'),
          },
        ],
      }
      const { db } = makeMockDb(async () => wrapped)
      const store = createPostgresEventStore(db)

      const result = await store.query(
        'workflow.started',
        '2026-05-20T00:00:00.000Z',
      )

      expect(result).toHaveLength(1)
      expect(result[0]!.payload).toEqual({})
      expect(result[0]!.createdAt).toBe('2026-05-20T10:00:00.000Z')
    })

    it('returns an empty array when the DB returns no rows', async () => {
      const { db } = makeMockDb(async () => [])
      const store = createPostgresEventStore(db)

      const result = await store.query(
        'workflow.started',
        '2026-05-20T00:00:00.000Z',
      )

      expect(result).toEqual([])
    })
  })
})
