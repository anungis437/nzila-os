# Private ORAS delivery: partial

Mission: `NZ-20261008-INFRA-001`

Slice: `G2_STAGE2A_PRIVATE_IMPORT_WITH_BUILDER_VERIFIER`

## Disposition

`STAGE2A_PRIVATE_ORAS_DELIVERY_PARTIAL`

`SOURCE_TARGET_ARTIFACT_EQUIVALENCE = UNRESOLVED`

`TARGET_ARCHIVE_SHA256 = UNPROVEN`

`OVERALL_G2 = FAIL`

The source archive is hash-proven and exactly one server-side import succeeded.
Private target archive retrieval failed. Operation success is not content proof.
No ORAS extraction/execution, package install/update, synthetic-health push,
Stage 2B, or Stage 3 occurred.

## Concurrency and boundaries

Branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`, subscription
`5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
`5082b8be-b04d-4a13-b61c-b6397670177b`, Canada Central.
The observed untracked worktree roots remain `.azure/` and
`infrastructure/landing-zone/g2-builder/`. No tracked foreign work was
dispositioned. No UE/Cora product source was changed. Neither product's
infrastructure NO_GO is softened.

## Execution chronology

1. Exact persistent builder Repository Reader to `g2-tooling` established.
   [Reader authority](G2_PRIVATE_IMPORT_READER_AUTHORITY.json) and
   [readback](G2_PRIVATE_IMPORT_READER_READBACK.json).
2. Private pre-import observer proved authenticated absence, then retired.
   [Result](G2_PRIVATE_IMPORT_PRE_VERIFIER_RESULT.json).
3. Existing build OIDC staged one generic OCI artifact in source `nzilacanadaacr`.
   [Run 38148994904](https://github.com/anungis437/nzila-os/actions/runs/38148994904)
   and [source authority](G2_PRIVATE_IMPORT_SOURCE_ARTIFACT_AUTHORITY.json).
   Approved archive SHA:
   `f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
   Source manifest:
   `sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f`.
4. Temporary source/target importer roles and target AzureServices opened
   exactly once. Import-only
   [run 38149872921](https://github.com/anungis437/nzila-os/actions/runs/38149872921)
   succeeded using source resource ID and immutable digest.
   [Recovered import result](G2_PRIVATE_IMPORT_IMPORT_RESULT.json).
5. The local result parser incorrectly counted an echoed command alongside
   the actual result marker. Its assertion entered teardown before the
   post observer. This is an ordering deviation, not a second import or
   a provider import failure. Preserve the original
   [execution failure](G2_PRIVATE_IMPORT_TRANSACTION_EXECUTION_FAILURE.json).
   [Teardown](G2_PRIVATE_IMPORT_IMPORT_TEARDOWN.json) passed after
   289.894698 seconds; no broader exception was reopened.
6. Original post observer failed with opaque `ValueError`.
   [Result](G2_PRIVATE_IMPORT_POST_VERIFIER_RESULT.json).
7. Private endpoint correlation proved registry `.5` and data endpoint `.4`.
   The host-specific pin correction was necessary but not sufficient.
   Corrected post observer also failed with opaque `ValueError`.
   [Correlation](G2_PRIVATE_IMPORT_POST_IP_MAPPING_DIAGNOSIS.json) and
   [corrected result](G2_PRIVATE_IMPORT_CORRECTED_POST_RESULT.json).
8. One diagnostic-only observer, still pull-only under restored private
   controls, reached archive retrieval and returned `blob-http-failure`.
   [Authority](G2_PRIVATE_IMPORT_DIAGNOSTIC_POST_AUTHORITY.json),
   [result](G2_PRIVATE_IMPORT_DIAGNOSTIC_POST_RESULT.json), and
   [retirement](G2_PRIVATE_IMPORT_DIAGNOSTIC_POST_RETIREMENT.json).
   No arbitrary exception text, response body, signed URL, or credential is
   exposed. The exact HTTP status and failing host were not captured;
   do not invent either or assert a diagnosed root cause.

## Final authorization and network contracts

| Principal | Repository / scope | Steady disposition |
|---|---|---|
| Builder UAMI | synthetic-health | Existing Writer unchanged |
| Builder UAMI | g2-tooling | Exact Reader present; Writer absent |
| Runtime UAMI | synthetic-health | Existing Reader unchanged |
| Runtime UAMI | g2-tooling | No assignment |
| Existing build OIDC | Source ACR | Pre-existing AcrPush unchanged |
| Existing build OIDC | Source/target import roles | Both transaction-created roles absent |

Target public access remains Disabled, bypass None, private endpoint/DNS
unchanged, admin credentials disabled. Existing source registry settings were
not changed or silently hardened. Protected infrastructure remains sixteen;
the only lasting authorization delta is the builder tooling Reader (+1).
No verifier extension remains attached.

Source and imported target artifacts are not deleted. The target artifact's
content remains unproven; retained-state wording is not a successful private
data-plane readback claim. Isolated staging/import GitHub branches are retained.

## Cleanup and integrity

Each post observer terminated and its exact CSE was removed.
Archive workspace cleanup is context-managed, including non-200/blob-error
paths. The observed package/configuration digest remained unchanged:
`14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
This does not claim Azure extension handler logs/cache are erased.

Historical executed source/test snapshots preserve the failed bytes.
Original and corrected authorities are verified against their matching
snapshots, not falsely against today's diagnostic source.
Generated source-folder JSON templates are archived byte-for-byte in new
evidence snapshots before their named cleanup. Historical roots and frozen
Stage 1/inventory source are verified separately.

## Validation

- Twenty private-import unit tests: PASS.
- Diagnostic verifier Bicep build and lint: PASS.
- Fresh provider validation: PASS.
- Raw FullResourcePayloads: exactly one intended extension Create;
  zero Modify, Delete, Unsupported, or unrelated changes.
- Final role/network/protected-state and source/evidence integrity results:
  [final verification](G2_PRIVATE_IMPORT_FINAL_VERIFICATION.json).
- `git diff --check`: PASS. Untracked files are covered by focused tests/builds
  and content-addressed source manifests, not by that tracked-diff command.
- No PR review requested; monorepo-wide PR eligibility checks were not run.

## Outstanding proof

Private archive readback must prove the approved SHA and source/target
equivalence before claiming `STAGE2A_PRIVATE_ORAS_DELIVERY_PROVEN`.
The observed archive non-200 failure is the remaining blocker. Any later
observer needs newly bound source/parameters/provider/exact-Create gates and
terminal retirement. Do not repeat staging/import, reopen broader exceptions,
execute ORAS, or advance stages under this partial disposition.
