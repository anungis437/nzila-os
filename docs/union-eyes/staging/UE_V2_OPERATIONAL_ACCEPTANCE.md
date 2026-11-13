# Protected operational acceptance

These tools prepare required live evidence; their presence and local contracts do not prove runtime recovery or revocation.

## Failed revision and known-good recovery

The main-only `ue-v2-staging-rollback-rehearsal.yml` shares deployment serialization with the normal staging deploy workflow. Its read-only protected plan captures the live healthy revision, exact image and template hash, requires the exact change-record source, main ancestry, Canada Central, the non-production subscription/tenant and Multiple revision mode with a named known-good revision pinned to 100% traffic. Review the plan artifact before the protected apply checkpoint. Apply refuses a changed reviewed revision, image or template.

The bounded rehearsal preserves image, scale, secret references and application configuration. It creates one revision with an intentionally absent Node preload, verifies an actual Azure failed state while the known-good source continues serving, then restores the captured healthy template as a new zero-traffic revision in `finally`. The known-good revision must retain 100% traffic throughout; a latest-following route or any observed traffic drift fails qualification. After healthy restoration, deactivate the deliberately failed revision. Recovery requires exact template/image equality, readiness, liveness and source identity. It changes no database data or schema and deletes no revision. Six local contracts exercise read-only planning, exact restoration, restoration after failed health, refusal of stale/wrong-source plans, unsafe latest-following traffic, and traffic moving to the failed revision. They are not Azure evidence.

The deployed application uses [multiple revisions with deliberate traffic management](https://learn.microsoft.com/en-us/azure/container-apps/revisions) and supports [template updates through JSON Merge Patch](https://learn.microsoft.com/en-us/rest/api/resource-manager/containerapps/container-apps/update?view=rest-resource-manager-containerapps-2024-03-01).

## Existing-cookie membership revocation

The protected real-Entra workflow defaults to baseline acceptance. With `verify_membership_revocation=true`, it publishes a redacted baseline checkpoint and keeps both actual provider sessions exclusively in process memory for six minutes. The private staging operator may then deactivate only the previously verified synthetic principal A's canonical membership using a separately guarded operation. The browser subsequently requires the same real provider session to remain unexpired while case access and new document download leases return 403/404. Failure to revoke remains an acceptance failure. No session cookie, password, bearer token or plaintext signed URL is saved.

Complete backup and recovery checkpoint evidence before changing the owned synthetic membership. A previously issued signed lease remains subject to the separate private-network actual-expiry check; denying a newly requested lease does not retroactively invalidate a previously issued signature. Restore synthetic membership after the recorded denial and recheck tenant boundaries. No institutional office, mandate, platform-admin power or real customer account is created or altered.
