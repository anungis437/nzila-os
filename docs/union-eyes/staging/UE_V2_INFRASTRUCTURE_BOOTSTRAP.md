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

The older runbook's export-helper paths are absent from the current checkout,
and its 694-table baseline differs from the current committed 771-table,
6,255-statement source plan. Those historical commands and digests are not
current restore authority. Reproduce and qualify the current source-bound
export using the pinned interpreter, hash-locked wheelhouse and pinned local
PostgreSQL image before any remote restore. A successful infrastructure pass
does not remove this qualification requirement. Do not replay frozen migration
lineage or substitute the historical export to get past it.

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
