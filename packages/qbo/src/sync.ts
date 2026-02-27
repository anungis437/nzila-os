/**
 * @nzila/qbo — Sync engine (status tracking + conflict resolution)
 *
 * Tracks synchronization state between Nzila and QBO,
 * detects conflicts, and provides resolution strategies.
 *
 * @module @nzila/qbo/sync
 */
import type { QboClient } from './client'
import type { QboAccount, QboJournalEntry } from './types'

// ── Types ────────────────────────────────────────────────────────────────────

export type SyncDirection = 'nzila-to-qbo' | 'qbo-to-nzila' | 'bidirectional'
export type SyncEntityType = 'account' | 'journal-entry' | 'vendor' | 'bill' | 'customer'
export type ConflictResolution = 'keep-nzila' | 'keep-qbo' | 'merge' | 'skip'

export interface SyncState {
  entityType: SyncEntityType
  direction: SyncDirection
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'failed' | 'never'
  itemsSynced: number
  itemsFailed: number
  conflicts: number
  nextSyncDue: string | null
}

export interface SyncConflict {
  id: string
  entityType: SyncEntityType
  nzilaId: string
  qboId: string
  field: string
  nzilaValue: string
  qboValue: string
  detectedAt: string
  resolvedAt: string | null
  resolution: ConflictResolution | null
}

export interface SyncResult {
  entityType: SyncEntityType
  direction: SyncDirection
  started: string
  completed: string
  created: number
  updated: number
  skipped: number
  failed: number
  conflicts: SyncConflict[]
}

export interface SyncSchedule {
  entityType: SyncEntityType
  direction: SyncDirection
  intervalMinutes: number
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
}

// ── Default sync schedules ───────────────────────────────────────────────────

export const DEFAULT_SYNC_SCHEDULES: SyncSchedule[] = [
  { entityType: 'account',       direction: 'qbo-to-nzila',  intervalMinutes: 1440, enabled: true,  lastRunAt: null, nextRunAt: null }, // daily
  { entityType: 'journal-entry', direction: 'nzila-to-qbo',  intervalMinutes: 60,   enabled: true,  lastRunAt: null, nextRunAt: null }, // hourly
  { entityType: 'vendor',        direction: 'qbo-to-nzila',  intervalMinutes: 1440, enabled: true,  lastRunAt: null, nextRunAt: null }, // daily
  { entityType: 'bill',          direction: 'qbo-to-nzila',  intervalMinutes: 360,  enabled: true,  lastRunAt: null, nextRunAt: null }, // every 6h
  { entityType: 'customer',      direction: 'bidirectional',  intervalMinutes: 720,  enabled: false, lastRunAt: null, nextRunAt: null }, // every 12h
]

// ── Sync state management ────────────────────────────────────────────────────

/**
 * Build initial sync state for a given entity type.
 */
export function createSyncState(entityType: SyncEntityType, direction: SyncDirection): SyncState {
  return {
    entityType,
    direction,
    lastSyncAt: null,
    lastSyncStatus: 'never',
    itemsSynced: 0,
    itemsFailed: 0,
    conflicts: 0,
    nextSyncDue: null,
  }
}

/**
 * Update sync state after a sync run.
 */
export function updateSyncState(
  state: SyncState,
  result: SyncResult,
  intervalMinutes: number,
): SyncState {
  const nextDue = new Date(new Date(result.completed).getTime() + intervalMinutes * 60_000)

  return {
    ...state,
    lastSyncAt: result.completed,
    lastSyncStatus: result.failed > 0
      ? (result.created + result.updated > 0 ? 'partial' : 'failed')
      : 'success',
    itemsSynced: result.created + result.updated,
    itemsFailed: result.failed,
    conflicts: result.conflicts.length,
    nextSyncDue: nextDue.toISOString(),
  }
}

/**
 * Check if a sync is overdue based on the state and schedule.
 */
export function isSyncOverdue(state: SyncState, schedule: SyncSchedule): boolean {
  if (!schedule.enabled) return false
  if (!state.lastSyncAt) return true

  const lastSync = new Date(state.lastSyncAt).getTime()
  const now = Date.now()
  const intervalMs = schedule.intervalMinutes * 60_000

  return now - lastSync > intervalMs
}

// ── Conflict detection ───────────────────────────────────────────────────────

/**
 * Detect conflicts between a Nzila record and its QBO counterpart.
 * Returns an array of field-level conflicts.
 */
export function detectFieldConflicts(
  entityType: SyncEntityType,
  nzilaId: string,
  nzilaFields: Record<string, string>,
  qboId: string,
  qboFields: Record<string, string>,
): SyncConflict[] {
  const conflicts: SyncConflict[] = []
  const now = new Date().toISOString()

  for (const [field, nzilaValue] of Object.entries(nzilaFields)) {
    const qboValue = qboFields[field]
    if (qboValue !== undefined && nzilaValue !== qboValue) {
      conflicts.push({
        id: `${entityType}-${nzilaId}-${field}-${Date.now()}`,
        entityType,
        nzilaId,
        qboId,
        field,
        nzilaValue,
        qboValue,
        detectedAt: now,
        resolvedAt: null,
        resolution: null,
      })
    }
  }

  return conflicts
}

/**
 * Resolve a sync conflict by applying the chosen resolution strategy.
 */
export function resolveConflict(
  conflict: SyncConflict,
  resolution: ConflictResolution,
): SyncConflict {
  return {
    ...conflict,
    resolution,
    resolvedAt: new Date().toISOString(),
  }
}

/**
 * Auto-resolve conflicts based on the sync direction.
 * - nzila-to-qbo: keep Nzila values
 * - qbo-to-nzila: keep QBO values
 * - bidirectional: keep most recently modified (defaults to QBO)
 */
export function autoResolveConflicts(
  conflicts: SyncConflict[],
  direction: SyncDirection,
): SyncConflict[] {
  return conflicts.map((c) => {
    let resolution: ConflictResolution

    switch (direction) {
      case 'nzila-to-qbo':
        resolution = 'keep-nzila'
        break
      case 'qbo-to-nzila':
        resolution = 'keep-qbo'
        break
      case 'bidirectional':
        // In bidirectional mode, QBO is the source of truth for financial data
        resolution = 'keep-qbo'
        break
    }

    return resolveConflict(c, resolution)
  })
}

// ── Sync health ──────────────────────────────────────────────────────────────

export interface SyncHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'critical'
  totalEntities: number
  syncedEntities: number
  overdueEntities: number
  unresolvedConflicts: number
  entities: Array<{
    entityType: SyncEntityType
    status: SyncState['lastSyncStatus']
    overdue: boolean
    unresolvedConflicts: number
  }>
}

/**
 * Generate a health report across all sync states and schedules.
 */
export function generateSyncHealthReport(
  states: SyncState[],
  schedules: SyncSchedule[],
  unresolvedConflicts: SyncConflict[],
): SyncHealthReport {
  const entities = states.map((state) => {
    const schedule = schedules.find((s) => s.entityType === state.entityType)
    const overdue = schedule ? isSyncOverdue(state, schedule) : false
    const entityConflicts = unresolvedConflicts.filter(
      (c) => c.entityType === state.entityType && !c.resolvedAt,
    )

    return {
      entityType: state.entityType,
      status: state.lastSyncStatus,
      overdue,
      unresolvedConflicts: entityConflicts.length,
    }
  })

  const overdueCount = entities.filter((e) => e.overdue).length
  const failedCount = entities.filter((e) => e.status === 'failed').length
  const totalUnresolved = unresolvedConflicts.filter((c) => !c.resolvedAt).length

  let overallStatus: SyncHealthReport['overallStatus'] = 'healthy'
  if (failedCount > 0 || totalUnresolved > 5) overallStatus = 'critical'
  else if (overdueCount > 0 || totalUnresolved > 0) overallStatus = 'degraded'

  return {
    overallStatus,
    totalEntities: entities.length,
    syncedEntities: entities.filter((e) => e.status === 'success').length,
    overdueEntities: overdueCount,
    unresolvedConflicts: totalUnresolved,
    entities,
  }
}
