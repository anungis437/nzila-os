# S2.02 execution preflight (2026-11-27)

This file records the read-only preflight done before the first refreshed S2.02 dispatch. Nothing here is live evidence. No catalogue job was dispatched, no database session was opened, and no privilege, network, schema, RLS, revision or production setting was changed.

| Flag | Value |
| --- | --- |
| `S2_02_PLANE_B_ENGINEERING_QUALIFIED` | YES (PR #1322, merge `5ac66fff`) |
| `S2_02_PRIVILEGED_LIVE_EXECUTION_AUTHORIZATION` | PENDING |
| `S2.02_PREIMAGE_COMPLETE` | NO |
| `S2.02_LEGACY_GATE` | INDETERMINATE |
| `STEP_2_ENGINEERING_COMPLETE` | NO |
| `STEP_2_ACCEPTED` | NO |
| `STAGING_GO` / `PRODUCTION_GO` | HELD / HELD |
| `UE_SAAS_OPERATIONAL_READINESS` | NO_GO |
| `fullReadiness` | NOT_YET_PROVEN |

## 1. Source

- `main` at `5ac66fffa6227efa7e47a5a9bb3b392dd6c84f07` (merge of PR #1322). Both planes, the operator, the controller, and `ue-v2-staging-catalog-job.yml` are on `main`.
- The workflow runs only on `workflow_dispatch` of `anungis437/nzila-os` at `refs/heads/main`. The build job uses environment `build` and the run job uses `ue-staging`, in concurrency group `ue-v2-staging-catalog-job` with no cancellation.

## 2. Founder recipient key

- The key was generated once with `--generate-recipient`. That command writes the private half exclusively (`wx`) with mode 0600, and prints only the public half.
- The private key is X25519, kept on the founder's machine outside the repository (directory 0700, file 0600). It is not in GitHub (no secret, no variable, no artifact), any log, or any commit.
- Public recipient key id: `bd8fa0572d31b7ce`.
- Checks run locally with the shipped code:
  - The public key derived from the private file equals the published one, and the key ids match.
  - `recipientDefect` accepts the published key, and refuses an empty value, malformed base64 and an Ed25519 key.
  - A random synthetic payload sealed to the recipient opens with the private key.
  - A synthetic privileged catalogue passes `openSealedCatalog`, including the AAD binding and the count, ledger and counter digest checks.
  - A different X25519 private key is refused.
- Do not regenerate the key during a chain. Every privileged session must be sealed to `bd8fa0572d31b7ce`. The controller refuses others with `SEALED_FOR_ANOTHER_RECIPIENT`, and offline assembly cannot open them.

## 3. GitHub recipient variable

- `UE_V2_STAGING_CATALOG_RECIPIENT` is set as a repository variable, as the decision record specifies. It holds only the SPKI/DER base64 public key. Read back after writing, it is byte-identical and derives key id `bd8fa0572d31b7ce`.
- No new secret was created and no other variable, secret or environment protection was changed.
- `UE_V2_STAGING_DB_ADMIN_PASSWORD` is present as a `ue-staging` environment secret. Only its name was checked; its validity is unknown until a live session.

## 4. Azure staging (read-only)

| Check | Observed |
| --- | --- |
| Tenant / subscription | `cc15259a-…` / `d562ba7f-…`, matching the controller constants |
| Resource group | `nzila-canada-staging-rg` |
| Managed environment | `nzila-ue-v2-staging-env`, Succeeded, logs to Log Analytics `nzila-ue-v2-staging-law`. The environment is not VNet-internal; the catalogue job has no ingress. |
| Serving revision | `nzila-ue-v2-staging-app--rel6a60c95c9d` at 100% traffic, image `…nzila-os-union-eyes-v2@sha256:2bf18216…`, matching `EXPECTED_REVISION` / `EXPECTED_IMAGE` |
| Other active revision | `--relcccfc8c311` (created 2026-11-17, 0% traffic, multiple-revision mode). It is a pre-existing revision, not a deployment in progress, and is outside the binding. |
| PostgreSQL | `nzila-ue-v2-staging-db-d562ba7f`: Ready, v16, public network access disabled, `require_secure_transport=on`, `track_counts=on`. Database `ue_v2_staging` exists. Administrator login `uev2admin`. |
| Identity | `nzila-ue-v2-staging-id` exists |
| Key Vault | `nzila-ue-v2-staging-kv` is private-link only, so it was not readable from the founder machine (expected). The runtime job resolves `database-url` through the staging identity inside the environment. |
| Log Analytics | Query access confirmed against the workspace |
| Deploy identity | `nzila-os-ue-staging-deploy`: custom role `Nzila UE V2 Staging Deployer` (`Microsoft.App/*` on the staging RG) and `Monitoring Contributor` on `nzila-ue-v2-staging-law` |
| Catalogue jobs | None present (no `ue-s202-cat-*` and no `purpose=s202-private-catalog`). Unrelated scheduled jobs and `ue-role-probe2` exist and are untouched. |
| Workflow runs | No catalogue, deploy or migration run in progress. The only catalogue run so far is 45940281038. |

Live-only unknowns:
- whether the admin password is still valid;
- whether `uev2admin` really has `BYPASSRLS` and inherits read access;
- whether TLS succeeds from the job;
- how long Log Analytics takes to ingest;
- whether a deploy starts during the chain.

The operator and controller refuse on each of these before or without accepting evidence.

## 5. Historical run 45940281038

- The run is preserved as historical evidence only. It predates the structure and relation-metadata digests and the corrected queries, so it cannot seed or replace the refreshed Plane A baseline.
- The private copy is held on the founder's machine outside the repository. Every directory on the path is 0700 and every file is 0600.
- All five entries of `run-45940281038/SHA256SUMS` verify against the private copy, and so does the derived `privilege-matrix.json` checksum.
- The private `SHA256SUMS`, `evidence-manifest.json` and `cleanup.json` are byte-identical to the copies in this folder.
- The manifest binds run `45940281038`, source `9803777d…`, job `ue-s202-cat-45940281038`, and its `sha256` equals the checksum of `catalog-evidence.json`. The cleanup receipt reads `deleted: true, absent: true`.
- The public GitHub artifact (id `15172876152`, expiring 2026-12-04) has not been deleted. Deleting it early needs explicit founder authorization.

## 6. Hardening added with this preflight

`RESIDUAL_CATALOG_JOB`: the controller now lists catalogue jobs before creating one.
- Any job left by another run stops the session before creation. A job counts if its name has the `ue-s202-cat-` prefix or it carries the purpose tag.
- An unreadable list stops it too (`JOB_STATE_UNREADABLE`).
- Such a job is named in the report and never stopped or deleted. A residual privileged job is an incident, not something to clean up silently.

## 7. Dispatch sequence (each step needs its own authorization)

1. **Plane A baseline.** Dispatch `ue-v2-staging-catalog-job.yml` from `main` with `plane=runtime` and `continuation_run_id` empty, then approve `build` and `ue-staging`. After it finishes, verify independently:
   - the run id and source SHA;
   - the observed login `ue_staging_runtime` and role `union_eyes_runtime`;
   - read-only and rollback;
   - the privilege matrix and the role-visible count scopes;
   - evidence integrity;
   - the cleanup receipt, and that the job is absent from the resource group.

   Expect `CATALOG_PARTIAL` with about 540 tables remaining. A green workflow does not by itself mean `CATALOG_COMPLETE`.
2. **Plane A continuations.** Dispatch with `plane=runtime` and `continuation_run_id=<immediately preceding Plane A run>`. Each token expires 24 hours after issue. About three continuations are needed at 250 counts per session.
3. **Plane B baseline.** This needs separate founder authorization to use `uev2admin`. Dispatch with `plane=privileged` and `continuation_run_id` empty. Expect `PLANE_CAPTURED_SEALED` sealed to `bd8fa0572d31b7ce`, and no plaintext totals, ledger rows or counters in the artifact or logs.
4. **Plane B continuations.** Dispatch with `plane=privileged` and `continuation_run_id=<immediately preceding Plane B run>`. Each one is a separate authorized dispatch, and each token expires 24 hours after issue. Any drift refusal (schema, migration, relation metadata, or modification or settled counters) starts a new chain from a fresh baseline. A chain is a bounded multi-session inventory, never one atomic snapshot.
5. **Assemble offline** with `--assemble` and the founder key. Only `CATALOG_COMPLETE` from assembly counts, and the flags above stay unchanged until the founder accepts S2.02.

Two freezes apply from step 1:
- **Staging deploys and migrations** are held until the last session of both chains. A revision change refuses every later session (`REVISION_BINDING_CHANGED`).
- **Merges to `main`** are held for the length of each chain. Every session of one chain must run from the same `main` SHA (`CONTINUATION_SOURCE_CHANGED`). Plane A and Plane B may use different SHAs, because plane reconciliation does not bind the source.

Merge this hardening before the Plane A baseline, so both chains run the residual-job guard.
