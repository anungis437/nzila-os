# G2 Stage 1 runtime discovery source repair

Mission: `NZ-20261008-INFRA-001`

`RUNTIME_DISCOVERY_SOURCE_REPAIR_COMPLETE`  
`SERIAL_MARKER_CONTRACT = PASS`  
`IDENTITY_ASSERTION_MODEL = PASS`  
`APT_DEB822_PARSER = PASS`  
`APT_DEB822_FIXTURE_TESTS = PASS`  
`INFRASTRUCTURE_BYTES_UNCHANGED = YES`  
`RUNTIME_REEXECUTION_MODE = NEW_VM_EXECUTION_REQUIRED`

These are local source-contract results, not a new Azure runtime proof.
Current Stage 1 remains PARTIAL; overall G2 remains FAIL. Retry 2 is consumed.

## Concurrency and preserved authority

Branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27` remain unchanged.
Observed worktree state is the existing untracked `.azure/` and builder tree;
no foreign tracked edits were made or dispositioned.

All previous evidence is preserved byte-for-byte. The new
[content-addressed manifest](./G2_STAGE1_RUNTIME_DISCOVERY_REPAIR.json)
records historical evidence hashes, old/new discovery/test hashes, unchanged
infrastructure hashes, previous deployed authority and the isolated candidate
template hash. The deployed template and parameters are not overwritten.

## Serial defect and repair

Cloud-init writes the embedded script, then uses `exec python3` without shell
tee/redirection in the Python path. Historically Python wrote compact V1 JSON
directly to `/dev/ttyS0` and also printed the entire record to stdout, captured
by cloud-init. Both records came from the intended process; there was no
alternate discovery command. The earlier verified serial capture establishes
interleaving between those two paths. Neither source nor fallback ever emitted
the two required literals, so their absence was not shell transformation,
buffering, redirection or truncation of an originally emitted marker.

The repaired Python path opens a blocking serial descriptor, writes exactly one
`NZILA_G2_DISCOVERY_STARTED` before collecting observations, then writes one
`NZILA_G2_DISCOVERY_RESULT=` compact JSON line. It does not duplicate the record
on stdout. UTF-8 byte budget is 8192; an oversized record becomes an explicit
bounded incomplete result, never truncated JSON or a success-shaped fallback.
Short writes raise an explicit error without a retry. The Python-unavailable
shell fallback emits the same literals directly to serial, without tee.

Tests prove ordering, exact marker count, one result write, no stdout record,
deterministic serialization, size bounds, sensitive-output rejection and
explicit write failures. Other boot writers remain outside script control;
actual future retrieved serial markers must still be verified.

## Identity assertion defect

`IMDS_IDENTITY_ASSERTION_DEFECT = SCRIPT_LOGIC`.

The old info-endpoint assertion expected client/principal/UAMI-map fields that
the saved runtime response did not contain: it returned `tenantId` only.
The token endpoint explicitly selected the builder client ID and succeeded.
[Microsoft's IMDS token contract](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-use-vm-token)
defines `client_id` as the intended identity selector; token response metadata
must not be confused with an ARM identity attachment map.

Read-only VM/UAMI correlation confirms:

- VM identity type: `UserAssigned`.
- Exact builder UAMI is attached.
- Builder client ID: `d4775ade-6d53-419a-a80f-c17ffbaa125f`.
- Builder principal ID: `c59571aa-66ea-47c5-83d5-59946b318ae2`.

The unchanged compiled builder wiring substitutes the builder UAMI clientId
into discovery. The new code records that requested selector safely and does
not require the info endpoint to enumerate identities.

Proofs are independent: live VM attachment, successful targeted IMDS request,
and identity correlation. A pure reconciliation helper checks exact resource
ID/client/principal metadata and targeted resource/client/status; it keeps
optional exchange BLOCKED separate. Guest output labels external attachment
and correlation BLOCKED pending control-plane reconciliation rather than
pretending to have queried ARM. Required attachment plus literal serial
verification are required for the reconciled result. No token claims need to
be decoded or persisted. The historical conditioned-role boundary remains
unchanged; successful ACR exchange is accepted prior evidence, not a new request.

## APT defect and repair

The prior parser classified deb822 comment lines without colons as errors and
did not validate malformed stanzas robustly. New parsing handles comments,
stanza separation, continuations, Types/URIs/Suites/Components, optional
Architectures, multiline Signed-By, multiple endpoints/suites and Enabled.
Signed-By/key material is never interpreted as an endpoint or output.
Legacy list observation remains supported.

Valid sibling records survive malformed records. Disabled malformed records
do not invalidate active endpoints; malformed active records keep observation
incomplete because their endpoint denominator cannot be established.
URI scheme/host/port and credential/query redaction are normalized; raw files
are never dumped and no repository contact/package mutation occurs.

**Evidence limit:** prior serial evidence contains normalized entries and 35
unparsed-line errors, not raw guest source-file lines. Exact Ubuntu guest-file
bytes cannot be inspected through the authorized read-only channels. The
fixture is explicitly modeled on Ubuntu 24.04 syntax and observed endpoints,
not represented as a raw runtime capture. Comment handling is a demonstrated
source defect, but all 35 historical errors cannot be individually attributed.
Fresh first-boot runtime observation is still necessary.

## Validation

- Python compilation: PASS.
- Discovery/serial/identity/deb822 tests: 22 PASS, zero skipped.
- Bicep build/lint: PASS; new payload compiled to a separate candidate.
- DNS/NSG contracts: PASS on deployed and repaired candidates.
- VM/firewall/preservation contracts: PASS; ten negative mutations rejected.
- Negative contracts: PASS; five negative mutations rejected.
- Static compiled comparison: only embedded discovery/cloud-init values and
  generator hashes differ; resource definitions, networking, roles and sizing
  are identical.
- `git diff --check`: PASS.

The initial VM/firewall check used the Network-RP investigation baseline,
which lacks the corrective test's expected VNet shape. It failed explicitly.
Re-running with the original corrective baseline passed without source changes.

## Execution adjudication

[Azure Custom Data documentation](https://learn.microsoft.com/en-us/azure/virtual-machines/custom-data)
states that Custom Data is processed at first provisioning and cannot be
updated in the model of an existing single VM. This VM has no approved
post-boot payload-execution channel. Reading Boot Diagnostics does not execute
new source. SSH/Run Command/extensions/disk or Custom Data edits are prohibited.
A restart would neither install corrected source nor create authorized proof.

Therefore `NEW_VM_EXECUTION_REQUIRED`. No new execution was performed.
See the [proposed authority packet](./G2_STAGE1_RUNTIME_REEXECUTION_PROPOSAL.md).
