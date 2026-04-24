# Access Control Model

_Vendor risk pack. Last revised: 2026-04-24._

For the buyer-facing version see [`../trust-center/04-access-control-model.md`](../trust-center/04-access-control-model.md).
For the technical reference see [`../../security/UNION_EYES_AUTH_MODEL.md`](../../security/UNION_EYES_AUTH_MODEL.md).

## Authentication factors (shipped)

| Factor | Implementation | Notes |
|---|---|---|
| Email + password | Argon2id (OWASP) | Opaque server-side session, 24 h cookie |
| Magic-link | 256-bit random token, SHA-256-hashed at rest, single-use, 15 min TTL | Sent via Resend |
| Microsoft Entra SSO | NextAuth v5 OAuth/OIDC | Auto-provisions user row on first login |
| TOTP MFA | RFC 6238, ±1 step window | Secrets AES-256-GCM at rest |
| Recovery codes | 10 codes per enrollment, Argon2id-hashed | Removed-on-use |

## Roles

Hierarchy: `app_owner > coo > admin > chief_steward > steward > member`.

- Roles are **organisation-scoped**. There is no global cross-tenant admin role.
- `withOrganizationAuth(handler)` is the required wrapper for every API route.
- `requireRole(role)` and `hasMinRole(role)` enforce the hierarchy.
- Invite-baked roles cannot be overridden by the recipient or by request body.

## Org-level policy controls

Surface: `/<locale>/admin/auth-policy` (role ≥ `admin`).

```
allowLocalAuth      : boolean
allowMagicLink      : boolean
allowSso            : boolean
requireSso          : boolean
requireInvite       : boolean
passwordResetAllowed: boolean
allowedEmailDomains : string[]
mfaRequiredForRoles : string[]   // any of the role names above
```

Saves are validated for contradictions. Each save writes
`auth_policy_changed` to the audit log with the prior and new values
in metadata.

## Data isolation

- Every tenant-bearing row carries `organization_id`.
- PostgreSQL row-level security policies enforce isolation at the database layer.
- The precedent-search engine throws a hard `CrossOrgPrecedentLeakError` if a candidate row sneaks in from another organisation.

## Lifecycle

| State | Login? | Visible? | Notes |
|---|---|---|---|
| `active` | ✅ | ✅ | Default |
| `pending_invite` | ❌ | ✅ flagged | Account exists, invite not yet accepted |
| `suspended` | ❌ | ✅ flagged | Reversible; sessions revoked |
| `deprovisioned` | ❌ | ❌ | Terminal; soft-deleted; org membership retained for audit |

Service functions: `suspendUser`, `reactivateUser`, `deprovisionUser`.
Each call atomically:

1. Updates `users.lifecycle_state`.
2. Nullifies `auth_user_sessions.expires_at` for that user.
3. Writes an audit row.

## Risk-based step-up

| Tier | Trigger | Action |
|---|---|---|
| Low | Recognised IP and UA, no recent failures, non-privileged role | Continue |
| Medium | New device / IP, or role ∈ {admin, coo, app_owner, platform_admin} | Force MFA |
| High | ≥ 3 failed logins in 15 min from same IP or account | Soft-lockout (generic failure) |

## Audit log event types (relevant subset)

```
signup, login_success, login_failed, account_locked,
logout, session_revoked,
password_reset_request, password_reset_complete,
magic_link_requested, magic_link_consumed, magic_link_verify_failed,
invite_created, invite_accepted, invite_accept_failed,
mfa_enroll_started, mfa_enrolled,
mfa_challenge_issued, mfa_challenge_succeeded, mfa_challenge_failed,
mfa_disabled,
user_suspended, user_reactivated, user_deprovisioned,
auth_policy_changed, email_delivery_failed
```

Every row carries `actor_user_id`, `target_user_id` (when applicable),
`organization_id`, `ip_address`, `user_agent`, `metadata` (JSONB),
`created_at`. Writes are best-effort and never block auth.

## Evidence pointers

| Concern | Module |
|---|---|
| Password service | `packages/platform-auth/src/password/auth-service.ts` |
| Magic-link service | `packages/platform-auth/src/magic-link/service.ts` |
| Invite service | `packages/platform-auth/src/invites/service.ts` |
| Org policy service | `packages/platform-auth/src/policy/service.ts` |
| TOTP MFA | `packages/platform-auth/src/mfa/{totp,service,handlers}.ts` |
| Risk assessor | `packages/platform-auth/src/risk/assess.ts` |
| Lifecycle | `packages/platform-auth/src/lifecycle/service.ts` |
| Demo seed | `pnpm seed:staging --app=union-eyes` (`tooling/staging-seed/`); legacy: `apps/union-eyes/scripts/seed-union-eyes-demo.ts` |
| Auth audit table | `user_management.auth_audit_log` |
