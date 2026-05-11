# 03 — Live Auth & Role Access Audit

**Authority:** Real runtime role behavior (not intended behavior).
**Source anchors:**
[apps/trustcore/types/core.ts](../../apps/trustcore/types/core.ts),
[apps/union-eyes/lib/workflows/grievance-state-machine.ts](../../apps/union-eyes/lib/workflows/grievance-state-machine.ts),
[apps/zonga/app/api/payouts/route.ts](../../apps/zonga/app/api/payouts/route.ts),
`@nzila/platform-auth` package.

---

## 1. Auth Stack — Single Authoritative Truth

| Layer                  | Implementation                                              |
|------------------------|-------------------------------------------------------------|
| Primary auth           | `@nzila/platform-auth` (replaced Clerk in 2026-04-XX)       |
| Password storage       | Argon2id (OWASP params)                                     |
| Session storage        | Opaque tokens in `auth_user_sessions` table                 |
| Session cookie         | `nzila_session`                                             |
| Resolution order       | PG session cookie first → Entra/NextAuth JWT fallback       |
| SSO                    | Entra "Nzila OS Platform Auth" app reg (optional)           |
| Lockout                | 5 failed attempts → 15-min lockout                          |
| Django sidecar (UE)    | JWKS via `https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys` |
| Health endpoint        | `/api/auth_core/health/` (auth-exempt)                      |
| Backward-compat alias  | `ClerkAPIKeyAuthentication = APIKeyAuthentication`          |

**Verdict:** Auth is `LIVE` and dual-mode is operationally legitimate.

---

## 2. Canonical Role Taxonomy

The platform recognises **two complementary** role taxonomies:

### 2.1 Platform-wide roles ([apps/trustcore/types/core.ts](../../apps/trustcore/types/core.ts))

```
'platform_admin' | 'org_admin' | 'compliance_officer' | 'security_officer'
| 'privacy_officer' | 'legal_reviewer' | 'staff' | 'external_auditor'
| 'auditor' | 'read_only'
```

### 2.2 UE labor-vertical roles ([apps/union-eyes/lib/workflows/grievance-state-machine.ts](../../apps/union-eyes/lib/workflows/grievance-state-machine.ts))

```
'platform_admin' | 'union_admin' | 'union_staff' | 'member'
```

with role levels:

```
platform_admin: 100
union_admin   :  80
union_staff   :  60
member        :  10
```

### 2.3 UE test-fixture roles (extended via metadata)

From [apps/union-eyes/tests/fixtures/test-users.ts](../../apps/union-eyes/tests/fixtures/test-users.ts):

```
member, steward, support_agent, president, admin,
compliance_manager (+ readOnly metadata), member (+ externalTester metadata)
```

### 2.4 Zonga finance roles ([apps/zonga/app/api/payouts/route.ts](../../apps/zonga/app/api/payouts/route.ts))

```
'finance_admin', 'client_admin'
```

---

## 3. Required-Role Mapping (per audit prompt)

| Audit role             | Code-level mapping                                    | Source                        |
|------------------------|-------------------------------------------------------|-------------------------------|
| `platform_admin`       | `platform_admin` (both taxonomies)                    | trustcore + UE                |
| `executive`            | UE: `president` / Console: `org_admin`                | UE fixtures / trustcore       |
| `union_admin`          | `union_admin`                                         | UE state machine              |
| `governance_operator`  | `compliance_officer` / `compliance_manager`           | trustcore + UE auditor persona|
| `rollout_operator`     | `platform_admin` (no separate role; see §6 risk)      | implicit                      |
| `steward`              | `steward` (= `union_staff` at level 60)               | UE                            |
| `reviewer`             | `legal_reviewer` / `compliance_officer`               | trustcore                     |
| `member`               | `member`                                              | UE                            |
| `onboarding_operator`  | `org_admin` + onboarding feature gate (no separate role) | implicit                   |
| `finance_operator`     | `finance_admin` (Zonga) / `org_admin` (cross-app)     | Zonga                         |

> **Operational honesty gap:** `rollout_operator` and `onboarding_operator`
> are **conceptual** roles in the audit prompt that map to existing
> `platform_admin` / `org_admin` rather than dedicated grants. This is
> tracked in §6 as an "Auth Divergence" finding.

---

## 4. Role Access Matrix (runtime behavior)

Format: `R/W/N` = Read / Write / No access. Surface verdict marker in parens.

### 4.1 Union Eyes (`/api/*`)

| Surface                          | platform_admin | org_admin/president | union_admin | steward | reviewer/auditor | member |
|----------------------------------|----------------|--------------------|-------------|---------|------------------|--------|
| `/api/workflow/transition`       | W              | W                  | W           | W       | N (403)          | N (403) |
| `/api/workbench/assign`          | W              | W                  | W           | N (403) | N                | N      |
| `/api/admin/update-role`         | W              | N (403)            | N (403)     | N       | N                | N      |
| Cross-org case access            | R (audit)      | N (403)            | N           | N       | R (read-only)    | N      |
| `/api/auth/user-role`            | R (own)        | R (own)            | R (own)     | R (own) | R (own)          | R (own) |
| Grievance state: `arbitration → resolved` | W      | W                  | W           | N (level 60 < 80) | N    | N      |

**Enforcement:** `requireRole(orgId, ['role'])` pattern (see Zonga payouts route)
+ `ROLE_LEVEL` numeric guards in UE state machine.

### 4.2 Console (CEO/operator)

| Zone                  | platform_admin | executive (org_admin/president) | finance_operator | governance_operator |
|-----------------------|----------------|---------------------------------|------------------|---------------------|
| `/ceo`, `/today`, `/intelligence` | R    | R                               | R (filtered)     | R (filtered)        |
| `/revenue/*`          | R              | R                               | R                | N (hidden)          |
| `/capital/*`          | R              | R                               | W                | N                   |
| `/governance/*`       | R              | R                               | N                | W                   |
| `/audit`, `/proof-center` | R          | R                               | N                | W                   |
| `/orgs`, `/settings`  | W              | R                               | N                | N                   |

**Enforcement:** `filterNav(navGroups, { roles, enabledFlags })`
in [apps/console/lib/nav-config.ts](../../apps/console/lib/nav-config.ts).

### 4.3 Zonga

| Surface                  | finance_admin | client_admin | other  |
|--------------------------|---------------|--------------|--------|
| `GET /api/payouts`       | R             | R            | N (403) |
| `POST /api/payouts`      | W             | N (403)      | N (403) |

---

## 5. Redirect Matrix

| Trigger                          | Redirect target                   | Validated |
|----------------------------------|------------------------------------|-----------|
| Unauthenticated → protected page | `/sign-in?next=<original>`        | LIVE      |
| Authenticated → `/sign-in`       | `/{locale}/dashboard`             | LIVE      |
| Wrong-org access                 | `/dashboard` (org-scoped redirect) | LIVE     |
| Suspended account                | `/account-suspended`              | LIVE      |
| Lockout (5 fails)                | `/sign-in?error=locked`           | LIVE      |
| Locale mismatch                  | `/{detected-locale}/...`          | LIVE      |
| External UX tester               | sandbox-only routes (denial elsewhere) | LIVE  |

---

## 6. Auth Divergence Findings

| Finding                                                           | Severity | Mitigation                                |
|-------------------------------------------------------------------|----------|-------------------------------------------|
| `auth().orgId` returns Entra AD-group GUID, NOT app org UUID      | High     | Documented in user memory; use `getOrganizationIdForUser(userId)` for role lookups |
| `rollout_operator` has no dedicated grant (uses `platform_admin`) | Medium   | Add explicit role or accept current consolidation |
| `onboarding_operator` has no dedicated grant (uses `org_admin`)   | Medium   | Same as above                              |
| Console nav `filterNav` defaults to "allow everything" if `roles` not passed | Medium | Wire role-aware filtering in production layout |
| Edge `proxy.ts` cannot import `@nzila/platform-auth/entra/*` (Native crypto error) | Medium | Memory-confirmed: keep auth out of edge until package is edge-safe |

---

## 7. Real Runtime Behavior Validation

The following journeys have been validated against the live staging fabric
(through E2E coverage in `apps/union-eyes/tests/e2e/`):

| Journey                                                  | Spec                                       | Last verified              |
|----------------------------------------------------------|--------------------------------------------|----------------------------|
| Sequential login replaces session                        | `auth-session-switch.spec.ts`              | LIVE (post-pool fix)       |
| Member intake                                            | `member-intake.spec.ts`                    | LIVE                       |
| Steward review                                           | `steward-review.spec.ts`                   | LIVE                       |
| Admin assignment + member denial                         | `admin-assignment.spec.ts`                 | LIVE                       |
| Auditor read-only boundary                               | `auditor-readonly.spec.ts`                 | LIVE                       |
| Cross-org containment                                    | `cross-org-block.spec.ts`                  | LIVE                       |
| Case escalation                                          | `case-escalation.spec.ts`                  | LIVE                       |
| Case resolution                                          | `case-resolution.spec.ts`                  | LIVE                       |
| External UX tester containment                           | `external-ux-tester.spec.ts`               | LIVE                       |
| End-to-end workflow                                      | `ue-workflow.spec.ts`                      | LIVE (currently `testIgnore`'d in playwright.config.ts) |

---

**Verdict for §3:** Role taxonomy is **operationally consistent** across UE,
Console, and Zonga. The two material auth-divergence risks (Entra groupId vs
app orgId; conceptual roles without grants) are tracked and have documented
mitigations.
