# Runbook — production database bootstrap (CANONICAL_BOOTSTRAP_V2)

**Status:** procedure **approved**, execution **pending** (R-9). Not executed against production.
Proven on the Azure staging server with synthetic data. The V2 installer is local-only by design, so
production is a verified restore of the qualified candidate.

Frozen candidate: schema plan digest `5ba116ec82c491577f4eee6ee7e19ef83472d62fd3d2b263b6e3212f9970597e` (re-frozen for bounded E2E compatibility from clean-release digest `0a5ee060e7c3e3e373192ca8a4a1d58a47b44bfe490c6a7f8587f05127553ef4`; original qualified digest `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748`; 694 tables and 8,420 statements are identical, see UE_RELEASE_PLAN_REFREEZE.md)
(694 tables, 8,420 statements, 19,865 catalog objects, catalog digest
`863de854d655321d3c639bd41dfbc0938cbe04d13bf0c91d1c8fa341e857cc2c`).

## 1. Preconditions (all must be true; otherwise stop)

- The production stack is deployed from `infrastructure/bicep/ue-v2/` and the server has **no public
  access and no firewall rules**. `azure.extensions` contains `VECTOR` (the template sets it).
- A **temporary operator host inside the VNet** with `psql` 16, Node 20 and this repository at the
  merged release commit. Never open a public firewall rule to run this procedure.
- The merged source reproduces the plan digest: `tsx scripts/bootstrap-v2/plan.ts --check` passes and
  the digest above is unchanged. If it differs, **stop** and find out why.
- Key Vault holds the admin password and three generated login passwords (runtime, system, auth).
- The export was produced from the same commit, on a machine with Docker and the pinned image
  `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337`.
- Dump files keep **LF** line endings. Do not open or rewrite them with a tool that converts to CRLF
  (it corrupts function bodies); the transform below refuses a CRLF dump.

## 2. Export and prepare (build machine)

```
set UE_V2_WHEELHOUSE=<wheelhouse path>
pnpm --dir apps/union-eyes exec tsx scripts/staging/export-v2-schema.ts <out>
pnpm --dir apps/union-eyes exec tsx scripts/staging/emit-role-sql.ts <out>
pnpm --dir apps/union-eyes exec tsx scripts/production/prepare-bootstrap-restore.ts <out>
```

Expected: the export prints `{"objects":19865,"catalogDigest":"863de854…cc2c",…}`; the prepare step
prints the byte sizes of `schema-restore.sql` and `receipt-restore.sql`. (Verified: on the staging
export the tool's output is byte-identical to the restore that was proven on Azure.) Copy
`schema-restore.sql`, `receipt-restore.sql`, `roles.sql` and `expected-catalog.json` to the operator
host. **Stop** if the object count or catalog digest differs.

## 3. Prepare the server (operator host, as the admin login)

```
psql "host=<fqdn> dbname=postgres user=uev2admin sslmode=require" -v ON_ERROR_STOP=1 -f roles.sql
psql "host=<fqdn> dbname=postgres user=uev2admin sslmode=require" -v ON_ERROR_STOP=1 ^
  -c "ALTER DATABASE ue_v2_prod OWNER TO ue_v2_owner"
psql "host=<fqdn> dbname=ue_v2_prod user=uev2admin sslmode=require" -v ON_ERROR_STOP=1 ^
  -c "CREATE EXTENSION IF NOT EXISTS vector SCHEMA public" -c "ALTER SCHEMA public OWNER TO ue_v2_owner"
```

Expected: no errors; `vector` is installed and owned by the platform (the Azure build is a newer
patch version than the local one, which is an accepted environmental difference).

## 4. Restore

```
psql "host=<fqdn> dbname=ue_v2_prod user=uev2admin sslmode=require" -v ON_ERROR_STOP=1 -q -f schema-restore.sql
psql "host=<fqdn> dbname=ue_v2_prod user=uev2admin sslmode=require" -v ON_ERROR_STOP=1 -q -f receipt-restore.sql
```

Expected: only `WARNING:  no privileges could be revoked/granted for "halfvec_…"` style lines (about 350
on staging) and **zero `ERROR` lines**. Any `ERROR` is a stop condition.

## 5. Create the application login roles

Generate each password in Key Vault first; never type one into a shell history.

```
CREATE ROLE ue_prod_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<kv>';
GRANT union_eyes_runtime TO ue_prod_runtime;
CREATE ROLE ue_prod_system  LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<kv>';
GRANT union_eyes_system  TO ue_prod_system;
CREATE ROLE ue_prod_auth    LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<kv>';
GRANT nzila_auth_gateway TO ue_prod_auth;
```

This is the exact provisioning the schema was qualified with. Store the three connection strings in
Key Vault as `database-url`, `system-database-url` and `auth-database-url`.

## 6. Verify (required before any application start)

```
set PGHOST=<fqdn>& set PGUSER=uev2admin& set PGDATABASE=ue_v2_prod& set PGPASSWORD=<from Key Vault>
pnpm --dir apps/union-eyes exec tsx scripts/staging/verify-remote-catalog.ts <out>
```

**Pass criteria (what the same candidate produced on Azure staging):** `missing = 0` in **every** kind;
`extra` only in `role_membership` (platform and login-role memberships); expected counts equal actual
counts for every other kind; differences confined to the environmental kinds (`function`,
`aggregate`, `operator`, `operator_class`, `operator_family`, `extension`, `constraint`, `policy`,
`relation`, `role_membership`). `exactMatch` is expected to be `false`; keep both digests in the
change record (staging: expected `863de854…cc2c`, actual `a82fa3a8…c0f`).

Structural cross-check (read-only), expected on the restored database: 695 tables, 1,223 policies, 134
functions, 2,187 indexes, 694 tables with row security, 1 bootstrap receipt.

## 7. Failure stop conditions

Stop and do not proceed to application start if any of: an `ERROR` during restore; a CRLF
detection; `missing > 0`; an `extra` outside `role_membership`; plan digest or export object count
differs from section 0; the extension cannot be created (not allow-listed); the operator host cannot
reach the server privately (do **not** open a public rule); or any step is ambiguous.

## 8. Rollback

- **Before the application has ever started and no administrator exists:** the database is disposable.
  `DROP DATABASE ue_v2_prod` (connect to `postgres`), recreate it, and repeat from section 3. The
  artifacts are reusable.
- **After data exists:** the schema is forward-only. Recover with point-in-time restore to a **new**
  server (drilled: 7 min 11 s at staging size; 35-day retention), verify the catalog and the data
  boundary, then cut over by publishing new connection secrets and restarting. Keep the old server
  until verified.
- **Edge:** switching traffic back is the Front Door origin group (the legacy stack keeps running
  alongside; see R-18).

## 9. Afterwards

Delete the dump files and the operator host, record the digests and the verification output in the
change record, and continue with `RUNBOOK_FIRST_ADMIN_BOOTSTRAP.md`.
