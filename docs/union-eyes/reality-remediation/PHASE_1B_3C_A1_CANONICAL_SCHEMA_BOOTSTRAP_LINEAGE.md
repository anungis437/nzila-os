# Phase 1B.3C-A1 — canonical schema bootstrap lineage

## Gate

`PHASE_1B_3C_A1_GATE = SOURCE_CEILING`.
Canonical operational ownership is established; a complete faithful disposable bootstrap is **not**.
No new database replay was authorized or executed. A2 and B3C-B remain **NOT_AUTHORIZED**.

## Organizations origin

Django is the canonical operational owner under
[`orm-authority-governance.md`](../../categories/platform-and-operations/architecture/orm-governance/orm-authority-governance.md).
[`auth_core/migrations/0001_initial.py`](../../../apps/union-eyes/backend/auth_core/migrations/0001_initial.py)
creates model `Organizations` with `db_table = organizations`.
The local environment strategy specifies Django migration before scoped bootstrap.
This identifies the creation source, **not** a proved complete PostgreSQL prerequisite sequence:
Django PG\* target binding, the scoped DATABASE_URL target, backend transitive migrations,
column/type compatibility and active ordering are not assumed equivalent.

- `apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql` — SQL_MIGRATION; **HISTORICAL_FROZEN_LINEAGE_ONLY**; creates: YES; scope: union-eyes.
- `apps/union-eyes/db/migrations/0002_true_selene.sql` — SQL_MIGRATION; **HISTORICAL_FROZEN_LINEAGE_ONLY**; creates: YES; scope: union-eyes.
- `apps/union-eyes/backend/auth_core/migrations/0001_initial.py` — DJANGO_MIGRATION; **ACTIVE_BACKEND_PREREQUISITE**; creates: YES; scope: union-eyes.
- `apps/union-eyes/db/schema-organizations.ts` — DRIZZLE_SCHEMA; **SCHEMA_DECLARATION_WITHOUT_EXECUTION_PATH**; creates: NO; scope: union-eyes.
- `apps/union-eyes/services/financial-service/drizzle/schema.ts` — DRIZZLE_SCHEMA; **SCHEMA_DECLARATION_WITHOUT_EXECUTION_PATH**; creates: NO; scope: financial-service.
- `apps/union-eyes/services/financial-service/src/db/schema.ts` — DRIZZLE_SCHEMA; **SCHEMA_DECLARATION_WITHOUT_EXECUTION_PATH**; creates: NO; scope: financial-service.
- `apps/union-eyes/db/__tests__/automation-rules-ownership-migration-postgres.test.ts` — OTHER_EXPLICIT; **SOURCE_CEILING_AUTHORITY**; creates: YES; scope: union-eyes.
- `apps/union-eyes/db/__tests__/automation-rules-ownership-migration-postgres.test.ts` — OTHER_EXPLICIT; **SOURCE_CEILING_AUTHORITY**; creates: YES; scope: union-eyes.
- `apps/union-eyes/db/__tests__/automation-rules-ownership-migration-postgres.test.ts` — OTHER_EXPLICIT; **SOURCE_CEILING_AUTHORITY**; creates: YES; scope: union-eyes.

Historical `0002_true_selene.sql`, audit snapshots and broad Drizzle declarations are not promoted
to active predecessors. No table was created manually and `0006` was not edited.

## Complete bounded prerequisite graph

The [JSON graph](./PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json)
contains all 23 frozen migration nodes in their original order, identity-scoped prerequisite
records, consumer/range evidence, creation candidates, authority records and explicit residual
dynamic/conditional dependency ceilings.

| Measure                                                                   | Count |
| ------------------------------------------------------------------------- | ----: |
| Frozen migrations                                                         |    23 |
| Inventoried prerequisite identities, including opaque binding obligations |   945 |
| Satisfied only within frozen sequence                                     |   134 |
| PostgreSQL-core-only identities                                           |     4 |
| Requiring canonical pre-consumer bootstrap/binding                        |   807 |
| Active authority conflicts                                                |     0 |
| Prerequisite source ceilings                                              |   807 |
| Unaccounted inventoried/opaque obligations                                |     0 |

These are source inventory counts, not a claim that every generated runtime identity is known.
Every opaque EXECUTE/grant-scope site is represented as a binding prerequisite and explicit
ceiling. Accepted B3A literal helper expansions provide target/column references without
re-analysis of policy correctness. Earlier frozen declarations do not prove migration success
or runtime presence. Full dynamic/transitive bootstrap closure remains unproven.

## Bootstrap authority

### CANONICAL_ACTIVE_BOOTSTRAP: `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`

- Scope: `union-eyes`.
- Order: extensions -> optional snapshot/baseline -> scoped journal -> platform journal; never default historical replay
- Limits: Snapshot identity is operator-selected, not a repository-pinned schema input. Snapshot path baselines all scoped hashes instead of executing all 23 frozen files. QA baseline source is referenced outside this mission source allowlist; not promoted to canonical prerequisite. Scoped-before-platform ordering cannot assume later platform relations exist for 0014.

### ACTIVE_BACKEND_PREREQUISITE: `apps/union-eyes/backend/manage.py migrate --noinput`

- Scope: `union-eyes`.
- Order: Django dependency ordering; governance places local Django before db:bootstrap.
- Limits: Canonical owner/creation source established; complete physical binding and transitive prerequisite/type/column compatibility remain source ceilings.

### CANONICAL_ACTIVE_BOOTSTRAP: `tooling/scripts/restore-union-eyes-snapshot.mjs`

- Scope: `union-eyes`.
- Order: Restore precedes scoped application/baselining
- Limits: Restore is implemented in source despite older reference documentation saying interface-only. No pinned local snapshot bytes, migration level or required-column contract established.

### SOURCE_CEILING_AUTHORITY: `tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs`

- Scope: `union-eyes`.
- Order: Django -> generated foundation shims -> reordered historical creation -> platform -> scoped
- Limits: Generates enum/unique-key shims, strips transaction boundaries, suppresses missing relation/type/column errors. Changes SQL execution and revives historical creation; disqualified for this mission, not run.

### HISTORICAL_FROZEN_LINEAGE_ONLY: `tooling/scripts/run-union-eyes-drizzle-migrate.mjs`

- Scope: `union-eyes`.
- Order: Historical journal with fault-tolerant SQL rewrites
- Limits: Presence of a legacy executable is not active replay authority; governed freeze controls.

### CANONICAL_SHARED_PLATFORM_PREREQUISITE: `pnpm --filter @nzila/db db:migrate`

- Scope: `shared-platform`.
- Order: Drizzle package config; no source-backed ordering before UE 0006
- Limits: Shared dependency names do not establish one physical database or canonical UE prerequisite sequence.

### DOCUMENTATION_ONLY: `tsx scripts/provision-runtime-db-roles.ts`

- Scope: `union-eyes`.
- Order: No accepted prerequisite ordering before frozen policy/grant consumers
- Limits: Role attributes and privilege/ownership compatibility remain prerequisite authority ceilings.

The canonical snapshot restore implementation exists, but its accepted payload identity and
migration level are operator inputs, not pinned repository prerequisite bytes. Snapshot
baselining skips scoped DDL, so it is not proof of exact execution of the frozen 23-file set.
The old interface-only reference documentation is not substituted for actual source behavior.
The cleanroom script's shims, transaction stripping and tolerance of missing objects disqualify
it from faithful unmodified replay in this mission. No historical override was invoked.

The financial-service frozen `0000_lucky_mole_man.sql` is entirely commented introspection
SQL. Its earlier successful execution was a **no-op**, not materialization of the **131**
financial-scope source objects. The scope-materialization obligation is explicitly recorded;
no commented DDL was uncommented, synthesized or merged into the UE database.

## Missing authority/source required

- Pin an accepted local canonical Django/bootstrap input and dependency plan with same-physical-database binding to UE scoped SQL.
- Establish every required column/type/function/role and dynamic target set before frozen consumers, including later platform objects consumed by scoped 0014.
- Resolve active creation conflicts and snapshot/scoped baselining versus the requirement to execute all 23 exact frozen files.
- Supply an authorized complete prerequisite sequence; neither schema declarations nor tolerant historical/shim cleanroom output may substitute.

Canonical sequence: **not established**. No generated DDL, scope merging, business-policy
decision, repair or replay has been used to close these ceilings.

## Partial C-A catalog quarantine

`CATALOG_SNAPSHOT_AUTHORITY = PREFLIGHT_PARTIAL_SCHEMA_OBSERVATION_ONLY`.

All **640** observations remain unchanged: **9 locally resolved / 603 local mismatches /
28 unresolved**. None resolves a B3B ceiling or supplies production evidence. Frozen first
failure remains `0006_external_specialist_runtime_privilege_closure.sql`:
`relation "organizations" does not exist`.

## State and validation

```text
PHASE_1B_3C_A1_GATE = SOURCE_CEILING
PHASE_1B_3C_A1 = SOURCE_CEILING_ACCEPTED
CANONICAL_DISPOSABLE_SCHEMA_BOOTSTRAP = NOT_ESTABLISHED
PHASE_1B_3C_A2 = NOT_AUTHORIZED
PHASE_1B_3C_B = NOT_AUTHORIZED
READY_FOR_RUNTIME_PROOF = 0
TENANT_ISOLATION_RUNTIME_PROVEN = NO
PRODUCT_READY = NO
```

Frozen predecessors, all 23 migration hashes, 612 objects, 1,490 policies, 3,124 packet items,
159 missing-RLS objects, two semantic mismatches and earlier carry-forwards remain unchanged.
No runtime DB/auth, production/staging/shared access, tenant test or later phase work occurred.

```powershell
node --check scripts\ue\reconcile-runtime-schema-bootstrap-lineage.mjs
node scripts\ue\reconcile-runtime-schema-bootstrap-lineage.mjs --self-test
node scripts\ue\reconcile-runtime-schema-bootstrap-lineage.mjs
node scripts\ue\reconcile-runtime-schema-bootstrap-lineage.mjs --check
pnpm exec prettier --check scripts\ue\reconcile-runtime-schema-bootstrap-lineage.mjs docs\union-eyes\reality-remediation\PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json docs\union-eyes\reality-remediation\PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.md
pnpm validate:docs
```
