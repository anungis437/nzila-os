# Union Eyes — Identity Lifecycle Runbook

_Last updated: 2026-04-24_

This runbook covers how to:

- Provision, suspend, reactivate, and deprovision Union Eyes user
  accounts.
- Understand the `account_source` field and why it matters.
- Operate the SCIM foundation that ships with this release (not yet a
  public endpoint, but the columns, service functions, and audit trail
  are all present and consistent with a future SCIM 2.0 service).

## Lifecycle states

`users.lifecycle_state` is a `varchar(32)` with these values:

| State | Meaning | Can log in? | Visible in org member list? |
|---|---|---|---|
| `active` | Default working state | ✅ Yes | ✅ Yes |
| `suspended` | Temporarily blocked, may be reversed | ❌ No | ✅ Yes (flagged) |
| `deprovisioned` | Hard off-boarded; data retained for audit | ❌ No | ❌ No (filtered) |
| `pending_invite` | Account row exists, user has not accepted invite yet | ❌ No | ✅ Yes (flagged) |

Transitions:

```
                  accept invite
pending_invite ─────────────────▶ active
                                  │
                                  ├── suspend ──▶ suspended ── reactivate ──▶ active
                                  │
                                  └── deprovision ──▶ deprovisioned  (terminal)
```

`deprovisioned` is **terminal** — we do not recycle identities. To
re-hire someone, create a fresh account.

## Account source

`users.account_source` records how the account was created:

| Value | Meaning |
|---|---|
| `local` | Email + password signup (default) |
| `entra_sso` | First login via Microsoft Entra SSO auto-provisioned the row |
| `magic_link` | Account materialised from a magic-link flow |
| `invite` | Accepted a direct invite |
| `scim` | Provisioned by an external SCIM client (future) |

Why it matters for operations:

- An `entra_sso` account's password column is `NULL` — do NOT try to
  reset a password for them; direct them to your IdP's password reset.
- A `scim`-sourced account should be managed by your IdP's SCIM
  provisioning — manual suspend/deprovision in Union Eyes will be
  **overwritten** on the next SCIM sync once the endpoint is live.
  Today (no public SCIM endpoint yet), manual management is safe.
- `magic_link` and `invite` accounts may not have a password — they
  log in via email link until they set one.

## Operations

All lifecycle mutations go through
`packages/platform-auth/src/lifecycle/service.ts`:

```ts
await suspendUser({ targetUserId, actorUserId, reason });
await reactivateUser({ targetUserId, actorUserId });
await deprovisionUser({ targetUserId, actorUserId, reason });
```

These functions:

1. Update `users.lifecycle_state`.
2. **Revoke every active session** for that user by nullifying
   `auth_user_sessions.expires_at`.
3. If deprovisioning: also mark `users.deleted_at = now()` (soft delete)
   so org-scoped queries exclude the row.
4. Write an audit event:
   `user_suspended` / `user_reactivated` / `user_deprovisioned` with
   `actor_user_id`, `target_user_id`, `reason`, `ip`, `ua`.

### Suspend

Use when you want a reversible, immediate block:

```sql
-- preview
SELECT id, email, lifecycle_state FROM user_management.users WHERE email = 'foo@example.com';
```

Then in an admin UI or script:

```ts
await suspendUser({
  targetUserId: 'usr_123',
  actorUserId: 'usr_admin',
  reason: 'Investigation: anomalous activity on 2026-04-23',
});
```

Effect:
- User's existing sessions are terminated.
- Next login attempt returns a generic "contact your administrator" error.
- Org member list shows them as suspended (UI surface TBD).

### Reactivate

```ts
await reactivateUser({
  targetUserId: 'usr_123',
  actorUserId: 'usr_admin',
});
```

Re-enables login immediately. Does **not** regenerate invitations or
passwords — their existing credentials still work. If MFA was enrolled,
it is still enrolled.

### Deprovision (off-boarding)

```ts
await deprovisionUser({
  targetUserId: 'usr_123',
  actorUserId: 'usr_admin',
  reason: 'Employment ended 2026-04-24',
});
```

Effect:
- All sessions terminated.
- `lifecycle_state = 'deprovisioned'`, `deleted_at = now()`.
- Row is excluded from org-scoped queries that filter on `deleted_at IS NULL`.
- MFA enrollment retained (for audit) but functionally unreachable.
- Organization memberships **retained** for audit/evidence trail — do
  not delete rows from `organization_members` for deprovisioned users.

### Forensic queries

```sql
-- who suspended whom, with reason, last 30 days
SELECT
  created_at,
  event_type,
  actor_user_id,
  target_user_id,
  metadata->>'reason' AS reason
FROM user_management.auth_audit_events
WHERE event_type IN ('user_suspended','user_reactivated','user_deprovisioned')
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

## SCIM foundation (future-ready, not yet exposed)

This release ships the **data model and service layer** needed for SCIM
2.0 but deliberately does not expose public SCIM endpoints.

### What ships today

- `users.account_source` column with `'scim'` reserved value.
- `users.external_id` — stable external identifier from IdP.
- `users.scim_last_sync_at` — set by the SCIM layer when implemented.
- `lifecycle/service.ts` functions are idempotent and use the same
  canonical update path an HTTP SCIM handler will call.
- Role mapping from SCIM `groups` → `organization_members.role` has a
  scaffolded helper (`syncRolesFromGroups`).

### Why not ship public endpoints now

- Requires a shared-secret or mTLS auth model for the IdP.
- Requires an agreed attribute mapping contract with each enterprise
  tenant (IdP groups → Union Eyes roles).
- Requires load testing: SCIM clients can burst thousands of
  requests/minute during bulk enrolments.
- Shipping half of SCIM is worse than shipping none: clients will
  partially sync and you'll inherit stale state.

### When you add SCIM

The endpoint handler for `PATCH /scim/v2/Users/:id` should:

1. Authenticate the SCIM client (bearer token in `scim_bearer_tokens`).
2. Map the operation to one of `suspendUser` / `reactivateUser` /
   `deprovisionUser` — **do not write directly to the users table**.
3. Update `scim_last_sync_at`.
4. Return the SCIM-compliant JSON envelope.

## Key env vars

| Variable | Purpose |
|---|---|
| `AUTH_SESSION_TTL_SECONDS` | Session cookie TTL; affects how quickly suspend/deprovision propagates if session revocation fails |
| `RESEND_API_KEY` | Optional — used to send a "your account has been deprovisioned" email if you wire `sendEmail` into `deprovisionUser` |

## Honest deferred items

- No admin HTTP UI for suspend/reactivate/deprovision yet (service
  functions exist; call them from a script or scripted admin flow).
- No automated email to the user on suspend / deprovision — wire this in
  `lifecycle/service.ts` when ready (Resend is already configured).
- Public SCIM 2.0 endpoints — see above.
- No "just-in-time" access requests (workflow/approval around
  `reactivateUser`) — all lifecycle mutations are synchronous and
  require a human admin actor today.
