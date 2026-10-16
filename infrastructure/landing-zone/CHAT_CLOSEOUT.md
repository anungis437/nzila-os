# Infrastructure conversation closeout

Mission: `NZ-20261008-INFRA-001`. Recorded: 2026-10-16.

This is a **source and selected-evidence closeout**, not deployment approval,
production certification, or a complete portable reproduction archive.
The PR is a draft. Do not execute historical deployment adapters or regenerate
proofs merely because their source has been committed.

## Scope and concurrency

The conversation owned the shared institutional landing-zone lane. Its earlier
foundation files were prepared in the shared worktree; its later builder,
provenance and runner work used the isolated `g2/synthetic-health-source` branch.
The [snapshot manifest](./CHAT_CLOSEOUT_MANIFEST.json) records 889 selected files
with byte hashes, origins and concurrency observations. Two pre-existing branch
commits also contribute the synthetic-health service.

Only the checkpoint-confirmed landing-zone directory, its foundation contract
test, the two legacy Bicep immutable-image changes, and the isolated conversation
proof/source lanes are included. Shared-worktree source files were read and
copied without editing, staging or reverting them. No product, package, lockfile,
workflow or parallel-conversation changes are part of this closeout.
The existing pre-commit hook also requires four canonical repository-inventory
outputs; those are generated from this isolated chat-only tree and included.
The copied G2 report's two retired Node-source links point to their immutable
historical commit rather than reintroducing removed runtime files. Its original
capture hash is retained in the manifest; no historical ruling is changed.

## Reading order and historical precedence

1. [Foundation design and live/IaC decisions](./README.md): historical G1
   `PASS_WITH_LIMITATIONS`, not a security, DR or readiness pass.
2. [G2 terminal report](../../.azure/evidence/G2_TERMINAL_REPORT.md),
   [disposition](../../.azure/evidence/G2_TERMINAL_DISPOSITION.json) and
   [limitations](../../.azure/evidence/G2_TERMINAL_LIMITATIONS.json): the accepted
   bounded private artifact/control-plane foundation scope, not product readiness.
3. [V1 interpretation correction](../../.azure/g3a-runner-v2/V1_INTERPRETATION_CORRECTION.json):
   V1 is a qualified execution-core proof artifact, not a production-invocable
   runner.
4. [V2 terminal disposition](../../.azure/g3a-runner-v2/FINAL_DISPOSITION.json)
   and [additive diagnosis](../../.azure/g3a-runner-v2/READ_ONLY_DIAGNOSIS_AND_TEST_INTERPRETATION.json):
   the latest runner qualification is blocked.

Earlier terminal decisions describe the authority and architecture in force at
their own capture time. Later explicit user authorities permitted the bounded
experiments recorded here; this index does not rewrite the earlier evidence.
In particular, the historical G3 no-go discussion in the foundation README is
not a substitute for the later runner disposition.

## Latest observed stop

The one parent-owned V2 local qualification rejected its generated authority:

```text
FROZEN_INPUT_MANIFEST_BINDING_MISMATCH
```

The generator recursively sorts census entry fields as `bytes,mode,sha256`;
Go serializes the entry struct as `sha256,bytes,mode`. Both encodings are 1842
bytes, but their hashes differ:

| Identity | SHA256 |
|---|---|
| Generated census | `65cb9700fc1445a45f9688900c57591c87f1c2aa2125a935a2d4572e6db07cd9` |
| Runner-expected census | `855cdca196309428269dd76d6385ca3f6ab2dc862adb4495af19cc5e93434062` |
| V2 candidate | `019021391af5fb32e0bc5e6757074a80b8e1ebc6bcdf5cdae502eb3d841a7bd7` |
| V2 source | `a89e752e70b611c46b112ee4adcd26d1776cd60bc9768c855358757460c93ef7` |
| Stable policy | `1ff31f2f52fb74756aabc9082d2458a07e44f58957a87f91b450f0bf845ecc8c` |

The candidate is 28151932 bytes. Input-root, payload and expected output-manifest
bindings matched. No consumption receipt, constructor or frozen-core invocation
occurred. Local container absence and unchanged parent mount state were checked.
No source repair, candidate rebuild, qualification retry or Azure proof followed.

Go unit fixtures shared the validator's census encoding. External negative CLI
tests asserted rejection without proving the intended rejection stage. Therefore
later-field external denial claims are **not proven**. Source-test PASS values
for single-use/capacity are not successful runtime qualification.

```text
G3_EXECUTION_READINESS = BLOCKED
RUNNER_V2_OFFLINE_QUALIFICATION = FAIL
RUNNER_V2_PROOF_AUTHORITY_CONSUMED = NO
RUNNER_V2_PINNED_GUEST_QUALIFICATION = NOT_RUN
G3A_PRODUCTION_COMPATIBLE_RUNNER = BLOCKED
LOCAL_FULL_TRANSACTION_ALLOWANCE_REMAINING = 1
G3A_LOCAL_FULL_TRANSACTION = NOT_RUN
G3A_TRANSACTION_READINESS = BLOCKED
G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED = NO
G3A_EXECUTION_AUTHORIZED = NO
G3B_EXECUTION_AUTHORIZED = NO
G3_TECHNICAL_EXECUTION_AUTHORIZED = NO
UE_INFRA = INFRA_NO_GO
CORA_INFRA = INFRA_NO_GO
```

The V2 failure-closure phase made zero Azure reads, mutations, deletes, role
changes, UAMI lifecycle changes or registry mutations. This is **not** a claim
that earlier authorized experiments in the whole conversation made no changes.
Its [terminal verification](../../.azure/g3a-runner-v2/TERMINAL_VERIFICATION.json)
checked 1585 references before PR packaging; original root:
`d3141e63e7c9b4bbfd1ec7e54e5a2823839e31cd7f4b5faf0612986f2d613c76`.

## Archive boundaries

- Historical JSON and source snapshots retain their original bytes, paths,
  timestamps and failed attempts. Expired synthetic envelopes are evidence,
  never reusable authority.
- Scoped Git attributes disable line-ending normalization only for this proof
  package and its hash-bound source files. Historical Markdown hard breaks and
  whitespace are retained rather than rewriting sealed evidence for formatting.
- Executables, toolchains, payloads, tar archives, extracted third-party runtimes,
  caches, generated ARM outputs and unselected raw cloud/web responses are not
  committed. They remain in their original local lanes.
- Historical seals can refer to absolute Windows paths and excluded files.
  The committed subset is not a claim that every historical verification script
  runs in a fresh clone. The snapshot manifest verifies the selected file bytes,
  not the omitted artifacts.
- Historical Node qualification tests require omitted raw/frozen evidence.
  The V2 historical evidence-transport test also expects an absent
  `EXACT_EVIDENCE_ENVELOPE.json`. Do not manufacture replacements to turn these
  archive checks into passing tests.
- All deployment/helper scripts remain inactive unless independently invoked.
  This PR adds no workflow, auto-run hook or product deployment integration.

## Closeout validation

Local, non-cloud validation performed for packaging:

- Nine Bicep entrypoints compiled with the installed local Bicep executable:
  foundation, runtime, edge, operations, landing-zone, artifact-registry,
  g2-proof, g2-artifact-foundation and legacy main.
- `G1_BICEP_OUTPUT=<local-output> pnpm exec vitest run --project=contract-tests tooling/contract-tests/landing-zone-foundation.test.ts`:
  **52 passed**, including emitted-template checks.
- `go test ./...` in synthetic-health, g3-source/image-candidate and
  g3-source/workload/synthetic-proof: **all three passed**.
- G2 Python unit tests: **143 passed** across the builder discovery/repair,
  Stage 2A helper and Stage 2B runtime suites. Initial discovery from the tests
  directory failed its import path; rerunning from the builder directory passed.
- `python -B -m unittest test_runtime_evidence_transport` in the V2 source lane:
  **5 passed, 1 skipped**. The separate historical evidence test remains blocked
  by its absent fixture; no runtime qualification was rerun.
- Selected-file SHA256 checks: **889 passed**. Python syntax parsing:
  **298 source files passed**. A bounded secret-pattern scan found no matches;
  this is not a security certification.
- Full-repository check results are recorded in the PR body. They must not be
  inferred from these targeted results.
- `pnpm validate:docs` passed after a frozen dependency restore, with zero
  errors. Full `pnpm lint`, `pnpm typecheck`, `pnpm test:fast` and
  `pnpm governance:audit` were attempted but interrupted before completion;
  none is claimed passing. The draft is not merge-ready.

## Rollout, rollback and next boundary

There is no rollout or migration in this PR. Reverting it removes the committed
source/evidence package; it does not alter or clean up Azure resources.
No production endpoint, DNS, database, identity or product workflow changes are
authorized by merging this archive.

The known census serialization defect requires a separately scoped repair and
qualification decision. No unused allowance is inferred from the failed
pre-consumption dispatch. The full outer transaction remains unexecuted.
