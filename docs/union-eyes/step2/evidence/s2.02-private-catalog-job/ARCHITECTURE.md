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
- Job name is `ue-s202-cat-<run id>`. Deletion requires all of: that name, the tags `purpose`, `owner`, `runId` and `source`, this managed environment, the exact operator image, and the staging identity. Executions must be proven terminal (live ones are stopped), and absence must be proven by an explicit not-found. Otherwise the job is kept and the receipt says `JOB_CLEANUP_UNPROVEN` and carries an incident. An `always()` cleanup step covers interrupted runs.
- Counts stay inside the existing 15 s / 45 s / 250 budget. Continuation tokens expire in 24 hours and are not a second authorization.
- The operator acts as `union_eyes_runtime` through `-c role=`. The evidence must show that role, the `ue_staging_runtime` login, a read-only transaction, and `ROLLBACK`.
- Evidence travels through the environment's own Log Analytics workspace, in frame `UE_CATALOG_V2`:
  - base64 of 6,000-byte chunks, bound to a nonce, run and source, with SHA-256 over exact bytes;
  - queried with the existing Monitoring Contributor grant;
  - filtered to this job, execution, container and image digest.

  Capacity is 32 MiB. The measured canonical catalogue is 1,306,708 bytes. Incomplete, mixed or tampered frames never become `CATALOG_COMPLETE`.

## Corrections in this revision

| Defect | Evidence | Correction |
| --- | --- | --- |
| `job logs show` couldn't carry the evidence | It needs a live replica after completion. It shares the console proxy that returned 404. Its default JSON output escapes the frame. The 672,000-byte cap was below the measured catalogue (1,306,708 bytes) | Log Analytics transport, frame v2, 32 MiB ceiling |
| The session never acted as the runtime role | `ue_staging_runtime` has `INHERIT FALSE`; locally, all 250 counts failed with `permission denied for schema public` | `-c role=union_eyes_runtime`; identity and login verified |
| A superuser login acting as the role read as `LIMITED_RUNTIME` | The privilege query checked `current_user` only | Login and role are both classified |
| A failed show after delete counted as deleted | Any non-zero exit was treated as absence | Explicit not-found, retries, incident |
| Ownership relied on name and tags | — | Environment, image, container and identity are also required |
| The controller tests never ran in CI | `ci.yml` ran only the exec test | Job and Docker operator tests are added to CI |

## Release holds

`S2.02_PREIMAGE_COMPLETE` stays `NO`. `S2.02_LEGACY_GATE` stays `INDETERMINATE`. Staging and production go remain held.

## Live prerequisites

1. Founder merges the pull request.
2. Founder dispatches `Union Eyes V2 — Staging private catalog job` from `main`.
3. Founder approves `build` and `ue-staging`.
4. The uploaded artifact is reconciled. A succeeded job is not acceptance.
