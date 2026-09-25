# Security Design Review — UE getUserRole under withSystemContext

**Date:** 2026-09-23 (ET)
**PR scope:** Union Eyes runtime schema lineage restoration + mainline green convergence
**Sensitive path:** `apps/union-eyes/lib/auth/rbac-server.ts`

## Change summary
`getUserRole()` now resolves membership/role rows inside `withSystemContext()`.
Tenant RLS on membership tables is org-scoped; role resolution must still filter by
`userId` + `organizationId` in SQL while executing under the dedicated
`union_eyes_system` connection (not by clearing tenant context on the runtime pool).

## Threat model notes
- **Fail-closed preserved:** fatal errors still throw `Authorization system unavailable`.
- **No privilege expansion:** SQL continues to constrain by the caller-supplied user/org IDs.
- **SYSTEM_ONLY data paths unchanged:** governance Class-B routes still require
  `GOVERNANCE_SYSTEM_ROLES` via `withApi` before handler `withSystemContext` data access.
- **Test updates:** unit tests mock `withSystemContext` for auth resolution; governance
  boundary tests assert handler `db.execute` is not reached on 403 paths.

## Residual risk / follow-ups
- Ensure CI/runtime always sets `SYSTEM_DATABASE_URL` for the system role connection.
- Continue monitoring entitlement-guard / withApi DB role fallback paths that also enter
  `getUserRole()`.

## Disposition
Accepted for merge subject to CI mandatory checks green and staging pilot preservation
(no production mutations). Reviewer applies `security-design-reviewed` after corroborating
this packet against the PR diff.
