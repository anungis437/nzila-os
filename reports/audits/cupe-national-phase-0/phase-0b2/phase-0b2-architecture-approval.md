# Phase 0B.2 — Architecture Approval

**Status:** ✅ **APPROVED** — Aubert, 2026-07-23.
**Selected architecture:** **Option D — Governed hybrid**.
**Authorization scope:** Phase 0B.2 Sections 1–19 (foundational slice only).
**Branch:** `fix/union-eyes-phase0b-clean`.

---

## 1. Approver

- **Name:** Aubert
- **Role:** Sole authority for Nzila OS architecture decisions during
  Phase 0 remediation.
- **Decision date:** 2026-07-23.

## 2. Decision

**Option D — Governed hybrid architecture.**

The Nzila OS database will host two co-located schemas:

- **`public`** — owned by the Nzila Platform (Drizzle). Contains
  platform-owned shared data (tenants, organization-level identity,
  cross-product observability, cross-product audit) and platform-owned
  exclusive tables.
- **`union_eyes`** — owned by the Union Eyes Django backend. Contains
  Union-Eyes-owned application data (case narratives, evidence packs,
  UE Cognition telemetry, pilot state, KPI aggregates) and Union-Eyes-owned
  exclusive tables.

Django framework internals (`auth_*`, `django_*`) do not compete inside
`public`; they live inside `union_eyes` (or, where required, a distinct
Django schema) and are declared `DJANGO_INTERNAL`.

Each colliding table has **exactly one DDL owner** — either the platform
or Union Eyes. Non-owners of a shared table adopt the owner's DDL through
a governed mechanism (see § 5) and do not recreate the table.

## 3. Source evidence

- [111-table collision inventory (Phase 0B.1)](../phase-0b1/phase-0b-table-collision-inventory.md)
- [Full Phase 0B.1 architecture decision package](../phase-0b1/phase-0b-lineage-architecture-decision.md)
- [Conditional migration plan (Phase 0B.1)](../phase-0b1/phase-0b-lineage-migration-plan.md)
- [Phase 0B.1 closure — AMBER](../phase-0b1/phase-0b1-closure.md)

## 4. Decision principles (encoded into the ownership manifest validator)

1. **One DDL owner per table.**
   No shared table may be recreated by more than one lineage.
2. **Platform-owned shared data stays in `public`.**
   `orgs`, cross-product audit, and cross-product identity remain in `public`.
3. **Union-Eyes-owned application data moves to `union_eyes`.**
   Case narratives, evidence packs, pilot state, UE Cognition telemetry,
   KPI aggregates.
4. **Django internal tables do not compete in `public`.**
   `auth_*`, `django_*` live inside the Django-owned schema.
5. **Shared tables are adopted, not recreated, by the non-owner.**
   Non-owners access the shared table via `managed = False`,
   `SeparateDatabaseAndState`, explicit migration-state adoption, or a
   scoped router — never through a duplicate `CREATE TABLE`.
6. **No broad 111-table migration in one wave.**
   Phase 0B.2 addresses only the foundational slice (see § 6). The remaining
   tables are classified by the ownership manifest and scheduled for later
   Phase 0B waves under the same rules.
7. **Foundational organization/KPI slice first.**
   `public.orgs` + `union_eyes.organizations` cross-schema contract,
   pilot-definition and pilot-metrics FKs, KPI + UE Cognition text-ID
   promotion, and the required audit-ownership rows.

## 5. Governed Django schema strategy (chosen approach summary)

Selected strategy: **explicit `db_table = 'union_eyes.<table>'` on Django
models + `managed = False` for adopted shared tables** for the foundational
slice, backed by checked-in migrations that create the `union_eyes` schema
via `RunSQL('CREATE SCHEMA IF NOT EXISTS union_eyes')` as the first
operation of the earliest Union-Eyes-owned migration.

**Rejected:**

- Global `search_path` redirection (untested cross-migration effect;
  invisible to code readers; hides ownership).
- Uncontrolled `SeparateDatabaseAndState` across the whole app (opaque
  and easy to drift).

**Full rationale and per-table application:** see
[`phase-0b-django-schema-strategy.md`](phase-0b-django-schema-strategy.md).

## 6. Foundational slice

Only the following tables are in scope for Phase 0B.2:

| Table                                     | DDL owner    | Target schema |
| ----------------------------------------- | ------------ | ------------- |
| `orgs`                                    | Platform     | `public`      |
| `organizations`                           | Union Eyes   | `union_eyes`  |
| `pilot_definitions`                       | Union Eyes   | `union_eyes`  |
| `pilot_metrics`                           | Union Eyes   | `union_eyes`  |
| `organization_members` (foundational rows only) | Platform | `public`      |
| `audit_events` (foundational rows only)   | Platform     | `public`      |
| `ue_cognition_*` (6 tables — text-ID)     | Union Eyes   | `union_eyes`  |

Full list, dependencies, and exclusion reasons in
[`phase-0b-foundational-slice.md`](phase-0b-foundational-slice.md).

## 7. Non-goals

Phase 0B.2 will **not**:

- Migrate all 111 colliding tables.
- Alter tables outside the foundational slice.
- Change Django framework internals beyond declaring them
  `DJANGO_INTERNAL` in the manifest.
- Alter the historical branch `fix/union-eyes-reality-remediation` other
  than for pointer/evidence updates.
- Cherry-pick historical Phase 0B commits (`1e5a6bd94`, `7a1c90ab3`, etc.)
  into the clean branch. Selective path-level extraction is used instead
  (see [`../phase-0b1/phase-0b-clean-branch-provenance.md`](../phase-0b1/phase-0b-clean-branch-provenance.md)).
- Import the 255-file test-timeout sweep; that work belongs on
  `chore/test-infrastructure-stabilization`.
- Deploy any environment.
- Begin Phase 0C, Phase 0D, or Phase 1.
- Graduate any CUPE scenario.

## 8. Closure conditions for Phase 0B.2

Phase 0B.2 may close GREEN only when **all** of the following hold on
`fix/union-eyes-phase0b-clean`:

- Ownership manifest exists and validator passes.
- Every colliding table classified into one of the eight ownership states,
  with zero `OWNERSHIP_UNRESOLVED` rows.
- `union_eyes` schema created via checked-in Django migration.
- Foundational Union-Eyes-owned tables live under `union_eyes.<table>`.
- Platform-owned shared tables adopted by Django without duplicate DDL.
- Cross-schema organization contract enforced
  (`union_eyes.organizations.platform_tenant_id = union_eyes.organizations.id = public.orgs.id`).
- Resolver integrated into the foundational paths listed in
  [`phase-0b-resolver-integration-proof.md`](phase-0b-resolver-integration-proof.md).
- KPI text-ID database migration applied.
- Clean-DB composition proof PASSES on a disposable database.
- Existing-DB upgrade proof PASSES on a disposable clone.
- Tests and validation on the clean branch pass.
- Clean branch pushed to `origin`.

If any of the above is incomplete, Phase 0B.2 closes **AMBER** with the
narrowest applicable classification from
[the mandate Section 20](#).

## 9. Hard-stop after Phase 0B.2

No Phase 0C, Phase 0D, Phase 1, deployment, or CUPE scenario graduation
until Phase 0B.2 closes GREEN and receives explicit further authorization.

---

**This document is the authoritative approval record for Phase 0B.2.**
All downstream Phase 0B.2 artefacts derive their scope from it.
