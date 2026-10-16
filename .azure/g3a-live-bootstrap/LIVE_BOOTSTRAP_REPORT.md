# Single live private Blob bootstrap proof

## Outcome

**BLOCKED: control-plane handler-version contract rejected. Cleanup completed.**

ARM rejected the sole CSE deployment with `InvalidParameter` targeting
`typeHandlerVersion` (`2.1.10`). The subsequent extension instance-view read
returned ResourceNotFound. No installed handler, binary execution, V1/V2 runtime
marker, or runtime self-hash was observed. The controller's raw
`CSEExecutions: 1` counts a deployment dispatch, not a guest execution.

Evidence: [primary rejection](EVENT_036.json),
[extension absence](EVENT_038.json), [raw controller outcome](LIVE_PROOF_RESULT.json),
[failure classification](TERMINAL_FAILURE_CLASSIFICATION.json).

## Completed portions

- Exactly one authority consumption and one CSE deployment dispatch; no retry,
  repair, image build, registry operation, product deployment, or product data.
- V1 was uploaded, its historical version read back, and the same object
  overwritten with distinct V2. The current unversioned object was verified V2.
- Temporary producer access was removed and Storage public access disabled;
  empty network exceptions, private endpoint/DNS and container Reader were checked
  before the private VM was created.
- Storage lockdown PASS is not a successful VM private-Blob download proof.
- Dedicated RG `nzila-g3-firstbyte-6e4441c8ec-rg` was deleted after proof-owned
  resource inventory and positive ownership verification.
- Final RG/resource/role census is empty. Exact UAMI, Storage and Graph principal
  absence checks supplement that census. G2 resources, roles and terminal root
  are unchanged.

## Accounting and cost

[Exact mutation accounting](EXACT_MUTATION_ACCOUNTING.json) separates dispatches,
successful explicit ARM create targets, data-plane writes, service-generated
resources and cascade deletion. Ten direct mutating dispatches include nine
successes and one rejected CSE deployment; four are direct delete dispatches.
There were two role creates/two deletes and one UAMI create/delete via ARM.
Do not interpret this as zero Entra mutations or as an observed count of every
internal cascade/Graph API call.

[Cost estimate](ACTUAL_CONSERVATIVE_COST_ESTIMATE.json) retains conservative DNS,
disk-day, operation and traffic allowances while replacing VM/PE duration bounds
with measured dispatch-to-cascade-completion upper bounds. It is a retail-meter
estimate, not an Azure invoice or measured guest-I/O charge. Expected proof cost
was CAD 1.5363953; the hard ceiling remains CAD 3.00.

## Governance

[Full requested disposition](LIVE_BOOTSTRAP_DISPOSITION.json) is authoritative
for this packet. Version selection is NOT_RUN; first byte and G3 transaction
readiness remain BLOCKED. The earlier downloaded-binary execution proof remains
source-level only. Portable builder/uploader qualifications are preserved without
replay. No conditional local G3A package completion was permitted by this outcome.
G3A/G3B/technical execution authorization stays NO; UE/Cora remain INFRA_NO_GO.

The [minimal architecture amendment](ARCHITECTURE_AMENDMENT.md) addresses only
the observed handler deployment-contract failure. It is not another authority.

## Concurrency and persistence

All writes are confined to the isolated proof lane. Active HEAD remains
`7bec20aad11d43eeae8099c14e021b3074154b27`; shared foreign HEAD remains
`1c337567635bb86ea0df7831557d8d2d22df1e6f`. The final write baseline observed
505 foreign status entries; none were edited, staged, reverted or dispositioned.
No commit was requested or made.

The new lane contains probe source/binaries, preflight/validation/bindings,
proof-only IaC, immutable event receipts, cleanup evidence and closeout tools.
Historical packets and the historical root deployment plan are preserved.
Generated local Go cache directories are excluded from the packet seal.

Validation: initial five fixture classifier tests PASS; three Bicep templates
build/lint PASS; official transport provider validation and what-if PASS
(Create14/Modify0/Delete0); live command FAIL as recorded above; cleanup PASS.
The final packet's independent verifier validates hashes, exact accounting,
cost arithmetic, blocked governance and preserved qualified histories without
replaying any image build or uploader transaction.
