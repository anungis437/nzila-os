# Union Eyes V2 private catalogue job

This is the S2.02 catalogue route that does not use `az containerapp exec`. It is not a migration and it is not the forward-upgrade operator.

## Why this route

The forward-upgrade job already creates one owned Container Apps job in `nzila-ue-v2-staging-env`, pulls an image with the staging user-assigned identity, and reads `database-url` from Key Vault. That job's command commits schema changes and takes the admin password. The catalogue job copies only the network, identity, and Key Vault reference pattern. Its image entrypoint is the v2 catalogue programme. It has no upgrade command and no admin password.

## What a later dispatch does

The workflow is manual and `main` only. Image build uses the existing `build` environment. The job uses the existing `ue-staging` approval. It rechecks the serving revision and image, creates `ue-s202-cat-<run id>`, starts one execution, reads that execution's logs, and deletes the job only when the name, `purpose=s202-private-catalog`, run id, and source SHA all match. A scheduled job with a similar prefix is not deleted.

`DATABASE_URL` is a `secretRef` to the existing `database-url` Key Vault secret. The transaction is `BEGIN READ ONLY` and ends in `ROLLBACK`. The connected role is classified `LIMITED_RUNTIME` or `ELEVATED`. A read-only transaction does not make the account a read-only credential.

A job status of `Succeeded` is not `CATALOG_COMPLETE` and does not set `S2.02_PREIMAGE_COMPLETE`.

## Continuation

Counts keep the 15 second statement timeout, the 45 second wall budget, and the 250 statement ceiling. A partial count receipt can build a continuation token bound to the revision, image, and table-inventory digest. A second session must be dispatched separately. Reconciliation rejects expired tokens, schema drift, overlapping counts, and contradictory values.

## Not done in this change

No image was pushed. No Azure job was created. The runtime role inside `database-url` is unverified until an approved dispatch.
