# 23 — Wave 0 correction & superseding findings

**Supersedes previous verdicts in:**
- [`21_WAVE_0_VALIDATION_MATRIX.md`](21_WAVE_0_VALIDATION_MATRIX.md)
- [`22_WAVE_0_SUMMARY.md`](22_WAVE_0_SUMMARY.md)
- [`../../../reports/wave-0-build-isolation-proof.md`](../../../reports/wave-0-build-isolation-proof.md)

**Does not rewrite history.** The prior documents remain in the tree with their original claims. This document records the corrections and the reversed verdict.

**Branch:** `fix/union-eyes-reality-remediation` @ `de263958a` (state at correction)
**Recorded:** 2026-07-21

## 1. Corrected verdict

> **Wave 0 is NOT COMPLETE.**
>
> The programme state at `de263958a` is best summarised as:
>
> `PARTIALLY_IMPLEMENTED — SEPARATE DEMO APPLICATION BUILDS, BUT THE OPERATIONAL APPLICATION STILL CONTAINS CUSTOMER-SPECIFIC DEMO CODE AND CAN STILL BE BUILT AS A CUPE DEMO.`

The prior "Wave 0 delivered" language in §10 / §14 is withdrawn. Wave 0 gates §1–§7 remain in place (they concern the anti-theatre scanner, route reconciliation, capability registry) but §8 (allowlist-model scanner) and §9 (build-isolation proof) are downgraded from **delivered** to **rejected**.

## 2. Inaccurate claims corrected

| Prior claim | Where | Correction |
|---|---|---|
| "§9 two-build isolation proof … distinct BUILD_IDs prove artifact isolation" | `wave-0-build-isolation-proof.md`, `21_WAVE_0_VALIDATION_MATRIX.md` row 8, `22_WAVE_0_SUMMARY.md` §1 | Both builds used `pnpm --filter @nzila/union-eyes build`. The `@nzila/union-eyes-demo` package was never invoked. See the superseding proof in [`../../../reports/wave-0-artifact-proof.md`](../../../reports/wave-0-artifact-proof.md). |
| "operational-build source scan → 29 files / 104 hits / 0 errors → PASS" | `20_OPERATIONAL_BUILD_DEMO_SCAN.md`, `21_WAVE_0_VALIDATION_MATRIX.md` row 4 | The scanner PASSES because 29 operational files with 104 CUPE-specific hits are allowlisted. That is not isolation; it is a controlled exception list around ongoing contamination. Green scan ≠ clean artifact. |
| "operational build bundle scan → 72f/73h (informational-only)" | `20_OPERATIONAL_BUILD_DEMO_SCAN.md`, `21_WAVE_0_VALIDATION_MATRIX.md` row 5 | Correct count restated (now 72 files with hits at `1784633120903`). The `informational-only` classification is wrong — 72 files in a production bundle that name a specific customer is a **defect**, not an informational metric. |
| "UE-BUILD-OPERATIONAL-ISOLATION at LIMITED with targetWave=6 documents the deferred bundle cleanup" | `capability-registry.ts`, `20_OPERATIONAL_BUILD_DEMO_SCAN.md` | The capability entry correctly documents the gap, but marking it `LIMITED` and deferring to Wave 6 is not acceptable given the go-live posture. Bundle isolation is a Wave 0 requirement, not a Wave 5/6 one. Target must be advanced. |
| "Wave 0 gates green at `4c2fd5b4a`" | `22_WAVE_0_SUMMARY.md` | Only the gates the scanner defines are green. The gates themselves are insufficient. Wave 0 requires artifact isolation, not scanner satisfaction. |
| "Staging deploy blocked pending authorization" | `22_WAVE_0_SUMMARY.md` §4 | Correct on the auth constraint, but the framing is misleading: even with authorization, deploying `1784633120903` would ship 72 CUPE-tainted files into the operational Container App. Deployment is blocked on contamination as well as on authorization. |

## 3. What actually remains

The scale of work now formally on the branch:

- **~20 operational source files** carry customer-specific CUPE runtime code (persona picker, gated sidebar/portal home/documents console/dashboard badge, gated login redirects, gated onboarding suppression, gated pilot-admin surface, gated health-endpoint field, gated commercial-transition validator, CUPE-only navigation getters, CUPE-only env-schema literals, CUPE-only type-union members). Full inventory in [`../../../tooling/reality/operational-build-demo-allowlist.json`](../../../tooling/reality/operational-build-demo-allowlist.json).
- **72 files in the operational bundle** currently carry demo tokens. Target: **0**.
- **The demo app already contains** parallel implementations of all the demo components in `apps/union-eyes-demo/components/demo/` and `apps/union-eyes-demo/lib/demo/`. The removal is not a "port"; the demo code is already in the demo package. It is a **delete** in the operational package plus a small number of demo-branch removals from operational entrypoints.
- **`/dashboard/reports` remains a dead nav target** — it returns `notFound()` while the sidebar/nav still points to it. Registry acknowledgement is not remediation.
- **`1264 anti-theatre warnings** remain, dominated by silent catches and unregistered surfaces. Section 10 of the continuation prompt lists the classification order.

## 4. Continuation plan (short-loop)

Executed in this session where feasible; deferred with concrete blockers otherwise. Every step ends with either a green artifact or a documented external-only blocker.

| # | Task | Success criterion |
|---|------|-------------------|
| A | Superseding artifact-to-artifact build proof | Two independent `pnpm --filter …` builds recorded per real package. **DONE** — `wave-0-artifact-proof.{md,operational.json,demo.json}`. |
| B | Correction doc (this file) | Reversed verdict published without rewriting history. **DONE** (this file). |
| C | Delete operational CUPE runtime code | `cupe4373-persona-picker.tsx` deleted from operational app; every operational entrypoint's `isCupe4373DemoRuntime()` branch removed; CUPE-only helpers dropped from `role-experience.ts`; portal-home / documents-console / dashboard-layout demo branches stripped. |
| D | Replace CUPE-specific env schema with generic demo class | `env-validation.ts` and `runtime/environment.ts` accept `'demo'` as an environment class but not `'cupe4373'` or `'cupe4373-demo'` in the operational package. |
| E | Rebuild operational; source scanner MUST reject any CUPE token that is not in a comment or the capability-registry evidence | Source-scanner acceptance shrinks toward the small comment/registry set. Allowlist becomes bounded, not open-ended. |
| F | Bundle scan MUST fall from 72 hits toward 0 | Any remaining bundle hit is a hard failure with a specific file to fix next. |
| G | `/dashboard/reports` dead-link elimination | The nav entry is removed from sidebar/menu; a test asserts every advertised UI route resolves to a non-404 implementation. |
| H | Generic-prohibition guard | `pilot-admin-operational.ts` sentinel list becomes `['demo','sample','placeholder','fixture','synthetic']` — no customer names. |
| I | Full local validation battery (§11 of the prompt) | Recorded. |
| J | §11–§14 execution or documented external blocker | Docker/ACR/staging deploy or exact minimum human action. |

Anything not delivered by session end is documented in the closing summary with the exact command, exact error, minimum human action, and follow-up path.

## 5. What this correction changes on the branch

- `reports/wave-0-artifact-proof.{md,operational.json,demo.json}` — new, replaces the invalid `wave-0-build-isolation-proof.md` findings.
- `docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md` — this file.
- Follow-on commits (see Task C onward) mutate the operational app to remove CUPE code.

The old `wave-0-build-isolation-proof.md` and `wave-0-build-isolation.{operational,demo}.{md,json}` remain in the tree, but a header note is added to each linking to this correction. History preserved; verdict reversed.
