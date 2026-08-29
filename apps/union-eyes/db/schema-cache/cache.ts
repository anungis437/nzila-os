/**
 * Scoped Drizzle barrel — runtime support / cache schema only.
 *
 * Per docs/architecture/orm-governance/drizzle-scope-reconstruction.md,
 * this file is the ONLY entrypoint that drizzle-kit resolves for the
 * UnionEyes Drizzle layer. Anything imported here becomes part of the
 * scoped schema. Anything not imported here is invisible to drizzle-kit.
 *
 * ALLOWED CATEGORIES (see orm-authority-governance.md):
 *   - cache schemas
 *   - governance runtime schemas
 *   - continuity observability schemas
 *   - attestation / evidence support schemas
 *   - operational read-model projections
 *
 * PROHIBITED CATEGORIES:
 *   - canonical business entities (Django-owned)
 *   - business workflows (grievances, claims, bargaining, billing,
 *     compliance, accounting, etc.)
 *   - shared identity tables (auth, organizations, memberships)
 *
 * Adding a new entry here is a governance event and requires updating
 * docs/architecture/orm-governance/canonical-schema-topology.md.
 */

// Intentionally narrow barrel. Cache schemas are added incrementally and
// reviewed against the canonical topology before inclusion.
//
// Delegated read-model projection — see canonical-schema-topology.md §2.2:
// "operational read-model projections that are explicitly delegated per a PR
// that updates the canonical topology". The ICRA (Institutional Continuity
// Risk Assessment) tables capture pseudonymous continuity scoring results
// and are continuity-observability scope, not canonical operational entities.
export * from "../schema/icra-schema";

// Delegated read-model projection — see canonical-schema-topology.md §2.2.
// The Governance Entropy Workbook™ (OCI P2) tables capture pseudonymous
// continuity mapping artifacts: memory holders, stewardship signals,
// governance lineage, breakpoints, modernization alignment, and a
// transformation roadmap. Continuity-observability scope, not canonical
// operational entities. Hybrid claim model (pseudonymous → account-claim
// on purchase) is documented in docs/oci/oci-product-ladder.md.
export * from "../schema/workbook-schema";

// Gate 13: Background Job & Provider Artifact Cancellation — Governance Runtime
// Tracks local state for background job cancellation with idempotency guarantees
// and comprehensive audit trails. Enables Union Eyes to record cancellation requests
// and enforce terminal state without relying on provider-side coordination.
// See: docs/categories/products-and-market/union-eyes/liuna-opdc-cecof-readiness/27-gate-13-background-job-provider-artifact-cancellation-proof.md
export * from "../schema/gate-13-job-cancellation-governance";
