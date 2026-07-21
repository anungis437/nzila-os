# Wave 0 §9 — Superseding artifact-to-artifact build proof

**Supersedes:** [`wave-0-build-isolation-proof.md`](wave-0-build-isolation-proof.md).
**Reason:** The original §9 proof compared the SAME package (`@nzila/union-eyes`) built with two different env-var sets. That is not artifact isolation; it demonstrates the operational app can still be turned into a CUPE demo through environment variables. This document replaces that invalid comparison with a real artifact-to-artifact test.

**Branch:** `fix/union-eyes-reality-remediation` @ `de263958a` (at time of build)
**Recorded:** 2026-07-21

## Method

Two independent, clean, `pnpm --filter …` package builds — one per registered workspace app. No env-var overrides that would coerce one artifact into the other's mode.

```powershell
Remove-Item apps/union-eyes/.next      -Recurse -Force
Remove-Item apps/union-eyes-demo/.next -Recurse -Force

# Operational artifact
Remove-Item Env:UE_DEPLOYMENT_TYPE           -ErrorAction SilentlyContinue
Remove-Item Env:UE_FEATURE_PROFILE           -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_UE_FEATURE_PROFILE -ErrorAction SilentlyContinue
Remove-Item Env:UE_DEMO_PROFILE              -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_UE_DEMO_PROFILE  -ErrorAction SilentlyContinue
pnpm --filter @nzila/union-eyes      build

# Demo artifact
pnpm --filter @nzila/union-eyes-demo build
```

## Results

| Field | Operational (`@nzila/union-eyes`) | Demo (`@nzila/union-eyes-demo`) |
|---|---|---|
| Package | `@nzila/union-eyes` | `@nzila/union-eyes-demo` |
| Command | `pnpm --filter @nzila/union-eyes build` | `pnpm --filter @nzila/union-eyes-demo build` |
| Commit | `de263958a` | `de263958a` |
| BUILD_ID | `1784633120903` | `dyG6B6BsIlZuIJTU8ebYp` |
| Output dir | `apps/union-eyes/.next` | `apps/union-eyes-demo/.next` |
| Routes (static / dynamic / total) | 711 / 575 / 1286 | 2 / 14 / 16 |
| Bundle size | 612 MB | 21 MB |
| Build duration | 119.2 s | 17.5 s |
| Exit code | 0 | 0 |
| `.next/` demo-token files with hits | **72** | 116 |

Machine-readable per-artifact snapshots: [`reports/wave-0-artifact-proof.operational.json`](../../../reports/wave-0-artifact-proof.operational.json), [`reports/wave-0-artifact-proof.demo.json`](../../../reports/wave-0-artifact-proof.demo.json).

## Honest interpretation

### What this DOES prove

- `@nzila/union-eyes-demo` is a **real, separately-built workspace app** with its own package, `.next/` output, BUILD_ID, and route table. It is not the operational app in disguise.
- Both artifacts compile cleanly with **exit code 0**.
- The artifacts are **structurally distinct**: 1286 routes vs 16 routes, 612 MB vs 21 MB. The overlap is neutral shared infrastructure, not shared demo behaviour.

### What this DOES NOT prove — and explicit correction of prior claims

- **The original §9 proof was invalid.** It ran `pnpm --filter @nzila/union-eyes build` twice with different env vars. That never touched `@nzila/union-eyes-demo`. The "distinct BUILD_IDs" observed were both from the operational package.
- **The operational artifact is still contaminated.** 72 files in `apps/union-eyes/.next/` contain CUPE 4373 tokens. Every such reference is customer-specific runtime code (a persona picker, gated sidebar, gated dashboard badge, gated portal home, gated documents console, gated login redirect) that must be moved to `apps/union-eyes-demo/` or deleted from the operational app. The presence of a runtime gate (`isCupe4373DemoRuntime()`) does not remove the code from the bundle.
- **The operational app can still be turned into a CUPE demo through environment variables.** Setting `UE_FEATURE_PROFILE=cupe4373` + `UE_DEPLOYMENT_TYPE=cupe4373-demo` + `NEXT_PUBLIC_UE_DEMO_PROFILE=1` on the operational package flips the gates and renders the CUPE UX. That is not artifact isolation; that is a runtime toggle.
- **The allowlist is not isolation.** The 29-file / 104-hit source allowlist accepts and legitimises the contamination. It must be replaced with actual removal — see the continuation plan in `23_WAVE_0_CORRECTION.md`.

### Verdict

- Artifact separation: **STARTED** (the demo package exists and builds).
- Artifact isolation: **NOT ACHIEVED** for the operational package.
- Environment-toggle susceptibility: **STILL PRESENT** in the operational package.

Wave 0 exit remains **NOT READY**. Follow-on work is enumerated in `23_WAVE_0_CORRECTION.md`.

## Reproduce

```powershell
cd c:\APPS\nzila-automation
# Ensure no demo env vars leak into the operational build
Get-ChildItem Env: | Where-Object Name -match 'UE_DEPLOYMENT_TYPE|UE_FEATURE_PROFILE|UE_DEMO_PROFILE'   # must return empty

Remove-Item apps/union-eyes/.next      -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item apps/union-eyes-demo/.next -Recurse -Force -ErrorAction SilentlyContinue

pnpm --filter @nzila/union-eyes      build
pnpm --filter @nzila/union-eyes-demo build

Get-Content apps/union-eyes/.next/BUILD_ID
Get-Content apps/union-eyes-demo/.next/BUILD_ID
& rg -i -c "cupe\s*[-_]?\s*4373|cupe\s*local\s*4373|CUPE4373_" apps/union-eyes/.next      | Measure-Object -Line
& rg -i -c "cupe\s*[-_]?\s*4373|cupe\s*local\s*4373|CUPE4373_" apps/union-eyes-demo/.next | Measure-Object -Line
```
