# Union Eyes V2 staging catalogue exec

Runs `45859100780` and `45887919234` both failed in the Container Apps exec WebSocket handshake with HTTP 404. That console is not the collection path. The private-network job is `ue-v2-staging-catalog-job.yml`. This file remains the record of the rejected console route.

## Authority

`ue-staging-plan` is the Reader identity used by the control-plane inventory. It cannot call `Microsoft.App/containerApps/exec/action`.

`ue-staging` is the existing protected deploy environment. Its documented identity is `nzila-os-ue-staging-deploy`. The runbook's custom role `Nzila UE V2 Staging Deployer` includes `Microsoft.App/*` and does not put the exec action in `NotActions`. That text is a design record. The runbook header still says the commands were not executed, while a later section records change `CHG-2026-0114`. The live role definition may differ. This workflow reads the caller's role assignments and definitions before exec. If the exec action is absent, it uploads that result and does not open a session. It does not create a role or a federated credential.

The environment allows `main` only and requires founder approval. This file cannot run from a pull request.

## Image client

The serving image `sha256:2bf18216fda45d71395b6396ec65b3974745f5446696d378f6ea6d37fe2e67ef` is the `union-eyes` stage of the root Dockerfile. That stage starts from `node:22-slim`, copies the Next.js standalone output, and removes npm, npx, corepack, and pnpm. It does not install `psql`. `pg` and `postgres` are listed in `serverExternalPackages`, so a traced standalone image can `require('pg')`. That presence is not proven for this digest until the exec probe reports `client.resolved`. If `pg` does not resolve, the probe stops. Nothing is installed into the revision.

## Session

`az containerapp exec` is an interactive console. Microsoft Learn documents `--revision` and `--container`. On a runner without a terminal it needs a pseudo-terminal (`script`) or it fails before the command starts. The process that starts that console is `timeout`, not `az`. ARM reads use `az` by themselves. A 124 from `timeout` is `EXEC_TIMED_OUT` and is not a catalogue. A revision show that omits `trafficWeight`, `healthState`, or the `union-eyes` image is `REVISION_FIELDS_ABSENT`. Those property paths are the ones inventory run 45766945607 already returned. The Azure CLI exit code is not the Node process exit code. The container command is `node -e` with the fixed catalogue program. It does not decode that program through `eval`. `evaluateCatalogCompleteness` accepts schema `ue-v2-staging-catalog/v2` only. A run is `CATALOG_COMPLETE` only when the session rolled back, the database is `ue_v2_staging`, the transaction is read-only, and every required category is `OBSERVED` or `ABSENT_VERIFIED`. `ABSENT_VERIFIED` is a successful read that proves the object is missing, including a ledger query skipped after discovery shows the relation is not there. A query error is `UNREADABLE` and cannot prove absence. A missing category, a count timeout, or a count left `NOT_ATTEMPTED` by the 45 second / 250 statement budget is `CATALOG_PARTIAL` and a nonzero exit. The repository schema sources contain 1224 `pgTable` declarations, so that budget is not a claim that one session counted the database. An identity mismatch, a failed rollback, a missing `pg` client, or an unexpected schema version is `CATALOG_REFUSED`. Output without the catalogue markers, or with malformed JSON, is `CATALOG_UNREADABLE`. The artifact is still uploaded. `CATALOG_COMPLETE` does not set `S2.02_PREIMAGE_COMPLETE`, and `S2_02_LEGACY_GATE` stays `INDETERMINATE`. A proven-absent security function is recorded as `LEGACY_TRANSITION_REQUIRED` on the evaluation only.

The revision, health, traffic weight, and image digest are read immediately before that single exec. The expected binding is `nzila-ue-v2-staging-app--rel6a60c95c9d` at weight 100, Healthy, with the digest above. Any other binding stops the run.

The container reads `DATABASE_URL` from its own environment. The runner never prints that variable, an access token, or the admin password. The admin password on the GitHub environment is not an input to this workflow.

## Dispatch

Do not dispatch this workflow until it is on `main` and a founder approves the `ue-staging` environment. A `COMPLETE` artifact is the catalogue input for a later evidence review. This workflow does not set `S2.02_PREIMAGE_COMPLETE`.

## Run 45859100780 — authenticated ACA console failure

The first founder-approved read-only run on 2026-11-26 authenticated the existing `ue-staging` deploy identity and proved its effective `Microsoft.App/containerApps/exec/action` permission. The expected revision was Healthy and carrying 100% of traffic, and its image digest matched. `az containerapp exec` then failed its WebSocket handshake with HTTP 404 before a container command or SQL statement could run. Evidence artifact: `ue-v2-staging-catalog-45859100780` (GitHub artifact 15140657256). `catalog.json` SHA-256: `e56c1c9c49a6aad368d5626fd225a081a4757a5c19a40cf0c8ed29d45d9535ec`.

This is a console transport failure, **not** a PostgreSQL verdict or proof of an absent `pg` driver. Run 45859100780 consumed the originally authorized one-time execution; this change does **not** authorize a retry.

The next candidate uses read-only `az containerapp replica list --revision` to discover the actual running replica, verifies it belongs to the pinned revision and includes `union-eyes`, then supplies `--replica` explicitly. Missing or ambiguous replica metadata fails closed before exec. This corrects a missing explicit selection according to Azure's published CLI instructions. It is not yet proven to resolve the 404; persistent WebSocket errors may originate within the Azure Container Apps console service.

No new identity, RBAC assignment, Container App revision, database job or firewall rule is needed. A subsequent dispatch requires its own founder authorization and the normal protected environment approval. `S2.02_PREIMAGE_COMPLETE` remains `NO`.
