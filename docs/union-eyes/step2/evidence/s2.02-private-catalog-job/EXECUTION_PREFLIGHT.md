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
3. **Plane B baseline.** This needs separate founder authorization to use `uev2admin`. Dispatch with `plane=privileged` and `continuation_run_id` empty. Only a session that captures every table reports `PLANE_CAPTURED_SEALED`; a partial session reports `PLANE_INCOMPLETE`, exits non-zero by design, and issues a continuation token. (This step first said to expect `PLANE_CAPTURED_SEALED` from the baseline; that held only for the last session of a chain. With the 1,000 ceiling of section 10, one session covers all 790 tables.) Values must stay sealed to `bd8fa0572d31b7ce`, with no plaintext totals, ledger rows or counters in the artifact or logs.
4. **Plane B continuations.** Needed only if a session leaves tables. Dispatch with `plane=privileged` and `continuation_run_id=<immediately preceding Plane B run>`. Each one is a separate authorized dispatch, and each token expires 24 hours after issue. Any drift refusal (schema, migration, relation metadata, or modification or settled counters) starts a new chain from a fresh baseline. A chain is a bounded multi-session inventory, never one atomic snapshot.
5. **Assemble offline** with `--assemble` and the founder key. Only `CATALOG_COMPLETE` from assembly counts, and the flags above stay unchanged until the founder accepts S2.02.

Two freezes apply from step 1:
- **Staging deploys and migrations** are held until the last session of both chains. A revision change refuses every later session (`REVISION_BINDING_CHANGED`).
- **Merges to `main`** are held for the length of each chain. Every session of one chain must run from the same `main` SHA (`CONTINUATION_SOURCE_CHANGED`). Plane A and Plane B may use different SHAs, because plane reconciliation does not bind the source.

Merge this hardening before the Plane A baseline, so both chains run the residual-job guard.

## 8. Plane A baseline, attempt 1: run 46019964268 (refused)

- **Dispatch.** From `main` `1698164d01f04680f6d34f7e89b3c38f8f11ebc6` (merge of PR #1323), with `plane=runtime` and no continuation. The founder authorized it and approved `build` and `ue-staging`. Operator image `…nzila-os-union-eyes-v2-catalog@sha256:7bd952a4…`. Revision binding unchanged (`rel6a60c95c9d`, `sha256:2bf18216…`).
- **Verdict.** `CATALOG_REFUSED`, with defect `DATABASE_IDENTITY_REFUSED` and operator blocker `IDENTITY_REFUSED`. The execution status was `Succeeded`, but that is not acceptance. No category was captured and no table was counted, so no continuation token was issued. This run starts no chain.
- **Observed identity.**
  - `session_user=ue_staging_runtime`, `current_user=union_eyes_runtime`, database `ue_v2_staging`, PostgreSQL 16.15.
  - The transaction was `BEGIN READ ONLY` (`transaction_read_only=on`) and was rolled back.
  - `default_transaction_read_only=off`. The operator requires `on`, so it refused before reading any catalogue or data.
- **Cause.** node-postgres overlays the parsed `DATABASE_URL` query parameters onto the client config. The staging `database-url` carries its own `options=` (the role), which replaced the operator's `options` field. The role was still applied, because the URL carries it too. The read-only default was lost. The fault harness's stand-in driver ignored `connectionString`, so the tests could not see this. Run 45940281038 did not check this setting (`default_read_only: null`).
- **Correction.**
  - The operator now appends its settings to the URL's own `options`.
  - The stand-in driver now overlays URL parameters the way node-postgres does.
  - A regression test reproduces the run's exact symptom against the previous operator (`-c role=union_eyes_runtime` only).
  - The Docker proof adds a real-driver case with `options=` in the URL.
  - The refusal stays as strict as before.
- **Integrity and cleanup.**
  - The three artifact entries verify against the run's `SHA256SUMS`. The manifest `sha256` (`95f41524…`) equals the checksum of `catalog-evidence.json`. Only one chunk, from one nonce, was accepted through Log Analytics.
  - The cleanup receipt reads `deleted: true, absent: true`, and an independent `az containerapp job show` returns `ResourceNotFound`.
  - The receipts are in `run-46019964268/`. The full artifact is held privately (directories 0700, files 0600).
- **Next.** Dispatch the Plane A baseline again only after the correction merges, and only with fresh founder authorization. The repeat is a new baseline, not a continuation.

## 9. Plane A: complete (runs 46036574426 and 46038068694)

Both sessions ran from `main` `2927b25caaa3ad2f6b4c2616acc8352e2dbbf98e` (merge of PR #1324) on revision `rel6a60c95c9d`, after founder authorization and `build` / `ue-staging` approval.

- **Baseline 46036574426.** `CATALOG_PARTIAL`, `PLANE_ACCEPTED`, no defects. Identity: `ue_staging_runtime` acting as `union_eyes_runtime`, with `transaction_read_only` and `default_transaction_read_only` both on, `ROLLBACK`, and `LIMITED_RUNTIME` (not a superuser, no RLS bypass). 13 of 15 categories accepted; `migration_history` and `preservation_counts` belong to Plane B. Of 790 tables, 250 were observed, 424 were `PRIVILEGE_DENIED` (no `SELECT` or no schema `USAGE`), and 116 were not attempted. The continuation token covered those 116.
- **Continuation 46038068694.** Bound to baseline `46036574426`, from the same source and revision, with the same identity checks. It observed the 116 remaining tables. No token was issued.
- **Independent checks.**
  - Every artifact file verifies against its run's `SHA256SUMS`, and each manifest `sha256` equals its `catalog-evidence.json`.
  - `assemblePlane` rebuilt the chain from the raw session evidence. On all 790 tables it matches the controller's `catalog-merged.json` (classification, value and scope), with 0 differences.
  - Result: 366 observed, all `ROLE_VISIBLE`, none a global total, and 424 denied. The denied set equals the privilege matrix's unreadable set.
  - Consistency is `MULTI_SESSION_STRUCTURE_UNCHANGED` (two sessions, not one snapshot).
  - Without Plane B, plane reconciliation refuses (`PLANE_EVIDENCE_MISSING`).
- **Posture observation, not a verdict.** Six relations have RLS disabled, and the runtime role cannot select any of them: `drizzle.__drizzle_migrations`, the four `public.ue_governance_job_*` tables, and `public.ue_v2_bootstrap_receipt`.
- **Cleanup.** Both receipts read `deleted: true, absent: true`. `az containerapp job show` returned `ResourceNotFound` for each job.

## 10. Plane B: multi-session chain refused for live writes; ceiling raised (option E)

- **Baseline 46048025241.** From the same source and revision, founder-authorized. It ran as `uev2admin` in `REPEATABLE READ` with both read-only settings on, then `ROLLBACK`. The session is `ELEVATED`: `rolbypassrls` true, `rolsuper` false.
  - Values are sealed to `bd8fa0572d31b7ce`. The public artifact has no clear count value and no clear ledger row. `sessionPlaneDefect` and `privilegedClearDefect` return null.
  - Opened offline with the founder key, the evidence is bound to this run and source.
  - 250 tables were observed as `GLOBAL` and 540 were not attempted. The 40 migration-ledger rows were captured. Opening and settled counters were equal after 75,093 ms.
  - No ledger hash appears in the public artifact or the run log.
  - Verdict `PLANE_INCOMPLETE`, exit non-zero by design, with a token for 540 tables.
- **Continuation 46072263185.** Refused: `DATA_DRIFT_BETWEEN_SESSIONS`.
  - Comparing the sealed opening counters offline: of 790 relations, only `public.audit_logs` changed, by inserts only, between 18:17:49Z and 22:11:42Z. Nothing else changed: no update, delete, rewrite or new relation.
  - Staging runs scheduled jobs every 5 to 30 minutes. In that window, `cron-deadlines` and `basops` ran 47 times each, and nine other schedules ran as well. Every session needs a build and two approvals, so any chain spans several firings. Retrying could not converge.
  - The job was deleted and proven absent. The chain is void and no value from it is used.
- **Measured cost.** The 250 counts took about 2.3 s of the 45 s wall budget (transaction start 18:17:49.703Z, session end 18:17:51.993Z). The 250-statement ceiling was the only reason for multiple sessions.
- **Decision (founder, 2026-11-27).** Option E of the decision record: `COUNT_MAX_STATEMENTS` goes from 250 to 1,000.
  - All 790 tables fit one `REPEATABLE READ` transaction, which is one atomic snapshot. Concurrent inserts cannot make its counts inconsistent, and the multi-session caveat does not apply.
  - Unchanged: the 15 s statement timeout, the 45 s wall budget, read-only mode, `ROLLBACK`, and sealing.
  - The Docker proof now builds 1,020 tables, so the continuation path and the drift refusal stay proven on real PostgreSQL.
  - Plane B restarts from a fresh baseline on the merged `main`. Plane A stays valid, because plane reconciliation does not bind the source SHA.

Receipts for all four runs (`SHA256SUMS`, `evidence-manifest.json`, `cleanup.json`) are in `run-<id>/`, byte-identical to the artifacts. Full artifacts are held privately (directories 0700, files 0600).

## 11. Plane B captured in one snapshot; offline assembly

- **Run 46084209107.** Dispatched from `main` `445451712b56da74fa572dd1c5928045c0f9d99b` (merge of PR #1325, ceiling 1,000), on revision `rel6a60c95c9d`. The founder authorized it and approved `build` and `ue-staging`.
  - Result: `PLANE_CAPTURED_SEALED`, no defects, exit 0.
  - Session: `uev2admin`, `REPEATABLE READ`, both read-only settings on, `ROLLBACK`. `rolbypassrls` true, `rolsuper` false.
  - Coverage: all 790 tables counted in one transaction, in 6.8 s of the 45 s budget (23:53:51.781Z to 23:53:58.536Z). No continuation token was issued.
  - Settle check: opening and settled counters were equal after 75,053 ms.
  - Sealing: values are sealed to `bd8fa0572d31b7ce`. There is no clear count or ledger row in the artifact. None of the 40 ledger hashes appears in the artifact or the run log. Opened offline, the evidence is bound to this run and source, and evaluates to `PLANE_ACCEPTED`.
  - Integrity: every file verifies against `SHA256SUMS`.
  - Cleanup: `deleted: true, absent: true`, and `az containerapp job show` returns `ResourceNotFound`.
- **Assembly.** Run offline on the founder machine with the founder key: `--assemble --runtime <46036574426>,<46038068694> --privileged <46084209107>`. Nothing contacted staging.
  - Verdict: `CATALOG_COMPLETE`, with all 15 categories accepted.
  - The output is private: directory 0700, files 0600. Only `preimage-20261127/preimage-summary.json` (classifications and digests, no values) is in this folder.
  - Its `privateEvidenceSha256` (`7e326e99…afbec`) binds it to the private preimage.
- **Correction made with this record.** The first assembly gave the runtime plane the privileged caveat. That caveat claims row-change statistics and the migration ledger were identical across sessions. The runtime plane reads neither, and counts in plain `READ ONLY`, not `REPEATABLE READ`.
  - `RUNTIME_CONSISTENCY_CAVEAT` now states only what runtime reconciliation compares: inventory, column structure, and relation and policy metadata. It says that data changes between runtime sessions are not detected.
  - The assembly was re-run with the correction. The two private preimages differ only in that caveat text. The first (`430f6e08…f58e00`) is kept privately as superseded.
- **What the result does and does not establish.**
  - Plane B (exact global totals and the migration ledger) is one atomic snapshot: `ONE_REPEATABLE_READ_TRANSACTION`.
  - Plane A (posture, plus role-visible counts that are never totals) is two sessions with unchanged structure, not one snapshot.
  - The planes were captured about six hours apart, from two `main` SHAs that differ only in the statement ceiling. `crossPlaneAtomic` is false.
  - Statistics counters detect recorded writes. They are not a complete detector of every mutation.
  - `public.audit_logs` grows continuously on live staging, so the preimage describes 2026-11-27 23:53:51Z for totals.
- **Flags.** `CATALOG_COMPLETE` from assembly is the evidence. It is not acceptance. `S2.02_PREIMAGE_COMPLETE` stays `NO` and `S2.02_LEGACY_GATE` stays `INDETERMINATE` until the founder reviews `preimage-private.json` and accepts S2.02. Every other flag in the table above is unchanged.
- **Open after-steps (founder).**
  - Review the private preimage.
  - Remove `UE_V2_STAGING_CATALOG_RECIPIENT` when no longer needed.
  - Consider rotating the `uev2admin` password.
  - Decide on early deletion of run 45940281038's artifact (expires 2026-12-04).
  - The deploy and merge freezes for the chains are no longer needed.
