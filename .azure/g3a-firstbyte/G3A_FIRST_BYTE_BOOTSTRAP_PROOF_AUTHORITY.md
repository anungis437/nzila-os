# G3A_FIRST_BYTE_BOOTSTRAP_PROOF_AUTHORITY

**PREPARED ONLY. NOT ISSUED. NOT EXECUTABLE.**

Mission: `NZ-20261008-INFRA-001`.

This draft is not permission to create a resource, acquire a live identity token,
upload a Blob, run a VM, or execute a transaction. A maintainer must issue a
separate, exact, single-use authority after its unresolved bindings are closed.

## Sole technical acceptance criterion

`PRIVATE_BLOB -> CSE_MANAGED_IDENTITY -> STATIC_BOOTSTRAP_EXECUTES`

The immutable object identifier must also be honored. A successful process start
from the wrong/current Blob does not satisfy this criterion.

This is not a portable-build rehearsal. There is no compiler/source input, input
ACR, runtime image build, target ACR read/write, G3B, or product workload.

## Why this proof is needed

Both captured CSE sources create downloads with mode `0500` and invoke the
command in the download directory through `/bin/sh -c`. No external `chmod`
is needed for a fresh download under those source semantics.

The independent uncertainty is immutable-object consumption: both MSI
downloaders send `x-ms-version: 2018-03-28`, whereas the Get Blob contract
documents `versionid` for `2019-12-12` and later. Source evidence does not
establish whether a published handler will reject the request, ignore its
version selector, or otherwise retrieve the intended version. No behavior is
assumed. Do not silently remove the version selector or replace it with a
snapshot/current Blob. A failed identity-bound version read stops the proof.

## Unresolved pre-issue bindings

- Exact issued authority hash, owner/executor principal and grant capability.
- Exact published handler version/package provenance; repository source tags
  alone are not evidence of the package deployed in Canada Central.
- Exact pinned VM image and verified compatible VM-agent/CSE installation.
- Static linux/amd64 identity-probe binary hash, bytes (maximum 10 MiB), source
  archive and toolchain hashes, no ELF interpreter/shared-library dependencies.
- Exact Storage account/container/object identifier and CSE settings with one
  bound UAMI client ID. No SAS, storage key, or secret literal.
- Proof cost bounds and a separately approved candidate ceiling; no G3A ceiling.
- Existing approved control-plane-bootstrap RG/VNet/subnets and their baseline,
  with a private path that permits VM-agent operation and execution.
- Transaction-owned resource-ID and role-assignment allowlist, name-absence
  checks, cost tags and exact creation-receipt ledger.

These are gating preconditions, not success-shaped default bindings.

## Minimal candidate resources

Use existing approved G3 control-plane bootstrap networking read-only. If that
network does not exist, stop: this draft does not authorize its bootstrap.

Create only one transient Standard_LRS StorageV2 account in Canada Central,
one private bootstrap container, one Blob private endpoint and its necessary
new private DNS zone/link/zone-group/records, one UAMI, one isolated B2s VM with
one NIC, NSG and 64 GiB StandardSSD OS disk, one CSE instance, and exact-container
Blob data-role assignments. No public IP or SSH ingress.

Every newly created resource is proof-owned. An existing DNS zone may be read
and referenced, but must not be owned, updated or deleted by cleanup. If safe
attachment cannot be achieved with newly owned resources, stop before mutation.

Temporary producer: `Storage Blob Data Contributor`, exact container scope.
Builder: `Storage Blob Data Reader`, exact container scope. No account
contributor, key retrieval, G2 identity or registry role.

## Future single-use sequence

1. Capture HEAD/worktrees, live read-only baseline, name absence and ownership.
2. Consume a durable exclusive proof-authority marker before first mutation.
3. Create only allowlisted proof-owned resources and record exact receipts.
4. Grant producer container access; authenticated write of the exact probe only.
5. Verify producer readback hash, bytes, object metadata and immutable identifier.
6. Revoke the producer grant. Disable public networking. Prove private DNS/PE
   configuration before VM consumption; do not use a public fallback.
7. Assign exact-container Blob Reader to the bound builder UAMI.
8. Create one private VM and one CSE instance, with `skipDos2Unix: true` in public
   settings and URI/managed identity/command in protected settings.
9. Execute `exec ./g3a-bootstrap` once in the handler download directory.
10. Collect bounded, sanitized process/version/provenance and identity evidence.
11. Seal acceptance or failure evidence, then remove only positively captured
    proof-owned resources/grants in reverse dependency order and reconcile.

Do not change `timestamp`, redeploy the extension to obtain a new sequence,
restart the transaction, or automatically retry a failed execution.
Handler-internal read-download retries are separate from the one process
execution attempt and do not permit mutation or command retries.

## Static probe behavior and evidence

The future proof probe must only report bounded version/provenance, compute its
own running-file hash after start, acquire IMDS identity using the bound client
ID, and demonstrate matching non-secret identity claims. Do not persist access
tokens, Authorization headers, token response bodies or signed URLs.

Post-start self-hash is not independent pre-execution verification. The trust
anchor remains platform transport plus a proven immutable object identifier.

To detect a version selector ignored by the handler, stage distinct version A
and version B of the **same** object, bind A's version URI, and leave B as current.
Both versions must be proof-only static identity probes, with bounded distinct
provenance; no product/build payload. A's process/self-hash and producer readback
must match the bound A identifier. B executing, any nonzero exit, missing
identity/provenance, or download failure is FAIL and consumes the one attempt.
The cumulative object-version bytes must remain inside the cost bound.

This identity/version discrimination tests the actual unresolved transport
behavior; it is not permission to make full G3A work.

## Costs and limits

The separate [proof cost model](./BOOTSTRAP_PROOF_COST_MODEL.json) prices one VM
for at most two hours and one PE/proof lifecycle for at most four hours, one
private DNS zone conservatively for a full month, bounded disk/Blob operations
and at most 0.1 GB of stored versions and traffic in each direction.

It is a conservative scenario, not an issued budget. Actual binary bytes and
all preconditions must be checked before issuance. Do not interpret this model
or the earlier CAD 4.02 component subtotal as the G3A execution ceiling.

## Failure and cleanup

Wrong immutable identifier, identity failure, public DNS/network consumption,
download failure, missing start, incorrect provenance, cost/duration excess,
foreign ownership, or cleanup failure causes an explicit failed disposition.

Preserve failed evidence. Do not remediate by running again. Cleanup must never
delete a baseline/G2/product/control-plane-bootstrap resource; delete only exact
positive creation receipts within the allowlist. Uncertain ownership stops that
cleanup action and is reported for human reconciliation.

## Governance boundary

This draft remains NOT ISSUED. `G3_CONTROL_PLANE_BOOTSTRAP` is still a separate
prerequisite. `G3A_EXECUTION_AUTHORIZED`, `G3B_EXECUTION_AUTHORIZED` and
`G3_TECHNICAL_EXECUTION_AUTHORIZED` remain `NO`.
