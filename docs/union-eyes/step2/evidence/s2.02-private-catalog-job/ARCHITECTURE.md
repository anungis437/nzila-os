# S2.02 private catalogue job — engineering record

Status: engineering package only. No live Azure job was created and no PostgreSQL session was opened on staging.

## Rejected route

| Run | Commit | Result |
| --- | --- | --- |
| 45859100780 | prior `main` | Container Apps exec WebSocket HTTP 404 |
| 45887919234 | `bfb905fe7869ae72ae323ec363db0c4dda1f4c97` | Replica `nzila-ue-v2-staging-app--rel6a60c95c9d-5d8b796556-jkfnp` selected. Handshake still HTTP 404 from `Microsoft-IIS/10.0`. Catalogue artifact `51099388dd6f42a70e6ce82dc5ded8117534b5cb9019548f837050d392905488`. No SQL. |

## Selected route

One temporary job in the existing managed environment `nzila-ue-v2-staging-env`, using the existing user-assigned identity and the existing Key Vault secret `database-url`. The operator image is `nzila-os-union-eyes-v2-catalog@sha256:…`, built `FROM` the qualified application image so `node` and `pg` come from that image. The entrypoint is the same programme as `containerSource()` in `tooling/scripts/ue-v2-staging-catalog-exec.mjs`. The evaluator remains `evaluateCatalogCompleteness` for schema `ue-v2-staging-catalog/v2`.

The forward-upgrade job was not reused as the operator. It exposes DDL and the admin password.

## Controls

- Manual `workflow_dispatch`, `main` only, `ue-staging` approval for the job.
- Hardcoded staging subscription, tenant, resource group, host, and database. A production target returns `WRONG_ENVIRONMENT` before any Azure call.
- Revision and image are rechecked. A mismatch is `REVISION_BINDING_CHANGED`.
- The operator image must be the catalog repository digest, not the application digest.
- The app must already have a secret named `database-url`. The value is not read.
- Job name is `ue-s202-cat-<run id>`. Deletion requires that exact name plus matching purpose, run id, and source tags.
- Counts stay inside the existing 15s / 45s / 250 budget. Continuation tokens expire in 24 hours and are not a second authorization.

## Release holds

`S2.02_PREIMAGE_COMPLETE` stays `NO`. `S2.02_LEGACY_GATE` stays `INDETERMINATE`. Staging and production go remain held.

## Live prerequisites

1. Founder merges the pull request.
2. Founder dispatches `Union Eyes V2 — Staging private catalog job` from `main`.
3. Founder approves `build` and `ue-staging`.
4. The uploaded artifact is reconciled. A succeeded job is not acceptance.
