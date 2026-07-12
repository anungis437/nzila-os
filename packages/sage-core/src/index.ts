// ─── @nzila/sage-core ────────────────────────────────────────────────────────
// SAGE (Service Assurance & Governance Evidence).
// Phase 1: stakeholder access model, domain types, permission/audit constants,
//   boundary-profile derivation, and implementation-blocking invariants.
// Phase 2: executable service layer (repository port, audit sink, services).
//
// Boundaries (from the SAGE World-Class Implementation Blueprint):
// no automated decisions, no scoring/ranking, no certification,
// no public availability/procurement claim. Human review required; export gated.

export * from './types.js'
export * from './permissions.js'
export * from './audit-events.js'
export * from './boundary-profile.js'
export * from './invariants.js'
export * from './access-model.js'
export * from './service-context.js'
export * from './service-errors.js'
export * from './repository.js'
export * from './audit-sink.js'
export * from './services.js'
