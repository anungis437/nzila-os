# Organization Model Verification — Phase 0B

**Status.** AMBER — organization and identifier integrity partially closed. Same-UUID contract (Outcome C) is DB-enforced only on the dev DB. On a governed clean DB the contract is deferred, correctly recorded as such by the substantive-outcome marker table, and cannot be upgraded to `applied` until the Django (application) lineage is materialized. Django-first ordering does not compose either: the two lineages have 111 overlapping `public` table names and Django's `bargaining.0001_initial` collides with the platform's `0000_initial.sql` on `votes` (SQLSTATE `42P07`). This is a genuine governance defect that is out of Phase 0B scope; it is enumerated in the remaining-work register.

**Date.** 2026-04-24 (Aubert local wall-clock), amended 2026-04-25 (this document) — supersedes the 2026-04-24 GREEN classification.

**Prior classification (superseded).** The prior revision of this document declared `Status: GREEN — constraint contract in place on dev DB and gracefully absent on clean/probe DB` and treated a silent no-op on the clean DB as full success. That classification was defective: (1) the guard recorded `outcome_class = full-success` in `drizzle.__platform_migrations` on a DB where the FK, CHECK, index, and backfill never ran, which is not a full success of the substantive contract; (2) it accepted an unrecorded `drizzle-kit push` for `public.organizations` as an implicit part of the initialization path even though the sanctioned Django ownership was never invoked; (3) it did not attempt a governed clean-DB proof and therefore did not surface the 111-table lineage overlap. This document reclassifies verification to AMBER, describes the false-success remediation, records the governed clean-DB probe results, and enumerates the residual work required to reach GREEN.

**Scope.** DB-level evidence for migration `0038_phase_0b_organization_and_kpi_integrity.sql`: what it does when `public.organizations` is materialized, what it records when the table is absent, how the substantive-outcome marker table `drizzle.__phase0b_outcomes` distinguishes the two, and what remains before organization integrity is provably closed on a governed clean DB.

**Anchor documents.**
- Decision (Outcome C, verbatim contract): `organization-model-decision.md`
- Dependency map: `organization-model-dependency-map.md`
- Provisioning evidence (transactional resolver): `organization-provisioning-proof.md`
- KPI evidence: `kpi-identifier-proof.md`
- Remaining work: `phase-0b-remaining-work-register.md`

---

## 1. Two-lineage architecture (unchanged from prior verification, retained for context)

Two independent schema lineages own the tables that Phase 0B relates:

| Table | Owner lineage | Created by |
| --- | --- | --- |
| `public.orgs` | Platform | `packages/db/drizzle/*.sql` (applied by `tooling/scripts/apply-platform-migrations.mjs` on top of `packages/db/bootstrap/0000_platform_schema_prerequisites.sql`) |
| `public.organizations` | Application | `apps/union-eyes/backend/auth_core/migrations/0001_initial.py` (applied by `python manage.py migrate` inside the `apps/union-eyes/backend` Django project); further shape-changing migrations live under other Django apps' `migrations/*.py` |

Consequence: any platform migration that references `public.organizations` unconditionally will fail on a database that has been bootstrapped only with the platform lineage. Similarly, any Django migration that expects the platform-owned tables (e.g. `orgs`, `votes`, `commerce_*`) to exist first will fail if run before the platform bootstrap. This session confirmed that both orderings currently fail — see §4 and §5.

---

## 2. Contract objects (dev DB) — unchanged, retained as evidence

Verified 2026-04-24 against `nzila_automation` on `localhost:5433` (native PG 17.8), after 0038 was re-applied under the marker-table remediation:

### 2.1 Constraints

```
                  conname                   | contype |                               definition
--------------------------------------------+---------+-------------------------------------------------------------------------
 organizations_platform_tenant_id_equals_id | c       | CHECK (((platform_tenant_id IS NULL) OR (platform_tenant_id = id)))
 organizations_platform_tenant_id_fk        | f       | FOREIGN KEY (platform_tenant_id) REFERENCES orgs(id) ON DELETE RESTRICT
(2 rows)
```

### 2.2 Partial index

```
CREATE INDEX organizations_platform_tenant_id_idx
    ON public.organizations USING btree (platform_tenant_id)
    WHERE (platform_tenant_id IS NOT NULL)
```

Rationale: the majority of `organizations` rows are union-hierarchy entities with no platform-tenant counterpart; the mapping index is filtered so it only stores the platform-participating subset.

### 2.3 Marker row on dev DB

```
                migration_filename                | outcome_class | organizations_row_count | orgs_row_count | platform_tenant_id_mapped_count | fk_constraint_present | check_constraint_present
--------------------------------------------------+---------------+-------------------------+----------------+---------------------------------+-----------------------+--------------------------
 0038_phase_0b_organization_and_kpi_integrity.sql | applied       |                      49 |             10 |                               9 | t                     | t
```

---

## 3. Population state (dev DB) — unchanged, retained as evidence

| Metric | Value |
| --- | --- |
| `orgs` total rows | 10 |
| `organizations` total rows | 49 |
| `organizations.platform_tenant_id IS NOT NULL` | 9 |
| `organizations.platform_tenant_id IS NULL` | 40 |

The 9 mapped rows split into:
- **5 pre-existing shared-UUID pairs** — see `organization-model-dependency-map.md` § 2.1
- **4 synthetic QA orgs newly provisioned by migration 0038** — see `organization-provisioning-proof.md`

The 40 unmapped rows are legitimate union-hierarchy entities (federations, districts, congress, non-platform-participating locals) that do not — and should not — have `orgs` counterparts. Any future promotion goes through the sanctioned resolver in `apps/union-eyes/lib/organizations/platform-tenant.ts`.

---

## 4. False-success remediation — the substantive-outcome marker table

### 4.1 The defect

The prior verification treated `drizzle.__platform_migrations.outcome_class = full-success` as sufficient proof that Phase 0B was in force in the environment. That signal is not sufficient. `__platform_migrations` records whether the SQL file executed to completion; it does not distinguish between the guard's early-return path (where FK, CHECK, index, backfill, and provisioning were all skipped because `organizations` was absent) and the substantive path (where all eight sub-operations ran). Both record `full-success`. Under the prior verification, a downstream consumer inspecting only `__platform_migrations` would incorrectly conclude the same-UUID contract was in force on a database where it was not.

### 4.2 The remediation

Migration `0038` was rewritten to unconditionally create and populate a second, purpose-built tracking table:

```sql
CREATE TABLE IF NOT EXISTS drizzle.__phase0b_outcomes (
  migration_filename                text PRIMARY KEY,
  outcome_class                     text NOT NULL,          -- 'applied' | 'deferred-app-schema-absent'
  organizations_row_count           integer,
  orgs_row_count                    integer,
  platform_tenant_id_mapped_count   integer,
  fk_constraint_present             boolean,
  check_constraint_present          boolean,
  notes                             text,
  recorded_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase0b_outcomes_outcome_class_check
    CHECK (outcome_class IN ('applied', 'deferred-app-schema-absent'))
);
```

The migration body branches on the presence of `public.organizations`:
- **Absent** → INSERT `outcome_class = 'deferred-app-schema-absent'` with NULL organization counts and `fk_constraint_present = false`; RETURN. `__platform_migrations` records `full-success`; `__phase0b_outcomes` honestly records that the contract is deferred.
- **Present** → run all eight sub-operations (add column, FK, CHECK, index, backfill, provisioning, comment) and INSERT `outcome_class = 'applied'` with the post-state counts and constraint presence.

`ON CONFLICT (migration_filename) DO UPDATE` makes the row upgrade automatically when 0038 is re-applied against a DB where `organizations` has since been materialized.

**Downstream consumers verifying organization integrity MUST read `drizzle.__phase0b_outcomes`, not `drizzle.__platform_migrations`.**

### 4.3 The remediation is verified

Applied to the truly-empty probe DB `nzila_phase0b_probe_v4` (created fresh this session, DROP + CREATE, then platform-bootstrap + platform-incrementals, no Django), the marker row correctly shows:

```
                migration_filename                |       outcome_class        | organizations_row_count | orgs_row_count | platform_tenant_id_mapped_count | fk_constraint_present | check_constraint_present
--------------------------------------------------+----------------------------+-------------------------+----------------+---------------------------------+-----------------------+--------------------------
 0038_phase_0b_organization_and_kpi_integrity.sql | deferred-app-schema-absent |                         |              0 |                                 | f                     | f
```

Evidence log: `logs/phase-0b-clean-db-marker-probe-v4.log`.

This is the correct signal. The false-success defect is closed.

---

## 5. Governed clean-DB proof — attempted and blocked

To upgrade the marker outcome from `deferred-app-schema-absent` to `applied` on a governed clean DB, both lineages must be applied to the same fresh database. Two orderings were attempted this session:

### 5.1 Ordering A: platform-first, then Django

- `DROP DATABASE + CREATE DATABASE nzila_phase0b_probe_v2` — fresh.
- `apply-platform-migrations.mjs --bootstrap-apply` — succeeded.
- `apply-platform-migrations.mjs` (incrementals) — succeeded, `0038` recorded `deferred-app-schema-absent` (see log).
- `PGDATABASE=nzila_phase0b_probe_v2 python manage.py migrate` — **failed** at `billing.0001_initial` with:
  `django.db.utils.ProgrammingError: relation "stripe_webhook_events" already exists`.

Root cause: the platform lineage's `0000_initial.sql` creates `stripe_webhook_events` (and 110 other tables — see §6) using bare `CREATE TABLE` (not `CREATE TABLE IF NOT EXISTS`), and Django's `billing.0001_initial` then tries to `CREATE TABLE stripe_webhook_events`, which fails because Django does not use `IF NOT EXISTS` for its initial migrations either.

Evidence log: `logs/phase-0b-clean-db-django-migrate.log`.

### 5.2 Ordering B: Django-first, then platform

- `DROP DATABASE + CREATE DATABASE nzila_phase0b_probe_v3` — fresh.
- `PGDATABASE=nzila_phase0b_probe_v3 python manage.py migrate` — succeeded. `public.organizations` present.
- `apply-platform-migrations.mjs --bootstrap-apply` — succeeded.
- `apply-platform-migrations.mjs` (incrementals) — **failed** at `0000_initial.sql` with:
  `[migrate:fail] failure applying 0000_initial.sql: relation "votes" already exists.`

Root cause: symmetric to §5.1. Django's `bargaining.0001_initial` creates `votes`; platform's `0000_initial.sql` also creates `votes` without an `IF NOT EXISTS` guard.

Evidence log: `logs/phase-0b-clean-db-django-first-platform-apply.log`.

### 5.3 Conclusion

Neither ordering composes on a governed clean DB. The two lineages have overlapping table ownership (§6) and neither uses `CREATE TABLE IF NOT EXISTS` for its initial migrations. The dev DB `nzila_automation` did not experience these failures only because its state accumulated over time through unrecorded `drizzle-kit push` operations, ad-hoc backfills, and interleaved migration runs — none of which are a governed initialization path.

**Therefore Phase 0B organization integrity cannot yet be proven on a governed clean DB.** The marker table correctly records `deferred-app-schema-absent`, and the FK/CHECK constraints exist only on the dev DB.

---

## 6. Two-lineage table-name overlap (structural finding)

Comparison of freshly-migrated Django-only DB (`probe_v3`) against freshly-migrated platform-only DB (`probe_v4`) yields:

| Metric | Value |
| --- | --- |
| Public tables after Django-only migrate | 549 |
| Public tables after platform-only migrate | 168 |
| Tables created by BOTH lineages (name collision) | 111 |

The 111 colliding names include `organizations`, `orgs`, `votes`, `stripe_webhook_events`, `auth_user`, `auth_group`, `django_migrations`, `kpi_configurations`, `analytics_metrics`, `mfa_configurations`, `sso_providers`, `chat_messages`, `chat_sessions`, `documents`, and many more. Full list: `logs/phase-0b-true-lineage-conflicts.log`.

Any future governed clean-DB path must resolve these name collisions before the same-UUID contract can be proven end-to-end. That resolution is not a Phase 0B deliverable.

---

## 7. Governance boundary (application resolver) — unchanged

The DB-level constraint is enforced by the FK + CHECK combination (dev DB only, until the two-lineage collisions are resolved). The application-level convention is enforced by requiring all crossings of the two-lineage boundary to go through:

`apps/union-eyes/lib/organizations/platform-tenant.ts`

Exports:

| Symbol | Contract |
| --- | --- |
| `resolvePlatformTenantId(organizationId, tx?)` | Returns `orgs.id` or `null`. Read-only. |
| `requirePlatformTenantId(organizationId, tx?)` | Returns `orgs.id` or throws `PlatformTenantMappingRequired`. |
| `provisionPlatformParticipant({ organizationId, legalName, jurisdiction, policyConfig? }, tx?)` | INSERT `orgs` row (ON CONFLICT DO NOTHING), UPDATE `organizations.platform_tenant_id` (guarded by `IS NULL`), returns `orgs.id`. Throws if `organizations` row does not exist. |
| `PlatformTenantMappingRequired` | Error class with `code = 'PLATFORM_TENANT_MAPPING_REQUIRED'` and `organizationId` property. |

Test coverage: `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` — the file has been user-edited since this session began; re-verification against the current file contents is a prerequisite for Commit 2 of the Phase 0B branch.

---

## 8. What migration 0038 explicitly does NOT do

Per Phase 0B constraint discipline:

- Does **not** alter historical migrations `0000–0033`.
- Does **not** alter healer migrations `0034–0037`.
- Does **not** alter the Django lineage in any way.
- Does **not** resolve the 111-table Django/platform name-collision (out of scope).
- Does **not** add rows to `organizations` (that lineage is application-owned).
- Does **not** back-populate the 40 unmapped `organizations` rows on dev.
- Does **not** issue any statement that would fail on a database missing `public.organizations`.

---

## 9. Verdict

**Organization model integrity: AMBER.**

Closed:
- Same-UUID contract (Outcome C) is DB-enforced on the dev DB.
- Substantive-outcome marker table `drizzle.__phase0b_outcomes` correctly distinguishes `applied` from `deferred-app-schema-absent`.
- False-success signal (previously `full-success` on a no-op run) is remediated.
- Sanctioned application resolver `platform-tenant.ts` exists and is transactional.

Not closed (see `phase-0b-remaining-work-register.md`):
- Governed clean-DB proof that both lineages compose (blocked by 111-table name overlap).
- Backfill of the 40 unmapped `organizations` rows (deliberately deferred — they are correct as-is under Outcome C, but the boundary must be re-verified after any future lineage consolidation).
- Removal of the dev DB's dependency on unrecorded `drizzle-kit push` for `public.organizations` (the current dev DB state is not reproducible from checked-in artifacts alone).

Organization model integrity is CLOSED on the dev DB and DEFERRED on any governed clean DB. Phase 0B is therefore AMBER, not GREEN.
