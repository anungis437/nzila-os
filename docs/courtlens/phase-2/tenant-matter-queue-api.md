# CourtLens Tenant Matter Queue API — Phase 2 Contract

## Status
- Phase 2C: implemented (`GET /api/courtlens/matters`, `GET /api/courtlens/matters/:matterId`).
- Phase 2C.5: auth contract hardened (this document).
- Phase 2D (tenant UI): **blocked** on the auth blockers listed below.

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

### Trusted server-side sources
- **`userId`**: derived from the authenticated platform-auth session (`@nzila/platform-auth/entra/server`). **Trusted.**
- **`withRequestContext`**: propagates `x-request-id` and W3C traceparent. **Trusted.**

### Not-yet-trusted client-controlled inputs

The following headers are currently client-controllable and MUST be treated as untrusted for production authorization decisions.

#### `x-org-id`
- Consumed by `resolveOrgContext` in [apps/abr/lib/org-context.ts](../../../apps/abr/lib/org-context.ts).
- Any authenticated user can currently target any org by setting this header.
- **No server-side membership check exists between `userId` and the resolved `orgId`.**
- `TENANT_MEMBERSHIP_TODO` in [apps/abr/lib/api-guards.ts](../../../apps/abr/lib/api-guards.ts).

#### `x-abr-role`
- Consumed by `requirePermission` in [apps/abr/lib/api-guards.ts](../../../apps/abr/lib/api-guards.ts).
- Any authenticated user can currently escalate role by setting `x-abr-role: super_admin`.
- **No server-side role source exists.**
- `ROLE_SOURCE_TODO` in [apps/abr/lib/api-guards.ts](../../../apps/abr/lib/api-guards.ts).

### Trusted role-source rule (must be enforced before Phase 2D production traffic)

1. Role must be derived from the server-side platform-auth session or a validated `OrganizationMembership` record.
2. `x-abr-role` header must be ignored in production paths.
3. Membership check: authenticated `userId` must have an active membership in the resolved `orgId`. Missing membership must fail closed with `403`.
4. Any residual dev/test role override must be gated by `NODE_ENV !== 'production'` or an explicit trusted service identity.

### Current safe-use envelope

The current guards are safe when:
- Deployed behind trusted-network conditions (internal pilot, controlled QA).
- No public tenant UI is exposed.
- Requests are made by a controlled service (CLI, integration test, trusted admin script).

They are **NOT safe** for public browser traffic until the two TODOs above are resolved.

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

1. **`x-abr-role` role source**: replace with server-derived role. See `ROLE_SOURCE_TODO`.
2. **`x-org-id` membership verification**: add `verifyOrgMembership(userId, orgId)` and fail closed. See `TENANT_MEMBERSHIP_TODO`.
3. **Regression tests for forged headers**: prove `x-abr-role: super_admin` from a low-privilege session is rejected after fix.

Until these are resolved, the tenant UI must be deployed behind trusted-network conditions only. UI code must not send `x-abr-role` from the browser; it must rely on server-side role derivation.

## Related

- [Phase 1 reuse audit](../phase-1/abr-reuse-audit.md)
- [Pilot readiness plan](../pilot-readiness-plan.md)
- [Implementation sequence](../implementation-sequence.md)
