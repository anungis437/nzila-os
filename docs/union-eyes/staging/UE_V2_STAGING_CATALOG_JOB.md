# Union Eyes V2 private catalogue job

This is the S2.02 catalogue route that does not use `az containerapp exec`. It is not a migration and it is not the forward-upgrade operator.

## Why this route

The forward-upgrade job already creates one owned Container Apps job in `nzila-ue-v2-staging-env`, pulls an image with the staging user-assigned identity, and reads `database-url` from Key Vault. That job's command commits schema changes and takes the admin password. The catalogue job copies only the network, identity, and Key Vault reference pattern. Its image entrypoint is the v2 catalogue programme. It has no upgrade command and no admin password.

## What a later dispatch does

The workflow is manual and runs from `main` only. The image build uses the existing `build` environment, and the job uses the existing `ue-staging` approval.

Before creating anything, the controller rechecks:
- the serving revision and its image;
- the `database-url` secret name;
- the environment's log destination.

Then it creates `ue-s202-cat-<run id>`, re-reads it to prove ownership, and starts one execution. The execution status is polled:
- `Pending` and `Running` keep polling, and a control-plane read error is retried within the 240-second deadline.
- At the deadline, the controller stops the execution and polls for another 60 seconds.
- A `Failed`, `Stopped`, `Cancelled` or `Degraded` execution is an execution failure, even when its evidence is retrieved.

### Evidence transport

The operator writes the catalogue to stdout as frame `UE_CATALOG_V2`:
- one `BEGIN` line, carrying a 32-hex nonce, schema, run id, source SHA, byte length, SHA-256 and chunk count;
- `CHUNK` lines, each holding base64 of 6,000 exact UTF-8 bytes, about 8,060 characters, under the 16,384-character container log line split;
- one `END` line.

The managed environment already sends job stdout to its Log Analytics workspace. The controller reads the workspace ID from the environment's `appLogsConfiguration` and queries `ContainerAppConsoleLogs_CL` with the deploy identity's existing Monitoring Contributor grant. It accepts only lines where all of these match:
- `ContainerJobName_s` is this job;
- `ContainerName_s` is `catalog-operator`;
- `ContainerImage_s` is the exact operator digest;
- `ContainerGroupName_s` starts with this execution;
- `Stream_s` is stdout.

It waits up to 15 minutes for ingestion, then fetches chunks in pages of 200 by index.

Reassembly is strict:
- order doesn't matter, and identical duplicates are ignored;
- a second nonce or replica is `EVIDENCE_AMBIGUOUS`;
- a different duplicate is `EVIDENCE_CONFLICT`;
- a gap is `EVIDENCE_MISSING`, with the missing indices listed;
- non-canonical base64 is `EVIDENCE_MALFORMED`;
- the wrong run or source is `EVIDENCE_BINDING_MISMATCH`;
- decoded bytes must match the declared length and SHA-256.

The frame ceiling is 32 MiB. The measured canonical catalogue is 1,306,708 bytes (218 chunks).

The replica log-stream proxy (`az containerapp job logs show`) isn't used. It needs the replica to still exist after completion, it belongs to the console proxy family that returned HTTP 404, its default JSON output escapes the frame, and its 300-line tail can't hold the catalogue.

### Identity

`DATABASE_URL` is a `secretRef` to the existing `database-url` Key Vault secret. The operator connects with `-c role=union_eyes_runtime`, as the application and forward-upgrade preflight do; the `ue_staging_runtime` login holds that role with `INHERIT FALSE`.

The evidence must show:
- `current_user=union_eyes_runtime`;
- `session_user=ue_staging_runtime`;
- `transaction_read_only=on`;
- `ROLLBACK`.

The session is classified `ELEVATED` when either the login or the role is superuser, bypasses RLS, or can create databases or roles. Only `LIMITED_RUNTIME`, with no superuser and no RLS bypass, is accepted; anything else is `DATABASE_PRIVILEGE_UNEXPECTED`. A read-only transaction doesn't make the account a read-only credential.

### Ownership and cleanup

A job is deleted only when **all** of these match: its name, the tags `purpose`, `owner`, `runId` and `source`, the managed environment, a single `catalog-operator` container on the exact operator image, and the staging identity.

Deletion order:
1. Every execution is listed, and live ones are stopped and polled to a terminal state.
2. Deletion is retried up to three times.
3. Absence must be proven by an explicit not-found. An unreadable state is never taken as deleted.

When something can't be proven:
- An execution that can't be proven terminated is kept, with an actionable incident in the receipt.
- A cleanup failure overrides a successful catalogue (exit 6).

Other create and start cases:
- An existing job with the same name stops the run before creation.
- After a create error, the job is reconciled by the same rules.
- A start error is followed by the same settle-then-delete path.
- An `always()` step runs `--cleanup-only` for cancelled or interrupted runs, under the same rules.

### Image

The build step runs the image's own entrypoint as uid 1001, with `NODE_PATH` unset and no database. It pushes the digest only when the framed refusal shows:
- `pg` resolved under `/app/node_modules`;
- the entry `/app/ue-catalog/operator.cjs`;
- blocker `DATABASE_URL_ABSENT`.

A job status of `Succeeded` isn't `CATALOG_COMPLETE`, and doesn't set `S2.02_PREIMAGE_COMPLETE`.

## Continuation

Counts keep the 15-second statement timeout, the 45-second wall budget and the 250-statement ceiling.

A partial run writes a continuation token, bound to the revision, image, operator source SHA and table-inventory digest. It also writes `catalog-merged.json`; both files are listed in `SHA256SUMS`.

Each continuation is a separate, separately approved dispatch, with `continuation_run_id` set to the previous run. The workflow accepts only a run of this workflow dispatched from `main`. The controller verifies the prior hashes and the token before creating any job, and sends only the remaining tables. Reconciliation rejects:
- expired tokens;
- a changed revision or source;
- schema drift;
- overlapping counts;
- contradictory values.

The number of sessions follows from the live table count. Intermediate sessions report `CATALOG_PARTIAL`.

## Evidence planes

The workflow input `plane` selects one of two sessions. They are reconciled offline into one preimage.

- **`runtime` (default, Plane A).**
  - Acts as `union_eyes_runtime`. Records posture: roles, ownership and ACLs, RLS, policies, functions, event triggers, audit permissions, sequences, and a per-table privilege matrix.
  - Its counts are role-visible and are never accepted as totals.
  - Alone it is at most `CATALOG_PARTIAL` with `planeVerdict = PLANE_ACCEPTED`. The run exits 0 when its share is complete.
- **`privileged` (Plane B).**
  - Runs only with separate founder authorization.
  - Uses the existing `uev2admin` login and its existing environment secret, which reaches only this step and only on this plane. Read-only, `REPEATABLE READ`, `ROLLBACK`, with the same time and statement bounds.
  - Reads the migration ledger and exact global counts. Those values are sealed in the container to the founder's key (`UE_V2_STAGING_CATALOG_RECIPIENT`). Without the key, nothing is created.
  - A complete run reports `PLANE_CAPTURED_SEALED`, which is not acceptance.

Only `--assemble`, run offline by the founder with the private key, can produce `CATALOG_COMPLETE`. It needs both planes, every artifact verified against its `SHA256SUMS`, and matching inventory, structure and migration discovery. Continuation chains never cross planes.

See [the decision record](../step2/evidence/s2.02-private-catalog-job/PLANE_B_DECISION_RECORD.md).

## Not done in this change

No image was pushed and no Azure job was created. Log Analytics ingestion timing, and the exact `database-url` login, are first observed on an approved dispatch; both fail closed.
