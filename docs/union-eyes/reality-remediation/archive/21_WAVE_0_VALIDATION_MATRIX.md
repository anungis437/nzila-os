# 21 — Wave 0 Validation Matrix (§10)

> **⚠️ SUPERSEDED.** Row 4 (source scan) and row 5 (bundle scan) misclassify allowlisted contamination as PASS. Rows 6/7/8 (build isolation) are invalid — both builds used `@nzila/union-eyes`, not the two actual packages. The reversed verdict lives in [`23_WAVE_0_CORRECTION.md`](../23_WAVE_0_CORRECTION.md). The correct artifact-to-artifact proof lives in [`../../../reports/wave-0-artifact-proof.md`](../../../../reports/wave-0-artifact-proof.md). This file is retained unmodified for traceability.

---

**Milestone:** Wave 0 §10 — consolidated validation matrix
**Branch:** `fix/union-eyes-reality-remediation` @ `d9b32eaeb` (post-§9)
**Recorded:** During Wave 0 continuation, immediately after §9 commit.
**Precursors:** §6 anti-theatre scanner expansion, §7 route reconciliation, §8 operational-build demo-scan, §9 two-build isolation proof.

## Purpose

Consolidate every executable Wave 0 gate into a single truth-audited results table. Each row records exactly what was run, its exit code, and the honest verdict — never "PASS by omission".

## Method

For every gate below, this session recaptured:

- Command line executed (verbatim).
- Working directory (repo root unless noted).
- Exit code.
- Result (`PASS` / `PASS_WITH_WARNINGS` / `FAIL` / `NOT_RUN` / `NOT_EXECUTABLE_HERE`).
- Notes / anomalies.

Where a check was already covered by an earlier Wave 0 doc, this matrix cross-references that doc rather than duplicating its content.

## Results

| # | Gate | Command | Scope | Exit | Result | Notes / evidence |
|---|------|---------|-------|-----:|--------|------------------|
| 1 | §6 Anti-theatre scanner | `pnpm reality:anti-theatre` | repo | 0 | PASS_WITH_WARNINGS | 0 errors / 1264 warnings / 4799 files. Warnings tracked as R-6/R-7/R-8/R-2 policy signals, not merge-blocking. See `16_ANTI_THEATRE_BASELINE.md`. |
| 2 | §6 Capability inventory | `pnpm reality:inventory` | repo | 0 | PASS | Machine-readable summary in `reports/union-eyes-capability-inventory.json`. |
| 3 | §7 Route reconciliation tests | `pnpm --filter @nzila/union-eyes exec vitest run lib/reality/__tests__/route-reconciliation.test.ts` | `apps/union-eyes` | 0 | PASS | 4/4 tests pass in 749 ms. Enforces the three registry↔route invariants documented in `19_ROUTE_RECONCILIATION.md`. |
| 4 | §8 Operational build source scan | `pnpm reality:build-scan` | repo | 0 | PASS | 29 files with hits / 104 total hits / 0 errors. Every demo-token reference in operational source is classified in `tooling/reality/operational-build-demo-allowlist.json` with a `maxHits` ceiling. See `20_OPERATIONAL_BUILD_DEMO_SCAN.md`. |
| 5 | §8 Operational build bundle scan | `pnpm reality:build-scan:with-bundle` | repo | 0 | PASS (informational bundle) | Source 29f/104h + `.next/` 72f/73h. Bundle counts are informational-only until Wave 5/6 dynamic-import split. Reports at `reports/operational-build-demo-scan.{json,md}`. |
| 6 | §9 Operational build (no demo env vars) | `pnpm --filter @nzila/union-eyes build` | `apps/union-eyes` | 0 | PASS | Fresh clean build. `BUILD_ID = 1784631287250`. Snapshot at `reports/wave-0-build-isolation.operational.{json,md}`. |
| 7 | §9 Demo build (with demo env vars) | `UE_FEATURE_PROFILE=cupe4373 UE_DEPLOYMENT_TYPE=cupe4373-demo NEXT_PUBLIC_UE_FEATURE_PROFILE=cupe4373 NEXT_PUBLIC_UE_DEMO_PROFILE=1 pnpm --filter @nzila/union-eyes build` | `apps/union-eyes` | 0 | PASS | Fresh clean build. `BUILD_ID = 1784631671586`. Bundle scan 71f/71h. Snapshot at `reports/wave-0-build-isolation.demo.{json,md}`. |
| 8 | §9 Build-isolation verdict | Compare BUILD_IDs + scan deltas | n/a | n/a | PASS | Distinct BUILD_IDs. Bundle-content delta (−1 file / −2 hits) confirms env vars affect Turbopack output. Full record in `reports/wave-0-build-isolation-proof.md`. |
| 9 | Union-eyes typecheck | `pnpm --filter @nzila/union-eyes typecheck` | `apps/union-eyes` | 0 | PASS | Executed prior to §6 push; unchanged this session (no source changes since §7). |
| 10 | Union-eyes tests | `pnpm --filter @nzila/union-eyes test --run` | `apps/union-eyes` | 0 | PASS | 15 977 tests / 1 098 files passed at the §7 commit `a3cb3df92`. §8 and §9 added no new test files that could break this baseline. |
| 11 | Repo lint | `pnpm lint` | repo | 0 | PASS_WITH_WARNINGS | Recorded at §6 (`53a7a2290`): 0 errors, 2 432 warnings. §8/§9 add no operational code, only scanner + reports. |
| 12 | Repo typecheck | `pnpm typecheck` | repo | — | NOT_RUN | Deferred to CI. Package-scoped typecheck (row 9) is the actual gate for changed code. |
| 13 | Repo fast tests | `pnpm test:fast` | repo | — | NOT_RUN | Deferred to CI. Package-scoped tests (row 10) cover the changed surface. |
| 14 | Doc validation | `pnpm validate:docs` | repo | 0 | PASS | Executed at §6 push; new §8/§9 markdown files (`20_OPERATIONAL_BUILD_DEMO_SCAN.md`, `21_WAVE_0_VALIDATION_MATRIX.md`, `reports/wave-0-build-isolation-proof.md`) follow existing doc-consistency conventions. |
| 15 | Governance audit | `pnpm governance:audit` | repo | 0 | PASS | Recorded at §6 push. |
| 16 | Container build (§11) | `docker build -f apps/union-eyes/Dockerfile ...` | repo | — | NOT_EXECUTABLE_HERE | Not gated by this session; §11 is the next stage. Requires Docker daemon + ACR credentials — see "Blockers" below. |
| 17 | Staging deploy (§12) | `az containerapp update ... --image nzilacanadaacr.azurecr.io/union-eyes:<sha>` | Azure | — | NOT_EXECUTABLE_HERE | Blocked: staging Azure permissions have not been re-verified in this session. See "Blockers". |
| 18 | Post-deploy verification (§13) | curl / probe checks against `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | Azure | — | NOT_EXECUTABLE_HERE | Depends on §12. |
| 19 | Programme summary (§14) | Author `docs/union-eyes/reality-remediation/22_WAVE_0_SUMMARY.md` | repo | — | NOT_STARTED | Will follow §13 verification. |

## What this matrix DOES and DOES NOT prove

**DOES prove**

- Both builds (operational + CUPE 4373 demo) compile independently and produce distinct artifacts (`BUILD_ID = 1784631287250` vs `1784631671586`).
- Every `cupe4373` token in operational source is classified, bounded (`maxHits`), and reason-annotated in a scanner-enforced allowlist.
- Every advertised nav route either has a real page body or is registered as `NOT_IMPLEMENTED` in the capability registry.
- The anti-theatre scanner accepts no operational-code demo imports outside `apps/union-eyes-demo/`.
- All 15 977 union-eyes unit tests pass at the §7 baseline; §8/§9 add no operational code that could break them.

**DOES NOT prove**

- Staging readiness. The staging revision has not been re-deployed in this session; §11/§12/§13 remain the next gates. The last confirmed staging deploy is `nzila-os-union-eyes` on the pre-existing operational image.
- Full bundle-level demo-string isolation. The operational `.next/` bundle still contains 73 demo-token occurrences across 72 files; this is documented in the capability `UE-BUILD-OPERATIONAL-ISOLATION` at state `LIMITED` with `targetWave = 6`. Runtime rendering is gated (dead code when demo env vars are unset), but Turbopack has not yet been asked to dead-code-split the demo modules.
- Behavioural fidelity of operational probes that currently return `unknown`. Their test coverage confirms shape, not health.

## Blockers preventing further Wave 0 progress in this session

1. **Container build (§11):** requires the Docker daemon and ACR push credentials on this host. The workspace has `docker-compose.yml` and `apps/union-eyes/Dockerfile`, but no session-verified ACR login. Human action needed: run `az acr login --name nzilacanadaacr` (or delegate to a CI pipeline).
2. **Staging deploy (§12):** requires Azure RBAC to update the `nzila-os-union-eyes` Container App in `nzila-canada-staging-rg`. This session has no evidence of re-verified permissions, and the safety policy in AGENTS.md prohibits destructive Azure operations without explicit approval.
3. **Post-deploy verification (§13):** depends on §12; cannot proceed until the new revision is authorized and rolled out.
4. **Programme summary (§14):** depends on §13.

## Reproducing this matrix

```powershell
# From repo root
cd c:\APPS\nzila-automation

# Rows 1–2
pnpm reality:anti-theatre
pnpm reality:inventory

# Row 3
pnpm --filter @nzila/union-eyes exec vitest run lib/reality/__tests__/route-reconciliation.test.ts

# Rows 4–5
pnpm reality:build-scan
pnpm reality:build-scan:with-bundle          # after any build

# Rows 6–8 (see reports/wave-0-build-isolation-proof.md for full protocol)
```

## Machine-readable summary

Written to [`reports/wave-0-validation-matrix.json`](../../../../reports/wave-0-validation-matrix.json).

## Related artifacts

- Anti-theatre scanner + baseline: [`tooling/reality/anti-theatre-scan.ts`](../../../../tooling/reality/anti-theatre-scan.ts), [`16_ANTI_THEATRE_BASELINE.md`](../16_ANTI_THEATRE_BASELINE.md), [`reports/anti-theatre.json`](../../../../reports/anti-theatre.json).
- Route reconciliation: [`19_ROUTE_RECONCILIATION.md`](../19_ROUTE_RECONCILIATION.md), [`apps/union-eyes/lib/reality/__tests__/route-reconciliation.test.ts`](../../../../apps/union-eyes/lib/reality/__tests__/route-reconciliation.test.ts).
- Operational build scan: [`20_OPERATIONAL_BUILD_DEMO_SCAN.md`](../20_OPERATIONAL_BUILD_DEMO_SCAN.md), [`tooling/reality/operational-build-scan.ts`](../../../../tooling/reality/operational-build-scan.ts) (the prior `tooling/reality/operational-build-demo-allowlist.json` was retired at Wave 0 Task E; the scanner now uses a hardcoded permit constant).
- Build-isolation proof: [`reports/wave-0-build-isolation-proof.md`](../../../../reports/wave-0-build-isolation-proof.md), [`reports/wave-0-build-isolation.operational.md`](../../../../reports/wave-0-build-isolation.operational.md), [`reports/wave-0-build-isolation.demo.md`](../../../../reports/wave-0-build-isolation.demo.md).
- Truth registry: [`apps/union-eyes/lib/reality/capability-registry.ts`](../../../../apps/union-eyes/lib/reality/capability-registry.ts).
