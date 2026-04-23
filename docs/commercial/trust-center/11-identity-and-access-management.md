# 11 — Identity and Access Management

_Trust Center · Last revised: 2026-04-24_

This page consolidates how identities are created, authenticated,
authorised, monitored, and retired in Union Eyes. It is the document to
read if you are an IT director or identity architect doing vendor due
diligence.

For the executive summary, see [01 — Security overview](./01-security-overview.md).
For the role/policy model, see [04 — Access control model](./04-access-control-model.md).

## 1. Identity sources

A `users` row may be created by any of:

| Source | Trigger | Password column | Notes |
|---|---|---|---|
| `local` | Self-service signup form | Argon2id hash | Default for non-SSO orgs |
| `entra_sso` | First Entra SSO login | NULL | Auto-provisioned via NextAuth on first login |
| `magic_link` | First magic-link sign-in | NULL | Materialised on first verification |
| `invite` | Invite acceptance | Argon2id (set during accept) | Role baked into the invite row |
| `scim` | (Reserved) future SCIM 2.0 client | NULL | Foundation columns shipped; endpoints deferred |

Account source is recorded in `users.account_source` so operators know
which recovery path applies.

## 2. Authentication

| Method | Implementation | Where |
|---|---|---|
| Email + password | Argon2id, opaque session token, 24 h cookie TTL | `packages/platform-auth/src/password/*` |
| Magic-link | 256-bit random token, SHA-256 hashed at rest, single-use, 15 min TTL | `packages/platform-auth/src/magic-link/*` |
| Microsoft Entra SSO | NextAuth v5 OAuth/OIDC | `apps/union-eyes/app/api/auth/[...nextauth]/route.ts` |
| TOTP MFA | RFC 6238, ±1 step window, AES-256-GCM secrets at rest | `packages/platform-auth/src/mfa/*` |
| Recovery codes | 10 single-use codes, Argon2id-hashed, removed-on-use | `packages/platform-auth/src/mfa/service.ts` |

All methods land on the same `auth()` resolver and produce equivalent
`{userId, organizationId, role}` claims for downstream RBAC.

## 3. Step-up logic

The login path runs through these gates **in order**:

1. **Lifecycle gate** — only `active` users continue. `pending_invite`,
   `suspended`, and `deprovisioned` are rejected with a generic
   "contact your administrator" message.
2. **Password verification** (or SSO redirect, or magic-link redemption).
3. **Risk assessment** — see [04 — Access control model](./04-access-control-model.md#risk-based-step-up). High-tier → soft lockout; medium-tier → force MFA.
4. **MFA gate** — combined view of:
   - Whether the user is enrolled (`mfa_totp.enabled_at IS NOT NULL`).
   - Whether their role appears in `org_auth_policies.mfa_required_for_roles`.
   - If MFA is required AND not enrolled → fail closed.
   - If MFA is required AND enrolled → issue an opaque 5-min challenge token; **no session cookie set yet**.
5. **Session creation** — only after the challenge succeeds (or if MFA was not required at all).

## 4. Authorisation

Two wrappers do all the work:

- `withOrganizationAuth(handler)` — required wrapper for every API route. Resolves `{userId, organizationId, memberId, role}`. Returns 401 if no session, 403 if no membership.
- `requireRole(role)` / `hasMinRole(role)` — enforce the role hierarchy `app_owner > coo > admin > chief_steward > steward > member`.

Row-level security on case data tables enforces isolation in PostgreSQL
itself, not just in the application. There is no "global admin" path
that can read another tenant's case data.

## 5. Lifecycle

| Action | Service call | Effect |
|---|---|---|
| Suspend | `suspendUser({targetUserId, actorUserId, reason})` | `lifecycle_state = suspended`; sessions revoked; audited |
| Reactivate | `reactivateUser({targetUserId, actorUserId})` | `lifecycle_state = active`; existing creds still work |
| Deprovision | `deprovisionUser({targetUserId, actorUserId, reason})` | `lifecycle_state = deprovisioned`, `deleted_at = now()`; sessions revoked; audited; org memberships retained for evidence |

All three nullify `auth_user_sessions.expires_at` atomically — the next
request from any active browser is logged out.

## 6. Risk monitoring

| Tier | Trigger | Action |
|---|---|---|
| `low` | Default | Continue |
| `medium` | New device / IP, or privileged role | Force MFA |
| `high` | ≥ 3 failed logins in 15 min from same IP or account | Soft-lockout (generic failure) |

Risk tier is appended to the `login_success` audit row and to
`mfa_challenge_issued` events for forensic review.

## 7. Org-level policy controls

Surface: `/<locale>/admin/auth-policy` (role ≥ `admin`).

```
allowLocalAuth      : boolean
allowMagicLink      : boolean
allowSso            : boolean
requireSso          : boolean
requireInvite       : boolean
passwordResetAllowed: boolean
allowedEmailDomains : string[]
mfaRequiredForRoles : ['member' | 'steward' | 'chief_steward' | 'admin' | 'coo' | 'app_owner' | 'platform_admin']
```

Validated for contradictions on save (e.g. `requireSso = true` plus
`allowLocalAuth = true` is rejected). Every change writes
`auth_policy_changed` to the audit log.

## 8. Audit log

`user_management.auth_audit_log` is append-only. Event types include:

```
signup
login_success
login_failed
account_locked
logout
session_revoked
password_reset_request
password_reset_complete
magic_link_requested
magic_link_consumed
magic_link_verify_failed
magic_link_rate_limited
magic_link_blocked_by_policy
invite_created
invite_accepted
invite_accept_failed
mfa_enroll_started
mfa_enrolled
mfa_challenge_issued
mfa_challenge_succeeded
mfa_challenge_failed
mfa_disabled
user_suspended
user_reactivated
user_deprovisioned
auth_policy_changed
email_delivery_failed
```

Every row carries `actor_user_id`, `target_user_id` (when applicable),
`organization_id`, `ip_address`, `user_agent`, `metadata` (JSONB), and
`created_at`. The write is best-effort — if the audit row fails, the
auth flow itself is not blocked, but the failure is recorded in the
application logs.

## 9. SCIM readiness (foundation only)

The data model and service layer needed for SCIM 2.0 are present:

- `users.account_source` reserves `'scim'`.
- `users.external_id` and `users.scim_last_sync_at` columns exist.
- Lifecycle service functions are SCIM-callable (idempotent, atomic).

Public SCIM endpoints are **not** shipped. We will not deliver a
half-built SCIM surface — when we ship it, it will pass the
`scim2-compliance-test-utils` suite and have a per-tenant attribute
mapping contract. See [docs/runbooks/union-eyes-identity-lifecycle.md](../../runbooks/union-eyes-identity-lifecycle.md)
for the engineering position.

## 10. Honest gaps (known and named)

- WebAuthn / passkeys: deferred; TOTP ships first.
- Public SCIM endpoints: deferred; service-layer foundations shipped.
- Geolocation-based "impossible travel": needs a data provider; not in scope.
- Device fingerprinting: needs client-side instrumentation; not in scope.
- Public status page: reserved at status.unioneyes.app, not yet operational.
- Admin UI for suspend / reactivate / deprovision: service functions exist; HTTP UI not yet built.

These gaps are documented so a buyer never discovers them mid-pilot.
