# G2 transactional ACR import: preflight stop

Mission `NZ-20261008-INFRA-001`; slice
`G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT`.

## Disposition

`STAGE2A_PRIVATE_ORAS_DELIVERY_PARTIAL`

Precise blocker:
`TARGET_COLLISION_AND_CONTENT_READBACK_CONTEXT_NOT_AUTHORIZED`.

**The temporary exceptions are now explicitly authorized.** Registry-wide
importer access and `None -> AzureServices -> None` are accepted only for this
transaction, not steady state. They are not the reason for this stop.

The transaction cannot meet its mandatory target collision and content-readback
requirements with an established permitted execution context. It has therefore
not opened. No source staging, temporary role creation, bypass change, import,
builder Reader creation, artifact deletion or guest execution occurred.

| Requirement | Observed result |
|---|---|
| IMPORT_PRINCIPAL_IDENTITY_RECHECK | PASS |
| SOURCE_STAGING_WRITE | EXISTING_ACRPUSH |
| TEMP_IMPORT_ROLE_ASSIGNMENT_COUNT | 2 planned, 0 applied |
| TARGET_TRUSTED_SERVICES_EXCEPTION_SCOPE | BROADER_THAN_ACR_IMPORT, authorized temporarily but not applied |
| IMPORT_WINDOW_OPENED | NO |
| SOURCE_MANIFEST_DIGEST | Not available; source artifact not created |
| ACR_SERVER_SIDE_IMPORT | NOT_RUN |
| SOURCE_TARGET_ARTIFACT_EQUIVALENCE | NOT_RUN |
| TARGET_NETWORK_RULE_BYPASS | None, unchanged |
| TARGET_TEMP_IMPORT_ROLE_REMOVED | NOT_CREATED |
| SOURCE_TEMP_IMPORT_ROLE_REMOVED | NOT_CREATED |
| BUILDER_G2_TOOLING_READ | NOT_GRANTED |
| AUTHORIZED_STEADY_STATE_RBAC_DELTA | 0 actual; +1 conditional plan not reached |
| PROTECTED_INFRASTRUCTURE_RESOURCE_COUNT | 16 |
| ORAS_EXECUTION_AUTHORITY_CONSUMED | NO |
| OVERALL_G2 | FAIL |

`IMPORT_WINDOW_STARTED_AT`, `IMPORT_WINDOW_ENDED_AT` and duration are null:
no temporary exception was applied. There was no rollback to perform or
teardown failure to conceal.

## Fresh baseline and exact transaction plan

Concurrency: worktree `C:\APPS\worktrees\nzila-g2-provenance`, branch
`g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`. Pre-write status remained the
existing untracked `.azure/` and `infrastructure/landing-zone/g2-builder/`.
No foreign work was dispositioned.

[Pre-transaction baseline](G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT_PRE_TRANSACTION_BASELINE.json)
records exact source/target GETs, canonical pre-state hashes, current direct/
inherited/group-inclusive assignments and identity recheck:

- Build principal `bfa4a851-696a-4d3f-927b-5fb1526f79f2`, client
  `5c02d25b-cbdc-412f-8c2a-9ed43b73ac20`, correct tenant and exact build
  GitHub OIDC federation; no password/certificate credentials.
- Existing source AcrPush assignment
  `456bd3f1-4ee2-423b-bc1a-8b99e8338e19` remains unchanged.
- Target public access Disabled, ABAC mode unchanged, private endpoint Approved,
  bypass None. No extension exists.
- Source relevant-tag inventory NOT_RUN because the staging OIDC workflow was
  not dispatched. Target inventory BLOCKED, not treated as an empty repository.

[Transaction change plan](G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT_TRANSACTION_CHANGE_PLAN.json)
contains deterministic UUIDv5 IDs, exact role-definition IDs/scopes/principals,
resolved live role definitions, reader condition and expected before/during/
teardown/final assignment sets. Naming inputs and namespace are recorded.
All proposed names were unused; equivalent temporary/reader assignments were
absent in the observed active subscription assignment census.

Only planned temporary changes:

1. Source registry importer/read/catalog assignment to existing build principal.
2. Target registry importer/read/catalog assignment to that same principal.
3. Target `properties.networkRuleBypassOptions: None -> AzureServices`.

No repository conditions are claimed for importer roles. The only later
lasting plan is builder Repository Reader conditioned exactly to `g2-tooling`,
after target equivalence and complete teardown. Existing synthetic-health
builder Writer/runtime Reader remain unchanged.

The plan is content-addressed evidence, **not execution-bound authority**:
the source manifest digest is unavailable, the target collision/readback
context is unestablished, and no provider/change execution gate passed.
No random execution IDs, template or write-capable controller was produced.

Rollback plan is exactly the authorized order: restore target bypass None and
verify; remove only transaction-created target importer; remove only
transaction-created source importer. Never remove pre-existing roles/artifacts
or modify other network state.

## Why server-side import does not close the readback gate

[Microsoft Private Endpoint documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-endpoints)
states that after an approved private endpoint/public-access disablement,
repositories/tags cannot be listed outside the virtual network using the
portal, Azure CLI or other tools.

[Trusted-services documentation](https://learn.microsoft.com/en-us/azure/container-registry/allow-access-trusted-services)
permits the **ACR import service** to bypass network rules. It does not make an
ordinary GitHub-hosted client a trusted ACR service or give it a private route.
Importer authorization is not network reachability.

The exact stable `2025-11-01` Microsoft ARM schema was retrieved from the
provider repository. `Registries_ImportImage` has no successful response schema
carrying manifests or blob bytes; its registry management surface does not
provide a manifest/blob content-read operation. ARM success cannot substitute
for the packet's explicit artifact type, manifest and archive readback proof.

[Verification-path gate](G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT_TARGET_VERIFICATION_PATH_GATE.json)
preserves bounded documentation excerpts/hashes, provider schema response
evidence and a read-only pinned private HTTPS probe:

- Target `10.90.2.5:443`, hostname/SNI
  `nzilag2tzo75uuozprbo.azurecr.io`.
- Proxy disabled, private-IP pin, no public fallback, no authentication.
- TCP connection timed out; curl exit 28, HTTP 000, no remote connection.
- Repository runner census still reports zero self-hosted runners.

This probe is an explicit unsuccessful observation, not a swallowed error.
It does not establish a current workstation-private read context, nor does it
assert every possible future private observer is impossible.

The builder has a prior proven private path, but the current packet explicitly
prohibits deploying CSE, pulling ORAS or guest execution. It cannot be reused
silently as a verifier. No ACR task/agent was started: that would add execution
outside the exact transaction and current target
`networkRuleBypassAllowedForTasks=false` does not establish such a path.

Without this context the packet cannot:

1. Determine target tag collision before import (same digest requires idempotency
   adjudication; different digest requires stop).
2. Read and verify imported target content before immediate teardown.

The built-in no-overwrite import behavior is useful but is not the required
pre-import collision observation. Source digest plus operation success is not
target readback. Opening the window or creating a source artifact now would
leave a foreseeable unfulfillable verification step.

## Smallest missing authority, not a new staging substrate

The import design remains supported. No new private staging runner/VM/network
is proposed.

A narrow resolution could explicitly authorize **read-only private observation
on the existing builder**, separately from ORAS execution/artifact push, or
identify an existing independent private observer with an approved secretless
authentication flow.

Such authority must bind:

- Target collision observation before import and manifest/blob readback after
  import, with exact expected schemas/hashes.
- A read-only execution channel and identity. The current ordering grants
  builder tooling Reader only after teardown; if using the builder, explicitly
  resolve how it reads tooling before equivalence/teardown rather than attaching
  the import principal, transferring tokens or silently moving the Reader grant.
- If a temporary CSE observer is chosen, exact source/tests/child Create/Delete
  authority and output sanitization; no package action, ORAS execution, push,
  unrelated reads or import credentials in settings.
- Removal/retirement and final protected-state proof, alongside the already
  authorized importer/bypass teardown. No general guest-administration approval.

No such execution or ordering change was inferred here. Existing transaction
authority is unconsumed, with all temporary exceptions closed because they were
never opened. Subsequent resolution must not relabel the accepted exceptions as
unapproved; it needs to close this one observation-context dependency.

## Validation and evidence

New evidence: pre-transaction baseline, deterministic change plan, target
verification gate, protected baseline, disposition, preflight integrity,
this report and final protected-state/integrity records.

Final checks repeat exact source/target configuration and assignment
preservation, protected16/extension absence, frozen Stage 1/inventory source,
historical evidence hashes, JSON parsing, concurrency and `git diff --check`.
No Bicep/provider deployment checks are applicable because no executable
IaC/source was changed and the transaction preconditions remain blocked.
The temporary read-only controller is retired after verification.

Stage 1 and Phase 1 inventory remain proven. No artifact-delivery or teardown
PASS is claimed; no Stage 2B/Stage 3.
