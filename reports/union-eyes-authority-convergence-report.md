# Union Eyes — Storage Authority Convergence Report

Generated: 2026-09-02T12:04:54.692Z

## Classification counts

| Classification | Count |
| --- | --- |
| TENANT_RLS_REQUIRED | 58 |
| LATENT_UNREACHABLE | 156 |
| NEEDS_REVIEW | 207 |
| PARENT_OWNED_RLS_REQUIRED | 1 |
| SYSTEM_ONLY | 9 |
| USER_RLS_REQUIRED | 1 |

## Authority-model convergence (invocationAuthority / dbExecutionPrincipal / privileges)

- invocationAuthority = TBD: 243
- dbExecutionPrincipal = TBD: 243
- requiredRuntimePrivileges = TBD: 207
- requiredSystemPrivileges = TBD: 247
- Closed (non-NEEDS_REVIEW) entries still carrying TBD authority: 36

## Invariant violations (must always be zero)

- SYSTEM_ONLY exposed to TENANT_RUNTIME/MIXED: 0
- LATENT_UNREACHABLE exposed to any DB role: 0

## Policy gaps (best-effort static scan of 0108)

- TENANT_RLS_REQUIRED without detected 0108 coverage: 58
- PARENT_OWNED_RLS_REQUIRED without detected policy: 1
- USER_RLS_REQUIRED without detected policy: 1

## Blanket grant blocker

union_eyes_runtime still holds GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public (0108). REVOKE + explicit per-table GRANT generation from this manifest cannot proceed while NEEDS_REVIEW > 0 or any closed-classification entry has TBD authority/privileges.
