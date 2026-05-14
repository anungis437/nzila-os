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

// Intentionally empty barrel. Cache schemas are added incrementally and
// reviewed against the canonical topology before inclusion.
export {};
