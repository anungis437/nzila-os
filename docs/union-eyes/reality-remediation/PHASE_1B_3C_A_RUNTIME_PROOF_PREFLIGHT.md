# Phase 1B.3C-A — disposable runtime preflight

## Gate and boundary

`PHASE_1B_3C_A_GATE = FAIL`. No executable tenant-isolation items.

Exact accepted-schema replay and concrete fixture/client/pool contracts are not established.
This is a failed runtime-environment preflight, not reopening B3B or permission to repair migrations.
The two isolated clusters were destroyed after capture. No production, staging, shared database,
application runtime, external authentication, cross-org read, or mutating proof test was touched.

## Existing harness and lifecycle

Reuses the Docker/Postgres lifecycle pattern from
[`platform-authz-acceptance.mjs`](../../../scripts/platform-authz-acceptance.mjs).
That harness's authorization-only bootstrap is not an adequate UE schema, and the UE backend
compose file is a persistent-service template. No existing database/container/volume was reused.

Prerequisites: local Docker Engine; local `postgres:16-alpine` image; Node/pnpm dependencies
from the lockfile; exact frozen inputs and migration hashes.

```powershell
node scripts\ue\prepare-runtime-tenant-isolation-proof.mjs --run
```

This creates a no-network/no-port tmpfs cluster, creates separate databases for the two frozen
logical scopes, replays the exact 23-file manifest until the first error in each scope, captures
read-only catalog facts, probes transaction-local context transport, destroys the cluster,
repeats from a clean second cluster, compares replay/catalog evidence, and verifies teardown.
Fixture seeding is blocked: no accepted per-object fixture/reset contracts. It is not silently skipped
as a successful seed step. The command writes failure evidence and exits 1 for the failed gate.
It never accepts an external connection string. Cleanup acts only on the exact run-labelled containers.

Reset/replay comparison: **PASS**. Teardown/absence: **PASS**.
Image: `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`.

### Replay blockers

- **union-eyes**: `apps/union-eyes/db/migrations-cache/0006_external_specialist_runtime_privilege_closure.sql`

```text
psql:<stdin>:53: NOTICE:  policy "ue_auth_users_self_select" for relation "user_management.users" does not exist, skipping
psql:<stdin>:58: NOTICE:  policy "ue_auth_organization_users_self_select" for relation "user_management.organization_users" does not exist, skipping
psql:<stdin>:107: ERROR:  relation "organizations" does not exist
```

The failed file may have committed earlier statements; the partial catalog is explicitly retained.
Remaining files in that scope were not applied. No missing relation, type, role, extension,
historical bootstrap or predicate was fabricated to force setup to succeed.

## Catalog baseline

| Measure                         | Count |
| ------------------------------- | ----: |
| Frozen relational objects       |   612 |
| Local matched objects           |    14 |
| Missing expected objects        |   598 |
| Extra local relevant objects    |    11 |
| Frozen active policy identities | 1,490 |
| Local policy identities         |     2 |
| Matched policy identities       |     2 |

Exact SQL, per-scope raw snapshots, owners, roles, RLS flags, policies, table/schema/default
ACLs, function owners/security/search-path/execute roles and every missing/extra identity
are in the [JSON artifact](./PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT.json).
Catalog query writes: **0**. Catalog DDL after setup: **0**.
Catalog evidence applies only to this incomplete disposable schema, never to deployed state.

## 640 catalog parent items

- `LOCAL_CATALOG_MISMATCH`: **603**
- `RESOLVED_BY_LOCAL_CATALOG`: **9**
- `LOCAL_CATALOG_STILL_UNRESOLVED`: **28**

Sum: **640**, consumed exactly once. Missing objects are local lineage mismatches, not new static
defects or proof of deployed absence. Grants/native role expectations remain unresolved where
the frozen intent is not concrete or schema replay failed.

## Fixture/client/context/pool readiness

- Six deterministic org/user IDs and exclusive membership plan are recorded, **not seeded**.
- Fixtured objects: **0**. All **612** objects have explicit fixture blockers.
- Installed JS constructors instantiated offline with **0** connection attempts: **7** client
  records are **PARTIAL**, constructor-only; the Django client is **NO**, no harness adapter.
  No application client module, local database connection or ordinary-path credential is proven.
- All **9** context primitives retain their frozen value contracts. PostgreSQL `set_config(...,true)`
  and rollback/clear were observed in a bootstrap transport-only session; no application wrapper ran.
- All **8** application pool items remain unprepared. A psql session is not a connection pool.
- Test-only roles are bounded NOLOGIN/NOSUPERUSER/NOBYPASSRLS roles. No broad grants or fixture bypass.

## 3,124-item reconciliation

- `READY_FOR_RUNTIME_PROOF`: **0**
- `BLOCKED_BY_KNOWN_STATIC_DEFECT`: **663**
- `BLOCKED_BY_REQUIREMENT_DECISION`: **1007**
- `BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION`: **814**
- `CATALOG_PROOF_COMPLETE_LOCAL_ENVIRONMENT`: **9**
- `CATALOG_MISMATCH_LOCAL_ENVIRONMENT`: **603**
- `CATALOG_UNRESOLVED_LOCAL_ENVIRONMENT`: **28**

Ready runtime denominator: **0**. Remaining command blockers: **2,484** =
**663** static-defect + **1,007** requirement-decision + **814** fixture/environment.
All 159 missing-RLS facts and two nullable-org mismatches remain frozen blockers.
Catalog items do not become command tests.

```text
PHASE_1B_3C_A_GATE = FAIL
RUNTIME_PROOF_ENVIRONMENT = NOT_READY_FAITHFUL_SCHEMA_NOT_ESTABLISHED
PHASE_1B_3C = NOT_YET_COMPLETE
PHASE_1B_3C_B = NOT_AUTHORIZED_NO_EXECUTABLE_ITEMS
PHASE_1B_3C_B_STARTED = NO
TENANT_ISOLATION_RUNTIME_PROVEN = NO
RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO
PRIVILEGED_DB_RUNTIME_BEHAVIOR_PROVEN = NO
PRODUCT_READY = NO
```

## Validation

```powershell
node --check scripts\ue\prepare-runtime-tenant-isolation-proof.mjs
node scripts\ue\prepare-runtime-tenant-isolation-proof.mjs --self-test
node scripts\ue\prepare-runtime-tenant-isolation-proof.mjs
node scripts\ue\prepare-runtime-tenant-isolation-proof.mjs --check
pnpm exec prettier --check scripts\ue\prepare-runtime-tenant-isolation-proof.mjs docs\union-eyes\reality-remediation\PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT.json docs\union-eyes\reality-remediation\PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT.md
pnpm validate:docs
```

Default generation and `--check` only reconcile saved capture; they never reconnect to a database
or regenerate B3B. Self-tests validate exact accounting and read-only query contracts.
Passing artifact validation is not a passing C-A runtime gate.
