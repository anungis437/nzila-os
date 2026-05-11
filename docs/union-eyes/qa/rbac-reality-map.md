# Union Eyes QA — RBAC Reality Map

This document maps the actual RBAC enforcement behaviour observed across all
Union Eyes API routes and UI surfaces.

## Route-Level Auth Reality

| Route | Method | Auth Required | Min Role | Org Scoped | Member | Steward | Admin | Auditor |
|-------|--------|---------------|----------|------------|--------|---------|-------|---------|
| /api/cases/intake | POST | yes | member | yes | allowed | allowed | allowed | denied |
| /api/cases | GET | yes | steward | yes | denied | allowed | allowed | allowed |
| /api/cases/[caseId] | GET | yes | member | yes | allowed | allowed | allowed | allowed |
| /api/cases/[caseId]/assign | POST | yes | steward | yes | denied | allowed | allowed | denied |
| /api/cases/[caseId]/evidence | GET | yes | member | yes | allowed | allowed | allowed | allowed |
| /api/cases/[caseId]/evidence | POST | yes | member | yes | allowed | allowed | allowed | denied |
| /api/cases/[caseId]/evidence | DELETE | yes | steward | yes | denied | allowed | allowed | denied |
| /api/cases/[caseId]/status | PATCH | yes | steward | yes | denied | allowed | allowed | denied |
| /api/cases/[caseId]/timeline | GET | yes | member | yes | allowed | allowed | allowed | allowed |
| /api/workbench/assigned | GET | yes | steward | yes | denied | allowed | allowed | denied |
| /api/workbench/assign | POST | yes | steward | yes | denied | allowed | allowed | denied |
| /api/workflow/transition | POST | yes | steward | yes | denied | allowed | allowed | denied |
| /api/claims | POST | yes | steward | yes | denied | allowed | allowed | denied |
| /api/claims/[id]/status | PATCH | yes | steward | yes | denied | allowed | allowed | denied |
| /api/auth/me | GET | yes | member | no | allowed | allowed | allowed | allowed |

## Notes

- All routes enforce authentication at the middleware level via `withApi`.
- Org scoping is enforced by `getOrganizationIdForUser` — never from `auth().orgId`.
- All entries in this map must have explicit auth expectations — no ambiguous entries permitted on critical paths.

## Verification Status

Last verified: 2026-05-10
