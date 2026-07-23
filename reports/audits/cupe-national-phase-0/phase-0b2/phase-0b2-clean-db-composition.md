# Phase 0B.2 — §14 Clean-DB Composition Proof

**Status.** ✅ PASS on `fix/union-eyes-phase0b-clean`.
**Method.** Ordered replay of every checked-in DDL artifact against a
disposable PostgreSQL 17 database (`nzila_automation` server on
`localhost:5433`), driven by [`tooling/checks/phase0b2-compose.ps1`](../../../../tooling/checks/phase0b2-compose.ps1).
No cached state was reused. The full transcript is preserved at
[`phase-0b2-compose-20260723095012.log`](logs/phase-0b2-compose-20260723095012.log).

## 1. Replay order and outcomes

| # | Step | Artifact | Outcome |
| --- | --- | --- | --- |
| 1 | Platform bootstrap | `packages/db/bootstrap/0000_platform_schema_prerequisites.sql` | 6 tables created (`orgs`, extensions, enums). |
| 2 | Drizzle 0000..0037 (baseline lineage) | 38 files, applied in name order | 32 files applied cleanly; 6 files partial-aborted **as expected** per `packages/db/drizzle/.known-partial-failures.json`; every partial-abort was healed by its paired `heal_*` migration later in the chain. |
| 3 | Django `auth_core` 0001..0003 | SQL projection (Django not installed in clean worktree) | Projected `public.organizations` with the `name` / `slug` columns the model requires, then moved it to schema `union_eyes` (matching the 0003 `SeparateDatabaseAndState` intent). |
| 4 | Drizzle 0038 (cross-schema contract) | `packages/db/drizzle/0038_organization_cross_schema_contract.sql` | Applied cleanly. Precondition guard ("schema union_eyes not present") passed because Step 3 created the schema. |
| 5 | Django `auth_core/0004` + `billing/0002` | Empty database_ops (state-only per `SeparateDatabaseAndState`) | Nothing to apply at SQL level — the shared platform tables (`organization_members`, `stripe_webhook_events`) are already declared and created via the platform Drizzle chain, so state-only adoption is a no-op at the DB layer. |
| 6 | Drizzle 0039 (UE cognition text-id promotion) | `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql` | Applied cleanly. All 6 `ue_*` tables live in schema `union_eyes` with `id text`. |

## 2. Allowlisted mid-file aborts (Step 2)

These match `packages/db/drizzle/.known-partial-failures.json` verbatim
and each names its paired healer:

| Broken migration | Reason | Healer |
| --- | --- | --- |
| `0010_pilot_alerting_hardening.sql` | `ADD CONSTRAINT IF NOT EXISTS` is not valid PG syntax → parse-time abort → whole file rolled back. | `0037_heal_pilot_alerting_hardening.sql` |
| `0013_orchestrator_runtime_hardening.sql` | `DROP INDEX` on a name that is actually a UNIQUE CONSTRAINT → 2BP01 rollback. | `0034_heal_orchestrator_runtime_hardening.sql` |
| `0017_trustcore_law25.sql` | `CREATE TYPE IF NOT EXISTS` is not valid PG syntax. | `0035_heal_trustcore_law25_chain.sql` |
| `0019_trustcore_policies.sql` | Cascade from 0017 — parent table `trustcore_privacy_programs` never created. | `0035_heal_trustcore_law25_chain.sql` |
| `0025_trustcore_privacy_programs_org_name.sql` | Cascade from 0017. | `0035_heal_trustcore_law25_chain.sql` |
| `0032_audit_events_canonical_hash.sql` | `audit_events.org_id` was only ever added out-of-band via `drizzle-kit push`. | `0036_heal_audit_events_canonical_hash.sql` |

The Phase 0A `0033_fix_pilot_alerts_rule_fk.sql` is a no-op on a fully
healed DB (its DO/IF NOT EXISTS guard makes it safe) and therefore did
not abort here.

## 3. Post-replay verification (Option D contract enforced at DB level)

Verification queries executed as the final step of the driver
([excerpt from log](logs/phase-0b2-compose-20260723095012.log)):

```
 schema:public
 schema:union_eyes

 ue.organizations.platform_tenant_id.type:uuid

 fk:organizations_platform_tenant_id_fkey

 check:organizations_platform_tenant_id_equals_id_check

 ue_table:ue_case_risk_snapshots.id:text
 ue_table:ue_cognition_audits.id:text
 ue_table:ue_engagement_snapshots.id:text
 ue_table:ue_kpi_snapshots.id:text
 ue_table:ue_precedent_matches.id:text
 ue_table:ue_workload_snapshots.id:text

 public.orgs.rowcount:0
```

Interpretation:

- ✅ Both schemas `public` and `union_eyes` coexist.
- ✅ `union_eyes.organizations.platform_tenant_id` is of type `uuid`
  (the same-UUID contract from §10).
- ✅ Cross-schema FK `union_eyes.organizations.platform_tenant_id →
  public.orgs.id` exists.
- ✅ CHECK constraint `platform_tenant_id = id` exists — meaning DB
  itself rejects any attempt to point a Union Eyes org at a different
  platform tenant.
- ✅ All 6 `ue_*` cognition tables are in schema `union_eyes` with
  `id text` after 0039's UUID→TEXT promotion.
- ✅ `public.orgs` exists (0 rows on a fresh disposable DB, as expected).

## 4. What this proves and what it does NOT prove

### Proves

1. The ordering `bootstrap → Drizzle 0000..0037 → Django 0001..0003 →
   Drizzle 0038 → Django 0004 + billing/0002 → Drizzle 0039` composes
   on an empty database with **zero unresolvable errors**.
2. Migration 0038's precondition guard (`schema union_eyes must exist`)
   correctly refuses to run before the Django auth_core/0003 SET SCHEMA
   step — verified inadvertently by the initial run where 0038 aborted
   with the exact expected message.
3. The FK + CHECK combination from §10 is enforced by the DB, not just
   by application code — a mis-set `platform_tenant_id` would be
   rejected at INSERT/UPDATE time by PostgreSQL itself.
4. Migration 0039's `id text` promotion for the 6 UE cognition tables
   succeeds on top of the freshly composed schema, matching the
   Drizzle schema declaration in `packages/ue-cognition/src/schema.ts`.
5. The known-partial-failures allowlist accurately describes the
   clean-DB behavior of the 6 legacy migrations — no unlisted mid-file
   failure occurred, and every listed one had its stated healer
   restore the intended state.

### Does NOT prove

- Django `manage.py migrate` produces exactly the projected SQL — Step 3
  is a hand projection of the model shape sufficient for §14. A full
  end-to-end Django replay is a CI-only exercise (Python + Django are
  not installed in this clean worktree by design).
- Route-level integration of the resolver (that is Phase 0C).
- The resolver's TypeScript unit tests run — vitest is not installed in
  this clean worktree. §16 will exercise the test suite in an
  environment where dev dependencies are available.

## 5. Driver artifact

The full driver — [`tooling/checks/phase0b2-compose.ps1`](../../../../tooling/checks/phase0b2-compose.ps1) —
reads the allowlist directly from
`packages/db/drizzle/.known-partial-failures.json` so it always tracks
what the platform runner tolerates. It emits a fully-timestamped
transcript per run under `reports/audits/cupe-national-phase-0/phase-0b2/logs/`.

## 6. Reproduction command

```powershell
# From repo root (clean worktree), with native PG 17 on localhost:5433
$env:PGPASSWORD = 'nzila_dev'
$env:PHASE0B2_DB = "phase0b2_compose_$(Get-Date -Format yyyyMMddHHmmss)"
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U nzila -d postgres -p 5433 -h localhost `
    -c "CREATE DATABASE $env:PHASE0B2_DB"
pwsh -NoProfile -File tooling/checks/phase0b2-compose.ps1 `
    -DatabaseName $env:PHASE0B2_DB
```

Transcript for this run:
[`reports/audits/cupe-national-phase-0/phase-0b2/logs/phase-0b2-compose-20260723095012.log`](logs/phase-0b2-compose-20260723095012.log).
