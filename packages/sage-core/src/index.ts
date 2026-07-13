// ─── @nzila/sage-core ────────────────────────────────────────────────────────
// SAGE (Service Assurance & Governance Evidence).
// Phase 1: stakeholder access model, domain types, permission/audit constants,
//   boundary-profile derivation, and implementation-blocking invariants.
// Phase 2: executable service layer (repository port, audit sink, services).
// Phase 3: SQL-backed repository persistence (SQL client, Postgres repository, mappers).
//
// Boundaries (from the SAGE World-Class Implementation Blueprint):
// no automated decisions, no scoring/ranking, no certification,
// no public availability/procurement claim. Human review required; export gated.

export * from './types'
export * from './permissions'
export * from './audit-events'
export * from './boundary-profile'
export * from './invariants'
export * from './access-model'
export * from './service-context'
export * from './service-errors'
export * from './repository'
export * from './audit-sink'
export * from './services'
export * from './export-scope'
export * from './export-package'
export * from './export-store'
export * from './sql-client'
export * from './postgres-mappers'
export * from './postgres-repository'
