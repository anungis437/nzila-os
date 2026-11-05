# UE Identity Cleanup — Compatibility Record and Open Blockers

Branch: `agents/ue-remove-clerk` (base `0c994b968`). Not pushed. Not merged. Staging and production: **NO-GO**.

## What was done

Provider-specific (Clerk) code, copy, CSS, locale text, fixtures and archive docs were removed from the Union Eyes app. Identity is Entra-based. Authority is never derived from a provider claim.

## Intentional retentions (not defects)

| Item | Reason |
|---|---|
| `UserRole.CLERK` | Domain role (union clerk), unrelated to the provider. |
| Immutable migrations and physical `clerk_user_id` / `clerk_organization_id` columns | Renames require a governed, reversible migration with a data plan. |
| `webhooks/clerk/` URL | Kept as logged deprecated alias of the auth webhook; consumer unverifiable from the repo. |
| `X-Clerk-Secret-Key` header | Log-and-ignore only (detection). Never authenticates. |
| Whop checkout metadata `clerkUserId` | Sent alongside `userId` (same authenticated value) for an unverifiable external consumer. Informational only. |

## Security-relevant behaviour changes

- The Entra `tid` is no longer used as an organization identifier.
- A token `org_id` claim is a claim only. `resolve_organization_context(org_id, user_id)` requires an active, non-deleted `OrganizationMembers` row on every call (not cached) and fails closed.
- Legacy `CLERK_*` environment variables are not read; a startup warning is logged if one is set without its `AUTH_*` counterpart.
- Verified by 13 DB-free tests (`backend/auth_core/tests_org_binding.py`); a mutant removing the membership check is killed.

## Credential exposure (value intentionally not recorded)

A repository-known default test password existed in docs, a seed comment and two provisioning scripts. Removed from current files; scripts now require an environment-supplied secret.

Residual and required actions:

1. The value remains in frozen migration `db/migrations/0095_ms_celebrations_auth_users.sql` (SQL comment; immutable) and in git history.
2. `scripts/provision-entra-test-users.mjs` created real Entra External ID staging users with that default. **Rotate or disable those accounts** (needs Entra access; not possible from the repo).
3. Treat the secret as compromised; history rewrite is a separate, maintainer-approved decision.
4. Other hardcoded fixtures were noted, not changed: `apps/union-eyes/tests/fixtures/test-users.ts` (`UE_TEST_USER_PASSWORD`, CI QA fixture) and `scripts/seed-zonga-auth-accounts.mjs` (other app).

## Open unknowns (need owner confirmation)

| Unknown | Impact |
|---|---|
| Does anything call `api/auth_core/webhooks/clerk/` or `webhooks/auth/`? | If not, the alias and the Clerk-shaped payload handler can be deleted. Nothing in-repo calls it. v2 Bicep sets no `AUTH_WEBHOOK_SECRET` (fails closed with 401). |
| Do live environments still set `CLERK_*` or `X-Clerk-Secret-Key` callers? | Startup warning will surface it; out-of-repo config is unverifiable. |
| Consumer of Whop `metadata.clerkUserId` | Keep dual keys until confirmed, then drop the legacy key. |
| Do the Entra test accounts still accept the old default? | Rotation required if yes. |

## Seed / replay finding (pre-existing, not caused by this branch) — REPAIRED in `278c0c2e8`

- `db/replay.ps1` applies `db/migrations-audit/0000_familiar_silhouette.sql`, which defines `clerk_organization_id`; Django migration 0003 renamed the column only in the Django-managed schema. The two schemas differ. A rename of the seed column was attempted and **reverted** because it was wrong for the replay schema (verified on PostgreSQL 16).
- **Correction to an earlier diagnosis.** This record previously attributed the failure to the final "Final summary" SELECT. Reproduced on real PostgreSQL 15 and 16, the failing statement is in the Phase 9 validation `DO` block (`seed-master.sql` ~line 829): `organization_members.organization_id` is `text` while `organizations.id` is `uuid`, so `organization_id IN (SELECT id FROM organizations ...)` raised `operator does not exist: text = uuid`, aborting the single transaction (0 organizations, 0 members persisted). The final summary SELECT never ran.
- **Fix:** one line, `SELECT id::text FROM organizations ...`. No fixture data, column name or frozen migration changed.
- **Evidence (identical on PostgreSQL 15 and 16):** exit code 0 and the transaction commits; the validation block reports 5 core organizations and 57 members; persisted counts are 40 organizations, 57 members, 6 grievances, 3 collective agreements, 51 users. A second run also commits with the same counts (idempotent).
- Not verified: the seed under the full Django-then-scoped production lineage. It was verified against the replay schema `db/replay.ps1` builds.

## Webhook alias contract (preserved, not removed)

| Item | State |
|---|---|
| Route | `api/auth_core/webhooks/clerk/` → `deprecated_clerk_webhook` → `auth_webhook` (logs a deprecation warning per call) |
| Payload shape | Clerk-shaped (`email_addresses`, `organizationMembership.*`, Svix signature). Entra emits no such event |
| Authentication | `AUTH_WEBHOOK_SECRET` (`X-Auth-Secret`). The legacy `X-Clerk-Secret-Key` header is logged and ignored, never accepted |
| Fail-closed state in v2 | The v2 Bicep sets no `AUTH_WEBHOOK_SECRET`, so the endpoint answers 401 there |
| In-repo callers | None |
| Removal condition | The deprecation log shows no call in the agreed window **and** the integration owner confirms no external sender. Until then the alias stays |

## Whop metadata contract

`app/api/whop/create-checkout` sends `metadata.userId` **and** the legacy `metadata.clerkUserId`, both set from the same authenticated session user. The legacy key is informational only and never used for authorization on this side. No Whop webhook consumer exists in this repository, so the external consumer is unverified. Removal condition: the Whop-side consumer is confirmed to read `userId` only.

## Exposed test credential — invalidation runbook (external action; NOT performed)

`scripts/provision-entra-test-users.mjs` created real Entra External ID staging users (tenant default `5082b8be-b04d-4a13-b61c-b6397670177b`) with a repository-known default password. Removing it from current files does **not** make it safe: the value remains in git history and in frozen migration `0095`. Treat every account the script lists as compromised.

Scope: the accounts enumerated in the script's user table (`nzila`, `clc`, `cape`, `cupe` and `zonga` groups, roughly 45 accounts). Anything signed in with the old value must be assumed accessible.

Required actions (need tenant admin; none can be done from this repository):

1. Enumerate the accounts from the script table, plus any created by `scripts/seed-test-auth-accounts.mjs` or `scripts/seed-zonga-auth-accounts.mjs`.
2. For each account, either set `accountEnabled=false` (preferred for test accounts nobody uses) or reset the password to a fresh random value held only in the secret store, with `forceChangePasswordNextSignIn=true`.
3. Revoke refresh tokens and sessions for each account (`POST /users/{id}/revokeSignInSessions`).
4. Verify by attempting a sign-in with the OLD value from the team secret store; it must fail (expected AADSTS50126 or a disabled-account error). Record the account count and the verification date. Do not paste the value into the record.
5. Reprovision any account that tests still need through the updated scripts, which now require `PROVISION_USER_PASSWORD` or `TEST_ACCOUNT_PASSWORD` (at least 16 characters, no default).
6. Decide separately whether to rewrite git history. That is a maintainer-approved, repository-wide action and is not proposed here.

Status: **OPEN — external.** Until step 4 is recorded, treat the staging tenant's test accounts as exposed.

## Verification

- `tsc` clean; contract tests `auth-purity` and `ue-auth-reality` pass.
- Full UE vitest run (`app/api/__tests__/whop-create-checkout.route.test.ts` + `__tests__`): passing on re-run; one flaky failure on first run did not reproduce.
- Django: only the 13 DB-free tests were run. Credentialed webhook and auth tests against a database are **not run** (blocked on infrastructure).
