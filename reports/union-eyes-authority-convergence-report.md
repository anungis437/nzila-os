# Union Eyes — Storage Authority Convergence Report

Generated: 2026-09-09T22:57:47.681Z

## Classification counts

| Classification | Count |
| --- | --- |
| TENANT_RLS_REQUIRED | 260 |
| USER_RLS_REQUIRED | 13 |
| LATENT_UNREACHABLE | 294 |
| SYSTEM_ONLY | 22 |
| CONTAINED_NO_AUTHORITY | 137 |
| PARENT_OWNED_RLS_REQUIRED | 36 |
| GLOBAL_REFERENCE_DATA | 25 |
| MIXED_GLOBAL_TENANT_RLS_REQUIRED | 3 |
| SEPARATE_DATABASE_BOUNDARY | 2 |
| MULTI_PARTY_RLS_REQUIRED | 3 |

## Authority-model convergence (invocationAuthority / dbExecutionPrincipal / privileges)

- invocationAuthority = TBD: 0
- dbExecutionPrincipal = TBD: 0
- requiredRuntimePrivileges = TBD: 0
- requiredSystemPrivileges = TBD: 0
- Closed (non-NEEDS_REVIEW) entries still carrying TBD in ANY of the four fields: 0

## Invariant violations (must always be zero)

- SYSTEM_ONLY exposed to TENANT_RUNTIME/MIXED: 0
- LATENT_UNREACHABLE exposed to any DB role: 0
- CONTAINED_NO_AUTHORITY exposed to any DB role: 0

## 0108 original baseline (24-table protected set) — bidirectional consistency

- Original 0108-protected table count (source of truth: db/rls-0108-protected-tables.ts): 24
- Baseline tables NOT mentioned in the 0108 migration SQL itself (drift/typo check): 0
- Baseline tables with NO entry in this manifest at all (coverage gap check): 0

## RLS policy expansion required (NEW tables beyond the 0108 baseline, NOT evidence 0108 lost coverage)

- TENANT_RLS_REQUIRED tables beyond the 0108 baseline: 248
- PARENT_OWNED_RLS_REQUIRED tables beyond the 0108 baseline: 34
- USER_RLS_REQUIRED tables beyond the 0108 baseline: 13
- MIXED_GLOBAL_TENANT_RLS_REQUIRED tables beyond the 0108 baseline: 3
- MULTI_PARTY_RLS_REQUIRED tables beyond the 0108 baseline: 3
- Total additional policy-expansion tables: 301

## Blanket grant blocker

REMOVED (as of the current generated migration, db/migrations/20260910_rls_enforcement_expansion_round58.sql PART E): all three gate conditions are satisfied (NEEDS_REVIEW=0, closed-classification TBD authority=0, geometry blockers=0), so the enforcement compiler's own blanketGrantRemovalGateOk check evaluated true and the migration now revokes union_eyes_runtime/union_eyes_system's blanket GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public (0108), replacing it with the exact per-table GRANTs this manifest generates. Re-run scripts/rls-enforcement/generate-rls-enforcement-migration.ts if this repo's state has changed since this report was generated — the gate is recomputed fresh on every run and will re-widen automatically if a regression reintroduces any of the three blocking conditions.
