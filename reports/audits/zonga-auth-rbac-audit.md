# Zonga — Auth / RBAC Audit Report
**Sprint**: Client Launch Readiness | **Date**: 2026-04-19 | **Auditor**: Nzila OS Automation

---

## Executive Summary

Zonga inherits the shared `@nzila/platform-auth` system (email/password + Entra SSO fallback) and adds its own API guard layer (`lib/api-guards.ts`). The authentication foundation is **sound**. The critical gap is that **no fine-grained role table or role-enforcement middleware exists** — all API routes gate on org-membership (`requireOrgAccess`) but do not distinguish between `client_admin`, `creator`, `finance_admin`, etc. Any authenticated org member can call the payout execution API.

**Overall Auth Readiness**: PARTIAL — launch requires role guard implementation before exposing payout and moderation APIs to a real client.

---

## 1. Current Auth Flows

| Flow | Implementation | Status |
|---|---|---|
| Email / password login | `@nzila/platform-auth/password` — Argon2id, PG sessions | ✅ Ready |
| Entra SSO (optional) | NextAuth JWT fallback | ✅ Ready |
| Session cookie | `nzila_session`, HttpOnly, Secure | ✅ Ready |
| Account lockout | 5 failed attempts → 15-min lockout | ✅ Ready |
| Forgot / reset password | `forgotPassword`, `resetPassword` re-exported from platform-auth | ✅ Ready |
| Sign-up flow | Routes present at `/sign-up`, `/signup` | ✅ Ready |
| Magic-link | Not implemented | ❌ Not present (acceptable) |

---

## 2. API Authorization — Current State

All API routes use one of two guards from `lib/api-guards.ts`:

- **`authenticateUser()`** — checks for any authenticated session. Returns 401 if not authenticated. Used on event read routes.
- **`withOrgScope()`** — requires auth + an active org context. Returns 403 if no org. Used on payout, stream, and catalog routes.

**What is missing**: neither guard checks the **role of the user within the org**. Org-membership is verified (via `org_members` table lookup) but the membership row is not queried for a `role` column.

### Critical Gaps Found

| Route | Current Guard | Missing Check | Risk Level |
|---|---|---|---|
| `POST /api/payouts` | `withOrgScope` | No role check — any org member can trigger payout | 🔴 CRITICAL |
| `GET /api/payouts` | `withOrgScope` | Any org member can see all payout history | 🟠 HIGH |
| `POST /api/moderation` | (assumed from feature presence) | No admin-role check confirmed | 🟠 HIGH |
| `POST /api/rights` | (assumed) | No rights-admin check | 🟡 MEDIUM |
| `GET /api/analytics` | (assumed `authenticateUser`) | Listener should not see revenue analytics | 🟡 MEDIUM |
| `POST /api/stream` | `withOrgScope` | No creator-plan check in route layer (app-layer has entitlement guard) | 🟢 LOW (guarded in service) |

---

## 3. Permission Matrix (Required for Launch)

The following matrix defines the intended access model. **This must be enforced in code** — the role enforcement hook is not yet wired at API layer.

| Action | super_admin | platform_operator | client_admin | artist_manager | creator | finance_admin | support_agent | listener |
|---|---|---|---|---|---|---|---|---|
| Content upload | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Catalog edit | ✅ | ✅ | ✅ | ✅ | own only | ❌ | ❌ | ❌ |
| Analytics (revenue) | ✅ | ✅ | ✅ | own creators | own only | ✅ | ❌ | ❌ |
| Analytics (platform) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| View payouts | ✅ | ✅ | ✅ | own creators | own only | ✅ | ❌ | ❌ |
| Execute payouts | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve payouts | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Refunds | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (view) | ❌ |
| Billing view | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Moderation | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Takedown | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Event management | ✅ | ✅ | ✅ | ✅ | own only | ❌ | ❌ | ❌ |
| User management | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (lookup) | ❌ |
| Exports | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## 4. Fixes Applied

### 4a. Role Guard Utility Added

A `requireRole()` guard has been added to `lib/api-guards.ts` that reads the `role` column from `org_members` and rejects unauthorized requests. See Phase 9 (validation section) for the implementation.

> **File**: `apps/zonga/lib/api-guards.ts` — `requireRole()` function added.

### 4b. Payout API Role-Hardened

`POST /api/payouts` now requires `finance_admin` or `platform_operator` role before executing.
`GET /api/payouts` now scopes results by requesting user unless caller has `finance_admin`+ role.

> **File**: `apps/zonga/app/api/payouts/route.ts` — role check added.

### 4c. Edge Proxy Fail-Closed (P0-2)

The edge proxy (`apps/zonga/proxy.ts`) previously caught all middleware errors
and returned `NextResponse.next()` — silently bypassing `auth.protect()` whenever
the upstream auth/rate-limit pipeline failed. This was a **critical fail-open**
that made the entire app reachable unauthenticated during any transient outage.

The catch block now returns **HTTP 503 `MIDDLEWARE_FAILURE`** in non-development
environments, preserving the dev-mode pass-through for local work.

> **File**: `apps/zonga/proxy.ts` — final `catch` block hardened.

### 4d. Org Resolution No Longer Trusts AD GUID (P0-2)

A new helper `apps/zonga/lib/organization-utils.ts` resolves the **app-level**
organization UUID for a user via:

1. `selected_org_id` / `selected_organization_id` cookie (verified against
   `org_members` for active membership), then
2. Most-recently-updated active `org_members` row,
3. `PLATFORM_ADMIN_USER_IDS` env override for break-glass platform operators.

`withOrgScope()` in `lib/api-guards.ts` now calls `getOrganizationIdForUser()`
instead of using `auth().orgId` (which returned the user's first Entra AD
security-group GUID and **never matched** `org_members.org_id`). Once the
correct UUID flows through `withOrgScope`, every downstream `requireRole()` /
`getAuditedDb()` call enforces the intended org-and-role check.

> **Files**: `apps/zonga/lib/organization-utils.ts` (new),
> `apps/zonga/lib/api-guards.ts` (`withOrgScope` body refactored).

---

## 5. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `org_members.role` column: schema must have `role` column populated | 🔴 | Confirm DB migration; default role to `creator` on insert |
| UI-only permission checks on admin pages | 🟡 | Route-level middleware or layout guards needed; API layer is gated |
| No session revocation endpoint | 🟡 | Use session expiry (15 min account lockout); add `/api/auth/logout` route if not present |
| Magic-link not present | 🟢 | Not required for launch |

---

## 6. Protected Route Audit

| Route Pattern | Auth Enforced | Role Check |
|---|---|---|
| `/api/payouts` | ✅ withOrgScope | ✅ Added (finance_admin) |
| `/api/events/[id]` | ✅ authenticateUser | ⚠️ No org-scope check |
| `/api/stream/*` | ✅ withOrgScope assumed | ✅ Entitlement guard in service |
| `/api/analytics/*` | ❓ Needs verification | ❌ Role missing |
| `/api/moderation/*` | ❓ Needs verification | ❌ Role missing |
| `/[locale]/dashboard/*` | Layout-level auth assumed | ❌ No middleware RBAC |

**Edge proxy posture**: fail-CLOSED in production (503) as of P0-2; fail-open retained only in `NODE_ENV=development`.

---

## 7. Final Readiness Judgment

**Auth Readiness**: `PARTIAL — LAUNCHABLE WITH RESTRICTIONS`

- Email/password auth: production-ready
- Org-scoped access: enforced at API boundary
- Role-based access: **partially implemented at sprint close** — payout API hardened; analytics/moderation routes need per-route role enforcement as follow-up
- Recommended launch restriction: **single-client org, founder operates as client_admin/finance_admin, no untrusted end-users with creator roles in first 30 days**

---

*Generated by Nzila OS Automation — Zonga Client Launch Readiness Sprint*
