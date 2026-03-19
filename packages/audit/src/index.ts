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
} from './schema.js'

export {
  AuditEngine,
  computeAuditHash,
} from './engine.js'

export {
  type AuditStore,
  InMemoryAuditStore,
} from './store.js'

export {
  verifyChain,
  verifyTenantChain,
} from './verify.js'

export {
  type SnapshotStore,
  InMemorySnapshotStore,
  createRootHashSnapshot,
} from './snapshot.js'

export {
  exportAuditLog,
  type AuditExportOptions,
  type AuditExportResult,
} from './export.js'
