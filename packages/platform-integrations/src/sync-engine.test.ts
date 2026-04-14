import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncEngine } from './sync-engine'
import type { SyncSessionStore, SyncCursorStore, SyncPolicyStore, SyncRecordDelta } from './sync-engine'
import type { IntegrationAuditHooks } from './audit-hooks'
import type { SourceOfTruthPolicy } from '@nzila/platform-integrations-types'

function createMockStores() {
  const sessionStore: SyncSessionStore = {
    create: vi.fn(async (s) => ({ ...s, id: 'session-1' })),
    update: vi.fn(async () => {}),
    getById: vi.fn(async () => null),
    listByConnection: vi.fn(async () => []),
  }
  const cursorStore: SyncCursorStore = {
    get: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
  }
  const policyStore: SyncPolicyStore = {
    getByConnectionAndEntity: vi.fn(async () => null),
  }
  const auditHooks: IntegrationAuditHooks = {
    recordIntegrationAction: vi.fn(async () => {}),
  }
  return { sessionStore, cursorStore, policyStore, auditHooks }
}

describe('SyncEngine', () => {
  let engine: SyncEngine
  let stores: ReturnType<typeof createMockStores>

  beforeEach(() => {
    stores = createMockStores()
    engine = new SyncEngine(stores.sessionStore, stores.cursorStore, stores.policyStore, stores.auditHooks)
  })

  describe('syncInbound', () => {
    const deltas: SyncRecordDelta[] = [
      { externalId: 'ext-1', internalId: 'int-1', fields: { name: 'Updated' }, sourceTimestamp: '2026-07-15T00:00:00Z' },
      { externalId: 'ext-2', internalId: null, fields: { name: 'New' }, sourceTimestamp: '2026-07-15T00:01:00Z' },
    ]

    it('creates a sync session and completes it', async () => {
      const result = await engine.syncInbound('org-1', 'conn-1', 'case', deltas, 'actor-1', 'trace-1')
      expect(result.status).toBe('completed')
      expect(result.applied).toBe(2)
      expect(result.failed).toBe(0)
      expect(stores.sessionStore.create).toHaveBeenCalledOnce()
      expect(stores.sessionStore.update).toHaveBeenCalledOnce()
    })

    it('updates cursor after sync', async () => {
      await engine.syncInbound('org-1', 'conn-1', 'case', deltas, 'actor-1', 'trace-1')
      expect(stores.cursorStore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn-1',
          entityType: 'case',
          direction: 'inbound',
          lastSyncedId: 'ext-2',
        }),
      )
    })

    it('records audit action', async () => {
      await engine.syncInbound('org-1', 'conn-1', 'case', deltas, 'actor-1', 'trace-1')
      expect(stores.auditHooks.recordIntegrationAction).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'sync.inbound.completed',
        }),
      )
    })
  })

  describe('evaluateFieldOwnership', () => {
    it('blocks inbound writes when mode is internal', () => {
      const policy: SourceOfTruthPolicy = {
        id: 'pol-1',
        orgId: 'org-1',
        connectionId: 'conn-1',
        entityType: 'case',
        mode: 'internal',
        fieldOwnership: [],
        conflictResolution: 'internal_wins',
        createdAt: '',
        updatedAt: '',
      }
      const delta: SyncRecordDelta = {
        externalId: 'ext-1',
        internalId: 'int-1',
        fields: { name: 'new-value' },
        sourceTimestamp: '2026-07-15T00:00:00Z',
      }
      const conflicts = engine.evaluateFieldOwnership(delta, policy, 'inbound')
      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts[0]!.resolution).toBe('internal_wins')
    })

    it('allows all writes when no policy exists', () => {
      const delta: SyncRecordDelta = {
        externalId: 'ext-1',
        internalId: 'int-1',
        fields: { name: 'new-value' },
        sourceTimestamp: '2026-07-15T00:00:00Z',
      }
      const conflicts = engine.evaluateFieldOwnership(delta, null, 'inbound')
      expect(conflicts).toHaveLength(0)
    })

    it('blocks external writes on field-level owned fields', () => {
      const policy: SourceOfTruthPolicy = {
        id: 'pol-1',
        orgId: 'org-1',
        connectionId: 'conn-1',
        entityType: 'case',
        mode: 'field_level',
        fieldOwnership: [
          { field: 'status', owner: 'internal', writePolicy: 'error', lastWriteWins: false },
          { field: 'description', owner: 'external', writePolicy: 'overwrite', lastWriteWins: false },
        ],
        conflictResolution: 'field_level',
        createdAt: '',
        updatedAt: '',
      }
      const delta: SyncRecordDelta = {
        externalId: 'ext-1',
        internalId: 'int-1',
        fields: { status: 'closed', description: 'updated desc' },
        sourceTimestamp: '2026-07-15T00:00:00Z',
      }
      const conflicts = engine.evaluateFieldOwnership(delta, policy, 'inbound')
      // status should conflict (owned by internal, external trying to write with error policy)
      expect(conflicts.some((c) => c.field === 'status')).toBe(true)
      // description should NOT conflict (owned by external, external is writing)
      expect(conflicts.some((c) => c.field === 'description')).toBe(false)
    })

    it('handles append_only mode (no conflicts)', () => {
      const policy: SourceOfTruthPolicy = {
        id: 'pol-1',
        orgId: 'org-1',
        connectionId: 'conn-1',
        entityType: 'case',
        mode: 'append_only',
        fieldOwnership: [],
        conflictResolution: 'last_write_wins',
        createdAt: '',
        updatedAt: '',
      }
      const delta: SyncRecordDelta = {
        externalId: 'ext-1',
        internalId: 'int-1',
        fields: { note: 'new note' },
        sourceTimestamp: '2026-07-15T00:00:00Z',
      }
      const conflicts = engine.evaluateFieldOwnership(delta, policy, 'inbound')
      expect(conflicts).toHaveLength(0)
    })
  })

  describe('getCursor', () => {
    it('delegates to cursor store', async () => {
      await engine.getCursor('conn-1', 'case', 'inbound')
      expect(stores.cursorStore.get).toHaveBeenCalledWith('conn-1', 'case', 'inbound')
    })
  })
})
