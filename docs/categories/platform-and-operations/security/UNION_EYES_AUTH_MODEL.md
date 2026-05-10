# Union Eyes — Authentication Model

Owner: Platform Auth · Last revised: 2026-04-23

This document is the source of truth for how a user proves identity to Union Eyes.

## 1. Methods supported

| Method | Status | Cookie set | Source of identity |
|---|---|---|---|
| Email + password | GA | `nzila_session` (PG-backed) | Argon2id hash in `user_management.users.password_hash` |
| Magic link (passwordless) | GA | `nzila_session` (PG-backed) | Proof-of-control of inbox; row in `user_management.magic_links` |
| Microsoft Entra SSO | GA | `__Secure-authjs.session-token` (NextAuth JWT) | Entra ID token validated via JWKS |
| Org-issued invite | GA | `nzila_session` (PG-backed) | Hashed token in `user_management.invites` |

Methods are gated per-organization by `user_management.org_auth_policies`. The
`/api/auth/methods` endpoint returns the active set so the UI shows only the
buttons that are permitted.

## 2. Session model

Two parallel session models co-exist; both are accepted by `auth()` in
`@nzila/platform-auth`:

1. **PG-backed opaque sessions** (`nzila_session`)
   - 32 random bytes, base64url-encoded
   - SHA-256 hash stored in `user_management.user_sessions.session_token_hash`
   - 24-hour TTL, `httpOnly`, `Secure` (prod), `SameSite=Lax`, path `/`
   - Used by: password login, magic-link verify, invite accept
2. **NextAuth/Entra JWT** (`__Secure-authjs.session-token`)
   - Issued by NextAuth after Entra OIDC callback
   - Verified with Microsoft JWKS at `https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys`
   - Used by: SSO sign-in only

`auth()` resolution order: PG cookie first → Entra JWT fallback. This means a
user who once logged in via SSO and is now revisiting via a magic link will
get a PG session and the SSO JWT becomes irrelevant for that browser.

## 3. Hashing & storage

| Item | Algorithm | Stored as |
|---|---|---|
| Password | Argon2id (m=19456, t=2, p=1, hash=32B) | PHC string in `users.password_hash` |
| Session token | SHA-256 | hex digest in `user_sessions.session_token_hash` |
| Magic-link token | SHA-256 | hex digest in `magic_links.token_hash` |
| Invite token | SHA-256 | hex digest in `invites.token_hash` |
| Password-reset token | SHA-256 | hex digest in `password_reset_tokens.token_hash` |

No raw secret is ever persisted at rest. Tokens are returned to the caller
exactly once — at issuance — and only over HTTPS in production.

## 4. Replay & abuse protections

- **Single-use tokens**: magic-link/invite/reset rows have a `used_at`/`accepted_at` sentinel set the first time they verify successfully; subsequent attempts fail.
- **Expiry**: magic links 15 min; invites 7 days; password resets 1 hour; PG sessions 24 hours.
- **Rate limits**:
  - Password reset: max 3 / 15 min per IP (DB-backed, scans `auth_audit_log`)
  - Magic link request: max 3 / 15 min per email (DB-backed, scans `magic_links.created_at`)
  - Magic-link verify: max 5 attempts per token before the row is poisoned
- **Account lockout**: 5 failed password attempts → `account_locked_until = now()+15min` on `users`
- **Enumeration defence**: `forgot-password`, `magic-link/request`, and `methods` always return a uniform success/positive shape; they do not reveal whether an email exists or whether an org exists.

## 5. Per-org policy

`user_management.org_auth_policies` (PK = `organization_id`) controls which
methods are allowed for a given org. **A missing row defaults to permissive**
(all methods on, none required) so existing orgs are unaffected by this
introduction.

| Column | Default | Effect |
|---|---|---|
| `allow_local_auth` | `true` | Email+password login enabled |
| `allow_magic_link` | `true` | Magic-link login enabled |
| `allow_sso` | `true` | "Continue with Microsoft" button shown |
| `require_sso` | `false` | When `true`, hides password and magic-link UI; only SSO offered |
| `require_invite` | `false` | When `true`, hides "Sign up" link on `/login`; new users must use an invite |
| `password_reset_allowed` | `true` | When `false`, hides "Forgot password?" link |
| `allowed_email_domains` | `[]` | When non-empty, magic-link request rejects emails outside the list |

Policy changes are admin-gated at the API layer and audit-logged. The
discovery endpoint (`/api/auth/methods?email=…`) returns the resolved set so
the UI can render adaptively without having to reason about the policy.

## 6. RBAC interaction (unchanged)

Authentication establishes **identity**. Authorisation is still done by:

- `withOrganizationAuth(handler)` — wraps API routes; resolves `{userId, organizationId, memberId}` from the session and verifies membership
- `requireRole(role)` / `hasMinRole(role)` — checks role in current org against a hierarchy: `app_owner` > `coo` > `admin` > `chief_steward` > `steward` > `member`
- Invite acceptance ALWAYS uses the role baked into the invite row — it cannot be overridden by request body

## 7. Audit trail

Every auth event is written to `user_management.auth_audit_log` (best-effort, never blocks the auth flow):

| Event type | Fired by |
|---|---|
| `signup` | `auth-service.signup` |
| `login_success` / `login_failed` / `account_locked` | `auth-service.login` |
| `logout` / `session_revoked` | `auth-service.logout` |
| `password_reset_request` / `password_reset_complete` | `auth-service.forgot/reset` |
| `magic_link_requested` / `magic_link_consumed` / `magic_link_verify_failed` / `magic_link_rate_limited` / `magic_link_blocked_by_policy` | `magic-link/service` |
| `invite_created` / `invite_accepted` / `invite_accept_failed` | `invites/service` |

## 8. File map

| Concern | Module |
|---|---|
| Password service | [packages/platform-auth/src/password/auth-service.ts](../../packages/platform-auth/src/password/auth-service.ts) |
| Sessions | [packages/platform-auth/src/password/session.ts](../../packages/platform-auth/src/password/session.ts) |
| Argon2id | [packages/platform-auth/src/password/password.ts](../../packages/platform-auth/src/password/password.ts) |
| Magic link | [packages/platform-auth/src/magic-link/service.ts](../../packages/platform-auth/src/magic-link/service.ts) |
| Invites | [packages/platform-auth/src/invites/service.ts](../../packages/platform-auth/src/invites/service.ts) |
| Org policy | [packages/platform-auth/src/policy/service.ts](../../packages/platform-auth/src/policy/service.ts) |
| DB schema | [packages/db/src/schema/auth.ts](../../packages/db/src/schema/auth.ts) |
| Migration | [migrations/2026-04-23_multi_mode_auth.sql](../../migrations/2026-04-23_multi_mode_auth.sql) |
| Entra/NextAuth catchall | [apps/union-eyes/app/api/auth/[...nextauth]/route.ts](../../apps/union-eyes/app/api/auth/%5B...nextauth%5D/route.ts) |
| Login UI | [apps/union-eyes/components/auth/login-form.tsx](../../apps/union-eyes/components/auth/login-form.tsx) |
| MFA (TOTP) | [packages/platform-auth/src/mfa/totp.ts](../../packages/platform-auth/src/mfa/totp.ts) |
| MFA service | [packages/platform-auth/src/mfa/service.ts](../../packages/platform-auth/src/mfa/service.ts) |
| Risk assessment | [packages/platform-auth/src/risk/assess.ts](../../packages/platform-auth/src/risk/assess.ts) |
| Lifecycle service | [packages/platform-auth/src/lifecycle/service.ts](../../packages/platform-auth/src/lifecycle/service.ts) |
| Email transport | [apps/union-eyes/lib/auth-emails.ts](../../apps/union-eyes/lib/auth-emails.ts) |

## 9. Multi-factor authentication (MFA)

See [UNION_EYES_MFA_AND_PASSWORDLESS.md](./UNION_EYES_MFA_AND_PASSWORDLESS.md) for full detail.

- **Factor shipped**: TOTP (RFC 6238), authenticator-app based.
- **Enrollment**: self-service at `/<locale>/settings/mfa`.
- **Policy**: admins can force MFA per role via `org_auth_policies.mfa_required_for_roles`.
- **Secrets at rest**: AES-256-GCM, key from `AUTH_MFA_ENCRYPTION_KEY` or derived from `AUTH_SECRET`.
- **Recovery codes**: 10 single-use codes, Argon2id-hashed, shown once at enrollment.
- **Login flow**: password → (optional) MFA step-up via opaque challenge token (5-min TTL, 5-attempt cap, single-use) → session cookie.
- **WebAuthn**: deferred. TOTP covers the common enterprise MFA requirement with zero external dependencies; WebAuthn will be added as an additional factor.

## 10. Risk-based authentication

Every login runs through `assessRisk()` in
[packages/platform-auth/src/risk/assess.ts](../../packages/platform-auth/src/risk/assess.ts).
The function returns a tier and a recommended action:

| Tier | Trigger | Action |
|---|---|---|
| `low` | Recognised IP/UA, no recent failures, no privileged role | `continue` — normal login |
| `medium` | New IP, new UA, or role ∈ {`admin`, `coo`, `app_owner`, `platform_admin`} | `require_mfa` — challenge even if policy didn't force it |
| `high` | ≥ 3 failed logins in last 15 min from same IP/account | `soft_lockout` — generic failure, no token returned |

This is intentionally a conservative first pass. Geolocation-based
"impossible travel" and device fingerprinting are deferred until we
have a data provider and a client-side fingerprint collector.

## 11. Identity lifecycle

See [../runbooks/union-eyes-identity-lifecycle.md](../runbooks/union-eyes-identity-lifecycle.md).

- `users.lifecycle_state`: `active` | `suspended` | `deprovisioned` | `pending_invite`.
- `users.account_source`: `local` | `entra_sso` | `magic_link` | `invite` | `scim`.
- Login path rejects any user not in `active`.
- Suspend / reactivate / deprovision are service functions today (no public admin UI yet) — SCIM 2.0 endpoints are deliberately deferred until per-tenant attribute contracts exist.
