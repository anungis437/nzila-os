# Final hard-bounded static runner candidate

This append-only lane implements section 23 after the parent confirmed offline
prerequisites. It does not invoke the frozen assembler, issue future production
authority, access Azure or the registry, or qualify a pinned guest.

## Proof invocation

Read the exact digest in `PREPARATION.json` / `proof_contract.json`, then invoke:

```text
./production-runner --hard-bound-static-proof <exact-proof-contract-sha256>
```

No additional options, stdin configuration, environment overrides, alternate
capacity, paths, payloads or commands are accepted. The separate internal child
route requires this same fixed identity, a bounded inherited pipe, the exact
controller-generated plan and namespace isolation.

The working directory must be canonical, root-owned and private (0700). Before
invocation the controller prepares these exclusive transaction-owned paths:

```text
.g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs
.g3a-transaction-HARD_BOUND_STATIC_PROOF/receipts
```

`inputs` is the unchanged fifteen-input census, already kernel-readonly and
readable/searchable by uid 65532. **Do not include historical `binding.json`.**
The controller must guarantee immutability through privileged aliases; a
readonly bind alone does not prevent privileged host mutation. `receipts` and
its transaction parent are canonical, controller-owned and private. No receipt
is created or consumed by this proof.

The candidate invokes the actual unchanged `stageProductionMounts` constructor
and `dispatchConstructedCore` / `childDispatchBoundary`, with a separately
source-bound harmless static witness instead of `executeFrozenCore`. The
production pin stays empty and public `--production` denies before reading.

The qualified runtime and isolation primitives remain unchanged. The proof
adds exact effective build/tmp verification, actual wrong-capacity/dirty-build
denials, null-only checks, readonly inputs, positive build/tmp execution and
work/output EACCES, no-network/privilege-regain negatives, and actual cleanup.
The only executable dispatched by the static callback is the embedded
`static-witness`, built from `static_witness.go` and emitting a fixed marker.
It is executed twice (build and tmp); no frozen input executable is invoked.

## Evidence

`G3A_FINAL_STATIC_PROOF_V1 ` is the compact result marker, never exceeding the
existing 3,800-character line bound. Complete private evidence is exclusively
created beneath `.g3a-isolation-proof-hard-bound-static`, with `baseline.json`
and `proof.json`. The latter contains complete runtime self-test evidence,
effective filesystem observations, every isolation check, the static dispatch
negatives, executable mount results and cleanup diagnostics.

`proof_evidence_reader.py` has a fixed pinned-parent path:
`/var/lib/waagent/custom-script/download/0/.g3a-isolation-proof-hard-bound-static`.
It verifies file safety and exact candidate/contract identities, then emits one
`G3A_FINAL_EXACT_EVIDENCE_V1 ` line containing **all exact bytes** of
`baselineJson`, `proofJson`, and `runtimeJson`, with bounded zlib/base64 decoding.
Its separately bound preset dictionary is compression input, **not guest
evidence**. Decode using `evidence_transport.decode`; independently validate
candidate, contract and baseline/runtime/proof hashes. Any complete live
evidence exceeding the safe bound fails closed; no truncation or field omission
is permitted. The static local variability fixture does not guarantee every
possible future pinned-guest diagnostic fits.

The parent must retain and transport evidence before removing all live-owned
input, evidence, VM/resource and staging state. This task's local ephemeral
container/namespace teardown is not proof of future Azure residual state.

## Reverification

Exact commands, environment-sensitive container flags and full stdout/stderr
are in `CANDIDATE_VALIDATION_ATTEMPT_1.json`; the explicit build source census is
in `SOURCE_BINDING.json`. Keep caches and unit-test binaries inside a newly
owned local check lane, never historical artifacts or host temporary paths.

The portable dispatch command is:

```text
go test -v dispatch.go frozen_bindings.go dispatch_test.go transaction_roots_test.go
```

Production primitive verification:

```text
go run verify_primitives.go -- <qualified-proof> proof_linux.go <qualified-launcher> launcher.go production_linux.go
```

Published static-proof primitive verification:

```text
go run verify_static_primitives.go -- <qualified-proof> proof_linux.go <qualified-launcher> launcher.go production_linux.go hardproof_child_linux.go hardproof_linux.go
```

Each verifies thirty rows, all original inline primitive statements in order
with their error branches, whole unchanged isolation helpers, and actual
namespace launcher wiring. Neither requires orchestration-wide equivalence.

Transport verification after sealing:

```text
python -B -m unittest -v test_evidence_transport.py
```

`build_validate_candidate.py` / `close_candidate.py` are construction-time
append-only drivers, not safe repeat-deployment commands. Do not rerun them into
this sealed lane. A future proof remains the parent's single unconsumed
authority; this lane does not grant another attempt.
