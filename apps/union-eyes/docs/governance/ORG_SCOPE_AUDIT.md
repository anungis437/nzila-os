# UnionEyes — Org-Scope (Multi-Tenancy) Audit

> **Status**: GREEN at the enforced layers; AMBER for automated proof at scale.

## 1. Enforcement layers

| Layer | Mechanism | Source |
|---|---|---|
| DB layer | `createAuditedScopedDb({ orgId })` from `@nzila/db` wraps writes; `createScopedDb({ orgId })` wraps reads. | `apps/union-eyes/lib/api-guards.ts` |
| Route layer | All standard CRUD routes use `crudRoutes({ orgScoped: true })`. | `apps/union-eyes/lib/api/crud-factory.ts` |
| Audit layer | `withAudit` records `organizationId` on every mutation. | `@nzila/db` |
| Red-team test | `security/redteam/adversarial.test.ts` — `RED-TEAM-001 — Cross-org data access must be structurally impossible`. | Repo root |

## 2. Authorised raw-DB import boundary

A single re-export of `db` from `@nzila/db/client` is permitted at `apps/console/lib/db/index.ts`. **This is the only path that bypasses the scoped DB wrappers**, and it is gated by three independent enforcement points:

- `tooling/ga-check/ga-check.ts` — exempts `apps/*/lib/db/**`
- `tooling/contract-tests/db-boundary.test.ts` — exempts `lib/db/index.ts`
- `security/redteam/adversarial.test.ts` — exempts `lib/db/index.ts`

UE itself does NOT have such an exemption. Every UE route MUST go through `getAuditedDb` / `getReadOnlyDb` from `apps/union-eyes/lib/api-guards.ts`.

## 3. Audit findings (current)

| Surface | Org-scope status | Notes |
|---|---|---|
| `/api/grievances/**` | ✅ Enforced | Uses `crudRoutes({ orgScoped: true })` or explicit `organizationId` filters. |
| `/api/cases/**` | ✅ Enforced | Same pattern as grievances. |
| `/api/claims/[id]/evidence` | ✅ Fixed (commit `0fff5f3`) | **Was**: queried claim by `claimId` only — cross-org evidence read possible. **Fix**: added `organizationId` join via `and(eq(claims.claimId, id), eq(claims.organizationId, orgId))`. |
| `/api/claims/[id]` PATCH | ✅ Fixed (commit `0fff5f3`) | **Was**: generic PATCH accepted `{ status: "closed" }`, bypassing the workflow FSM. **Fix**: `blockedPatchFields: ['status']` strips status from PATCH — mutations must go through `workflow-engine.ts`. |
| `/api/executive/dashboard` | ✅ Enforced | `organizationId` extracted from auth context, filtered via `eq(grievances.organizationId, orgId)`. |
| `/api/metrics/operational` | ⚠️ Aggregate | Returns ORG-AGNOSTIC platform totals (deliberate; operator-facing). Add `?org=` filter before exposing externally. |
| `/api/governance/telemetry` | ⚠️ Aggregate | Same as above; platform-wide counters. |
| `/api/evidence/export` | ✅ Per-app summary | Does not return tenant data; only emits structural metadata. |
| `/api/search/universal` | ✅ Enforced | Org-filter applied before similarity ranking. |

## 4. Known gaps (truthful)

- **300+ tables** in `apps/union-eyes/db/schema/`; only the most-trafficked have been spot-checked. A repo-wide static scan for `pgTable(...)` definitions lacking an `organizationId` column would surface gaps. See follow-up task `ue-org-scope-table-audit`.
- **Search endpoints** rely on the route layer for org-scoping; no defence-in-depth at the DB layer for some `LIKE`-style queries. Acceptable risk while red-team test passes; revisit if `crossOrgAccessLog` records leaks.
- **Service-to-service** routes accepting `x-service-key` (e.g., `/api/metrics/operational`) bypass user auth and return aggregate-only data. Service key must never be a user credential.

## 5. Test coverage

- `security/redteam/adversarial.test.ts` — passes; enforces import boundary.
- `apps/union-eyes/tests/api/**` — org-scoped CRUD smoke tests.
- `apps/union-eyes/e2e/authenticated-role-navigation.spec.ts` — RBAC visibility.

## 6. Recommended follow-up (deferred from session)

1. Add `tooling/contract-tests/ue-org-column-audit.test.ts` that asserts every UE table with a tenant boundary has an `organization_id` column.
2. Add `?org=` filter support to `/api/metrics/operational` and `/api/governance/telemetry` for per-tenant procurement views.
3. Wire `crossOrgAccessLog` records into `/api/governance/telemetry` as `cross_org_access_attempts_count`.
