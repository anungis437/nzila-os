# Union Eyes — Auth Procurement Q&A

_Buyer-safe answers to the questions IT, security, and procurement
teams ask before signing. Every answer is tied to a real implemented
capability — no roadmap framed as present tense._

_Last revised: 2026-04-24._

---

## 1. Do you support MFA?

**Yes.** TOTP-based two-factor (RFC 6238) using any standard
authenticator app — Microsoft Authenticator, 1Password, Google
Authenticator, Authy.

- Self-enroll at `/<locale>/settings/mfa` (QR code + manual secret).
- 10 single-use recovery codes shown once at enrollment.
- TOTP secrets are AES-256-GCM encrypted at rest.
- Recovery codes are Argon2id-hashed; removed from the row when used.
- Org admins can require MFA per role (e.g. all `admin`, `coo`, `app_owner` accounts).

WebAuthn / passkeys are on the roadmap; TOTP is the supported factor today.

---

## 2. Do you support SSO?

**Yes.** Microsoft Entra ID via OAuth/OIDC (NextAuth v5).

- Auto-provisions a user row on first sign-in.
- Org admins can make SSO **the only** sign-in method (`requireSso = true`).
- Group-claim mapping is supported via the existing Entra group → app role pipeline.

SAML and Okta SSO are not currently shipped. They are negotiable on enterprise contracts.

---

## 3. Can we disable passwords?

**Yes.** Per organisation, set `allowLocalAuth = false` in the admin
auth-policy UI. Users sign in via SSO and/or magic-link only. Existing
passwords become unusable immediately (no fallback path).

You can also disable magic-link (`allowMagicLink = false`) and run
SSO-only by combining `requireSso = true` with the other toggles off.

---

## 4. How do you offboard users?

Three lifecycle states, all service-layer-callable today:

- `suspendUser({targetUserId, actorUserId, reason})` — reversible block. All active sessions revoked atomically. Audited.
- `reactivateUser({targetUserId, actorUserId})` — lifts a suspension.
- `deprovisionUser({targetUserId, actorUserId, reason})` — terminal off-boarding. Soft-deleted from org-scoped queries. Sessions revoked. Audit history retained.

All three flip `users.lifecycle_state` and write
`auth_audit_log.event_type IN ('user_suspended', 'user_reactivated', 'user_deprovisioned')`
with `actor_user_id`, `reason`, `ip`, `ua`.

An admin HTTP UI for these actions is on the near-term roadmap;
service functions are usable today via scripted admin flows.

---

## 5. Can admins control auth methods?

**Yes.** Per-organisation policy at `/<locale>/admin/auth-policy`
(role ≥ `admin`):

- `allowLocalAuth` — email + password on/off.
- `allowMagicLink` — magic-link sign-in on/off.
- `allowSso` — show/hide "Continue with Microsoft" button.
- `requireSso` — when true, hides all other methods.
- `requireInvite` — hides self-service signup; new users need an invite.
- `passwordResetAllowed` — hides "Forgot password?" link.
- `allowedEmailDomains` — restricts passwordless and signup to listed domains.
- `mfaRequiredForRoles` — list of roles for which TOTP is mandatory.

Validated for contradictions on save. Every change writes
`auth_policy_changed` to the audit log.

---

## 6. How are suspicious logins handled?

Every login runs through a risk assessor that returns one of:

| Tier | Trigger | Action |
|---|---|---|
| Low | Recognised IP + UA, no recent failures, non-privileged role | Continue |
| Medium | New device, new IP, or role ∈ {admin, coo, app_owner, platform_admin} | Force MFA challenge |
| High | ≥ 3 failed logins in 15 min from same IP or same account | Soft-lockout: generic failure, no challenge issued |

The risk tier is appended to the `login_success` audit row for
forensic review.

We do **not** currently use geolocation or device fingerprinting. We
say so explicitly.

---

## 7. How do invites work?

- An admin (role ≥ `admin`) sends an invite to an email address with a chosen role.
- A 256-bit random token is generated and SHA-256-hashed at rest. The plaintext token is sent only via email.
- The recipient opens `/invite/accept?token=…`, enters their name and password, and is bound to the org with the role baked into the invite.
- The role on the invite **cannot be overridden by the recipient or by the request body**.
- Invite tokens are single-use, time-limited, and audited at every step (`invite_created`, `invite_accepted`, `invite_accept_failed`).

---

## 8. How are sessions revoked?

`auth_user_sessions.expires_at` is nullified for every active session
of the affected user in a single SQL update. The next request from
any active browser is logged out instantly.

This happens automatically on:

- Suspend
- Deprovision
- Password reset (the reset path revokes all other sessions)
- Manual revocation via the admin runbook

Cookie TTL is 24 hours by default; a revoked session does not require
the cookie to expire — the server-side row drives the decision.

---

## 9. Are auth events audited?

**Yes.** `user_management.auth_audit_log` is append-only and contains
all of the following event types:

```
signup, login_success, login_failed, account_locked,
logout, session_revoked,
password_reset_request, password_reset_complete,
magic_link_requested, magic_link_consumed, magic_link_verify_failed,
magic_link_rate_limited, magic_link_blocked_by_policy,
invite_created, invite_accepted, invite_accept_failed,
mfa_enroll_started, mfa_enrolled,
mfa_challenge_issued, mfa_challenge_succeeded, mfa_challenge_failed,
mfa_disabled,
user_suspended, user_reactivated, user_deprovisioned,
auth_policy_changed, email_delivery_failed
```

Each row carries `actor_user_id`, `target_user_id` (when applicable),
`organization_id`, `ip_address`, `user_agent`, `metadata` (JSONB),
and `created_at`. Writes are best-effort — auth flow is never blocked
by a failed audit insert.

Audit-log queries are documented in
[`docs/runbooks/union-eyes-auth-operations.md`](../../runbooks/union-eyes-auth-operations.md).

---

## 10. What if an employee leaves suddenly?

Single call:

```
deprovisionUser({
  targetUserId: 'usr_…',
  actorUserId: 'usr_admin',
  reason: 'Employment ended 2026-04-24',
});
```

Effect, atomically and within the same transaction:

1. `users.lifecycle_state = 'deprovisioned'`, `users.deleted_at = now()`.
2. Every active session for that user is revoked.
3. The user is excluded from all org-scoped queries that filter on `deleted_at IS NULL`.
4. MFA enrollment is retained (for audit) but functionally unreachable.
5. Organisation membership row is **kept** (for evidence trail) — we do not silently delete history.
6. Audit row written with actor, target, reason, IP, UA.

The next API request from any of that user's sessions returns 401.
There is no propagation delay.

---

## Bonus answers

### Can we get an audit-log export?

Yes — the table is readable by your platform-admin role and exportable
via standard SQL. Bulk export endpoints are on the roadmap; today,
exports are scripted by the customer success engineer.

### Can we BYO Key Vault for MFA secret encryption?

`AUTH_MFA_ENCRYPTION_KEY` is read from environment. It can be sourced
from your own Azure Key Vault via the standard secret-injection
mechanism on Azure Container Apps. Customer-managed keys (CMK) for
the storage layer follow the standard Azure CMK pattern.

### Can we enforce password complexity?

Yes — Argon2id parameters are fixed at OWASP-recommended values.
Length minimum is set in `packages/platform-auth/src/password/policy.ts`.
We do not enforce composition rules (special-char counts, rotation
deadlines) by default — modern guidance (NIST 800-63B, current OWASP)
recommends length over composition, and we follow that guidance.

### Can we use HSM-backed signing for sessions?

Sessions are opaque tokens (no signing) — the server-side row is the
source of truth. There is nothing to HSM-back; revocation is a single
SQL update and propagates instantly.

### What about phishing-resistant authentication?

WebAuthn / passkeys are the answer to "phishing-resistant" and they
are on the roadmap. Today the closest equivalent is `requireSso = true`
combined with conditional-access policies on your Entra tenant.

---

**Companion documents**

- Trust Center: [`../trust-center/`](../trust-center/)
- Security one-pager: [`../UNION_EYES_SECURITY_ONE_PAGER.md`](../UNION_EYES_SECURITY_ONE_PAGER.md)
- Auth model (technical): [`../../security/UNION_EYES_AUTH_MODEL.md`](../../security/UNION_EYES_AUTH_MODEL.md)
- MFA + passwordless: [`../../security/UNION_EYES_MFA_AND_PASSWORDLESS.md`](../../security/UNION_EYES_MFA_AND_PASSWORDLESS.md)
- Identity lifecycle runbook: [`../../runbooks/union-eyes-identity-lifecycle.md`](../../runbooks/union-eyes-identity-lifecycle.md)
- Auth operations runbook: [`../../runbooks/union-eyes-auth-operations.md`](../../runbooks/union-eyes-auth-operations.md)
