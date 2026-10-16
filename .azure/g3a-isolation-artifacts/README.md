# Separately bound isolation proof artifact

Local/offline only; no production execution, cloud calls, registry mutations,
or live qualification. Historical seal and capsule remain unchanged. This lane
is independent of the parent's live controller lane.

The historical launcher extraction and `--self-test <exclusive-root>` functions
are unchanged. Only main dispatch is extended. The exact historical payload is
embedded without alteration (141 census members plus `census.json`).

## Fixed kernel mechanism

The static Go outer spawns a disposable copy of itself with direct Linux
`clone(CLONE_NEWNS|CLONE_NEWNET)` via `SysProcAttr`. This creates both namespaces
**before** Go runtime threads exist. Calling thread-local `unshare` after Go
runtime startup would leave other runtime threads in host namespaces, so it is
deliberately not used. No fallback or user namespace is attempted.

The child checks separation from its actual parent's namespace identifiers
before any mount. Recursive-private propagation, a fresh tmpfs root, readonly
root/runtime mounts, dedicated noexec/nosuid/nodev work/output tmpfs, and
`chroot` plus immediate `chdir` establish the boundary. `/proc` and `/sys` are
absent (no host proc exposure, rather than a PID namespace). No host path
traversal or sensitive contents are read. Known-path stat negatives only.

The child records down/addressless loopback and zero usable IPv4/IPv6 routes
(all-zero `::/0` kernel null-route reject sentinels are separately counted), then
checks direct nonblocking TCP connect denial to loopback, private, and link-local
target classes. It does not rely on inability to reach a public endpoint.

No-new-privileges, ambient clearing and bounding drops use Go all-thread syscall
coordination. Supplementary groups and real/effective/saved GIDs/UIDs become
65532. Capabilities are cleared and verified; UID/GID/capability regain must
fail. The historical loader and Python entrypoint run only from `/runtime`,
with the original cleared environment and root argument `/runtime`.

Root staging additionally creates four SONAME hard-link aliases from the
already verified embedded native-library bytes (`libbz2`, `liblzma`, `libz`,
`libzstd`). This is proof-only root preparation, not a payload change: the frozen
archive stores real filenames, while ELF consumers request SONAMEs. Each alias
is derived from the embedded ELF metadata and independently hash verified;
the guest evidence records its source/alias/hash as `CAPSULE_EMBEDDED`. No host
library lookup or copy is permitted. The embedded census remains exactly 141.
An extra proof-only native import probe checks these dependencies before the
unchanged historical Python self-test. Explicit stdio pipes avoid `/dev/null`
dependency in the root (which deliberately contains neither `/dev` nor `/proc`).

## Compact guest marker contract

Each stdout line with exact prefix `G3A_ISOLATION_PROOF_V1 ` contains one JSON
object with schema `g3a-isolation-proof/v1`. Treat anything else as non-proof
output. Require exactly one proof marker, exact candidate SHA/bytes, mode
`--guest-isolation-proof`, outcome `PASS`, and every required check `PASS`.
Nonzero exit, absent/duplicate/malformed marker, unsupported primitive, missing
check, or failed evidence write is failure. Never promote offline unsupported
namespace dispatch into guest isolation qualification.

`baselineSha256` binds the exact UTF-8 bytes in `baseline.json` (full UID/GID,
saved identities, capability/NNP/seccomp fields, namespace IDs, relevant mount
flags/propagation, kernel, architecture and cwd). `evidenceSha256` binds exact
`proof.json` bytes containing full baseline, structured result, safe accessibility
summary, network observations, dropped identities, and full embedded-runtime
import census. `embeddedCensusSha256` binds the preserved embedded `census.json`;
`runtimeEvidenceSha256` binds the exact historical Python JSON output including
its terminal newline. `runtimeCensusCount` gives the corresponding entry count.

Evidence is persisted in one exclusively created `.g3a-isolation-proof-*`
directory beneath inherited cwd, mode 0700, files 0600. The marker's relative
`evidenceFile` is the safe reference for a bounded read-only diagnostic. Do not
arbitrarily traverse guest directories. Full baseline/runtime evidence is not
printed; compact markers are bounded under the CSE approximately 4KB limit.

`G3A_HANDOFF_V1 ` similarly contains schema `g3a-handoff/v1`, self SHA/bytes,
verified capsule SHA/bytes, requested mode, outcome, and propagated exit.
The shim accepts exactly one absolute or cwd-relative capsule filename. Pass
the immutable content-addressed filename downloaded by CSE, not a mutable alias.
It has no network/Azure/package-manager logic.

## Offline qualification boundary

The dropped-capabilities, network-none, readonly Docker fixture is expected to
fail namespace clone with structured baseline and `UNSUPPORTED`. That proves
dispatch and fail-closed behavior, **not** the pinned guest's kernel primitives.
Source unit tests and source contract checks do not prove privileged live
behavior. `ARTIFACT_BINDING.json` gives exact hashes, build provenance,
qualification results, preserved historical identities and limitations.

No candidate rebuild is authorized after the final proof binary build. Any
new defect discovery then must be reported without changing candidate sources
or bytes. The parent owns authority sealing and all live actions.

## Local parser invocation

Parent IsolationProof entry point: `result_parser.py`, `parse(message)`.
It returns identity digests, boolean `allPassed`, all ten named check statuses,
baseline/isolation/handoff outcomes, failure details, provenance, raw parsed
markers, and explicit evidence availability. A well-formed failure returns
`allPassed=False, structuredOutputAdequate=True, diagnosticRequired=False`.
Malformed, missing, duplicate, truncated, contradictory, or unbound markers raise
`ParseError` (a `ValueError`); the parent alone handles its one safe handler-log
diagnostic. No parser execution performs a diagnostic, file read, or cloud call.

The frozen binaries emit compact references, not full baseline/runtime contents.
The parser cannot recover those contents from hashes and never substitutes Docker
fixture evidence for a live guest baseline. To provide full bounded evidence,
pass `{"message": stdout, "baselineJson": exact_baseline_file_text,
"proofJson": exact_proof_file_text, "runtimeJson": exact_runtime_output_text}`.
The three evidence fields are optional; supplied values are SHA-256 verified
against the guest marker. Do not reserialize their JSON before hashing/passing it.
Full proof evidence includes the baseline and runtime details; runtime output
text retains its trailing newline. Without supplied evidence, explicit availability
flags are false and safe relative filenames plus hashes remain available.
Message bound: 16 KiB; each marker: 4 KiB; each full evidence input: 256 KiB.
Parent must also require actual extension success before marking PROVEN, even
when `allPassed=True`. A parser result alone is never a live certification.

Exact requested parent outcomes are returned both at top level and in `outcomes`.
`PINNED_GUEST_BASELINE_CAPTURE` maps to `baseline`; `GUEST_MOUNT_NAMESPACE` to
`mountNamespace`; `ISOLATED_ROOT_MECHANISM` and `GUEST_ROOT_ISOLATION` to
`rootIsolation`; `ISOLATED_ROOT_HOST_FS_NEGATIVE` to `hostFSNegative`;
`GUEST_NETWORK_ISOLATION_MECHANISM` and `ISOLATED_BUILD_NETWORK` to
`networkIsolation`; `ISOLATED_BUILD_NETWORK_NEGATIVE` to `networkNegative`;
`GUEST_NO_NEW_PRIVS` to `noNewPrivs`; `GUEST_PRIVILEGE_DROP` to `privilegeDrop`;
`GUEST_PRIVILEGE_REGAIN_NEGATIVE` to `privilegeRegainNegative`;
`PROOF_MODE_CAPSULE_SELF_CONTAINED` to `selfContained`;
`BOOTSTRAP_TO_CAPSULE_HANDOFF` to the verified handoff outcome.
Mechanism statuses are aliases of boundary probes, not new independent checks.
On successful probes, mount namespace is normalized to `SUPPORTED`, handoff to
`QUALIFIED`, root mechanism to
`clone(CLONE_NEWNS|CLONE_NEWNET)+private-bind-readonly+chroot(no-proc)`, and network
mechanism to `CLONE_NEWNET_DISCONNECTED_LOOPBACK_NO_USABLE_ROUTES`.
Raw `checks` and `handoffOutcome` remain unchanged; unsupported/failure statuses
are never promoted. Other successful requested fields remain `PASS`.
The `PINNED_` name is the parent's requested key, not a parser assertion of VM
identity; the parent independently binds guest identity and extension success.

**Evidence gate:** `checksAllPassed` reports matching successful markers/checks.
`allPassed` additionally requires full hash-verified proof with its baseline and
runtime evidence supplied to the parser. Compact-only success therefore returns
`allPassed=False`, `structuredOutputAdequate=False`, `diagnosticRequired=True`,
and `insufficientOutputReason=FULL_BASELINE_AND_RUNTIME_NOT_RETAINED`.
An adequate structured noCAP failure still needs no diagnostic.
`baselineCaptureState=GUEST_CAPTURED_HASH_BOUND_FILE` describes the guest-written
baseline artifact, whereas `controllerBaselineView=HASH_ONLY` explicitly means
the controller has not retained its contents. Safe references alone are not full
baseline evidence after guest cleanup. Persist permitted bounded evidence before
cleanup; never invent it or consume additional diagnostic attempts. The parser
does not itself request diagnostics, fetch evidence, or assume a handler log
contains full baseline/runtime files. If the parent's one authorized diagnostic
cannot supply the required evidence, retain BLOCKED rather than claim PROVEN.

Tests: `python -B -m unittest -v result_parser_test` reuses the recorded actual
no-capability and inherited-root Docker stdout from `BUILD_AND_OFFLINE_COMMANDS.json`.
Full-evidence fixtures are synthetic exact-byte envelopes over recorded semantics;
they are not represented as original guest evidence bytes.

The final single authoritative integration read is `PARENT_INTEGRATION_REPORT.json`,
SHA/size-bound by `ARTIFACT_BINDING.json`. It includes actual recorded root and
noCAP command/stdout/exit, exact baseline/proof/runtime evidence envelopes,
parsed requested outcomes, full baseline, full isolation/native-alias details,
all 128 imported runtime module/path entries, and the complete 141-file embedded
runtime/native file census including exact paths, sizes, modes and hashes.
Exact bytes were recovered by
matching frozen Go/Python serialization and verified against their originally
captured SHA-256 values; no marker/digest was substituted to make that test pass.
These additional actual-record recovery fixtures are distinct from the synthetic
tamper fixtures above. The report claims only offline Docker qualification, never
a pinned VM result. For live integration, supply the live guest's evidence, not
this report's offline envelopes. All ten parser test methods pass, including
actual recovered full root/noCAP evidence and normalized requested values.

Import `require_guest_pass` from `parse_guest_output.py` in the parent's local
controller. Call `require_guest_pass(cse_stdout, artifact_binding,
actual_exit_code)` with the parsed `ARTIFACT_BINDING.json` and raw marker-bearing
stdout. It returns `(proof, handoff)` only on complete PASS; all unsupported or
failed primitives and identity/evidence-reference mismatches raise `ValueError`.
Do not infer PASS from an offline fixture name or an exit code alone.
For a permitted bounded evidence read, verify SHA-256 of exact `proof.json`
bytes against `evidenceSha256`, and exact `baseline.json` bytes against
`baselineSha256`, before inspecting their contents.
