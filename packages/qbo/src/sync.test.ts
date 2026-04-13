import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  createSyncState,
  updateSyncState,
  isSyncOverdue,
  detectFieldConflicts,
  resolveConflict,
  autoResolveConflicts,
  generateSyncHealthReport,
  DEFAULT_SYNC_SCHEDULES,
} from './sync'
import type { SyncState, SyncResult, SyncConflict, SyncSchedule } from './sync'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    entityType: 'account',
    direction: 'qbo-to-nzila',
    started: '2025-01-01T00:00:00.000Z',
    completed: '2025-01-01T00:05:00.000Z',
    created: 5,
    updated: 3,
    skipped: 1,
    failed: 0,
    conflicts: [],
    ...overrides,
  }
}

function makeConflict(overrides: Partial<SyncConflict> = {}): SyncConflict {
  return {
    id: 'conflict-1',
    entityType: 'account',
    nzilaId: 'n-1',
    qboId: 'q-1',
    field: 'Name',
    nzilaValue: 'Nzila Corp',
    qboValue: 'QBO Corp',
    detectedAt: '2025-01-01T00:00:00.000Z',
    resolvedAt: null,
    resolution: null,
    ...overrides,
  }
}

function makeSchedule(overrides: Partial<SyncSchedule> = {}): SyncSchedule {
  return {
    entityType: 'account',
    direction: 'qbo-to-nzila',
    intervalMinutes: 1440,
    enabled: true,
    lastRunAt: null,
    nextRunAt: null,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── DEFAULT_SYNC_SCHEDULES ───────────────────────────────────────────────

  describe('DEFAULT_SYNC_SCHEDULES', () => {
    it('defines 5 schedules', () => {
      expect(DEFAULT_SYNC_SCHEDULES).toHaveLength(5)
    })

    it('has customer sync disabled by default', () => {
      const cust = DEFAULT_SYNC_SCHEDULES.find((s) => s.entityType === 'customer')
      expect(cust?.enabled).toBe(false)
    })
  })

  // ── createSyncState ──────────────────────────────────────────────────────

  describe('createSyncState', () => {
    it('returns initial state', () => {
      const state = createSyncState('account', 'qbo-to-nzila')

      expect(state).toEqual({
        entityType: 'account',
        direction: 'qbo-to-nzila',
        lastSyncAt: null,
        lastSyncStatus: 'never',
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: 0,
        nextSyncDue: null,
      })
    })
  })

  // ── updateSyncState ──────────────────────────────────────────────────────

  describe('updateSyncState', () => {
    it('updates state with success result', () => {
      const state = createSyncState('account', 'qbo-to-nzila')
      const result = makeSyncResult({ created: 10, updated: 5, failed: 0, conflicts: [] })

      const updated = updateSyncState(state, result, 1440)

      expect(updated.lastSyncStatus).toBe('success')
      expect(updated.itemsSynced).toBe(15)
      expect(updated.itemsFailed).toBe(0)
      expect(updated.conflicts).toBe(0)
      expect(updated.nextSyncDue).toBeTruthy()
    })

    it('marks partial when some items fail but others succeed', () => {
      const state = createSyncState('journal-entry', 'nzila-to-qbo')
      const result = makeSyncResult({ created: 3, updated: 0, failed: 2 })

      const updated = updateSyncState(state, result, 60)
      expect(updated.lastSyncStatus).toBe('partial')
      expect(updated.itemsFailed).toBe(2)
    })

    it('marks failed when all items fail', () => {
      const state = createSyncState('vendor', 'qbo-to-nzila')
      const result = makeSyncResult({ created: 0, updated: 0, failed: 5 })

      const updated = updateSyncState(state, result, 1440)
      expect(updated.lastSyncStatus).toBe('failed')
    })

    it('counts conflicts from result', () => {
      const state = createSyncState('account', 'qbo-to-nzila')
      const result = makeSyncResult({ conflicts: [makeConflict(), makeConflict()] })

      const updated = updateSyncState(state, result, 1440)
      expect(updated.conflicts).toBe(2)
    })
  })

  // ── isSyncOverdue ────────────────────────────────────────────────────────

  describe('isSyncOverdue', () => {
    it('returns false for disabled schedule', () => {
      const state = createSyncState('customer', 'bidirectional')
      const schedule = makeSchedule({ enabled: false })
      expect(isSyncOverdue(state, schedule)).toBe(false)
    })

    it('returns true when never synced', () => {
      const state = createSyncState('account', 'qbo-to-nzila')
      const schedule = makeSchedule({ enabled: true })
      expect(isSyncOverdue(state, schedule)).toBe(true)
    })

    it('returns true when last sync exceeds interval', () => {
      const state: SyncState = {
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      }
      const schedule = makeSchedule({ intervalMinutes: 1440 }) // 1 day
      expect(isSyncOverdue(state, schedule)).toBe(true)
    })

    it('returns false when within interval', () => {
      const state: SyncState = {
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
      }
      const schedule = makeSchedule({ intervalMinutes: 1440 })
      expect(isSyncOverdue(state, schedule)).toBe(false)
    })
  })

  // ── detectFieldConflicts ─────────────────────────────────────────────────

  describe('detectFieldConflicts', () => {
    it('detects differing fields', () => {
      const conflicts = detectFieldConflicts(
        'account', 'n-1',
        { Name: 'Nzila Value', Type: 'Bank' },
        'q-1',
        { Name: 'QBO Value', Type: 'Bank' },
      )

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].field).toBe('Name')
      expect(conflicts[0].nzilaValue).toBe('Nzila Value')
      expect(conflicts[0].qboValue).toBe('QBO Value')
    })

    it('returns empty when fields match', () => {
      const conflicts = detectFieldConflicts(
        'vendor', 'n-2',
        { Name: 'Same', Email: 'same@test.com' },
        'q-2',
        { Name: 'Same', Email: 'same@test.com' },
      )
      expect(conflicts).toHaveLength(0)
    })

    it('ignores fields only on nzila side', () => {
      const conflicts = detectFieldConflicts(
        'account', 'n-3',
        { Name: 'Test', Extra: 'onlyNzila' },
        'q-3',
        { Name: 'Test' },
      )
      expect(conflicts).toHaveLength(0) // Extra not in qbo → not a conflict
    })
  })

  // ── resolveConflict ──────────────────────────────────────────────────────

  describe('resolveConflict', () => {
    it('resolves conflict with keep-nzila', () => {
      const conflict = makeConflict()
      const resolved = resolveConflict(conflict, 'keep-nzila')

      expect(resolved.resolution).toBe('keep-nzila')
      expect(resolved.resolvedAt).toBeTruthy()
    })

    it('resolves conflict with skip', () => {
      const conflict = makeConflict()
      const resolved = resolveConflict(conflict, 'skip')
      expect(resolved.resolution).toBe('skip')
    })
  })

  // ── autoResolveConflicts ─────────────────────────────────────────────────

  describe('autoResolveConflicts', () => {
    it('resolves to keep-nzila for nzila-to-qbo direction', () => {
      const resolved = autoResolveConflicts([makeConflict()], 'nzila-to-qbo')
      expect(resolved[0].resolution).toBe('keep-nzila')
    })

    it('resolves to keep-qbo for qbo-to-nzila direction', () => {
      const resolved = autoResolveConflicts([makeConflict()], 'qbo-to-nzila')
      expect(resolved[0].resolution).toBe('keep-qbo')
    })

    it('resolves to keep-qbo for bidirectional direction', () => {
      const resolved = autoResolveConflicts([makeConflict()], 'bidirectional')
      expect(resolved[0].resolution).toBe('keep-qbo')
    })
  })

  // ── generateSyncHealthReport ─────────────────────────────────────────────

  describe('generateSyncHealthReport', () => {
    it('reports healthy when everything is synced', () => {
      const states: SyncState[] = [{
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
      }]
      const schedules = [makeSchedule({ intervalMinutes: 1440 })]

      const report = generateSyncHealthReport(states, schedules, [])

      expect(report.overallStatus).toBe('healthy')
      expect(report.syncedEntities).toBe(1)
      expect(report.overdueEntities).toBe(0)
      expect(report.unresolvedConflicts).toBe(0)
    })

    it('reports degraded when overdue', () => {
      const states: SyncState[] = [{
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastSyncStatus: 'success',
      }]
      const schedules = [makeSchedule({ intervalMinutes: 1440 })]

      const report = generateSyncHealthReport(states, schedules, [])

      expect(report.overallStatus).toBe('degraded')
      expect(report.overdueEntities).toBe(1)
    })

    it('reports degraded when few unresolved conflicts', () => {
      const states: SyncState[] = [{
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
      }]
      const schedules = [makeSchedule({ intervalMinutes: 1440 })]
      const conflicts = [makeConflict()] // 1 unresolved

      const report = generateSyncHealthReport(states, schedules, conflicts)

      expect(report.overallStatus).toBe('degraded')
      expect(report.unresolvedConflicts).toBe(1)
    })

    it('reports critical when entities have failed', () => {
      const states: SyncState[] = [{
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'failed',
      }]
      const schedules = [makeSchedule({ intervalMinutes: 1440 })]

      const report = generateSyncHealthReport(states, schedules, [])

      expect(report.overallStatus).toBe('critical')
    })

    it('reports critical when more than 5 unresolved conflicts', () => {
      const states: SyncState[] = [{
        ...createSyncState('account', 'qbo-to-nzila'),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
      }]
      const schedules = [makeSchedule({ intervalMinutes: 1440 })]
      const conflicts = Array.from({ length: 6 }, (_, i) =>
        makeConflict({ id: `conflict-${i}` }),
      )

      const report = generateSyncHealthReport(states, schedules, conflicts)

      expect(report.overallStatus).toBe('critical')
      expect(report.unresolvedConflicts).toBe(6)
    })

    it('handles state without matching schedule', () => {
      const states: SyncState[] = [
        createSyncState('bill', 'qbo-to-nzila'),
      ]
      const schedules: SyncSchedule[] = [] // no schedule for bill

      const report = generateSyncHealthReport(states, schedules, [])

      expect(report.totalEntities).toBe(1)
      // No schedule → not overdue
      expect(report.orgs[0].overdue).toBe(false)
    })
  })
})
