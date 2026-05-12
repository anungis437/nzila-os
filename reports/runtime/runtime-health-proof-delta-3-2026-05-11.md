# Delta-3 — Post-Delta-2 Live Runtime Proof + Evidence Automation

- **As-of date:** 2026-05-11
- **Branch:** `chore/runtime-health-proof-delta-3`
- **Authority level:** current-runtime-remediation
- **Predecessor:** [reports/runtime/runtime-health-contract-delta-2026-05-11.md](reports/runtime/runtime-health-contract-delta-2026-05-11.md) (Delta-2)
- **Source-of-truth artifact:** [reports/runtime/runtime-health-status-latest.json](reports/runtime/runtime-health-status-latest.json) (regenerated deterministically by CI)

## 1. Mandate

Convert Delta-2's static, hand-curated runtime classification into:

1. A deterministic **generator** that rebuilds `runtime-health-status-latest.json` from inventory + failure matrix + Delta-2 sidecar.
2. A deterministic **validator** that fails CI on any classification regression.
3. A **CI wiring** that runs both on every push without secrets, without live network, and without `|| true` softening.
4. A **post-redeploy proof plan** that is the ONLY path by which `orchestrator-api` may move from `failing` to `healthy`.

This delta does NOT change the os-core health contract, the orchestrator-api source fix, or any product-layer code. Those remain owned by Delta-2 (commit `4ad83815f`).

## 2. Decisions matrix

| Decision | Status | Evidence |
| --- | --- | --- |
| Generator is the single writer of `runtime-health-status-latest.json` | GO | [tooling/scripts/generate-runtime-health-status.mjs](tooling/scripts/generate-runtime-health-status.mjs) |
| Validator forbids `orchestrator-api = healthy` while failure matrix is latest observation | GO | [tooling/scripts/validate-runtime-health-status.mjs](tooling/scripts/validate-runtime-health-status.mjs) |
| CI runs generator + validator on every push (no secrets, no `|| true`) | GO | [.github/workflows/runtime-governance-attestation.yml](.github/workflows/runtime-governance-attestation.yml) |
| Latest JSON uploaded as workflow artifact | GO | upload-artifact path extended to include `reports/runtime/runtime-health-status-latest.json` |
| Post-redeploy proof plan exists and is referenced by JSON notes | GO | [reports/runtime/post-delta-2-redeploy-proof-plan-2026-05-11.md](reports/runtime/post-delta-2-redeploy-proof-plan-2026-05-11.md) |
| `orchestrator-api` reclassified to `healthy` in this delta | NO-GO | Reclassification gated on the proof plan above; no live evidence exists yet |
| Veridian-{admin,care,site} reclassified | NO-GO | DNS/infra remediation is a separate track; `requiresDnsOrInfra=true` |
| `agrimo` failing classification reclassified | NO-GO | Incubating; does not block Union Eyes pilot |
| Union Eyes pilot blocked by any of the above | NO-GO | All non-healthy entries have `blocksUnionEyesPilot=false`; UE remains unblocked |

## 3. Portfolio summary (from generated latest JSON)

| Field | Value |
| --- | --- |
| `totalAppsReviewed` | 20 |
| `healthy` | 6 |
| `degraded` | 3 |
| `failing` | 5 |
| `notInstrumented` | 6 |
| `requiresRedeploy` | 1 (orchestrator-api) |
| `requiresDnsOrInfra` | 3 (veridian-admin, veridian-care, veridian-site) |
| `stagedOrIncubating` | 4 |

20 eligible apps = 28 inventory entries − 6 `outOfScope` − 1 `faircase` aliased to `abr` − 1 reserved for non-app entries (verified by inventory walk in generator).

## 4. Files changed in this delta

- Added: [tooling/scripts/generate-runtime-health-status.mjs](tooling/scripts/generate-runtime-health-status.mjs)
- Added: [tooling/scripts/validate-runtime-health-status.mjs](tooling/scripts/validate-runtime-health-status.mjs)
- Added: [reports/runtime/runtime-health-status-latest.json](reports/runtime/runtime-health-status-latest.json) (generator output; tracked so CI compares against committed truth)
- Added: [reports/runtime/post-delta-2-redeploy-proof-plan-2026-05-11.md](reports/runtime/post-delta-2-redeploy-proof-plan-2026-05-11.md)
- Added: [reports/runtime/runtime-health-proof-delta-3-2026-05-11.md](reports/runtime/runtime-health-proof-delta-3-2026-05-11.md) (this report)
- Modified: [package.json](package.json) — added `runtime:health:generate` and `runtime:health:validate` scripts
- Modified: [.github/workflows/runtime-governance-attestation.yml](.github/workflows/runtime-governance-attestation.yml) — added Generate + Validate steps after install; extended artifact upload path

No runtime application code changed. No package contract changed. No `tenant` language introduced.

## 5. Generator behavior (deterministic)

Inputs (read-only):

- [governance/release/deployment-inventory.json](governance/release/deployment-inventory.json) (28 entries; 6 `outOfScope`; `faircase` alias of `abr`).
- [reports/runtime/live-health-failure-matrix.json](reports/runtime/live-health-failure-matrix.json) (live ACA observations).
- [reports/runtime/runtime-health-status-2026-05-11.json](reports/runtime/runtime-health-status-2026-05-11.json) (Delta-2 sidecar; carries non-live curatorial notes).

Output:

- [reports/runtime/runtime-health-status-latest.json](reports/runtime/runtime-health-status-latest.json) — sorted, stable JSON.

Rules (executed in order, smallest-safe-fix):

1. Skip `outOfScope=true` entries; collapse `faircase` into `abr`.
2. For each remaining app, look up the most recent failure-matrix observation.
3. If `/api/health` returned HTTP 503 → `failing` (only orchestrator-api currently; `clearsAfterRedeploy=true`).
4. If only the advisory root probe timed out → `degraded` (HTTP 200 retained per `RuntimeHealthResponse.ok` semantics).
5. If no probe was attempted → `not_instrumented` (lift to `degraded`/`healthy` from sidecar where curatorially justified).
6. If sidecar marks an app as DNS/infra-blocked → `requiresDnsOrInfra=true` (veridian-{admin,care,site}).
7. `blocksUnionEyesPilot` is computed from sidecar; never true for incubating products.
8. Main-guard: `import.meta.url === pathToFileURL(process.argv[1]).href` (Windows-safe).

## 6. Validator behavior (deterministic; CI gate)

Hard rules (any violation → EXIT=1):

1. Summary integers must equal classification counts derived from `apps[]`.
2. `orchestrator-api` MUST NOT be `healthy` while its `evidenceBasis` is `live_failure_matrix` and `clearsAfterRedeploy=true`.
3. No app with `clearsAfterRedeploy=true` may have `requiresRedeploy=false` in the summary.
4. No app with `currentRuntimeClassification=failing` AND `productLayer=product` AND `blocksUnionEyesPilot=true` may exist (UE-blocking failure would require an explicit override commit).
5. JSON must be byte-identical to a re-run of the generator (no manual edits permitted).

Current run: EXIT=0.

## 7. CI integration

`.github/workflows/runtime-governance-attestation.yml` now runs, on every push:

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4` + Node 20
3. `pnpm install --frozen-lockfile`
4. **`pnpm runtime:health:generate`** ← new
5. **`pnpm runtime:health:validate`** ← new
6. Existing attestation/evidence upload, with `reports/runtime/runtime-health-status-latest.json` added to the artifact path

No secrets. No live network. No `|| true`. `contents: read, actions: read` permissions only.

## 8. Outstanding (tracked, NOT remediated in this delta)

- `orchestrator-api` redeploy + post-redeploy proof capture (per [post-delta-2-redeploy-proof-plan-2026-05-11.md](reports/runtime/post-delta-2-redeploy-proof-plan-2026-05-11.md)). Reclassification target: 5 → 4 failing, 6 → 7 healthy, 1 → 0 requiresRedeploy.
- `veridian-{admin,care,site}` DNS/infra remediation (separate track).
- `agrimo` adoption of `@nzila/os-core/health` helper (incubating; non-blocking).

## 9. Verification performed

- `pnpm runtime:health:generate` → wrote latest JSON; summary `{6,3,5,6, redeploy=1, dns=3, incubating=4}`.
- `pnpm runtime:health:validate` → EXIT=0.
- Re-running generator produces byte-identical output (idempotent).
- Validator fails (EXIT=1) when `orchestrator-api` is manually flipped to `healthy` (negative test, reverted).
- Workflow YAML lints clean; no new permissions; no new secrets.

## 10. Sign-off

Delta-3 is GO for the automation/CI scope. Delta-3 is NO-GO for `orchestrator-api` reclassification — that remains gated on the post-redeploy proof plan. Union Eyes pilot is unblocked: every non-healthy entry has `blocksUnionEyesPilot=false`.
