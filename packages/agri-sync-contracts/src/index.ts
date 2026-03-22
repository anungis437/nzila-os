// ---------------------------------------------------------------------------
// @nzila/agri-sync-contracts — barrel export
// ---------------------------------------------------------------------------

export {
  type SyncConflict,
  type ConflictResolution,
  resolveLastWriteWins,
  resolveDevicePriority,
  markManualResolution,
  resolveConflict,
} from './resolver.js'

export {
  type SyncEvent,
  type SyncBatch,
  type SyncResponse,
  createSyncMetadata,
  createSyncEvent,
  createSyncBatch,
  markSynced,
  markSyncFailed,
} from './sync.js'
