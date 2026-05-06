// ─── @nzila/audit ────────────────────────────────────────────────────────────
// Tamper-proof audit system with SHA-256 hash chain, append-only storage,
// chain integrity verification, daily root hash snapshots, and export.

export {
  type AuditEntry,
  type AuditInput,
  type RootHashSnapshot,
  type VerificationResult,
  auditEntrySchema,
  auditInputSchema,
  rootHashSnapshotSchema,
  verificationResultSchema,
  GENESIS_HASH,
} from './schema'

export {
  AuditEngine,
  computeAuditHash,
} from './engine'

export {
  type AuditStore,
  InMemoryAuditStore,
} from './store'

export {
  verifyChain,
  verifyOrgChain,
} from './verify'

export {
  type SnapshotStore,
  InMemorySnapshotStore,
  createRootHashSnapshot,
} from './snapshot'

export {
  exportAuditLog,
  type AuditExportOptions,
  type AuditExportResult,
} from './export'
