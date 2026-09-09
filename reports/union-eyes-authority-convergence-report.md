# Union Eyes — Storage Authority Convergence Report

Generated: 2026-09-09T17:36:08.490Z

## Classification counts

| Classification | Count |
| --- | --- |
| TENANT_RLS_REQUIRED | 261 |
| USER_RLS_REQUIRED | 13 |
| LATENT_UNREACHABLE | 199 |
| SYSTEM_ONLY | 22 |
| CONTAINED_NO_AUTHORITY | 137 |
| PARENT_OWNED_RLS_REQUIRED | 36 |
| GLOBAL_REFERENCE_DATA | 24 |
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

- TENANT_RLS_REQUIRED tables beyond the 0108 baseline: 249
- PARENT_OWNED_RLS_REQUIRED tables beyond the 0108 baseline: 34
- USER_RLS_REQUIRED tables beyond the 0108 baseline: 13
- MIXED_GLOBAL_TENANT_RLS_REQUIRED tables beyond the 0108 baseline: 3
- MULTI_PARTY_RLS_REQUIRED tables beyond the 0108 baseline: 3
- Total additional policy-expansion tables: 302

## Blanket grant blocker

union_eyes_runtime still holds GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public (0108). REVOKE + explicit per-table GRANT generation from this manifest cannot proceed while NEEDS_REVIEW > 0, any closed-classification entry has TBD authority/privileges, or rlsPolicyExpansionRequired's tables lack an actual migration adding their RLS policy.
