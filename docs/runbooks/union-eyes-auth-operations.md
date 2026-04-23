# Union Eyes — Auth Operations Runbook

Owner: Platform Auth · Last revised: 2026-04-23

## Day-to-day operations

### Issue a magic link manually (test or recovery)

```powershell
curl -X POST https://union-eyes.example/api/auth/magic-link/request `
  -H "Content-Type: application/json" `
  -d '{"email":"user@example.com"}'
```

In `NODE_ENV=development` the response includes the raw token; in production
the token is only delivered via the platform email service and never echoed
back. The link the user clicks is `/magic-link/verify?token=<raw>`.

### Issue an org invite

Admins (role >= `admin`) call:

```powershell
curl -X POST https://union-eyes.example/api/auth/invite/create `
  -H "Content-Type: application/json" `
  -H "Cookie: nzila_session=<admin session token>" `
  -d '{"email":"new.user@example.com","role":"steward"}'
```

The recipient opens `/invite/accept?token=<raw>` and confirms their name.
The role on the invite cannot be changed by the recipient.

### Tighten an org's auth policy (e.g. require SSO)

```sql
INSERT INTO user_management.org_auth_policies (organization_id, allow_local_auth, allow_magic_link, allow_sso, require_sso, updated_by)
VALUES ('<org uuid>', false, false, true, true, '<admin user id>')
ON CONFLICT (organization_id) DO UPDATE SET
  allow_local_auth = EXCLUDED.allow_local_auth,
  allow_magic_link = EXCLUDED.allow_magic_link,
  require_sso = EXCLUDED.require_sso,
  updated_by = EXCLUDED.updated_by,
  updated_at = now();
```

After this, `/login` for that org's users renders only the "Continue with
Microsoft" button. Existing PG sessions remain valid for their TTL — to
force re-auth, also revoke active sessions:

```sql
UPDATE user_management.user_sessions
SET is_active = false
WHERE user_id IN (
  SELECT user_id FROM user_management.organization_users
  WHERE organization_id = '<org uuid>'
);
```

## Incident response

### Suspected token compromise (single user)

1. Revoke all of the user's sessions: `UPDATE user_management.user_sessions SET is_active = false WHERE user_id = '<id>';`
2. Invalidate any pending magic links: `UPDATE user_management.magic_links SET used_at = now() WHERE user_id = '<id>' AND used_at IS NULL;`
3. Force a password reset: `UPDATE user_management.users SET password_hash = NULL WHERE user_id = '<id>';` (forces them through forgot-password or magic link on next visit)

### Suspected widespread compromise

1. Rotate `AUTH_SECRET` (NextAuth JWT signing key) — all SSO sessions become invalid immediately.
2. `UPDATE user_management.user_sessions SET is_active = false;` — all PG sessions invalidated.
3. `UPDATE user_management.magic_links SET used_at = now() WHERE used_at IS NULL;` — all unused magic links voided.
4. `UPDATE user_management.invites SET revoked_at = now() WHERE accepted_at IS NULL AND revoked_at IS NULL;` — all unaccepted invites voided.

### Account lockout (legitimate user)

Lookup current state:

```sql
SELECT user_id, email, failed_login_attempts, account_locked_until
FROM user_management.users
WHERE lower(email) = lower('user@example.com');
```

Clear the lockout:

```sql
UPDATE user_management.users
SET failed_login_attempts = 0, account_locked_until = NULL
WHERE lower(email) = lower('user@example.com');
```

## Diagnostics

### Recent auth events for a user

```sql
SELECT created_at, event_type, ip_address, metadata
FROM user_management.auth_audit_log
WHERE user_id = '<id>'
ORDER BY created_at DESC
LIMIT 50;
```

### Magic-link health (last hour)

```sql
SELECT
  COUNT(*) FILTER (WHERE used_at IS NOT NULL) AS consumed,
  COUNT(*) FILTER (WHERE used_at IS NULL AND expires_at > now()) AS pending,
  COUNT(*) FILTER (WHERE used_at IS NULL AND expires_at <= now()) AS expired,
  COUNT(*) AS issued
FROM user_management.magic_links
WHERE created_at > now() - interval '1 hour';
```

### Failed verifies (potential token brute-force)

```sql
SELECT created_at, ip_address, metadata
FROM user_management.auth_audit_log
WHERE event_type IN ('magic_link_verify_failed', 'invite_accept_failed', 'login_failed')
  AND created_at > now() - interval '15 minutes'
ORDER BY created_at DESC;
```

If you see > 50 failures from one IP in 15 minutes, block at the WAF / CDN layer.

## MFA operations

### Reset a user's TOTP (lost device)

There is no public HTTP endpoint yet; run the service call from a scripted
admin flow (`pnpm tsx scripts/…`) or a psql shell. Preferred path:

```ts
import { disableMfa } from '@nzila/platform-auth/mfa';
await disableMfa({
  targetUserId: 'usr_123',
  actorUserId: 'usr_admin',
  reason: 'Lost device, verified by phone on 2026-04-24',
});
```

The user's next login will succeed without MFA, and they will be
prompted (via the `/settings/mfa` page) to re-enroll. Audit event:
`mfa_disabled` with `actor_user_id` and `reason`.

### Recovery code regen

Users cannot regenerate recovery codes in-place in this release — they
must disable + re-enroll. If this is operationally painful, add a
`regenerateRecoveryCodes(userId)` path that rewrites
`mfa_totp.recovery_codes_hashed` without touching the secret.

### Force MFA for privileged roles

Admins at `/<locale>/admin/auth-policy` can toggle per-role chips. Effect
is immediate — the next login attempt by an affected user is challenged.

If a targeted user has NOT enrolled, their login is rejected with a
generic "contact your administrator" message. Fix: ask them to
self-enroll at `/<locale>/settings/mfa` first (their pre-MFA session,
if still valid, lets them do so) OR clear the role requirement
temporarily to give them a grace window.

### Audit: who enrolled, used, or disabled MFA

```sql
SELECT created_at, event_type, user_id, actor_user_id, metadata
FROM user_management.auth_audit_log
WHERE event_type LIKE 'mfa\_%' ESCAPE '\'
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

## Identity lifecycle operations

See [union-eyes-identity-lifecycle.md](./union-eyes-identity-lifecycle.md)
for the full runbook. Quick reference:

| Action | Service call | Effect |
|---|---|---|
| Suspend | `suspendUser({targetUserId, actorUserId, reason})` | Reversible block; sessions revoked |
| Reactivate | `reactivateUser({targetUserId, actorUserId})` | Lifts suspension |
| Deprovision | `deprovisionUser({targetUserId, actorUserId, reason})` | Terminal off-boarding; soft-delete |

All three:
1. Flip `users.lifecycle_state`.
2. Null out `auth_user_sessions.expires_at` (immediate session kill).
3. Write an audit event.

## Risk tier explanations

See [../security/UNION_EYES_AUTH_MODEL.md#10-risk-based-authentication](../security/UNION_EYES_AUTH_MODEL.md#10-risk-based-authentication)
for the full tier matrix.

Quick forensic query: why was a user challenged / locked?

```sql
SELECT created_at, event_type, metadata->>'risk_tier' AS tier, metadata->>'reason' AS reason
FROM user_management.auth_audit_log
WHERE user_id = 'usr_123'
  AND event_type IN ('login_success','login_failed','login_soft_lockout','mfa_challenge_issued')
ORDER BY created_at DESC
LIMIT 20;
```

## Email delivery failures

The transport (`apps/union-eyes/lib/auth-emails.ts`) writes a row to
`auth_audit_log` with `event_type = 'email_delivery_failed'` when
Resend returns a non-2xx. Monitor:

```sql
SELECT created_at, metadata
FROM user_management.auth_audit_log
WHERE event_type = 'email_delivery_failed'
  AND created_at > now() - interval '1 hour';
```

Common causes: `RESEND_API_KEY` not set in the running environment
(staging vs prod), sender domain not verified in Resend, or recipient
domain bouncing.
