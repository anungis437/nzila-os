/**
 * @nzila/institutional-governance-graph
 *
 * Read-side projection of Union Eyes institutional data into the canonical
 * `@nzila/platform-entity-graph` and `@nzila/platform-decision-graph`
 * substrates.
 *
 * This package is read-only. It performs no IO of its own; it consumes a
 * caller-provided `InstitutionalGovernanceSourceAdapter` and emits graph
 * projection objects.
 */

export * from './ontology/kinds'
// Workstream I — canonicalization deny-list & promotion-discipline guards.
export * from './ontology/canonicalization'
export * from './lifecycle/normalize'
export * from './adapters/source-adapter'
export * from './projection/organizations'
export * from './projection/affiliations'
export * from './projection/voting'
export * from './projection/representation'
export * from './projection/build'
export * from './delegation/resolver'
export * from './decisions/mapper'

// Phase 3 — protected-semantics fence, chronology, and read-only query surfaces.
export * from './governance/protected'
export * from './governance/chronology'
export * from './governance/queries'

// Phase 4 — institutional timeline (read-only convergence layer).
export * from './governance/timeline'

// Phase 4 — evidence/knowledge/policy convergence (read-only citation layer).
export * from './governance/evidence'

// Phase 4 — institutional continuity (read-only succession & tenure layer).
export * from './governance/continuity'

// Phase 4 — trust & explainability (read-only provenance convergence layer).
export * from './governance/trust'

// Phase 4 — read-only institutional observability (counts-only, gated).
export * from './observability/snapshot'
