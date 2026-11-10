# V2 staging infrastructure bootstrap

The first deployment cannot resolve application database secrets until the
private PostgreSQL server, qualified schema and separate login roles exist.
Use two controlled applies rather than placeholder connection strings.

## First pass: infrastructure

Use `ue-v2-staging-deploy.yml` from main with `operation=apply` and
`parameters_file=infrastructure/bicep/ue-v2/main.staging.bootstrap.parameters.json`.
Use an exact merged and authorized source SHA and its successful digest-only
release manifest. Every existing plan, image attestation, change-record,
change-window, protected environment, reviewed no-delete what-if and drift
gate remains required. Review this pass's own artifact before approving it.

The explicit boolean `bootstrapInfrastructureOnly=true` suppresses app and
workload-alert modules only for staging. Networking, identity, private vault,
storage, Redis, PostgreSQL and its extension allow-list still deploy. The switch
does not omit image validation or change the workflow's deployment target.
Incremental deployment retains existing workloads; do not use complete mode.
Production always deploys workloads regardless of this flag.

The outputs report `bootstrapInfrastructureOnly=true` and an empty
`appInternalFqdn`. A successful infrastructure pass is not an app deployment,
runtime acceptance or `STAGING_GO`.

## Database qualification

Follow `docs/union-eyes/production/RUNBOOK_DATABASE_BOOTSTRAP.md`, adapted only
to the dedicated staging server and `ue_v2_staging` database. Use the qualified
export and role SQL, verify catalog and plan digests, and preserve the restore
and verification receipts. Operate from the private staging network. Do not
open PostgreSQL or vault public access.

The older runbook's removed helper commands and 694-table baseline are historical.
Use the current local-only exporter from a clean, committed checkout:

```sh
UE_V2_WHEELHOUSE=/absolute/hash-locked/wheelhouse pnpm exec tsx tooling/scripts/export-ue-v2-staging-schema.cts --out /absolute/empty/export-directory
```

The exporter regenerates the current plan twice, checks it against the committed
plan and every current repository source commitment, and refuses source drift.
It uses the pinned PostgreSQL image on loopback only, installs the reference
schema and a second database through the existing installer, checks the native
privilege contract, verifies catalog equality and the receipt-backed repeat
NOOP, and emits schema/receipt/role SQL plus measured catalog and file hashes.
It removes only its own disposable container. It never reads customer data,
connects to Azure, replays frozen migrations or writes login credentials.

The previous deliberate frozen hash for the organization-switch route is now
bound to the current source bytes; a stale or tampered commitment fails both
the source-plan CLI and its regression test. This is source admission, not
runtime acceptance. Use the new export qualification receipt's measured digest
and counts, never copy the historical runbook's catalog or schema digests.
Provision extensions only when declared in the current export receipt. The
current plan declares no vector columns or vector extension: the historical
runbook's unconditional `CREATE EXTENSION vector` must not be applied to it.
The transform explicitly validates either the declared vector line or its
declared absence; it does not silently tolerate an unexpected extension.

Generate the three login passwords, create the actual runtime/system/auth
roles with their specified restrictions, then publish `database-url`,
`system-database-url` and `auth-database-url` to the private V2 vault. Never
substitute old database URLs, admin credentials for app roles, dummy secrets or
unqualified schema. Preserve any successful prior bootstrap; do not overwrite
existing secrets or replay destructive database operations to retry deployment.

## Second pass: workloads

After database verification, use the normal
`infrastructure/bicep/ue-v2/main.staging.parameters.json` through a new controlled
apply, with a new reviewed what-if and all the same gates. The default
`bootstrapInfrastructureOnly=false` deploys the app, scanner, scheduled jobs
and workload alerts. Continue candidate-bound Phase 3A qualification afterward.

`STAGING_NO_GO` remains until every required runtime proof exists. No production
deployment, Phase 3B activity or acceptance bypass is authorized by this mode.
