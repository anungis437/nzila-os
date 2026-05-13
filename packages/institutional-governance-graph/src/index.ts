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

export * from './ontology/kinds.js'
export * from './lifecycle/normalize.js'
export * from './adapters/source-adapter.js'
export * from './projection/organizations.js'
export * from './projection/affiliations.js'
export * from './projection/voting.js'
export * from './projection/representation.js'
export * from './projection/build.js'
export * from './delegation/resolver.js'
export * from './decisions/mapper.js'

// Phase 3 — protected-semantics fence, chronology, and read-only query surfaces.
export * from './governance/protected.js'
export * from './governance/chronology.js'
export * from './governance/queries.js'

// Phase 4 — institutional timeline (read-only convergence layer).
export * from './governance/timeline.js'

// Phase 4 — evidence/knowledge/policy convergence (read-only citation layer).
export * from './governance/evidence.js'

// Phase 4 — institutional continuity (read-only succession & tenure layer).
export * from './governance/continuity.js'

// Phase 4 — trust & explainability (read-only provenance convergence layer).
export * from './governance/trust.js'
