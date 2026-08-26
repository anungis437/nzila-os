# Phase 0B — Organization Model Decision (§ 5)

**Phase:** 0B · Organization and Identifier Integrity
**Author:** Copilot (executing per Aubert's authorized directive)
**Generated:** 2026-07-24
**Amended:** 2026-07-24 (reclassification: Outcome C, not Outcome A; false-success prevention added)
**Companion:** [organization-model-dependency-map.md](./organization-model-dependency-map.md)

---

## Amendment note (READ FIRST)

An earlier revision of this document labelled the chosen pattern
**Outcome A — Intentional bounded contexts + governed mapping**. That
label was incorrect. In the authoritative outcome vocabulary a governed
mapping table is Outcome A because it accepts that
`organizations.id` and `orgs.id` may differ per row. A single
institutional tenant projected into two bounded-context tables via a
deliberately shared UUID — enforced by an equality CHECK constraint,
an FK, and a governed resolver — is **Outcome C**. Adding
`platform_tenant_id`, enforcing `platform_tenant_id = organizations.id`,
and provisioning the same UUID into both `orgs` and `organizations` is
the shared-identifier model.

This document has been re-labelled accordingly. All references to
"Outcome A" in earlier revisions of this file, in
`organization-model-dependency-map.md`, in
`organization-model-verification.md`, in
`organization-provisioning-proof.md`, in `kpi-identifier-proof.md`,
in `cupe-national-phase-ledger.md`, and in the header comment of
`packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql`
should be read as **Outcome C**.

The two-lineage architecture, the same-UUID contract mechanics, the
FK/CHECK/index, the resolver, and the provisioning helper are unchanged.
Only the outcome label is corrected.

---

## Decision

**`orgs` and `organizations` remain separate bounded-context tables
representing the same institutional tenant. Phase 0B adopts a
deliberate shared-UUID parity contract between them. Every platform-
participating organization satisfies
`organizations.platform_tenant_id = organizations.id = orgs.id`. The
equality is enforced by a database CHECK constraint, referential
integrity is enforced by a foreign key, and all bounded-context
crossings resolve through a single governed helper.**

Classification: **Outcome C — deliberate shared-identifier parity,
governed by DB constraint and application resolver.**

## The outcome vocabulary (authoritative)

| Label | Description | Chosen? |
| --- | --- | --- |
| **Outcome A** | Independent mapping table (`organization_platform_map (org_id, tenant_id)`) permitting `organizations.id ≠ orgs.id` per row. | ❌ Rejected — see § "Why not Outcome A" |
| **Outcome B** | Immediate consolidation of `orgs` and `organizations` into a single table. | ❌ Rejected — see § "Why not Outcome B" |
| **Outcome C (chosen)** | Same institutional entity in two tables with `organizations.id = orgs.id` enforced. FK + CHECK + resolver. | ✅ |
| Status quo | Unenforced shared-UUID convention (pre-Phase 0B). | ❌ Rejected — see § "Why not the status quo" |

Outcome C is chosen because five of the six existing shared pairings
already conform to the shared-UUID convention (see dependency map
§ 2.1), because there is no operational scenario in the current codebase
where a single institutional tenant benefits from having differently-
identified `orgs` and `organizations` rows, and because a hard equality
CHECK is the cheapest, most fail-closed way to prevent silent divergence
between what the two runtime paths think an organization is.

## Why not Outcome A (independent mapping table)

Outcome A permits `organizations.id ≠ orgs.id`. It is more flexible but
introduces two failure modes not present in Outcome C:

1. Divergent identifiers can enter production silently. A developer can
   insert an `organization` and an `orgs` row with unrelated UUIDs and
   the mapping table will happily record the pair. No test forces
   `orgs.id = organizations.id`, so drift accumulates.
2. Every bounded-context crossing must join through the mapping table.
   Every audit-event insert, every pilot metric write, every AI budget
   read now performs an extra lookup, and every one of them can fail if
   the mapping row is missing. In Outcome C the resolver still exists
   but its correct answer for a platform-participating org is `id` by
   construction; the resolver is a fail-closed guard, not a hot-path
   join.

Outcome A also creates a larger surface for the exact class of bug this
phase is closing: audit and pilot writes silently succeeding against the
wrong tenant because the mapping table was populated by mistake.

## Why not Outcome B (immediate consolidation)

Outcome B collapses `orgs` and `organizations` into a single table. It
is the correct end-state for most systems but it is not what Phase 0B
can safely deliver:

- ~330 foreign keys across two large table sets (~130 platform, ~200
  union) point to either `orgs.id` or `organizations.id`. Rewriting all
  of them is a scope explosion outside the authorized Phase 0B fence.
- The two rowsets have incompatible column semantics
  (`clerk_org_id` vs `clerk_organization_id`, different jurisdiction
  encodings, incompatible enum types).
- Some `organizations` rows (federations, districts, congress bodies,
  non-platform-participating locals) legitimately have no
  corresponding `orgs` row and should not be forced into the platform
  tenant model.
- Phase 0B is explicitly prohibited from touching sealed historical
  migrations 0000–0033.

Consolidation belongs to a future Phase 1 or beyond, not to this gate.

## Why not the status quo (unenforced shared UUID)

Before Phase 0B, five rows already shared UUIDs across the two tables
by convention:

- Afrobeats Records `3333-…-3333`
- MS Celebrations `4444-…-4444`
- Nzila Console Local Dev Org `458a56cb-…`
- TrustCore Admin Locked Org ↔ CUPE Local 123 `9210418f-…`
- Trustcore Demo Corp `a1b2c3d4-…`

The convention was:

- Not backed by any FK — an `orgs` row could be deleted without
  affecting the `organizations` row.
- Not backed by any CHECK — an `organizations` row could have its `id`
  changed independently of any `orgs` row.
- Not backed by any resolver — any code that trusted
  `organizations.id === orgs.id` implicitly was one migration away from
  silent divergence.
- Not observable — there was no way to ask "is this organization a
  platform-tenant participant?" without doing two lookups.

Outcome C promotes this fragile convention to a machine-verifiable
contract without changing its runtime semantics.

## Two-lineage architecture (governance context)

The chosen contract sits astride two independently governed schema
lineages, both of which must be understood together:

- **Platform lineage.** SQL migrations under
  `packages/db/drizzle/*.sql`, applied by
  `tooling/scripts/apply-platform-migrations.mjs`, tracked in
  `drizzle.__platform_migrations`. Owns `public.orgs` and the ~130
  platform-domain tables that FK to it. This is where migration 0038
  lives.
- **Application (union-eyes) lineage.** Django migrations under
  `apps/union-eyes/backend/<app>/migrations/*.py`, applied by
  `python manage.py migrate`. Owns `public.organizations` and the
  ~200 union-domain tables that FK to it. Created by
  `apps/union-eyes/backend/auth_core/migrations/0001_initial.py`.

Drizzle in `apps/union-eyes/drizzle.config.ts` is scoped narrowly to
`./db/schema-cache/cache.ts` and its module-level comment explicitly
states:

> Drizzle MUST NOT declare or migrate canonical operational business
> entities (organizations, users, unions, grievances, claims,
> bargaining, billing, compliance, etc.). Those are owned by Django and
> live under apps/union-eyes/backend/<app>/migrations/.

Therefore any clean-database proof of the Outcome C contract MUST
materialize `public.organizations` through the Django path before or
alongside applying the platform lineage. A platform-only probe cannot
demonstrate contract enforcement because `public.organizations` never
exists in that scope.

## The Outcome C contract

### Schema

Migration `0038_phase_0b_organization_and_kpi_integrity.sql` adds:

```sql
ALTER TABLE public.organizations
  ADD COLUMN platform_tenant_id uuid NULL;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_platform_tenant_id_fk
  FOREIGN KEY (platform_tenant_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_platform_tenant_id_equals_id
  CHECK (platform_tenant_id IS NULL OR platform_tenant_id = id);

CREATE INDEX organizations_platform_tenant_id_idx
  ON public.organizations (platform_tenant_id)
  WHERE platform_tenant_id IS NOT NULL;
```

### Semantics

- `platform_tenant_id IS NULL` — the organization is pure labour
  hierarchy (federation, district, congress, non-platform-participating
  local). No platform-domain writes are authorized for it.
- `platform_tenant_id = organizations.id` — the organization
  participates in the platform domain and MUST have a matching `orgs`
  row with `id = organizations.id`.

The CHECK enforces the equality invariant. The FK enforces referential
integrity. `ON DELETE RESTRICT` prevents orphaning the mapping via a
stray `orgs` delete.

### Application resolver

`apps/union-eyes/lib/organizations/platform-tenant.ts`:

- `resolvePlatformTenantId(organizationId): Promise<string | null>`
- `requirePlatformTenantId(organizationId): Promise<string>` — throws
  `PlatformTenantMappingRequired` when the mapping is absent.
- `provisionPlatformParticipant({ id, name, policyConfig?, region? })`
  — the ONE governed entry point for pairing an `organizations` row
  with an `orgs` row.

Both read paths are single-row lookups on the partial index.

### Where the resolver MUST be called (Phase 0B fence)

Any code path that writes to a platform-domain FK-to-`orgs` table
starting from an `organizations.id` (the shape returned by
`getOrganizationIdForUser`) MUST resolve through
`requirePlatformTenantId` and MUST fail closed if the mapping is absent.
The authoritative catalogue of these crossings is in
`organization-model-dependency-map.md` § 3.2 and § 5.

Integration into every listed production path is **NOT complete in the
initial Phase 0B commit set**. The resolver + tests land in that set;
production integration lands in Phase 0B.2 (deferred). See § "Remaining
work" below.

## KPI identifier resolution

The six `@nzila/ue-cognition` snapshot tables (`ueKpiSnapshots`,
`ueCaseRiskSnapshots`, `ueWorkloadSnapshots`, `ueEngagementSnapshots`,
`uePrecedentMatches`, `ueCognitionAudits`) had `id uuid('id')
.defaultRandom()` in Drizzle but the file-backed runtime always emits
`{prefix}_{timestampSlug}_{shortHash}` text IDs. The mismatch would
cause every insert to fail on the first environment that materializes
these tables in Postgres.

**Decision (Outcome C-consistent).** Change the Drizzle schema
declaration to `text('id').primaryKey()` for these six tables. Retain
the runtime slug format. No historical migration change; the tables do
not yet exist in Postgres (storage is file-backed for Phase 1). Add a
comment referencing this decision.

**Follow-up (deferred).** When these tables are materialized in
Postgres, a forward migration must convert the columns from uuid to
text AND round-trip existing file-store values into DB rows. That
migration is deferred to Phase 1 storage cutover. See
`kpi-identifier-proof.md` for the runtime evidence.

## False-success prevention (added 2026-07-24)

Under the original design, migration `0038` on a database whose
`public.organizations` table did not exist executed a guarded `DO $mig$`
block, issued a `RAISE NOTICE`, returned early, and was recorded in the
platform migration tracker as `outcome_class = 'full-success'`. That
record was **indistinguishable from a genuine success** in which every
sub-operation had run against a real `organizations` table. The clean-DB
probe therefore proved only that the migration did not error — not that
the same-UUID contract took effect.

Migration 0038 has been amended to:

1. Create a marker table `drizzle.__phase0b_outcomes(migration_filename
   text PK, outcome_class text NOT NULL, notes text, recorded_at
   timestamptz DEFAULT now())`.
2. INSERT exactly one row on each apply, ON CONFLICT (filename) DO
   UPDATE, whose `outcome_class` is one of:
   - `applied` — every sub-operation ran against a real
     `public.organizations`. Constraints, index, backfill, and
     synthetic-QA provisioning are in place.
   - `deferred-app-schema-absent` — `public.organizations` did not
     exist. The migration executed no substantive change. The
     same-UUID contract is NOT in force in this database. A subsequent
     apply after the application schema is materialized will upgrade
     the outcome to `applied`.

Verification steps (in `organization-model-verification.md` and in
`phase-0b-validation-summary.md`) MUST read from this marker table and
MUST refuse to claim organization-integrity green in any environment
where the row exists with `outcome_class = 'deferred-app-schema-absent'`.

## Remaining work (deferred to Phase 0B.2 — recorded here to prevent silent skip)

The initial Phase 0B commit set closes:

- The classification defect (Outcome A → Outcome C) in all authored
  artefacts.
- The false-success defect (marker table in migration 0038;
  verification refuses green on `deferred`).
- The KPI schema-declaration defect (uuid → text in
  `@nzila/ue-cognition`).
- The resolver utility + its unit tests.
- The dev-database contract application (constraints in place, mappings
  established) — as previously proven in
  `phase-0b-dev-verify.log`.

It does NOT close, and Phase 0B closure MUST be AMBER until each of the
following lands:

1. **Django-based clean-DB proof.** Run the governed application-schema
   init (`apps/union-eyes/backend/manage.py migrate`) against a
   disposable probe DB, then apply the platform lineage including 0038,
   and confirm `outcome_class = 'applied'` in the marker table.
2. **Resolver integration into production paths.** The catalogue in
   `organization-model-dependency-map.md` § 3.2 lists every FK-to-`orgs`
   write path that today receives an `organizations.id`. Each of those
   call sites must be modified to route through
   `requirePlatformTenantId` and to fail closed when the mapping is
   absent, with per-path tests.
3. **Database-backed contract tests.** Beyond the unit-test suite for
   the resolver, add integration tests that exercise the FK / CHECK /
   unique-index against a real Postgres, asserting each error class
   (missing platform tenant, mismatched identifier, missing referenced
   org, duplicate mapping, deletion behaviour).
4. **KPI DB forward migration.** When the six cognition tables are
   materialized in Postgres, a migration must convert them from uuid to
   text and round-trip existing file-store values.
5. **Seed / reset validation.** Deterministic seed for Outcome C-shaped
   fixtures (primary demo org, secondary isolation org, unmapped-invalid
   org, existing dev org) plus a reset that removes only marked
   synthetic data.
6. **Full validation battery.** Full `pnpm --filter @nzila/union-eyes
   test`, focused API suite, contract tests, production build, doc
   validation — post-integration.

## Closure vocabulary implication

- With Outcome C mechanics in place on dev DB and the marker table
  distinguishing `applied` from `deferred`, the "no false green"
  invariant holds.
- Absent the six items above, closure of Phase 0B is
  **`AMBER — ORGANIZATION OR IDENTIFIER INTEGRITY INCOMPLETE`**, not
  green. See `phase-0b-validation-summary.md`.
