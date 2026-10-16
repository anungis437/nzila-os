# G3A content-addressed first-byte closure

## Live result

**G3A_CONTENT_ADDRESSED_FIRST_BYTE = PROVEN**. The same corrected authority
was consumed once; no additional authority or retry was created.
The frozen executable was not rebuilt or changed. Custom Script selector
2.1 resolved to 2.1.19, executed `G3A_BOOTSTRAP_REQUESTED_V1`, and reported
the exact runtime self-hash:
`5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8`.

The SHA-addressed object was absent before one conditional PUT, read back
byte-for-byte with the same ETag, then consumed with producer write
authority revoked and public Storage access disabled. Versioning is
disabled; no query string, version ID, SAS, or Storage key was used.
No diagnostic action was needed.

## Cleanup and accounting

Proof RG and subscription deployment metadata were removed. Exact ARM
UAMI/Storage and Graph service-principal absence was reconfirmed.
Resource and role censuses are empty; G2 resources, roles, and terminal
root remain unchanged. **FIRST_BYTE_PROOF_RESIDUAL_STATE = ZERO**.

| Counter | Value |
|---|---:|
| Azure mutating dispatches | 9 |
| Successful mutating dispatches | 9 |
| Rejected mutating dispatches | 0 |
| Delete dispatches | 4 |
| Role assignment creates/deletes | 2 / 2 |
| UAMI creates/deletes | 1 / 1 |
| Run Command diagnostic actions | 0 |
| Registry mutations | 0 |

These are direct caller dispatches, not total ARM leaf/cascade RPC counts.
UAMI lifecycle involved nonzero directory-mediated activity; exact
internal Graph write count is not observed.

## Cost

- Expected proof: CAD 1.5363953.
- Proof ceiling: CAD 3.00.
- Conservative actual proof estimate: CAD 1.3550364.
- Earlier separate proof estimates remain CAD 1.3567668 and 1.3567119.
- Full bounded G3A expected scenario: CAD 4.8973042.
- Local G3A ceiling: CAD 7.35, at least 50% contingency.

Current exact CAD retail meters were refreshed and matched. The full
scenario includes bootstrap Storage/PE/DNS, input Premium ACR/PE/DNS,
builder/disk, incremental final ACR storage, IO and conservative traffic.
It excludes already-paid G2 base capacity and G3B, and assumes no
additional paid telemetry. Proof estimates are not invoices. The G3A
scenario is not a new execution authority or an enlargement of the
separate CAD 3 proof ceiling; actual payload and lifetime caps must be
bound and enforced before any future execution.

## Conditional local closure

- G3A_CONTROLLER = INCOMPLETE
- G3A_BICEP_PACKAGE = INCOMPLETE
- G3A_TRANSACTION_READINESS = BLOCKED

- No qualified hash-bound production guest executable/runtime capsule delivers the frozen Python stdlib registry primitives and TLS trust. Python, curl, or guest dependencies are not inferred from the image.
- No qualified isolated-root build runner exists. Frozen portable core rejects visible host paths including /etc/ssl/certs/ca-certificates.crt; PATH-only isolation is insufficient.
- Frozen first-byte ELF is marker-only, explicitly rejected as the runtime pipeline; no final production bootstrap URI or protected CSE execution command can be emitted.
- Live baseline, producer private staging/revocation, role and endpoint-approval ownership, provisioning, VM/CSE sequencing, exclusive writer authority, final reconciliation and evidence-seal adapters remain incomplete. The 18-phase controller is fixture-only.
- Top-level Bicep is a conditional foundation, not a complete executable VM/CSE lifecycle. Separate builder and target-role modules are not invoked by the foundation.
- Production runtime payload hashes and exact archive/capsule byte census are unresolved; enforcement against the parent model quantity/lifetime bounds is required before any future mutation.
- Current proof authority is consumed. No additional independent runtime qualification, G3A, G3B or technical execution is authorized.

See the [local closure disposition](../g3a-ca-closure/CLOSURE_DISPOSITION.json)
for exact local command results and remaining implementation boundaries.
First-byte proof establishes transport and execution of the frozen probe,
not runtime input retrieval/build/upload qualification.

## Concurrency and boundaries

Active isolated worktree remains at
`7bec20aad11d43eeae8099c14e021b3074154b27`; observed foreign main remains at
`1c337567635bb86ea0df7831557d8d2d22df1e6f` with 505 status entries.
No foreign changes were edited, staged, reverted or dispositioned.
Prior failed proofs and qualified packets remain hash-protected.

G3_EXECUTION_READINESS remains BLOCKED. G3A, G3B and technical execution
authorizations remain NO. UE and Cora remain INFRA_NO_GO.
No input ACR, runtime image, registry uploader, ABAC probe, ACA or G3B was
executed. Local-only closure added no Azure mutation.
The next gate is **G3_CONTROL_PLANE_BOOTSTRAP**.

## Evidence

- [Full requested output](FINAL_DISPOSITION.json)
- [Live proof result](LIVE_PROOF_RESULT.json)
- [Version-free runtime result](CONTENT_FIRST_BYTE_RESULT.json)
- [Write-once evidence](WRITE_ONCE_RESULT.json)
- [Cleanup reconciliation](CLEANUP_RECONCILIATION.json)
- [Exact mutation accounting](MUTATION_ACCOUNTING.json)
- [Actual estimate](ACTUAL_COST_ESTIMATE.json)
- [Full bounded G3A cost model](FULL_G3A_COST_MODEL.json)
- [Seal](CONTENT_PROOF_VERIFICATION.json)
- [Independent verification](CONTENT_INDEPENDENT_VERIFICATION.json)
