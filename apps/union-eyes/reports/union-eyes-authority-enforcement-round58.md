# Round 58 — Union Eyes Authority Enforcement (compiled report)

## SHA chain

| Stage | SHA |
|---|---|
| START | `2c8aa260f566d542276152934a507d57ee93e5ce` |
| 58A (Phase 0 — strike-fund provenance blocker) | `3110c8c4000d5140c543f8e94e086d60ffdd1b36` |
| 58B (Phase 1+ — RLS+GRANT compiler, first pass, 32 blockers) | `e431b2afdaf1447b4f15b7e803284145c189e615` |
| 58C (this round — close enforcement geometry) | pending commit |

PR #752 remains **NO_GO / DO NOT MERGE** regardless of this round's outcome. No staging/shared-environment mutation occurred in 58C — every proof ran against a disposable, local, non-shared PostgreSQL server.

## What 58C set out to do

Close 58B's 32 geometry blockers to 0, then complete the original Round 58 enforcement contract: independent policy oracle, blanket-grant removal, exact grants, deployment-DAG wiring, and a disposable-Postgres proof of the *entire* migration (not just the policy-generation slice).

## Section 1 — Authority manifest: frozen, unchanged classification posture (except one evidenced amendment)

- 700 entries, 0 `NEEDS_REVIEW`, 0 `TBD` privileges, 0 invariant violations — reconfirmed at the start of this round.
- **One classification amendment**, made under section 1's own explicit allowance ("reclassify only if enforcement work exposes a concrete contradiction... with explicit evidence and report amendment"):
  - `arbitration_decisions`: `TENANT_RLS_REQUIRED` → `GLOBAL_REFERENCE_DATA`. Round 11's manifest evidence claimed this table was "auto-filtered by the caller's own organizationId" via `crudRoutes({ orgScoped: true })`. That claim is factually wrong: the table has no `organizationId`/`org_id` column in either of its two duplicate declarations (`db/schema/domains/agreements/intelligence.ts` and `services/financial-service/src/db/schema.ts`), and `lib/api/crud-factory.ts`'s own `orgScoped` guard (`getColumn(table, 'organizationId')`) resolves to `undefined` for this table, so the filter never executes. The schema's own shape (`isPublic` default `true`, free-text party names, a "Public access" section) matches the manifest's own established precedent for this exact defect (wage-benchmark-rates, CPI data, `dataClassificationPolicy` — all previously reclassified/fixed under identical reasoning). `requiredRuntimePrivileges` was left unchanged to avoid any behavioral regression to the currently-functioning route. **Carried forward, not fixed:** the route's `writeRole: 'steward'` is an ordinary per-tenant role writing to now-explicitly-shared cross-tenant data — the same defect class Round 52 fixed for `dataClassificationPolicy`. This is an application-layer authorization decision, out of this round's DB-enforcement scope.

## Section 2 — The 32 blockers: closed to 0

Verified mechanically (`count = 32` before, `count = 0` after). Resolution breakdown:

- **5 tables** fixed via **generic geometry-parser fixes** (no per-table override needed): `org_configurations`, `dispatch_requests`, `dispatch_rules`, `stewards`, `compliance_alerts`. Root causes: (a) `org_id` wasn't recognized as an alias of `organization_id`; (b) two legacy top-level `db/schema-*.ts` files (outside `db/schema/**`) were never scanned at all.
- **1 table** resolved via **manifest reclassification**: `arbitration_decisions` (see Section 1).
- **1 table** resolved by **cascade**: `dispatch_assignments` — once `dispatch_requests` gained resolved geometry, its own parent-chain resolution succeeded automatically.
- **25 tables** resolved via a new, source-controlled **`ENFORCEMENT_GEOMETRY_OVERRIDES` registry** (`scripts/rls-enforcement/enforcement-geometry-overrides.ts`) — explicit, evidenced, provenance-cited entries describing *how* an already-approved authority disposition is physically expressed in PostgreSQL. This registry never makes a privilege or classification decision; every entry cites the exact schema file(s) read this round. Kinds used: `EXPLICIT_DIRECT_COLUMN_OVERRIDE` (2), `USER_DIRECT_COLUMN_OVERRIDE` (1), `TENANT_VIA_PARENT` (6), `PARENT` (9), `PARENT_VIA_USER` (4), `MULTI_PARTY` (1), `SHARED_LIBRARY_ROOT` (1), `SHARED_LIBRARY_CHILD` (1).
- A compile-time **contradiction check** rejects any override whose kind is incompatible with the manifest's own classification for that table — this check caught a real mistake during this round's own development (an initial `signature_audit_trail` override was miscategorized as `PARENT` when the manifest classifies it `TENANT_RLS_REQUIRED`; fixed to `TENANT_VIA_PARENT`).

Two noteworthy findings within the override work:
- `shared_clause_library`/`clause_library_tags`: real shape is `source_organization_id` + `sharing_level` (private/federation/congress/public) + `shared_with_org_ids` (array) — not a generic two-column multi-party table. A dedicated `ue_create_shared_library_rls_policy` + `ue_create_shared_library_child_rls_policy` pair was built. Federation/congress sharing levels conservatively resolve to no expanded visibility (no federation/congress-membership table exists in the schema) — a safe, under-permissive default, not a broadening.
- `workbooks`: `USER_RLS_REQUIRED` but no `user_id` column — real ownership lives in `claimed_by_user_id` (an anonymous pre-claim / claimed post-claim lifecycle). A new `ue_create_parent_owned_via_user_rls_policy_v2` helper cascades this to its 4 child tables.

## Section 3 — Compiler output

- **322 policies generated** (up from 291), **700 GRANT blocks** (unchanged — Part C already covered all manifest entries), **0 blockers**.
- **3 new SQL helper functions**: `ue_create_parent_owned_via_user_rls_policy_v2`, `ue_create_shared_library_rls_policy`, `ue_create_shared_library_child_rls_policy`.
- **New PART D**: a targeted, idempotent cleanup for `ai_budgets` — Round 35 found it had RLS enabled with a stale `CREATE POLICY` referencing a nonexistent `auth.user_id()` function. PART D drops any such policy by inspecting its definition text (not a guessed name) and leaves the table `FORCE ROW LEVEL SECURITY`-enabled with zero policies, consistent with its `CONTAINED_NO_AUTHORITY` classification (zero required privileges either side).
- A `RLS_ENFORCEMENT_DEPLOYABLE=1` mode (new `rls:generate-enforcement:deployable` script) makes the generator **refuse (exit 1)** to treat its own output as a deployable artifact while `blockers.length > 0` — ordinary diagnostic runs are unaffected.

## Section 4 — Re-validation (everything re-proven against the new migration)

All of 58B's proofs were re-run against the regenerated 322-policy migration, plus new proofs added this round:

| Proof | Result |
|---|---|
| Behavioral proof (9 tests, 4 original helper shapes) | 9/9 pass, real multi-role disposable PostgreSQL |
| Policy syntax dry-run (PART A+B, full scale) | 700 stub tables, 1401 `pg_policies` rows, 0 SQL errors |
| ACL oracle (PART C, all 700 entries) | 0 missing, 0 extra |
| **New: independent policy oracle** | 322 tables checked, 0 missing, 0 extra — expected state computed from manifest+overrides only, never by parsing generated SQL |
| **New: full-migration transactional proof** | Entire migration (PART A+B+C+D) applies inside one transaction (1401 policies, 989 grants), rolls back cleanly (0 policies), re-applies identically |
| **New: deployment DAG contract test** | 5/5 pass — static YAML shape check (no dispatch) |
| Full `apps/union-eyes` vitest suite | 1225 files / 17255 tests passed, 1 file / 9 tests skipped (expected — disposable-Postgres-gated) |
| Manifest invariant tests | 21/21 passed |
| Typecheck / lint | clean (2 pre-existing-style `any` warnings in the new contract test, 0 errors) |

**Not run this round** (time-budget decision, documented honestly): full Django suite re-run (no Python touched; pre-existing unrelated `core` app `ImportError` carried forward), `pnpm audit`, Trivy, Snyk, red-team suite, `inventory:generate`/`:check`.

## Section 5 — The blocker that keeps Round 58 at PARTIAL

Cross-checking **every** `pgTable(...)` declaration in the entire repository (not just `db/schema/**`) against the 700-entry manifest surfaced a real, concrete, previously-undiscovered gap:

**111 physical tables have a genuine Drizzle table declaration but no entry anywhere in the manifest.** Sample: `members`, `tenants`, `strike_funds`, `budgets`, `vendors`, `encryption_keys`, `pii_access_log`, `dues_rules`, `tax_slips`, `pension_trustee_boards`, plus roughly 15 `v_*`-prefixed names that are very likely SQL views (a distinct, separate gap — RLS/FORCE RLS does not reach views at all). Spot-checking several of these confirms they are declared **only** in `services/financial-service`'s own separate schema files, not in `db/schema/**`. The manifest's own pre-existing evidence (for `members`, in `analytics-ai.ts`) already documents that `financial-service` targets the *same* production database — but does not establish whether that service authenticates as `union_eyes_runtime`/`union_eyes_system` or its own separate role.

Given this, revoking 0108's blanket `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public` now — as the mandate's sections 42/44 call for once blockers reach 0 — would risk silently removing all runtime/system access to those 111 tables the moment this migration is ever applied to a real environment. This migration is not applied anywhere in this round, but it is intended as the artifact Round 59 eventually applies for real; authoring a blanket-grant removal without resolving this first would be reckless. **The blanket grant, and its accompanying blanket sequence grant, are therefore deliberately left untouched this round** — the generated migration's own header now documents this exact finding and reasoning.

(Section 45 — default privileges for future tables — is separately confirmed already satisfied: 0108 itself already `REVOKE`s any sticky `ALTER DEFAULT PRIVILEGES` grant and never re-establishes one. Nothing to do there.)

**Required follow-up before the blanket grant can be safely narrowed:**
1. Determine `services/financial-service`'s actual database connection/role.
2. If it shares `union_eyes_runtime`/`union_eyes_system`, extend the manifest to cover all ~111 tables (or formally carve `financial-service` out as a `SEPARATE_DATABASE_BOUNDARY`-style exception for the tables it exclusively owns).
3. Separately audit the ~15 `v_*` view names — views need their own access-control story regardless of the outcome above.

## Section 6 — Deployment DAG

A new `apply-authority-enforcement-migration` job was added to `.github/workflows/deploy-union-eyes.yml`, mirroring the existing `apply-rls-foundation-migration` (0108) job's exact pattern: gated on `workflow_dispatch` + an explicit `apply_authority_enforcement_migration` boolean input, **never** part of the ordinary push-triggered deploy path. It was deliberately **not** promoted to a mandatory pre-deploy gate (unlike `apply-icra-capability-migration`) because of the Section 5 finding — Round 59 owns that decision once the 111-table gap is resolved. A static contract test (`scripts/rls-enforcement/__tests__/deployment-dag-contract.test.ts`, 5/5 passing) proves the job exists, is correctly gated, and is not yet a hard dependency of any other job. Nothing was dispatched; no real environment was touched.

## Section 7 — Round 59 tooling (built, smoke-tested, not yet exercised for real)

- `scripts/rls-enforcement/preflight-round59.ts` — read-only; checks role existence/attributes, 0108 baseline presence, manifest health, and 0 geometry blockers, all before any real apply. Smoke-tested against the disposable server (correctly FAILed on "0108 not yet applied here," proving both pass and fail paths work).
- `scripts/rls-enforcement/post-apply-verifier.ts` — read-only; checks RLS/FORCE status, policy inventory, and exact `has_table_privilege` grants against **real** tables in a target environment (not synthetic stubs), skipping (not failing) tables that don't exist yet in that environment. Smoke-tested against the disposable server (322 skipped, 0 missing/extra — correct, since none of those tables exist there).

Neither tool has been run against any actual staging/production environment — none exists to test against yet; that is explicitly Round 59's job.

## Verdict

```
ROUND58C = PARTIAL
```

The 32-blocker core objective is fully closed and extensively proven (behavioral + syntax + ACL + independent-policy oracles + full-migration transactional rollback proof, all green). Deployment-DAG wiring exists, is safe (non-gating, no dispatch), and is proven by a passing contract test. Round 58 cannot reach `CLOSED` because completing it now requires resolving a newly-discovered, concretely evidenced gap — 111 physical tables absent from the authority manifest — before the blanket grant this whole effort exists to eventually remove can be revoked without risking a real production regression. This is reported as an honest, exact blocker rather than worked around or hidden, per this program's own standing instruction that PARTIAL-with-documented-blockers is an explicitly sanctioned outcome.
