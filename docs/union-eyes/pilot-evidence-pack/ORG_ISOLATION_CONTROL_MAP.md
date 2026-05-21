# Org Isolation Control Map — Union Eyes

**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** `apps/union-eyes/lib/db/with-rls-context.ts` + RLS migration files  
**Supersedes:** N/A (new — authoritative reference)  
**Live-evidence dependencies:** PostgreSQL RLS policy verification requires DB access

---

## Summary

Union Eyes enforces org isolation at three layers:

1. **Application layer** — `withRLSContext` sets `app.current_org_id` in every request
2. **Database layer** — 238 RLS policies filter on `organization_id` for every tenant table
3. **Idempotency layer** — deduplication hashes include `organizationId` to prevent cross-org replay

All three layers are fail-closed: missing `orgId` throws, not logs.

---

## Control Map

### Control 1: withRLSContext — Primary Request Path

| Field | Detail |
|-------|--------|
| **Control** | `withRLSContext()` wrapper |
| **Purpose** | Sets `app.current_user_id` and `app.current_org_id` via `SET LOCAL` for every request |
| **Behavior on missing orgId** | **Throws** `"Organization context is required..."` — fail-closed |
| **Code location** | `apps/union-eyes/lib/db/with-rls-context.ts` lines 55–141 |
| **Test coverage** | `__tests__/cross-org-isolation.test.ts` — cross-org read denied; `__tests__/case-intake-idempotency.test.ts` — idempotency scoped to org |
| **Evidence artifact** | `CI_GOVERNANCE_EVIDENCE.md` — Section 2 |
| **Residual risk** | LOW — any path skipping this wrapper is caught by the DB import guard |
| **Reviewer notes** | Overloads ordered so `(tx: RLSTx) => Promise<T>` is resolved before `() => Promise<T>` to avoid TS callback arity ambiguity |

---

### Control 2: Raw DB Import Guard

| Field | Detail |
|-------|--------|
| **Control** | `scripts/check-ue-db-import-guard.ts` CI gate |
| **Purpose** | Detects any file in Union Eyes that imports `db` directly (bypassing RLS wrappers) |
| **Allowlist** | `[]` — zero tolerance |
| **Expected result** | `0 violations` |
| **Code location** | `scripts/check-ue-db-import-guard.ts` |
| **Test coverage** | Gate runs on every CI push |
| **Evidence artifact** | `CI_GOVERNANCE_EVIDENCE.md` — Section 4 |
| **Residual risk** | LOW — gate is blocking; violation blocks CI |
| **Reviewer notes** | Gate scans `apps/union-eyes/**` for direct `db` import patterns |

---

### Control 3: Org-Scoped Idempotency

| Field | Detail |
|-------|--------|
| **Control** | Case intake deduplication hash includes `organizationId` |
| **Purpose** | Prevents cross-org replay of intake operations (attacker in org A cannot re-trigger intake with org B case ID) |
| **Code location** | `apps/union-eyes/app/api/cases/intake/route.ts` — idempotency hash construction |
| **Test coverage** | `__tests__/case-intake-idempotency.test.ts` |
| **Evidence artifact** | `CI_GOVERNANCE_EVIDENCE.md` — Section 3 |
| **Residual risk** | LOW — hash includes org scope |
| **Reviewer notes** | Previous sprint fixed: hash previously lacked `organizationId`, creating cross-org replay surface |

---

### Control 4: Claims Scoped via RLS Middleware

| Field | Detail |
|-------|--------|
| **Control** | `crudRoutes({ orgScoped: true })` for claim GET |
| **Purpose** | The `crudRoutes` factory applies `WHERE organization_id = :orgId` on all reads |
| **Code location** | `apps/union-eyes/app/api/claims/route.ts` line 44 (`orgScoped: true`) |
| **Test coverage** | Integration tests for `/api/claims` GET |
| **Residual risk** | VERY LOW |
| **Reviewer notes** | The `/api/claims` route is deprecated (see Control 5 below); new consumers should use `/api/cases` |

---

### Control 5: Deprecated Claims POST — Documented Exception

| Field | Detail |
|-------|--------|
| **Control** | `withSystemRLSContext` on deprecated `/api/claims` POST |
| **Exception reason** | Legacy backward compatibility for portal/mobile clients; uses `withSystemRLSContext` for claim-number sequence generation. **Data insert includes `organizationId` explicitly.** |
| **Risk mitigations** | (a) Requires `auth: { required: true, minRole: 'steward' }` — unauthenticated access blocked. (b) Insert explicitly sets `organizationId` from authenticated request context. (c) Sequence query now org-scoped: `AND organization_id = ${organizationId}` (fixed 2026-05-14). |
| **Code location** | `apps/union-eyes/app/api/claims/route.ts` lines 56–108 |
| **Test coverage** | Auth gate tested; org field tested in integration |
| **Residual risk** | LOW — sequence info scoped; insert org-scoped; auth required |
| **Reviewer notes** | Deprecated route. Prefer `/api/cases` for all new consumers. Scheduled for removal post-pilot. |

---

### Control 6: withSystemRLSContext — Approved System Paths

`withSystemRLSContext` is approved for the following files and patterns ONLY:

| File | Pattern | Justification |
|------|---------|---------------|
| `app/api/claims/route.ts` | Deprecated claim-number sequence + insert | Backward compat; data insert is org-scoped; auth required |
| `db/queries/enhanced-rbac-queries.ts` | RBAC role-definition reads/writes | Role definitions are system-level config, not org-specific data |
| `app/api/webhooks/*.ts` (if present) | Webhook event processing | Webhooks operate before org context is established |
| Background job handlers | Scheduled/queue processing | No user session available |

Any new `withSystemRLSContext` usage outside this list must be reviewed by the security lead.

---

### Control 7: withPlatformAdminRLSContext — Cross-Org Admin

| Field | Detail |
|-------|--------|
| **Control** | `withPlatformAdminRLSContext(adminId, operationName, fn)` |
| **Purpose** | Platform-admin cross-org operations (support tooling, compliance exports, migrations) |
| **Audit trail** | Logged via `logger.info('[withPlatformAdminRLSContext] ...')` with adminId + operation |
| **Code location** | `apps/union-eyes/lib/db/with-rls-context.ts` lines 438–451 |
| **Residual risk** | LOW — requires explicit `adminId`; throws if empty |
| **Reviewer notes** | All platform-admin operations should declare their purpose via the `operation` parameter |

---

### Control 8: Database RLS Policies

| Field | Detail |
|-------|--------|
| **Control** | PostgreSQL Row-Level Security policies |
| **Count** | 238 RLS policies across all Union Eyes tables |
| **Scope** | All tenant tables filter on `current_setting('app.current_org_id', true)` |
| **Code location** | `migrations/` — RLS policy migrations |
| **Test coverage** | RLS policies tested in `__tests__/cross-org-isolation.test.ts` |
| **Evidence artifact** | `CI_GOVERNANCE_EVIDENCE.md` — Section 1 |
| **Residual risk** | LOW — policies are enforced at DB layer independent of application code |
| **Reviewer notes** | System context operations explicitly clear org context (`SET LOCAL app.current_org_id = ''`) |

---

### Control 9: Claim Helper Functions — Org-Scoped

| Field | Detail |
|-------|--------|
| **Control** | All claim query helpers require `organizationId` parameter |
| **Purpose** | Prevents helpers from being called without org scope |
| **Code location** | `apps/union-eyes/db/queries/claims-queries.ts` |
| **Residual risk** | LOW — TypeScript type enforcement; missing `organizationId` is a compile error |

---

## Cross-Org Regression Test Coverage

Tests verifying org isolation are in:

```
apps/union-eyes/__tests__/cross-org-isolation.test.ts
```

Covered scenarios:
- User in org A cannot read cases from org B
- User in org A cannot create cases in org B  
- Cross-org claim lookup returns empty (not error)
- Idempotency key from org A cannot be replayed in org B

---

## Static Guard for New withSystemRLSContext Calls

The `scripts/check-ue-db-import-guard.ts` currently guards against raw `db` imports.
For `withSystemRLSContext`, the approved-file list is documented in Control 6 above.

If a new `withSystemRLSContext` call is added outside the approved list, the PR author
must:
1. Add a comment in the PR describing the justification
2. Update Control 6 in this document
3. Get explicit sign-off from the security lead

This is a **process gate** (not yet automated). Automation can be added in a future sprint
by extending the DB import guard script to also check for unapproved `withSystemRLSContext` usage.

---

## Residual Risk Register

| Risk | Likelihood | Impact | Mitigation | Residual |
|------|-----------|--------|------------|---------|
| Deprecated `/api/claims` POST bypasses full org-scoped wrapper | LOW | LOW | Auth required; insert is org-scoped; sequence query org-scoped (fixed 2026-05-14) | ACCEPTED |
| withSystemRLSContext spread to new files | LOW | MEDIUM | Process gate: PR review + update this doc | MONITORED |
| RLS policy missing on new table | LOW | HIGH | Migration linting; cross-org tests would fail | MONITORED |
| org isolation tested but not live-proven against real DB | — | — | Live evidence capture runbook provides SQL-layer verification | PENDING |

---

*Reviewer: Any CISO/security auditor should start with Controls 1–3 as the primary isolation backbone,
then review Controls 5–6 as the documented exception surface.*
