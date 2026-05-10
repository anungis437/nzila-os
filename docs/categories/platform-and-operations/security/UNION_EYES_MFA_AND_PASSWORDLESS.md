# Union Eyes — MFA and Passwordless Authentication

_Last updated: 2026-04-24_

This document describes the Union Eyes multi-factor authentication (MFA)
architecture, the decision to ship TOTP instead of WebAuthn in this round,
and the semantics of policy-forced MFA for privileged roles.

## Summary

| Capability | Status | Shipped in |
|---|---|---|
| TOTP (RFC 6238) via authenticator app | ✅ Shipped | 2026-04-24 |
| 10 single-use recovery codes | ✅ Shipped | 2026-04-24 |
| MFA challenge token (post-password step-up) | ✅ Shipped | 2026-04-24 |
| Org policy: require MFA for selected roles | ✅ Shipped | 2026-04-24 |
| Admin override / force-disable MFA | ✅ Shipped (via `disableMfa` service) | 2026-04-24 |
| AES-256-GCM encryption of TOTP secrets at rest | ✅ Shipped | 2026-04-24 |
| WebAuthn / passkeys | ⏸ Deferred | TBD |
| SMS OTP | ❌ Out of scope | Not planned |

## Why TOTP, not WebAuthn

WebAuthn is the stronger factor but adds material complexity we cannot
ship honestly in a single pass:

- Requires `@simplewebauthn/server` + browser ceremony instrumentation.
- Requires careful handling of attestation, origin/RP-ID configuration,
  and credential-replay protection.
- Needs a fallback factor anyway (users lose devices), so TOTP +
  recovery codes would still be required.

TOTP is RFC 6238, interoperable with every major authenticator app
(Microsoft Authenticator, 1Password, Google Authenticator, Authy), and
can be delivered with zero external dependencies. We implement it inline
(~160 lines) in `packages/platform-auth/src/mfa/totp.ts`. WebAuthn will
be added as an additional factor once the TOTP foundation has been
observed in production for a release cycle.

## Data model

Two new tables in the `user_management` schema:

### `mfa_totp`

| Column | Type | Notes |
|---|---|---|
| `user_id` | varchar PK | One row per user; 1:1 with `users` |
| `secret_encrypted` | text | AES-256-GCM; format `v1:<iv-hex>:<tag-hex>:<ct-hex>` |
| `recovery_codes_hashed` | jsonb | Array of Argon2id-hashed one-time codes |
| `enabled_at` | timestamptz | NULL until first-code verification |
| `disabled_at` | timestamptz | NULL unless disabled; enrolled state = enabled=NOT NULL and disabled=NULL |
| `last_used_at` | timestamptz | Updated on every successful challenge |

### `mfa_challenges`

Ephemeral table — challenges have a 5-minute TTL and are single-use.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Default `gen_random_uuid()` |
| `user_id` | varchar | FK to `users` |
| `token_hash` | text UNIQUE | SHA-256 of the opaque challenge token |
| `method` | varchar(16) | `'totp'` today; future: `'webauthn'`, `'recovery'` |
| `expires_at` | timestamptz | Always `created_at + 5 min` |
| `consumed_at` | timestamptz | NULL until redeemed; set when challenge passes |
| `attempts` | int | Max 5 before the challenge row is considered spent |
| `ip_address`, `user_agent` | text | Captured at `/mfa/challenge` time — MUST match the original IP/UA within reason (soft-check) |

### `users.two_factor_enabled`

Denormalised boolean kept in sync with `mfa_totp.enabled_at IS NOT NULL AND disabled_at IS NULL`.
Used by the login path to avoid a second DB roundtrip when MFA is off.

### `org_auth_policies.mfa_required_for_roles`

JSONB array of role names. When a user's role is in the array, the login
flow forces an MFA challenge regardless of whether the user has enrolled.
Valid roles: `member`, `steward`, `chief_steward`, `admin`, `coo`,
`app_owner`, `platform_admin`.

## Secret encryption at rest

TOTP secrets are AES-256-GCM encrypted. The key is derived as follows:

1. If `AUTH_MFA_ENCRYPTION_KEY` is set (64 hex chars), use it directly.
2. Otherwise, compute SHA-256 of `AUTH_SECRET` and use the 32-byte digest.

The second path is a safe default for small deployments but rotates with
`AUTH_SECRET`, so production MUST set `AUTH_MFA_ENCRYPTION_KEY`
explicitly. Rotating the MFA key **requires re-encrypting every
`mfa_totp.secret_encrypted` row** — there is no transparent key
rotation today.

## Enrollment flow

1. User clicks "Enable two-factor" at `/<locale>/settings/mfa`.
2. Client → `POST /api/auth/mfa/enroll` (session-authenticated).
3. Server calls `enrollMfa(userId, userEmail, issuer='Union Eyes')`:
   - Generates 20 random bytes → 32 base32 chars → TOTP secret.
   - Encrypts the secret.
   - Generates 10 recovery codes (40 bits each, `XXXX-XXXX-XX` shape).
   - Argon2id-hashes each code, stores hashes in `recovery_codes_hashed`.
   - Writes `enabled_at = NULL` (pending verification).
   - Audit event: `mfa_enroll_started`.
4. Response: `{otpAuthUri, secret, recoveryCodes}`.
5. Client renders QR via `api.qrserver.com` (fallback: manual secret).
6. User enters the first 6-digit code from their authenticator.
7. Client → `POST /api/auth/mfa/verify-enroll` with `{code}`.
8. Server verifies code against the (decrypted) stored secret with a ±1
   window. On success, sets `enabled_at = now()` and
   `users.two_factor_enabled = true`. Audit event: `mfa_enrolled`.

The raw secret and raw recovery codes are returned **exactly once** in
the response to `/enroll`. They are never logged or persisted
plain-text. If the user loses them before verification, they must
re-enroll.

## Challenge (login) flow

1. User submits email + password at `/login`.
2. Server validates credentials, then in order:
   - Checks `lifecycleState`: anything other than `active` → fail.
   - Runs `assessRisk({userId, ip, ua, roles})`:
     - Tier `high` → `soft_lockout` → generic error, no challenge.
     - Tier `medium` → `require_mfa` regardless of enrollment.
     - Tier `low` → continue.
   - Checks `mfa_totp` for active enrollment AND `org_auth_policies.mfa_required_for_roles` for role-forced MFA.
3. If MFA is required **and** enrolled:
   - Calls `issueMfaChallenge({userId, ip, ua})` → 32-byte opaque token,
     SHA-256 hashed at rest, 5-minute TTL.
   - Response: `{success: true, requiresMfa: true, mfaChallengeToken, mfaChallengeExpiresAt}`.
   - **No session cookie is set yet.**
4. If MFA is required **and NOT enrolled**:
   - Returns a hard error telling the user to contact an admin. This
     path prevents an attacker from bypassing a policy-enforced MFA
     simply by having valid credentials.
5. Client shows the MFA step. User enters either:
   - 6-digit TOTP code from authenticator, OR
   - One of the 10 recovery codes.
6. Client → `POST /api/auth/mfa/challenge` with
   `{challengeToken, code | recoveryCode}`.
7. Server:
   - Looks up the challenge by SHA-256 hash of the token.
   - Rejects if expired, consumed, or `attempts >= 5`.
   - Verifies TOTP (±1 step window) OR compares the recovery code against
     each stored Argon2id hash in constant-ish time. If a recovery code
     matches, it is **removed** from the array (single-use).
   - On success: creates a full PG session, sets the `nzila_session`
     cookie, marks the challenge `consumed_at`.
   - Audit events: `mfa_challenge_issued`, `mfa_challenge_succeeded` /
     `mfa_challenge_failed`.

## Disabling MFA

- **Self-service:** `POST /api/auth/mfa/disable` with optional reason.
  Sets `disabled_at`, flips `users.two_factor_enabled = false`.
- **Admin override:** via `disableMfa(targetUserId, actorUserId, reason)`
  service call. Not yet exposed as an HTTP endpoint — expose via your
  user-admin UI when needed.

Disabling MFA does **not** delete the recovery codes — they remain
hashed in the row so re-enabling MFA does not require a full
re-enrollment UX.

## Recovery codes

- Generated: 10 codes per enrollment, 40 bits each, displayed once.
- Stored: Argon2id-hashed in a JSONB array.
- Consumed: Single-use. On successful challenge via recovery code, the
  hash is **removed** from the array and the mutation is persisted.
- Regenerating: There is no "regenerate recovery codes" endpoint in
  this release — users must disable + re-enroll to get a new set. This
  is a documented rough edge; add a dedicated endpoint when backlog
  allows.

## Policy: force MFA for roles

At `/<locale>/admin/auth-policy` (admin role or higher):

- Toggle-per-role chips: `member`, `steward`, `chief_steward`, `admin`,
  `coo`, `app_owner`, `platform_admin`.
- Saved to `org_auth_policies.mfa_required_for_roles` as a JSONB array.
- The login path unconditionally forces a challenge for any member
  whose role is in the array. If they have not enrolled, they are told
  to contact their admin.

## Rate limiting and abuse protection

- **Challenge attempts:** capped at 5 per challenge row.
- **Challenge TTL:** 5 minutes; re-trying requires a fresh login.
- **IP/UA binding:** recorded at issue + verify; mismatches do not block
  today but are logged as `pending_ip` / `pending_user_agent` metadata
  for forensic review.
- **Recovery code reuse:** impossible — hash is removed on use.

## Honest deferred items

- WebAuthn / passkeys.
- Admin HTTP endpoints for: rotating a user's TOTP secret,
  regenerating their recovery codes.
- Bulk-enroll UX (e.g. QR-code-in-printable-PDF for new hires).
- Push-based MFA (Microsoft Authenticator push, Duo, etc.) — requires
  enterprise-tier integrations.

## Key env vars

| Variable | Purpose | Default |
|---|---|---|
| `AUTH_MFA_ENCRYPTION_KEY` | 64-hex-char AES-256 key for TOTP secrets | Derived from `AUTH_SECRET` |
| `AUTH_SECRET` | NextAuth + fallback MFA key derivation | Required |
| `RESEND_API_KEY` | Transactional email (not MFA-specific, used for magic link / invite / reset) | Required in prod |
