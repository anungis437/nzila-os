# Wave 0 §9 — Build Isolation Proof: Operational vs. CUPE 4373 Demo

> **⚠️ SUPERSEDED — DO NOT RELY ON THIS DOCUMENT.**
>
> The two builds captured below both invoked `pnpm --filter @nzila/union-eyes build`. The `@nzila/union-eyes-demo` package was never built. The distinct BUILD_IDs observed do not demonstrate artifact isolation; they only demonstrate that the operational app produces a different BUILD_ID when demo env vars are set.
>
> The correct artifact-to-artifact proof lives in [`wave-0-artifact-proof.md`](wave-0-artifact-proof.md).
> The reversed verdict and remediation plan live in [`../docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md`](../docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md).
>
> This file is retained unmodified below for historical traceability.

---

**Milestone**: Wave 0 §9 (build isolation proof)
**Branch**: `fix/union-eyes-reality-remediation`
**Generated**: See per-build timestamps in the JSON artifacts.
**Related**: [§8 scanner](../docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md), [capability `UE-BUILD-OPERATIONAL-ISOLATION`](../apps/union-eyes/lib/reality/capability-registry.ts)

## Purpose

Prove that the union-eyes Next.js application can be built independently in two disjoint profiles — the **operational** profile (no demo env vars set) and the **CUPE 4373 demo** profile (demo env vars set) — and that each produces a distinct, self-consistent artifact.

This is Wave 0's answer to the continuation directive: *"both applications build independently, the operational build and image are proven free of demo content."*

## Method

Two clean-slate Next.js builds of `@nzila/union-eyes` on the same commit (`0d4197433`, branch `fix/union-eyes-reality-remediation`), same tooling versions, same host:

1. Delete `apps/union-eyes/.next/`.
2. Explicitly clear all four demo env vars (`UE_FEATURE_PROFILE`, `UE_DEPLOYMENT_TYPE`, `NEXT_PUBLIC_UE_FEATURE_PROFILE`, `NEXT_PUBLIC_UE_DEMO_PROFILE`).
3. Run `pnpm --filter @nzila/union-eyes build`.
4. Record the resulting `BUILD_ID` and the `pnpm reality:build-scan:with-bundle` counts.
5. Snapshot `reports/operational-build-demo-scan.{json,md}` as the operational artifact.
6. Delete `apps/union-eyes/.next/`.
7. Set the demo env vars (`UE_FEATURE_PROFILE=cupe4373`, `UE_DEPLOYMENT_TYPE=cupe4373-demo`, `NEXT_PUBLIC_UE_FEATURE_PROFILE=cupe4373`, `NEXT_PUBLIC_UE_DEMO_PROFILE=1`).
8. Run `pnpm --filter @nzila/union-eyes build` again.
9. Record `BUILD_ID` and re-scan.
10. Snapshot as the demo artifact.

Each build emits Turbopack chunks under `apps/union-eyes/.next/`; the `pnpm reality:build-scan:with-bundle` command counts every occurrence of `cupe\s*[-_]?\s*4373|cupe\s*local\s*4373|CUPE4373_` (case-insensitive) across the compiled bundle.

## Environment

| Setting | Operational build | Demo build |
| --- | --- | --- |
| `UE_FEATURE_PROFILE` | (unset) | `cupe4373` |
| `UE_DEPLOYMENT_TYPE` | (unset) | `cupe4373-demo` |
| `NEXT_PUBLIC_UE_FEATURE_PROFILE` | (unset) | `cupe4373` |
| `NEXT_PUBLIC_UE_DEMO_PROFILE` | (unset) | `1` |
| Command | `pnpm --filter @nzila/union-eyes build` | `pnpm --filter @nzila/union-eyes build` |
| Working tree | Clean at `0d4197433` | Clean at `0d4197433` |

## Results

| Metric | Operational | Demo | Delta |
| --- | --- | --- | --- |
| Build success | ✅ | ✅ | Both compile |
| `BUILD_ID` | `1784631287250` | `1784631671586` | Distinct |
| Source demo-token hit count (allowlist-enforced) | 104 hits / 29 files | 104 hits / 29 files | Identical (source is env-independent) |
| Source scan errors | 0 | 0 | Both pass gate |
| `.next/` bundle files with demo tokens | 72 | 71 | −1 file |
| `.next/` bundle total demo-token hits | 73 | 71 | −2 hits |
| Prerendered HTML files with demo tokens | 0 | 0 | All demo routes are dynamic |

### Interpretation

1. **Both builds compile independently.** The demo profile is not required for a valid operational build, and enabling it does not break compilation. This satisfies the continuation-directive requirement that "both applications build independently".

2. **`BUILD_ID` differs** between the two profiles even though inputs (source, lockfile, tooling) are identical. Next.js derives `BUILD_ID` per compilation, so the two artifacts are distinguishable end-to-end (image tag, cache key, deploy target).

3. **Bundle content is not identical.** The −2 / −1 hit-count delta on the compiled bundle is small but consistently reproducible, and reflects the `NEXT_PUBLIC_*` env-var inlining that Turbopack performs at build time. Concretely:
   - `NEXT_PUBLIC_UE_FEATURE_PROFILE` and `NEXT_PUBLIC_UE_DEMO_PROFILE` become inlined `"cupe4373"` / `"1"` string constants in the demo build vs. `undefined` in the operational build.
   - Downstream statically-analysable branches (`process.env.NEXT_PUBLIC_UE_DEMO_PROFILE === "1"`) resolve at compile time and Turbopack tree-shakes accordingly.

4. **Prerendered HTML contains no demo strings in either build.** Every route that gates on `isCupe4373DemoRuntime()` is server-rendered on demand (dynamic), not statically prerendered, so the demo persona picker, demo navigation, and demo document titles only reach the wire when a request-time environment declares the demo profile.

5. **Source-side counts are identical (104/29)** because the operational-build scanner reads source files, not compiled artifacts. The allowlist-enforced source ceiling is env-independent by design.

## Verdict

**Both builds succeed independently.** The operational build produces a compilable, self-consistent Next.js artifact with `BUILD_ID=1784631287250` and never renders demo content at runtime because `isCupe4373DemoRuntime()` returns `false` when the four demo env vars are unset. The demo build produces a distinct artifact with `BUILD_ID=1784631671586` whose runtime detector activates the CUPE 4373 demo surfaces.

**Bundle-level demo-string isolation is still incomplete** (72 files in the operational bundle contain `cupe4373` tokens, all statically-imported). Runtime rendering is gated and dead when the operational profile is active, but the compiled JavaScript still contains the demo modules. Wave 5/6 will dynamically-import those modules to remove them from the operational bundle entirely; until then, the capability `UE-BUILD-OPERATIONAL-ISOLATION` remains at state `LIMITED` in the truth registry.

## Reproduce

```powershell
$env:UE_FEATURE_PROFILE = $null
$env:UE_DEPLOYMENT_TYPE = $null
$env:NEXT_PUBLIC_UE_FEATURE_PROFILE = $null
$env:NEXT_PUBLIC_UE_DEMO_PROFILE = $null
Remove-Item -Recurse -Force apps/union-eyes/.next
pnpm --filter @nzila/union-eyes build
Get-Content apps/union-eyes/.next/BUILD_ID -Raw   # operational
pnpm reality:build-scan:with-bundle               # source + bundle

$env:UE_FEATURE_PROFILE = 'cupe4373'
$env:UE_DEPLOYMENT_TYPE = 'cupe4373-demo'
$env:NEXT_PUBLIC_UE_FEATURE_PROFILE = 'cupe4373'
$env:NEXT_PUBLIC_UE_DEMO_PROFILE = '1'
Remove-Item -Recurse -Force apps/union-eyes/.next
pnpm --filter @nzila/union-eyes build
Get-Content apps/union-eyes/.next/BUILD_ID -Raw   # demo
pnpm reality:build-scan:with-bundle
```

## Artifacts

- Operational scan snapshot: [reports/wave-0-build-isolation.operational.json](wave-0-build-isolation.operational.json), [reports/wave-0-build-isolation.operational.md](wave-0-build-isolation.operational.md)
- Demo scan snapshot: [reports/wave-0-build-isolation.demo.json](wave-0-build-isolation.demo.json), [reports/wave-0-build-isolation.demo.md](wave-0-build-isolation.demo.md)
- Tracked "current" scan (mirror of operational): [reports/operational-build-demo-scan.md](operational-build-demo-scan.md)
- Scanner: [tooling/reality/operational-build-scan.ts](../tooling/reality/operational-build-scan.ts)
- Allowlist: retired at Wave 0 Task E — the scanner now uses a hardcoded permit constant (see the scanner header). The prior `tooling/reality/operational-build-demo-allowlist.json` was removed.
- Runtime gate: [apps/union-eyes/lib/dashboard/role-experience.ts](../apps/union-eyes/lib/dashboard/role-experience.ts)
- Capability entry: `UE-BUILD-OPERATIONAL-ISOLATION` in [apps/union-eyes/lib/reality/capability-registry.ts](../apps/union-eyes/lib/reality/capability-registry.ts)
- §8 design doc: [docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md](../docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md)
