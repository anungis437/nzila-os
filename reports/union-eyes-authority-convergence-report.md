# Union Eyes — Storage Authority Convergence Report

Generated: 2026-09-04T19:18:34.042Z

## Classification counts

| Classification | Count |
| --- | --- |
| NEEDS_REVIEW | 320 |
| LATENT_UNREACHABLE | 189 |
| SYSTEM_ONLY | 17 |
| TENANT_RLS_REQUIRED | 136 |
| PARENT_OWNED_RLS_REQUIRED | 11 |
| GLOBAL_REFERENCE_DATA | 3 |
| MIXED_GLOBAL_TENANT_RLS_REQUIRED | 1 |
| CONTAINED_NO_AUTHORITY | 19 |
| SEPARATE_DATABASE_BOUNDARY | 2 |
| MULTI_PARTY_RLS_REQUIRED | 1 |
| USER_RLS_REQUIRED | 1 |

## Authority-model convergence (invocationAuthority / dbExecutionPrincipal / privileges)

- invocationAuthority = TBD: 320
- dbExecutionPrincipal = TBD: 320
- requiredRuntimePrivileges = TBD: 320
- requiredSystemPrivileges = TBD: 320
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

- TENANT_RLS_REQUIRED tables beyond the 0108 baseline: 124
- PARENT_OWNED_RLS_REQUIRED tables beyond the 0108 baseline: 9
- USER_RLS_REQUIRED tables beyond the 0108 baseline: 1
- MIXED_GLOBAL_TENANT_RLS_REQUIRED tables beyond the 0108 baseline: 1
- MULTI_PARTY_RLS_REQUIRED tables beyond the 0108 baseline: 1
- Total additional policy-expansion tables: 136

## Blanket grant blocker

union_eyes_runtime still holds GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public (0108). REVOKE + explicit per-table GRANT generation from this manifest cannot proceed while NEEDS_REVIEW > 0, any closed-classification entry has TBD authority/privileges, or rlsPolicyExpansionRequired's tables lack an actual migration adding their RLS policy.
