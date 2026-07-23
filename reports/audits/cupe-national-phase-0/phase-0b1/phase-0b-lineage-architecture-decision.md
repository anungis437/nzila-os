# Phase 0B.1 — Two-Lineage Architecture Decision

**Status:** ✅ **DECIDED — Option D (Governed hybrid architecture)**.
Aubert selected on 2026-07-23. See [Decision record](#decision-record) below
and [`../phase-0b2/phase-0b2-architecture-approval.md`](../phase-0b2/phase-0b2-architecture-approval.md)
for the Phase 0B.2 approval scope and non-goals.
**Blocks (historical):** at Phase 0B.1 closure, this file blocked Phase 0B
closure, Phase 0C authorization, and deployment. Phase 0B.1 closed AMBER
pending this decision; that closure is preserved in
[`phase-0b1-closure.md`](phase-0b1-closure.md).

## The problem, stated precisely

The Nzila OS PostgreSQL database serves two independently-authored lineages
that both write into `public.*`:

- **Platform lineage** — Drizzle ORM. Root: `packages/db/drizzle/*.sql`
  (39 files) + `packages/db/src/schema/*.ts`. Owns ~168 tables.
- **Union Eyes Django lineage** — Django migrations. Root:
  `apps/union-eyes/backend/*/migrations/*.py`. Owns ~549 tables including
  Django framework internals (`auth_*`, `django_*`).

Independent observation via `phase-0b-true-lineage-conflicts.log` recorded
**111 `public.<name>` tables where both lineages claim ownership** (or where
at least one lineage has a DDL statement targeting the name). Neither
lineage's migration set can be applied cleanly on top of the other's without
CREATE TABLE conflicts, ownership ambiguity, or silent schema drift.

See [phase-0b-table-collision-inventory.md](phase-0b-table-collision-inventory.md)
for the full 111-row inventory and the classifications
(`SHARED_INTENT` × 2, `DJANGO_INTERNAL` × 9, `REQUIRES_DECISION` × 100).

## What Phase 0B already committed to (via migration 0038)

Migration `0038_phase_0b_organization_and_kpi_integrity.sql` encodes
**Outcome C** for the organization contract:

    organizations.platform_tenant_id = organizations.id = orgs.id

This is enforced by an FK, a CHECK constraint, and a partial index. This is
the correct treatment of `organizations` × `orgs` (the two `SHARED_INTENT`
rows). It does **not** by itself address the remaining 109 colliding tables.

## Options

The four candidate topologies, with their consequences:

### Option A — One authoritative owner per table (single-DB, single-schema)

Every colliding table has exactly one lineage that owns its DDL. Reads from
the other lineage occur via views / read-only clients.

- ✅ Simplest runtime. Single connection string. No cross-DB joins.
- ❌ Requires renaming Django tables (or accepting Django loses ~half of
  its default table names). Django framework tables (`auth_user`,
  `django_migrations`) are non-negotiable — they must be Django-owned.
- ❌ Requires either (a) rewriting large portions of platform Drizzle
  schema to use different table names, or (b) rewriting large portions of
  Django to point at Drizzle-authored tables via unmanaged models.
- ❌ Highest short-term rewrite cost.

### Option B — Separate PostgreSQL schemas per lineage (single-DB, dual-schema)

Django gets its own PostgreSQL schema (e.g. `union_eyes`); platform stays in
`public`. Search-paths per role. Cross-schema reads allowed via explicit
qualification.

- ✅ Preserves both lineages' existing table names.
- ✅ No CREATE TABLE conflicts at migration time.
- ✅ Django framework tables (`auth_*`, `django_*`) live in Django's schema
  without polluting `public`.
- ⚠️ Requires updating Django `DATABASES` config for `search_path` and
  every Drizzle client's search path.
- ⚠️ `SHARED_INTENT` tables (`organizations`, `orgs`) need explicit
  ownership decision — likely one lineage owns them and the other reads via
  fully-qualified name or view.
- ⚠️ Cross-schema FKs are allowed but complicate migration ordering.

### Option C — Separate databases per lineage (dual-DB)

Django lives in a `union_eyes` PostgreSQL database; platform stays in
`nzila_automation`. Cross-DB reads via FDW (`postgres_fdw`) or through
application code.

- ✅ Complete isolation. Neither migration set can conflict with the other.
- ✅ Independent backup / restore / point-in-time recovery per lineage.
- ❌ Cross-database FKs are impossible. `organizations`/`orgs` shared
  contract must be maintained by application logic + reconciliation jobs.
- ❌ Doubles operational surface (two DBs, two migration pipelines, two
  monitoring surfaces, two RLS setups).
- ❌ Highest infra cost.

### Option D — Governed hybrid (single-DB, dual-schema, contract-enforced)

Same physical layout as Option B, but with:

- Explicit contract owner per `SHARED_INTENT` table (Outcome C already
  declares this for `organizations`/`orgs`).
- CI check enforcing that no new colliding public.* table is introduced.
- Read-only views published from the owner schema into the reader schema
  so consumer code paths do not need to know the owner's schema name.
- Deprecation plan for the 100 `REQUIRES_DECISION` tables that resolves
  each to either "Django-owned; platform reads via view" or
  "platform-owned; Django reads via unmanaged model".

- ✅ Preserves both lineages' existing table names in the near term.
- ✅ Provides a concrete path to Option A over time (the deprecation
  plan) if long-term direction is single-owner.
- ✅ Enforces boundaries via CI rather than convention.
- ⚠️ Requires the deprecation plan to be authored, sequenced, and tracked
  as its own workstream.
- ⚠️ Requires migration 0038's `orgs` clause to be re-read against the
  final owner choice.

## Recommendation (from analysis; not a decision)

**Option D — Governed hybrid** appears to have the best cost/risk profile
for a project already carrying both lineages in production-shaped
environments. Option B is the minimum viable step toward it. Option A is
the long-term target that Option D naturally drifts toward. Option C is
not recommended given the sharedness of the `organizations`/`orgs`
contract already enforced at DB level by migration 0038.

**However, this is not a decision.** Aubert must select the option and
record the selection below.

## Decision record

| Field | Value |
| --- | --- |
| Selected option | ✅ **Option D — Governed hybrid architecture** |
| Approver | Aubert (sole authority) |
| Date | 2026-07-23 |
| Migration 0038 wording review | Superseded on clean branch by the foundational-slice migrations landed in Phase 0B.2 (see [`../phase-0b2/phase-0b2-architecture-approval.md`](../phase-0b2/phase-0b2-architecture-approval.md)). Migration 0038 remains on the historical branch as recorded history. |
| Downstream artefact updates required | Phase 0B.2 architecture-approval doc, ownership manifest, foundational-slice doc, Django schema strategy, cross-schema organization contract, resolver integration, KPI database migration, tests, closure. |

### Historical decision state (preserved as evidence)

At the time this document was first authored on **2026-07-22**, the
decision record read `Selected option: PENDING AUBERT`, `Date: PENDING`.
On **2026-07-23**, Aubert selected **Option D — Governed hybrid
architecture** and authorised Phase 0B.2 to proceed through Sections 1
through 19 of the Phase 0B.2 mandate.

The pending state above is preserved as the earlier record and updated
in place because this file lives on both:

- `fix/union-eyes-reality-remediation` — historical/audit branch,
  where Phase 0B.1 committed the `PENDING` state at
  `c83e55efc669365d0bf1dfa457f38847b47b806d`. That commit is retained
  unchanged as evidence of the decision-gate state at Phase 0B.1
  closure.
- `fix/union-eyes-phase0b-clean` — Phase 0B.2 implementation branch,
  where the decision is now recorded as Option D and drives all
  subsequent implementation.

## What Phase 0B.1 will NOT do

- It will not choose the option.
- It will not silently reword migration 0038 to imply any option was chosen.
- It will not close Phase 0B GREEN.
- It will not authorize Phase 0C.
- It will not deploy either branch.

## What Phase 0B.1 WILL do

- Publish the 111-table collision inventory.
- Publish this options + recommendation document.
- Publish `phase-0b-lineage-migration-plan.md` as a **conditional plan**
  that branches on the selected option.
- Close Phase 0B.1 as **AMBER — ARCHITECTURE DECISION REQUIRED**.
