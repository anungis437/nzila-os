# Union Eyes V2 staging catalogue exec

This workflow is the execution route for the S2.02 catalogue. It is not a deployment and it is not the forward-upgrade job.

## Authority

`ue-staging-plan` is the Reader identity used by the control-plane inventory. It cannot call `Microsoft.App/containerApps/exec/action`.

`ue-staging` is the existing protected deploy environment. Its documented identity is `nzila-os-ue-staging-deploy`. The runbook's custom role `Nzila UE V2 Staging Deployer` includes `Microsoft.App/*` and does not put the exec action in `NotActions`. That text is a design record. The runbook header still says the commands were not executed, while a later section records change `CHG-2026-0114`. The live role definition may differ. This workflow reads the caller's role assignments and definitions before exec. If the exec action is absent, it uploads that result and does not open a session. It does not create a role or a federated credential.

The environment allows `main` only and requires founder approval. This file cannot run from a pull request.

## Image client

The serving image `sha256:2bf18216fda45d71395b6396ec65b3974745f5446696d378f6ea6d37fe2e67ef` is the `union-eyes` stage of the root Dockerfile. That stage starts from `node:22-slim`, copies the Next.js standalone output, and removes npm, npx, corepack, and pnpm. It does not install `psql`. `pg` and `postgres` are listed in `serverExternalPackages`, so a traced standalone image can `require('pg')`. That presence is not proven for this digest until the exec probe reports `client.resolved`. If `pg` does not resolve, the probe stops. Nothing is installed into the revision.

## Session

`az containerapp exec` is an interactive console. Microsoft Learn documents `--revision` and `--container`. On a runner without a terminal it needs a pseudo-terminal (`script`) or it fails before the command starts. The Azure CLI exit code is not the Node process exit code, so the runner accepts the catalogue only when stdout contains the `UE_CATALOG_BEGIN` record, `transaction_read_only` is `on`, the database is `ue_v2_staging`, and the script issued `ROLLBACK`.

The revision, health, traffic weight, and image digest are read immediately before that single exec. The expected binding is `nzila-ue-v2-staging-app--rel6a60c95c9d` at weight 100, Healthy, with the digest above. Any other binding stops the run.

The container reads `DATABASE_URL` from its own environment. The runner never prints that variable, an access token, or the admin password. The admin password on the GitHub environment is not an input to this workflow.

## Dispatch

Do not dispatch this workflow until it is on `main` and a founder approves the `ue-staging` environment. `S2.02_PREIMAGE_COMPLETE` stays `NO` until the uploaded `catalog.json` is verified.
