# Runbook — one-time first-administrator bootstrap

**Status:** engineering **PASS** (implemented and proven on a real PostgreSQL with the canonical V2
schema, synthetic data); production execution **pending** (R-10). Not executed against production.

Tool: `apps/union-eyes/scripts/production/first-admin-cli.ts` (logic in `first-admin-bootstrap.ts`).
It is an operator tool only: there is no HTTP route, no default identity or password, and no standing
bypass. It is never shipped in the application image path of any request handler.

## What it does (one transaction, one advisory lock)

1. Validates the owner-supplied identity, organization, role and password (policy-checked, hashed
   with the platform hasher; never logged, never a command-line argument).
2. Refuses if **any** administrator already exists in the database (no marker), or if a different
   first administrator was already established.
3. Creates the organization if a name and slug are given (otherwise it must already exist), the user
   (active, email verified), the membership with the explicit role, and an **enrolled TOTP** secret so
   the account can never sign in with a password alone.
4. Appends a `bootstrap.first_admin` record to the canonical hash-chained audit log
   (`operator:<id>`, role, platform-admin flag, whether the organization was created, an email hash).
5. Commits. Any failure rolls everything back, including the organization.

Outcomes: `CREATED` (exit 0); `ALREADY_ESTABLISHED` for the same identity and organization, idempotent
and a no-op (exit 0); anything else is `REFUSED` with a code on stderr (exit 2) and **no change**.

## Preconditions (otherwise stop)

- `RUNBOOK_DATABASE_BOOTSTRAP.md` is complete and verified; the application is **not yet serving users**.
- The owner has decided and recorded: user id, email, a new organization UUID, organization name and
  slug, role (`admin` or `executive`) and whether the user is a platform administrator (required to
  create further organizations through the application).
- The password is chosen by the owner in a password manager and placed in a file readable only by the
  operator (`FIRST_ADMIN_PASSWORD_FILE`). There is no default password.
- `AUTH_MFA_ENCRYPTION_KEY` is the **exact production value** from Key Vault `mfa-encryption-key`
  (the same secret version the application will use). A different key would lock the administrator
  out of MFA permanently; that key is not rotatable (R-11).
- A temporary operator login with the right to write the user, membership, MFA and audit tables, used
  from the in-VNet operator host. The admin login has `BYPASSRLS` but no table grants; grant them for
  this step only (`SET ROLE ue_v2_owner; GRANT ALL ON ALL TABLES IN SCHEMA public, user_management TO <login>`)
  and revoke them afterwards (`REVOKE ALL ON ALL TABLES IN SCHEMA …`).

## Command

```
set BOOTSTRAP_DATABASE_URL=postgres://<operator>:<from Key Vault>@<fqdn>:5432/ue_v2_prod?sslmode=require
set AUTH_MFA_ENCRYPTION_KEY=<from Key Vault>
set FIRST_ADMIN_PASSWORD_FILE=<path to the owner-supplied password file>
pnpm --dir apps/union-eyes exec tsx scripts/production/first-admin-cli.ts ^
  --operator <operator id> --user-id <id> --email <address> ^
  --organization-id <new uuid> --organization-name "<name>" --organization-slug <slug> ^
  --role admin --platform-admin
```

Expected on first run: one JSON line `{"result":"CREATED","organizationId":…,"userId":…,"createdOrganization":true,"totpProvisioningUri":"otpauth://…"}`.
The `totpProvisioningUri` is a **secret shown once** and is not stored in plaintext anywhere: scan or
enter it into the administrator's authenticator immediately, do not capture stdout in CI logs or
tickets. Re-running is safe and prints `{"result":"ALREADY_ESTABLISHED"}` without a URI.

## Verification (read-only)

```
SELECT user_id, is_system_admin, lifecycle_state FROM user_management.users;          -- exactly 1 row
SELECT user_id, role, is_active FROM user_management.organization_users;             -- 1 row, role as chosen
SELECT count(*) FROM user_management.mfa_totp WHERE enabled_at IS NOT NULL;          -- 1
SELECT action, user_id, resource_id FROM public.audit_logs WHERE action='bootstrap.first_admin'; -- 1 row
```

Then sign in through the application: password, then the authenticator code; select the organization;
the go-live smoke's authenticated checks (`scripts/production/go-live-smoke.ts`) use a separate
synthetic smoke operator in a dedicated smoke organization, never this administrator.

## Stop conditions

`REFUSED` with any code (`ADMIN_ALREADY_EXISTS`, `BOOTSTRAP_BY_ANOTHER_IDENTITY`, `ORGANIZATION_NOT_FOUND`,
`INVALID_INPUT`): do not retry with different values to "make it pass"; investigate. A password that
fails the policy writes nothing. If the production MFA key is uncertain, do not run.

## Rollback

There is deliberately no undo command: the audit marker is append-only. Before any user has signed in,
roll back by recreating the database from `RUNBOOK_DATABASE_BOOTSTRAP.md` section 8 (it is disposable
at that point). After sign-in, use point-in-time restore to a new server as described there.

## Afterwards

Revoke the temporary table grants, delete the password file and any shell history that contains
secrets, remove the operator host, and record the audit record id and the change reference. Further
organizations and administrators are then created through the application by the platform
administrator, which is audited by the normal mutation controls.

## Proof (synthetic data only)

`scripts/production/first-admin-native.test.ts` runs against a real PostgreSQL with the canonical V2
schema (9 tests): creation with enrolled MFA and one audited chain head; idempotent re-run; a
concurrent race producing exactly one `CREATED`; refusal for a different identity; refusal when an
administrator or platform administrator already exists; refusal when the organization is missing;
atomic rollback after a mid-transaction failure; no write on invalid input. Removing the advisory lock
makes the race test fail.
