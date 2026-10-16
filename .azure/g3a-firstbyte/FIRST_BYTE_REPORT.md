# G3A first-byte source qualification

Mission: `NZ-20261008-INFRA-001`.

## Outcome

`G3A_CSE_DOWNLOADED_BINARY_EXECUTION = PROVEN` for the pinned source semantics.

`G3A_FIRST_BYTE_BOOTSTRAP = REQUIRES_LIVE_BOOTSTRAP_PROOF`.

`G3A_TRANSACTION_READINESS = BLOCKED`. No execution is authorized.

The surviving first-byte blocker is **immutable version-bound private Blob
consumption**, not missing Python/curl/chmod and not downloaded executable mode.
Controller/top-level Bicep completion and all-in G3A costing were conditional
on first-byte READY; they were not started after this stop boundary.

## Direct authoritative evidence

Current source commit:
`74f1d89ae43d1e8d1d0ffd921d3c0df3ce3decd8`.

Tagged `v2.1.17` source commit:
`aa2eb2a9724ca074044c7b8c31dfbaa4196e7942`.

Both Microsoft-maintained implementations establish:

| Surface | Source-bound behavior |
| --- | --- |
| Download file | `main/files.go` passes creation mode `0500` to `download.SaveTo`. |
| Mode application | `pkg/download/save.go` opens a new file using that mode. No external `chmod`. Existing file permissions are not repaired by this call. |
| Output path | `/var/lib/waagent/custom-script/download/<seqnum>/<last-URL-path-segment>`; query parameters are excluded from the filename. |
| Working directory | `main/cmds.go` executes in the same sequence download directory. |
| Invocation | `main/exec.go` uses `/bin/sh -c`; candidate command is `exec ./g3a-bootstrap`. |
| Binary bytes | `skipDos2Unix: true` bypasses post-processing. This setting belongs in public settings; managed identity, file URIs and command may be protected. |
| Identity | The original Blob URL is handed to the MSI downloader with a bound client/object ID. No Python/curl is involved in this transition. |
| Attempts | Handler read-download retries exist; they are not authorization for a second command/transaction attempt. |

This is source evidence, not a claim about an installed guest, a published
Canada Central handler package, filesystem execution policy, or a built
bootstrap binary. A fresh handler directory and executable filesystem are
required. The exact binary/guest/runtime bindings remain unprepared at STOP.

Sources:
[tagged files.go](https://github.com/Azure/custom-script-extension-linux/blob/aa2eb2a9724ca074044c7b8c31dfbaa4196e7942/main/files.go),
[tagged save.go](https://github.com/Azure/custom-script-extension-linux/blob/aa2eb2a9724ca074044c7b8c31dfbaa4196e7942/pkg/download/save.go),
[tagged exec.go](https://github.com/Azure/custom-script-extension-linux/blob/aa2eb2a9724ca074044c7b8c31dfbaa4196e7942/main/exec.go),
[Microsoft CSE contract](https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux).

## Independent unresolved transport condition

Both captured MSI implementations explicitly set:

`x-ms-version: 2018-03-28`.

Microsoft's [Get Blob contract](https://learn.microsoft.com/en-us/rest/api/storageservices/get-blob)
states that `versionid` is available with version `2019-12-12` and later.

Therefore forwarding `?versionid=...` is not, by itself, evidence of immutable
version consumption. The local fail-closed fixture rejects this candidate
combination. No server-side result (reject, ignore, or another behavior) was
tested or inferred.

The current source has the same API version, so switching from the tagged
source to current source does not close this condition. The source tag does
not establish which Azure package would actually be installed.

Snapshot or other immutable-object contracts were **not silently selected** as
a replacement. The packet stops at uncertainty rather than designing around
it. A future maintainer may choose a separately qualified compatible contract;
this packet does not claim every private Blob design requires a live proof.

Source:
[tagged MSI downloader](https://github.com/Azure/custom-script-extension-linux/blob/aa2eb2a9724ca074044c7b8c31dfbaa4196e7942/pkg/download/blobwithmsitoken.go).

## Trust and design boundaries

The selected first-byte model remains
`CSE_MANAGED_IDENTITY_PRIVATE_BLOB`. OCI input-registry design is unchanged.
Blob carries only the first hash-bound static executable, never source,
compiler, runtime image or customer/product data.

Platform transport trust comprises TLS, private endpoint/DNS, managed identity,
and a **proven** immutable object identifier. That last condition is unresolved.
Post-start self-hash does not independently verify the first executable before
execution. Every subsequent controller/input must be SHA-256 verified before
use. No optional current-source hash allowlist was configured or claimed.

Candidate StorageV2 Standard_LRS/Canada Central, TLS 1.2, no shared key, no
anonymous Blob, private consumption, exact-container Reader/temporary
Contributor, producer-grant removal, transactional lockdown, cleanup ownership
and DELETE poststate are recorded in
[candidate contracts](./BOOTSTRAP_CANDIDATE_CONTRACTS.json). These are design
contracts, not deployed/private-path or complete-IaC proofs.

The [proof authority](./G3A_FIRST_BYTE_BOOTSTRAP_PROOF_AUTHORITY.md) is
**PREPARED, NOT ISSUED**. Its acceptance is narrowly limited to private managed
Blob delivery and static identity-probe execution. A two-version discriminator
detects silently ignored version selection. No application build or ACR
operation is allowed.

## Costs

[Separate proof cost](./BOOTSTRAP_PROOF_COST_MODEL.json) includes conservative
VM, disk, PE, DNS, Blob capacity/operations and transfer bounds. It uses exact
CAD primary meters; GPv2 aliases are checked by matching meter ID, unit and
rate against their primary shared-meter records. Public pricing pagination is
complete. Actual probe bytes are not measured; the scenario bounds them instead.

This is a candidate proof budget, not a G3A execution budget.
`G3A_EXPECTED_COST_CAD` and `G3A_COST_CEILING_CAD` remain `UNRESOLVED`.
The old CAD 4.0249905122734567 component subtotal remains unchanged.

## Concurrency, preservation and validation

Work is isolated to the new first-byte lane. Baselines are refreshed before
each write batch. Neither shared/product work nor prior sealed packets were
edited, staged, committed, cleaned up or dispositioned.

The new packet binds the prior transaction root
`0c216d4b17146236bf632640df6fef84c31deea7a9d814637e14714f6e0859a4`
and qualified core root
`3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81`.
Sealing verifies the prior transaction census and protected references,
including G2 terminal. Independent verification rechecks those bytes and
replays only the new offline source-contract tests. Portable reproducibility,
registry uploader qualification and image builds are not rerun.

Exact local commands/results are recorded in
[local validation](./FIRST_BYTE_LOCAL_VALIDATION.json) and
[independent verification](./FIRST_BYTE_INDEPENDENT_VERIFICATION.json).
No repository PR review was requested; no monorepo/product checks or cloud
what-if/deploy commands were run.

## Required output

Every requested disposition is in
[FIRST_BYTE_DISPOSITION.json](./FIRST_BYTE_DISPOSITION.json).
The portable builder/build core/private reader/uploader qualification is
preserved. Actual controller/top-level Bicep remain INCOMPLETE.
All G3 execution authorities remain NO. Azure, Entra and registry mutations
are zero. UE and Cora remain INFRA_NO_GO.
