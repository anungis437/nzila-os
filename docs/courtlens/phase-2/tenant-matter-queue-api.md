# CourtLens Tenant Matter Queue API — Phase 2 Contract

## Status
- Phase 2C: implemented (`GET /api/courtlens/matters`, `GET /api/courtlens/matters/:matterId`).
- Phase 2C.5: auth contract documented (this document).
- Phase 2C.6: **auth blockers closed** — trusted role + membership verification in place.
- Phase 2D (tenant UI): unblocked from an auth perspective, subject to the residual limitations listed below.

## Routes

### `GET /api/courtlens/matters`
Authenticated. Returns the tenant matter queue for the resolved org.

Request headers:
- Authenticated session (via `@nzila/platform-auth`)
- `x-org-id: <slug>` — target org (see trust model below)
- `x-abr-role: <role>` — actor role (see trust model below)

Response `200`:
```json
{
  "orgId": "metro-university",
  "dataSource": "database" | "seeded-memory",
  "items": [ MatterQueueItem, ... ]
}
```

`MatterQueueItem`:
- `id`, `orgId`, `title`
- `practiceArea` (`housing` | `employment` | `debt` | `unknown`)
- `subIssue` (nullable)
- `statusLabel` (CourtLens display label for ABR incident FSM state)
- `urgencyLabel` (ABR severity: `low` | `medium` | `high` | `critical`)
- `aiSummaryStatus`, `referralStatus`, `isPacketExternalizable`
- `assignedTo`, `openedAt`, `dueAt`, `deadlineDate`

Errors:
- `401` unauthenticated
- `400` missing org context
- `403` missing `incident.read` permission

### `GET /api/courtlens/matters/:matterId`
Authenticated. Returns the tenant matter detail with role-aware redaction.

Response `200`:
```json
{
  "orgId": "metro-university",
  "matter": CourtLensMatterDetailView
}
```

`CourtLensMatterDetailView` includes:
- All queue fields, plus
- `clientGoal`, `hearingDate`, `deadlineDate` (null for `executive_viewer`, `auditor`)
- `riskFlags` (null for roles without evidence access)
- `clientProfile` (null for roles without evidence access)
- `notes` (role-filtered by existing `applyIncidentRedaction`)
- `timeline` (role-filtered)
- `legalBoundaryNotice` (mandatory)

Errors:
- `401` unauthenticated
- `400` missing org context or matter ID
- `403` missing `incident.read` permission
- `404` matter not found (also returned for cross-tenant lookups — no existence leak)

## Auth / Org-Scope / Role Contract

CourtLens matter routes use the trusted verified guards added in Phase 2C.6:
`requireVerifiedOrgAccess` and `requireVerifiedPermission` (see [apps/abr/lib/api-guards.ts](../../../apps/abr/lib/api-guards.ts)).

### Trusted server-side sources
- **`userId`**: derived from the authenticated platform-auth session (`@nzila/platform-auth/entra/server`). **Trusted.**
- **`withRequestContext`**: propagates `x-request-id` and W3C traceparent. **Trusted.**
- **Org membership**: verified via `verifyAbrOrgMembership(userId, orgId)` (see [apps/abr/lib/trusted-auth.ts](../../../apps/abr/lib/trusted-auth.ts)).
- **Role**: derived from the verified membership record via `resolveAbrRoleForRequest`.

### Membership verification sources (priority order)
1. **`session_org_match`** — platform-auth session `orgId` matches requested `orgId`. No DB hit.
2. **`abr_users_lookup`** — DB row where `id = userId AND org_id = orgId AND active = true`.
3. **`in_memory_demo`** — in-memory demo store (when `DATABASE_URL` is unset).
4. **`dev_unverified_fallback`** — only when `NODE_ENV !== 'production'` AND `ABR_ALLOW_UNVERIFIED_ORG === 'true'`. Fails closed in production.

### Role source (priority order)
1. **Membership record role** — from whichever source verified the membership.
2. **`x-abr-role` header** — only when `NODE_ENV !== 'production'` AND `ABR_ALLOW_HEADER_ROLE === 'true'`. **Never trusted in production.**

### Client-controlled inputs — actual trust status

| Header | Role in Phase 2C.6 |
|---|---|
| `x-org-id` | **Selector only.** Never proof of access. Verified against membership before use. Non-member → `403 ORG_MEMBERSHIP_REQUIRED`. |
| `x-abr-role` | **Dev/test override only.** Requires two environment flags: `NODE_ENV !== 'production'` AND `ABR_ALLOW_HEADER_ROLE === 'true'`. Attempting to forge `super_admin` in production is silently ignored. |

Regression tests in [apps/abr/lib/trusted-auth.test.ts](../../../apps/abr/lib/trusted-auth.test.ts) prove:
- Forged `x-abr-role: super_admin` in production is not honoured.
- `ABR_ALLOW_HEADER_ROLE=true` in production is not honoured.
- Non-member of the requested org is rejected fail-closed.
- Inactive membership is rejected.

### Production readiness of the trusted guards

**Safe for production traffic** under these conditions:
- `NODE_ENV=production` (default).
- `DATABASE_URL` set OR the in-memory demo store is intentionally used.
- `ABR_ALLOW_HEADER_ROLE` and `ABR_ALLOW_UNVERIFIED_ORG` are **not set** (they are ignored in production either way).
- Platform-auth session is available.

## Cross-Tenant Isolation

- Queue: `listMatterQueueForOrg(orgId)` calls `listIncidents(orgId)` which filters by `org_id`. No cross-tenant leakage in-memory or in DB.
- Detail: `getMatterDetail(orgId, matterId)` returns `null` when `matterId` does not belong to `orgId`. Route returns `404` with a generic message that does not leak existence.
- Verified by integration tests in [apps/abr/modules/incidents/__tests__/matter-queue.test.ts](../../../apps/abr/modules/incidents/__tests__/matter-queue.test.ts) and route tests in [apps/abr/app/api/courtlens/matters/__tests__/route.test.ts](../../../apps/abr/app/api/courtlens/matters/__tests__/route.test.ts).

## RBAC / Visibility Behavior

Role gating uses existing `AbrRole` and `getIncidentVisibilityPolicy` (see [apps/abr/lib/visibility.ts](../../../apps/abr/lib/visibility.ts)).

| Role | Queue | Detail sensitive fields | Notes filter |
|---|---|---|---|
| `super_admin` | ✅ | ✅ all | all scopes |
| `organization_admin` | ✅ | ✅ all | all scopes |
| `investigator` | ✅ | ✅ all | all scopes |
| `hr_lead`, `dei_lead` | ✅ | ❌ (canSeeEvidence: false) | investigator_only + executive_safe |
| `legal_counsel` | ✅ | ✅ all | executive_safe + legal_only |
| `executive_viewer` | ✅ (aggregate) | ❌ | executive_safe only |
| `auditor` | ✅ | ❌ | executive_safe only |
| `learner` | 403 (no `incident.read`) | 403 | n/a |

Sensitive CourtLens detail fields (null for roles without evidence access): `riskFlags`, `clientProfile`, `clientGoal`, `hearingDate`, `deadlineDate`.

## Event Replay Strategy

CourtLens field state is derived from `abr_incident_events` entries with `type: 'courtlens_event'` (see Phase 1D). `getMatterDetail` reconstructs state via `deriveCourtLensFields`.

## Known Performance Limitation

`listMatterQueueForOrg` calls `getMatterDetail` per item to reconstruct CourtLens state. This is N+1.

- Acceptable for pilot-scale queues (< ~200 matters per org).
- Not measured against production traffic yet.
- Documented mitigation path: add `courtlens_metadata jsonb` column to `abr_incidents` as a materialised projection cache. **Deferred until pilot proves the field set is stable and N+1 is a measured blocker.**

## Response Safety Rules

The following are never returned by the routes:
- Raw event payloads
- Client profile in queue rows (detail only, and role-gated)
- Reviewer notes in queue rows
- Complete client PII to executive/auditor roles
- AI packet content when `aiSummaryStatus` is not `approved` or `revised_by_human` (`isPacketExternalizable` gate)
- Legal advice or legal conclusions

Legal boundary notice is mandatory on every detail response.

## Blockers Before Phase 2D Tenant UI

Both Phase 2C.5 blockers have been closed in Phase 2C.6:

- ✅ **`x-abr-role` role source**: replaced with server-derived role via `resolveAbrRoleForRequest`. Header is production-ignored. Regression tests prove forged headers are rejected.
- ✅ **`x-org-id` membership verification**: `verifyAbrOrgMembership` fails closed if the authenticated user is not an active member of the requested org.

### Residual limitations to know before shipping UI

1. **`abr_users` seed data**: production deployment must populate `abr_users` with real `(userId, orgId, role)` triples that match the platform-auth session `userId` values. Without this seed, non-session users will fail membership verification.
2. **Session `orgRole` mapping**: platform-auth `orgRole` values must map to valid `AbrRole` values (`normalizeRole` returns `'learner'` for unknown roles). If Entra/Clerk uses different role names, add a translation table.
3. **Legacy incident routes** (`/api/abr/incidents/*`) still use the older `requireOrgAccess` / `requirePermission`. They remain safe for dev/test/pilot but should migrate to the verified guards before those routes ship to public production traffic.
4. **`x-org-id` may still expose org-existence** through error messages when a valid user targets an unknown org. Consider unifying to `404` if enumeration is a concern.
5. **N+1 event replay** in queue list — unchanged from Phase 2C. Deferred.

## Related

- [Phase 1 reuse audit](../phase-1/abr-reuse-audit.md)
- [Pilot readiness plan](../pilot-readiness-plan.md)
- [Implementation sequence](../implementation-sequence.md)
