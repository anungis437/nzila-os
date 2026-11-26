# Union Eyes V2 staging read-only inventory

The workflow `Union Eyes V2 — Staging read-only inventory` reads the V2 staging control plane after it is on `main`. Cursor's local runtime has no Azure identity and no path to the private database, so it cannot make this observation. The workflow reuses the existing `ue-staging-plan` OIDC subject, `repo:anungis437/nzila-os:environment:ue-staging-plan`. That environment already allows `main` only. No deployment-branch exception, client secret, or second Azure identity is required.

GitHub shows a `workflow_dispatch` workflow after the workflow file exists on the default branch. This file is admitted by merging its own pull request. The integration token cannot dispatch Actions, and that permission stays unchanged.

The job runs only when the event is `workflow_dispatch`, the repository is `anungis437/nzila-os`, and the ref is `refs/heads/main`. The command list is closed in `tooling/scripts/ue-v2-staging-readonly-inventory.mjs`. It refuses a subscription or tenant other than `d562ba7f-d891-4504-a489-10917c0ebaaf` / `cc15259a-d2bf-421f-8e44-dccf8dc6232a`, and it refuses any resource id other than `nzila-ue-v2-staging-app` or `nzila-ue-v2-staging-db-d562ba7f` in `nzila-canada-staging-rg`. Queries are explicit projections. A response field whose name looks like a secret is discarded. The artifact is `inventory.json` plus its SHA-256. `S2.02_PREIMAGE_COMPLETE` stays `NO` until a separate database catalog is also observed.

## Owner execution after merge

1. Merge the isolated workflow pull request after its checks pass. Do not merge it from this document.
2. Open GitHub Actions for `anungis437/nzila-os`.
3. Select **Union Eyes V2 — Staging read-only inventory**.
4. Select `main`.
5. Run the workflow. It has no inputs.
6. Confirm the job used the `ue-staging-plan` environment and finished with a serving revision whose classification is `OBSERVED`.
7. Download `ue-v2-staging-readonly-inventory-<run id>` and check `SHA256SUMS` against `inventory.json`.
8. Reconcile the observed revision, traffic weight, and image with the frozen Step 2 preimage. Do not copy an older revision claim into the new observation.
9. Leave `S2.02_PREIMAGE_COMPLETE = NO` until the database catalog below is observed through a separate authorization.

## Database catalog, not executed

No workflow on `main` opens a read-only SQL session inside the V2 staging network. The plan identity is an ARM Reader. `tooling/scripts/run-ue-v2-forward-upgrade-job.py` creates a Container Apps job, so it is not a read-only path. The older `r1-readonly-check.js` helper targets the previous Union Eyes ledger, not `ue_v2_staging`.

The existing in-network workload is the running Container App `nzila-ue-v2-staging-app`. One later authorization, not granted here, is a single `az containerapp exec` into the serving revision named by the inventory artifact. The command uses the database identity the revision already has. It must not print environment variables or connection strings. The session ends when the command exits. No firewall rule, job, role, or credential is created.

The session is `BEGIN READ ONLY` with `statement_timeout` of 15 seconds. It records catalog facts only:

- `SELECT version(), current_database(), current_user` for version and identity.
- `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id` for migration history.
- `SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')` for table ownership.
- `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg_%'` for role attributes. Do not query `pg_authid`.
- `SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity, pol.polname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_policy pol ON pol.polrelid = c.oid WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')` for RLS.
- `SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner), p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')` for function ownership.
- `SELECT n.nspname, c.relname, c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','S') AND n.nspname NOT IN ('pg_catalog','information_schema')` for ACLs.
- `SELECT n.nspname, c.relname, s.seqstart, s.seqincrement FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace` for sequence metadata. Do not call `nextval`.
- `SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')`, then one `SELECT count(*) FROM ONLY` per listed table, for the business inventory.
- Current topology is confirmed only when both `user_management.auth_business_org_authorized(uuid, text[])` and event trigger `ue_guard_deadline_reassignment_convergence_policy` are present. Absence of the function is `LEGACY_TRANSITION_REQUIRED`. An unreadable catalog is `INDETERMINATE`. Neither result marks the four legacy installer cases passed.

Until that session exists, the catalog remains `NOT_OBSERVED`.
