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

## Seed / replay finding (pre-existing, not caused by this branch)

- `db/replay.ps1` applies `db/migrations-audit/0000_familiar_silhouette.sql`, which defines `clerk_organization_id`; Django migration 0003 renamed the column only in the Django-managed schema. The two schemas differ. A rename of the seed column was attempted and **reverted** because it was wrong for the replay schema (verified on PostgreSQL 16).
- `db/seeds/seed-master.sql` final "Final summary" SELECT (~lines 831-836) fails with `operator does not exist: text = uuid`, aborting the single transaction: no orgs or members persist. Identical at baseline. Not fixed here; fix needs a seed owner decision.

## Verification

- `tsc` clean; contract tests `auth-purity` and `ue-auth-reality` pass.
- Full UE vitest run (`app/api/__tests__/whop-create-checkout.route.test.ts` + `__tests__`): passing on re-run; one flaky failure on first run did not reproduce.
- Django: only the 13 DB-free tests were run. Credentialed webhook and auth tests against a database are **not run** (blocked on infrastructure).
