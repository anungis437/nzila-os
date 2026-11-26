# Union Eyes V2 private catalogue job

This is the S2.02 catalogue route that does not use `az containerapp exec`. It is not a migration and it is not the forward-upgrade operator.

## Why this route

The forward-upgrade job already creates one owned Container Apps job in `nzila-ue-v2-staging-env`, pulls an image with the staging user-assigned identity, and reads `database-url` from Key Vault. That job's command commits schema changes and takes the admin password. The catalogue job copies only the network, identity, and Key Vault reference pattern. Its image entrypoint is the v2 catalogue programme. It has no upgrade command and no admin password.

## What a later dispatch does

The workflow is manual and `main` only. Image build uses the existing `build` environment. The job uses the existing `ue-staging` approval. It rechecks the serving revision and image, creates `ue-s202-cat-<run id>`, and starts one execution. Status is polled until `Succeeded`, `Failed`, `Stopped`, `Cancelled`, or `Degraded`, or until the 240 second deadline. `Pending` and `Running` stay in the poll. A control-plane read error is retried inside that deadline. At the deadline the controller stops the execution and polls for 30 seconds. It deletes the job only after the execution is terminal and the name, `purpose=s202-private-catalog`, run id, and source SHA all match. A job that is still running is left in place and recorded as `JOB_CLEANUP_UNPROVEN`. A scheduled job with a similar prefix is not deleted. A create error is followed by the same ownership read: an absent job is not deleted, an unowned job is not deleted, and an owned job is removed.

The operator prints the catalogue as `UE_CATALOG_FRAME` chunks of 3000 characters, each line under 4096 characters, with one SHA-256 over the whole body. The controller asks for 2813 log lines, which covers an 8 MiB body. A missing chunk, a split line, or a body over 8 MiB is `EVIDENCE_MISSING` or `EVIDENCE_TRANSPORT_EXCEEDED`. It is not `CATALOG_COMPLETE`. A job status of `Failed` stays an execution failure even when the log frame parses.

`DATABASE_URL` is a `secretRef` to the existing `database-url` Key Vault secret. The transaction is `BEGIN READ ONLY` and ends in `ROLLBACK`. The connected role is classified `LIMITED_RUNTIME` or `ELEVATED`. A read-only transaction does not make the account a read-only credential.

A job status of `Succeeded` is not `CATALOG_COMPLETE` and does not set `S2.02_PREIMAGE_COMPLETE`.

## Continuation

Counts keep the 15 second statement timeout, the 45 second wall budget, and the 250 statement ceiling. A partial count receipt can build a continuation token bound to the revision, image, and table-inventory digest. A second session must be dispatched separately. Reconciliation rejects expired tokens, schema drift, overlapping counts, and contradictory values.

## Not done in this change

No image was pushed. No Azure job was created. The runtime role inside `database-url` is unverified until an approved dispatch.
