# CIVIC Runtime Slice 2 - Bounded Synthetic Technical-Hardening Proof

**Date:** 2026-10-12

**Technical disposition:** `CIVIC_RUNTIME_SLICE_2_PASS_WITH_LIMITATIONS`

**Human proof-owner acceptance:** `CIVIC_RUNTIME_SLICE_2_ACCEPTED_WITH_LIMITATIONS`

**Proof owner:** Aubert Nungisa

**Human decision date:** 2026-10-12

**Authorization terminated:** YES

**Terminated at:** `2026-10-12T20:28:37.5704126+00:00`

This document records executed technical evidence, not production certification,
legal evidence, real institutional validation, pilot approval or human/operator
validation. Human acceptance above was explicitly supplied by the proof owner
after technical closeout; it is not inferred from the technical disposition.

## Human acceptance and phase transition

Aubert Nungisa accepts the bounded synthetic authority-ordering, final-commit
authority, TOCTOU, revoked-retry, historical-decision, integrity-anchor,
tamper-detection, crash/recovery, replay, institution-isolation, termination and
retention evidence, plus the local synthetic performance envelope.

Accepted limitations remain unresolved: the 100-measurements-per-cell target
(only ten measured per cell); same-host anchor custody without host-administrator
protection; no production persistence, key management, identity integration or
backup/disaster-recovery certification; no live connectors, real authority
instruments, real institutional data, real-user validation or deployment.

This acceptance is not production readiness, pilot authorization, real
institutional/user validation, security accreditation, legal evidentiary
certification, deployment approval or customer/government-data authorization.

`CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE`

`READY_TO_CONSIDER_CONTROLLED_HUMAN_OPERATOR_VALIDATION`

Next phase: `CONTROLLED_HUMAN_OPERATOR_VALIDATION_PREPARATION`, documentation
only. No Slice 3 is proposed. Further synthetic technical work requires a
material defect discovered through future validation and separate authorization.
All runtime remains terminated, general authorization false, retained evidence
unchanged and custody with Aubert Nungisa. No cleanup is authorized.

## Authorization and activation

The [human authorization packet](CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET.md)
records explicit conditional approval and the immediate activation amendment.
Actual host capture `2026-10-12T14:38:49.5329498+00:00` is the authoritative
effective time; expiry is exactly `2026-10-19T14:38:49.5329498+00:00`.
The earlier future start was superseded, not used as an active gate.

`CIVIC_SLICE_2_ACTIVATION_PASS` preceded material implementation. The approved
storage/checkpoint/adversarial-copy/independent-anchor locations were clean;
existing ancestors were checked for reparse points. Exact local Git exclusions
protect both generated subtrees. General runtime authorization remains false;
accepted Slice 0 and Slice 1 remain terminated and fingerprinted.
No signing keys, shared-platform changes, deployment, merge, real data, Slice 3
or controlled human validation is authorized.

## Corrected authoritative transaction boundary

The verified transaction order is:

1. Preliminary work and bounded test barrier before acquiring the writer lock.
2. `BEGIN IMMEDIATE`; reconstruct the latest locked institutional predecessor.
3. Bounded preappend/precommit hooks and work.
4. Actual uncached runtime governance validation.
5. Fresh trusted proof clock and final live delegated-authority validation.
6. Persist that exact final snapshot and evaluated-at value through synchronous
   deterministic hashing/journal append.
7. COMMIT; only afterward report committed boundary instrumentation.

No successful-path callback, await or external work follows final institutional
validation before commit. Crash-only append injection cannot proceed to a successful
commit. The recorded timestamp is now the actual final institutional check, not
the earlier prepared timestamp. Current authority is checked before receipt
replay; old keys/timestamps cannot resurrect revoked authority.

The first run exposed a durable final timestamp gap and a governance storage-scan
race on disappearing SQLite journals. Both were corrected before the fresh
correctness proof. Storage traversal tolerates only an enumerated regular SQLite
sidecar disappearing with ENOENT; missing primary files, access errors and
junctions/symlinks remain errors. Source scans and archival hashes are unchanged.

## Executed correctness evidence

The corrected runs verified 15 distinct correctness tests (focused/full selections
overlap), including 100 successful two-process schedules:

| Schedule                                                              | Successful repetitions |
| --------------------------------------------------------------------- | ---------------------: |
| Revocation wins                                                       |                     20 |
| Decision wins, followed by committed-operation retry under revocation |                     20 |
| Authority expires during work                                         |                     20 |
| Rolled-back attempt retried after revocation                          |                     20 |
| Contested simultaneous start                                          |                     20 |

Ordering uses bounded process barriers and real SQLite transactions, not arbitrary
sleep as the authority oracle. Committed prior decisions retain historical validity
after later revocation. Denied/rolled-back attempts leave no consequential receipt.

Six process-exit windows covered before lock, inside the transaction, before
append, after append, precommit and after commit. Fresh recovery excludes
uncommitted effects and preserves committed state/idempotency. The committed
but unpublished-anchor suffix reports `UNANCHORED_PENDING_REVIEW`; no trusted
anchor is silently regenerated.

Twelve adversarial integrity cases include primary-store alteration, checkpoint
alteration, inconsistent/coherent combined rewriting, coherent truncation,
reordering, nested event/authority/decision mutation and stale anchor replay.
Coherent rewriting is checked against separately held custody-bound anchor input,
not just internal journal consistency. Coherent truncated history may replay
internally but fails the trusted minimum position. Synthetic institution isolation,
replay and immutable decision/history relationships were checked.

## Declared integrity trust model

Claim: `INDEPENDENT_INTEGRITY_ANCHOR_PROOF` and
`TAMPER_EVIDENT_WITHIN_DECLARED_TRUST_MODEL`.

The verifier compares canonical receipt content against separately held expected
digest/minimum position in the exact approved independent-anchor location.
Adversarial tests alter approved copied stores/checkpoints, not this trusted input.
Human custody and verifier code, fixture genesis, proof clock/OS and SQLite
transaction semantics remain assumptions.

Same-host path/custody separation is not host-administrator resistance. Coordinated
compromise of all anchors, verifier inputs/code, OS and custody remains outside the
model. No signing keys, legal certification or cryptographic non-repudiation claim.

## Performance follow-up

The initial corrected performance report contained 42 measured samples and
42 warmups with no errors. This did not satisfy ten warmups per metric/state-size;
it is not a complete envelope.

A performance-only follow-up completed for authorization, read, write,
decision commit, replay/reconstruction, restart/recovery and integrity verification
at 16/64/256 events across two fictional institutions. Raw samples record actual
before/after positions, phase/check counts, failures/timeouts and environment.
No authorization cache or production extrapolation is permitted. The target of
100 successful measured samples per cell remains conditional on feasibility and
must not be claimed without the counts.

The extended run exposed a proof-worker artifact identifier collision when Windows
reused an exited process ID. Immutable checkpoint output correctly refused overwrite
with EEXIST; this was not ignored or repaired by replacing retained evidence.
The worker now includes invocation time and monotonic nanoseconds in its output
identifier. Only the exact owned measurement process trees were stopped before the
correction, and failed/partial samples remain retained.

Final sampling obtained ten warmups and ten successful measured samples per
metric/state-size/institution (42 cells). The requested target of 100 measured
samples per cell remains explicitly unfulfilled: uncached admission costs multiple
seconds per call and the full target consumes many additional shared-host hours.
This is a performance-characterization limitation, not a claimed target achievement
or permission to reduce the already executed 100 correctness race schedules.

All 42 cells verified exact sizes, ten successful warmups and ten successful
measurements, zero failures, recomputed median and nearest-rank p95: 420 warmups
and 420 measurements total. Write/decision attempts begin at the exact requested
size and commit one additional event; private working-copy reset/setup is excluded
from metric latency and reported separately. No failed/partial prior run is counted
as a successful final cell.

| Metric                         | Cell median range (ms) | Cell p95 range (ms) |
| ------------------------------ | ---------------------: | ------------------: |
| Actual authorization           |        3958.57-4701.30 |     4464.17-5331.11 |
| Guarded read                   |        4348.42-6788.00 |    5950.46-10440.71 |
| Write                          |       7532.96-12276.95 |    9320.77-20902.05 |
| Human decision commit          |        5780.43-7888.69 |    8132.56-16324.18 |
| Guarded replay/reconstruction  |        3367.19-5455.52 |     3694.82-8597.68 |
| Fresh-process restart/recovery |       9929.75-17592.67 |   12623.04-24288.81 |
| Integrity verification         |       8895.94-12558.05 |    9672.39-19215.50 |

Ranges summarize separate size/institution cells, not pooled p95. Exact 42-cell
values, raw file references and environment are in the ignored local
`final-performance-summary.json`. Environment: Windows 10.0.26200, Node 24.13.1,
SQLite 3.51.2, Intel i7-12700H, 20 logical CPUs, 34,071,896,064 memory bytes.
Up to three independent metric groups shared the host; OS page cache is uncontrolled,
disk type unmeasured. Pure replay alone is not separately timed. No production
capacity, performance improvement or production identity/persistence claim.

## Final validation

| Executed check                                                     | Result                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| Corrected focused boundary/lifecycle/crash selection               | PASS, 7 selected tests, with overlap in full suite     |
| Corrected full hardening suite                                     | PASS, 10 tests; 100 required schedules                 |
| Slice 2 targeted TypeScript, lint and formatting checks            | PASS after final source changes and termination        |
| Full doctrine suite including termination/archive regressions      | PASS, 194 tests                                        |
| Actual-context archival validator and targeted validator typecheck | PASS after termination                                 |
| Slice 0, Slice 1 and Slice 2 exported runtime guards               | Expected authorization-terminated denial for all three |
| Governance lint                                                    | Zero errors; two existing fixture-helper warnings      |

Final performance selections passed seven tests across three independent runs:
authorization/read/replay, restart/integrity and write/decision. Runtime types,
scoped lint and formatting passed after the unique worker identifier correction.
Final source fingerprints are installed; closure and retained manifest checks
are recorded in the closeout checkpoint.

Exact final validation commands:

- `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts`: PASS, 194 tests, including authorization-negative and archive-integrity tests.
- `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`: PASS, actual closed archival context.
- `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --types node --target ES2022 --module NodeNext --moduleResolution NodeNext scripts\lib\civic-oci-doctrine.ts`: PASS.
- `pnpm exec tsc --noEmit -p apps\civic\slice2.tsconfig.json`: PASS.
- `pnpm exec eslint --config apps\console\eslint.config.mjs apps\civic\src\slice2 apps\civic\tests\slice2 apps\civic\slice2.vitest.config.ts`: PASS, zero errors; informational missing Next pages-directory notice only.
- Governance/test lint through the existing Sage-core ESLint configuration adapted in memory: zero errors, two pre-existing fixture-helper `no-explicit-any` warnings.
- Scoped documentation consistency through the existing read-only `runDocConsistency` helper, relative-link existence checks, scoped Prettier checks and `git diff --check`: PASS.

Documentation consistency found zero scoped errors/warnings and five informational
platform-name suggestions inside the explicitly approved Windows storage paths;
those exact authorized paths were deliberately not renamed. All nine scoped
relative documentation links resolve.

Broad unrelated implementation suites were not run. No proof-runtime execution was
performed after termination; governance fixture tests and expected-denial guards
do not reopen runtime authorization.

## Repository and custody

HEAD remains `1c337567635bb86ea0df7831557d8d2d22df1e6f`, branch
`civic/three-reality-hardening`, isolated CIVIC worktree. Required-surface collision
checks found no other-worktree changes. Generated proof/anchor artifacts remain
untracked. Aubert Nungisa is proof owner and anchor custodian.

Minimum-retention cleanup of specifically identified superseded agent-created
artifacts was recorded, with losslessly archived machine evidence and retained
standalone representative stores/anchors. The final performance archive preserves
531 supplementary files byte-exactly (479,820,241 original bytes compressed to
43,280,030 bytes). Every archived entry was restored and compared before only those
exact originals were removed. The seven successful final aggregate raw reports
remain standalone; failed/partial prior evidence remains archived, not discarded.

Final retained inventory: **205 files, 61,563,345 bytes** across the two approved
locations. Canonical proof storage contains 163 files, 61,546,951 bytes including
the final manifest; the independent anchor location separately retains 42 files,
16,394 bytes. No unresolved SQLite journals, WAL/SHM sidecars or lock files remain.
`final-retained-manifest.json` lists and hashes 204 payload files (61,518,537 bytes);
its own 44,808 bytes are explicitly excluded from its payload inventory.
`final-performance-retention-plan.json` and
`final-performance-retention-cleanup.json` preserve exact archive/cleanup custody
evidence; `final-performance-support-evidence.jsonl.gz` is the verified archive.

`final-source-inventory.json` records all 11 final archived source/config/test
fingerprints. Its normalized inventory aggregate is
`486f56431033db5d5bdfdb03905d0ff7ad736834bce33d3adfe25c56f492901f`.
The governed archival validator independently verifies all three slices' retained
source fingerprints. No unknown data or accepted Slice 1 evidence was deleted or
changed.

All retained files are `LOCAL_SYNTHETIC_PROOF_ARTIFACT`, not production backups,
institutional records, legal evidence or customer data. Human acceptance is now
explicitly recorded above. Further cleanup or retention requires a separate
explicit instruction; no post-acceptance disposition is inferred.

## Execution closure and synthetic-hardening exit

All proof measurement processes exited before closure. The contract records exact
revocation/termination time, and the guarded source records the same literal time.
Runtime admission denies after closure even if the proof marker is removed.
Static review requires terminated proof/grant consistency and exact fingerprints
for all retained Slice 0/1/2 source/config/tests; source scanning continues.
No grant automatically renews or reopens from a document edit.

The executed evidence identifies no remaining major correctness defect within
the declared synthetic trust model. The sample target deficit, same-host custody
assumptions, experimental local SQLite, unmeasured disk/cold-cache behavior,
production identity/key management/backup/disaster recovery and real institutional/
human validity remain limitations, not silently closed gaps.

Recommendation: `READY_TO_CONSIDER_CONTROLLED_HUMAN_OPERATOR_VALIDATION`.
This means consider a separately authorized protocol for comprehensibility,
workflow burden, configuration, support expectations and decision usefulness.
No outreach, participants, human validation, pilot, deployment or real data is
authorized. Do not propose another synthetic slice merely for incremental refinement.

Synthetic technical slicing is closed; do not propose Slice 3.
