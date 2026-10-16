# G3A controller repair and single local/offline retry

Mission: `NZ-20261008-INFRA-001`.

The failed full rehearsal remains unchanged. The sole production-source change
moves the exclusive manifest write and exact digest gate outside the two-layer
descriptor loop. Compression, tar construction, config, application source,
compiler, build flags and serialization contracts are unchanged.

## Regression and bounded diff

The static AST regression failed against the prior buggy source before repair.
It passed after repair, checking two descriptors in application/certificate
order, no write inside the loop, one top-level exclusive manifest write,
immediate failure return, one exact manifest gate and index/layout after that
gate. The existing non-overwrite test also remains passing.

- Changed production source: `assembler/main.go`.
- Added test only: `assembler/manifest_regression_test.go`.
- Unrelated source changes: **0**.
- Unit tests: **6 passed**; vet, static build, formatting and bounded diff: PASS.
- [Exact source diff](./CONTROLLER_PATCH.diff)
- [Patch validation](./CONTROLLER_PATCH_REVIEW.json)
- [Expected prior regression failure](./REGRESSION_PRIOR_EXPECTED_FAIL.json)

## Single retry result

Exactly one fresh clean-room full retry completed with exit code 0.
Application binary, both tar streams, both gzip blobs, config, manifest and index
are byte-identical to the frozen outputs.

- Manifest:
  `sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7`
- Index:
  `sha256:a9b061637c76b7680ac5d1f682e0ab8abe507474ccc835eefcb5dee18a1f7a12`
- OCI layout version: `1.0.0`.
- Final OCI tree contains exactly six intended files: four content-addressed
  blobs, index and layout.
- `G3A_PORTABLE_PRIVATE_BUILDER = QUALIFIED`.
- `G3A_BUILD_CONTROLLER_CORE = QUALIFIED`.
- `G3A_PORTABLE_IMAGE_REPRODUCTION = PASS`.
- `G3_EXECUTION_READINESS = BLOCKED`.
- Retry authority consumed; no second retry.

## Input bytes and exact changes

All original payloads were copied unchanged, not regenerated. Only repaired
controller source/binary and their integrity binding changed:

| File | Prior bytes | New bytes | Delta |
|---|---:|---:|---:|
| `portable-assembler` | 3,477,628 | 3,473,532 | -4,096 |
| `controller-main.go` | 16,397 | 16,390 | -7 |
| `binding.json` | 3,489 | 3,489 | 0 |
| **Total staged input payload** | **265,084,641** | **265,080,538** | **-4,103** |

The binding changes only the hashes/sizes of those two repaired files. The new
test is local validation evidence, not an additional staged input. Reader source
is included in the existing payload; guest reader runtime, bootstrap channel,
transport and delivery overhead are not qualified by this byte total.

## Isolation, evidence and next boundary

The host Docker engine provided only the outer isolation boundary. Inside the
full transaction: no network, Docker/socket/buildx/BuildKit, host Go, host CA,
image cache, package manager or frozen-image archive. Executables are staged
controller/compiler/tools/compressor and a test ELF generated from staged source.

- [Required dispositions](./REPAIR_DISPOSITION.json)
- [Exact byte comparisons](./EXACT_OUTPUT_COMPARISON.json)
- [Six-file OCI completeness](./OCI_LAYOUT_COMPLETENESS.json)
- [Executable census](./EXECUTABLE_CENSUS.json)
- [Input census and deltas](./STAGED_INPUT_CENSUS.json)
- [Single retry command](./FULL_RETRY_ISSUED.json)
- [Preserved retry outputs](./clean-room/transaction/)
- [Evidence seal](./REPAIR_VERIFICATION.json)
- [Independent verification](./REPAIR_INDEPENDENT_VERIFICATION.json)

No uploader/auth probes, registry operations, cloud reads/mutations, guest
execution, Bicep/what-if work, global installation or PATH changes occurred.
No foreign product work was edited, staged, reverted or dispositioned.
Prior sealed packets, including the failed attempt and G2 terminal root, remain
protected. UE and Cora remain `INFRA_NO_GO`.

**STOP.** The next authority is
`G3A_REGISTRY_UPLOADER_AND_CONTROLLER_QUALIFICATION`, not issued here.
Full G3A controller, registry uploader, bootstrap/cleanup orchestration, Bicep,
grants and cost ceiling remain outside this qualification.

## Commands and results

- `python -B prepare.py`: PASS preservation/isolation; regression failed as
  expected against prior source.
- `python -B validate.py`: PASS six tests, vet, static build and exact diff.
- `python -B run_once.py`: PASS exactly one full repaired retry.
- `python -B seal.py`: evidence outcome in the linked seal.
- `python -B independent_verify.py <root>`: outcome in the independent result.
