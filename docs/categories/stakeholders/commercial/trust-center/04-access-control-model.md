# 04 — Access Control Model

_Trust Center · Last revised: 2026-04-24_

Union Eyes uses a layered model: every request is authenticated, then
authorised against an organisation-scoped role, and then constrained by
row-level data isolation in the database.

## Authentication methods

Each organisation can enable any combination of:

| Method | Notes |
|---|---|
| **Email + password** | Argon2id (OWASP parameters), opaque server-side session tokens, 24 h cookie TTL. |
| **Magic-link** | One-time, single-use, 256-bit token. Hashed at rest. Sent via Resend transactional email. |
| **Microsoft Entra SSO** | NextAuth-backed OAuth/OIDC. Auto-provisions a user row on first login. |
| **TOTP two-factor** | RFC 6238 authenticator-app codes. Optional self-enroll. Can be **required by role**. |
| **Recovery codes** | 10 single-use codes issued at MFA enrollment. Argon2id-hashed at rest. Removed-on-use. |

Every method writes to the same audit log and uses the same session
revocation path — admins can disable any user from one place regardless
of how they sign in.

## Org-level admin policy

Organisation administrators can set, at any time:

- `allowLocalAuth` — enable/disable email + password.
- `allowMagicLink` — enable/disable email-link sign-in.
- `allowSso` — show/hide the "Continue with Microsoft" button.
- `requireSso` — when on, hide all other methods (SSO-only org).
- `requireInvite` — hide self-service signup; new users must accept an invite.
- `passwordResetAllowed` — hide "Forgot password?" if the org wants to use external recovery only.
- `allowedEmailDomains` — restrict passwordless and signup to a list of approved domains.
- `mfaRequiredForRoles` — list of roles for which TOTP MFA is mandatory.

Policy changes are admin-gated at the API layer, validated for
contradictions (e.g. `requireSso=true` + `allowLocalAuth=true` is
rejected), and written to the audit log.

The admin UI lives at `/<locale>/admin/auth-policy`.

## Roles and authorisation

Roles are organisation-scoped. The hierarchy is:

```
app_owner > coo > admin > chief_steward > steward > member
```

- `withOrganizationAuth(handler)` resolves `{userId, organizationId, memberId, role}` from the session and verifies membership.
- `requireRole(role)` and `hasMinRole(role)` enforce the hierarchy in API routes.
- Invite acceptance always uses the role baked into the invite row — it cannot be overridden by request body.

## Data isolation

- Every grievance, case note, member record, and evidence row carries an `organization_id`.
- PostgreSQL row-level security policies enforce isolation **at the database layer**, not just at the application.
- The precedent-search engine throws a hard `CrossOrgPrecedentLeakError` if a candidate sneaks in from another organisation. This is a contract, not a config flag.

## Identity lifecycle

| State | Effect |
|---|---|
| `active` | Default; login works. |
| `pending_invite` | Account row exists, user has not accepted. |
| `suspended` | Reversible block. All sessions revoked immediately. Login returns "contact your administrator". |
| `deprovisioned` | Terminal off-boarding. Soft-deleted from org-scoped queries. Audit history retained. |

Suspend / reactivate / deprovision are service-level functions today.
Each one revokes all active sessions for the target user atomically and
writes an audit row with the actor, reason, IP, and user-agent.

## Risk-based step-up

Every login runs through a risk assessor that returns a tier:

| Tier | Trigger | Action |
|---|---|---|
| Low | Recognised IP and UA, no recent failures, no privileged role | Continue normally |
| Medium | New device, new IP, or role ∈ `{admin, coo, app_owner, platform_admin}` | Force MFA challenge regardless of policy |
| High | ≥ 3 failed logins in 15 minutes (per IP or per account) | Soft-lockout: generic failure, no challenge issued |

The risk tier is appended to the `login_success` audit metadata for
forensic review.

## What we do **not** do

- We do not store passwords or MFA secrets in plain text. We never
  email plaintext passwords or recovery codes after the one-time
  display.
- We do not sync passwords with any external system.
- We do not allow cross-organisation access. There is no "global
  admin" role that can read another tenant's case data.
- We do not silently fall back to a less secure factor when MFA fails.
  A failed challenge is failed; the user must re-authenticate.

## Pointers (for evidence)

| Concern | Module |
|---|---|
| Password service | `packages/platform-auth/src/password/auth-service.ts` |
| Magic-link service | `packages/platform-auth/src/magic-link/service.ts` |
| Invite service | `packages/platform-auth/src/invites/service.ts` |
| Org policy service | `packages/platform-auth/src/policy/service.ts` |
| TOTP MFA | `packages/platform-auth/src/mfa/totp.ts`, `service.ts`, `handlers.ts` |
| Risk assessor | `packages/platform-auth/src/risk/assess.ts` |
| Lifecycle | `packages/platform-auth/src/lifecycle/service.ts` |
| Audit log table | `user_management.auth_audit_log` |
