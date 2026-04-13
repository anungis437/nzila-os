/**
 * @nzila/platform-integrations-types — Sync Types
 *
 * Canonical types for bidirectional sync, source-of-truth policies,
 * and field ownership.
 */

// ─── Source of Truth Policy ──────────────────────────────────────────────────

export type SourceOfTruthMode =
  | 'internal'       // UE/Nzila is source of truth
  | 'external'       // external system is source of truth
  | 'field_level'    // ownership varies per field
  | 'append_only'    // both systems append, no overwrites

export interface SourceOfTruthPolicy {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly entityType: string
  readonly mode: SourceOfTruthMode
  readonly fieldOwnership: readonly FieldOwnershipRule[]
  readonly conflictResolution: ConflictResolutionStrategy
  readonly createdAt: string
  readonly updatedAt: string
}

export interface FieldOwnershipRule {
  readonly field: string
  readonly owner: 'internal' | 'external'
  readonly writePolicy: 'overwrite' | 'ignore' | 'append' | 'merge' | 'error'
  readonly lastWriteWins: boolean
}

export type ConflictResolutionStrategy =
  | 'internal_wins'
  | 'external_wins'
  | 'last_write_wins'
  | 'manual_review'
  | 'field_level'

// ─── Sync Session ────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'conflict'

export interface SyncSession {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly direction: 'inbound' | 'outbound' | 'bidirectional'
  readonly entityType: string
  readonly status: SyncStatus
  readonly recordsSynced: number
  readonly recordsFailed: number
  readonly recordsSkipped: number
  readonly conflicts: readonly SyncConflict[]
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly traceId: string
}

export interface SyncConflict {
  readonly entityId: string
  readonly field: string
  readonly internalValue: unknown
  readonly externalValue: unknown
  readonly resolution: ConflictResolutionStrategy | null
  readonly resolvedAt: string | null
  readonly resolvedBy: string | null
}

// ─── Sync Cursor ─────────────────────────────────────────────────────────────

export interface SyncCursor {
  readonly connectionId: string
  readonly entityType: string
  readonly direction: 'inbound' | 'outbound'
  readonly lastSyncedAt: string
  readonly lastSyncedId: string | null
  readonly watermark: string | null
}
