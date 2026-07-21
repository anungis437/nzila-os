# Wave 0 §8 — Operational-Build Demo-String Scanner

## Purpose

The operational-build scanner (`pnpm reality:build-scan`) enforces a **bounded, classified inventory of every `cupe4373` reference** in the operational union-eyes source tree. It prevents the operational build surface from silently accumulating new demo content while Wave 5/6 completes the dynamic-import split that will remove demo modules from the operational bundle entirely.

This is a **truth-gate**, not a bundle-splitter. See "Bundle vs. render" below.

---

## Bundle vs. render — what "operational-build free of demo content" means today

The operational build currently **compiles and bundles** the CUPE 4373 demo modules (persona picker, demo navigation, demo dashboard tiles) because they are statically imported by shared code paths. However, at runtime:

1. `isCupe4373DemoRuntime()` at `apps/union-eyes/lib/dashboard/role-experience.ts:129` reads four environment variables:
   - `NEXT_PUBLIC_UE_DEMO_PROFILE`
   - `NEXT_PUBLIC_UE_FEATURE_PROFILE`
   - `UE_FEATURE_PROFILE`
   - `UE_DEPLOYMENT_TYPE` (must equal `cupe4373-demo`)
2. Operational builds set **none** of these, so the gate returns `false`.
3. Every JSX branch that would render demo content sits inside `{isCupeDemo ? … : <RealBranch />}` and is unreachable dead code at runtime.

The Wave 0 goal is therefore **twofold**:

- **Render truth (delivered — §7 + this §8)**: prove the operational build renders zero demo content at runtime.
- **Bundle truth (Wave 5/6 target)**: dynamic-import demo modules so the operational `.next/` bundle contains zero demo strings.

Until Wave 5/6 lands, the `.next/` scan (`--build-dir apps/union-eyes/.next`) is **informational only** — its non-zero hit count is expected and is not an error.

---

## Design

### Path B — classified allowlist with per-file `maxHits` ceilings

Every `cupe4373` token in operational source **must** be classified in `tooling/reality/operational-build-demo-allowlist.json`. Each entry declares:

| Field | Meaning |
| --- | --- |
| `file` | Repo-relative path (POSIX separators). |
| `classification` | One of the taxonomy values below. |
| `reason` | One-sentence truthful explanation of why the reference exists. |
| `maxHits` | Ceiling on the number of matches allowed in this file. |
| `targetWave` | The wave that will remove or refactor the reference (usually `6`). |

Unallowlisted files with any hit → **error**.
Files that exceed their `maxHits` ceiling → **error**.
Allowlist entries with zero hits (dead entries) → **error**.

### Classification taxonomy

| Classification | Meaning | Example |
| --- | --- | --- |
| `env-schema` | Type union or Zod schema that literally lists the demo profile name. | `lib/runtime/environment.ts` |
| `runtime-detector` | Runtime code that reads/matches env vars to detect the demo profile. | `lib/dashboard/role-experience.ts` — `isCupe4373DemoRuntime()` |
| `demo-component` | UI component that is dedicated to the demo experience (rendered only inside a gate). | `components/auth/cupe4373-persona-picker.tsx` |
| `gated-render` | Operational code path that renders demo JSX inside an `isCupe4373DemoRuntime()` gate. | `app/[locale]/dashboard/layout.tsx` |
| `registry-evidence` | Truth registry / capability entries whose evidence text mentions the demo profile. | `lib/reality/capability-registry.ts` |
| `code-comment` | Comment or docstring referencing the demo profile with no runtime effect. | `app/[locale]/dashboard/page.tsx` |
| `build-config` | Build scripts, package.json entries, or IaC parameters that reference the demo profile. | `package.json` — `seed:cupe4373-members` |
| `report-artifact` | Auto-generated reports that summarise demo instances (rooted under `reports/` etc.). | Filtered out via test-path markers. |
| `test-fixture` | Test or mock file. | Filtered out via test-path markers before scanning. |

### Test/fixture filter

`isTestOrFixturePath()` matches the anti-theatre-scan conventions and skips paths containing `/__tests__/`, `/__mocks__/`, `/__fixtures__/`, `/__snapshots__/`, `/tests/`, `/test/`, `/e2e/`, `/fixtures/`, `/scripts/`, `/coverage/`, `.test.*`, `.spec.*`, `.stories.*`, and root-only paths under `reports/`, `artifacts/`, `proof-artifacts/`, `apps/union-eyes/reports/`.

---

## Invocation

```powershell
# Source-only scan (fast; enforces the allowlist and produces the baseline report)
pnpm reality:build-scan

# Source + informational bundle scan (requires apps/union-eyes/.next to exist)
pnpm build:union-eyes
pnpm reality:build-scan:with-bundle
```

Outputs:

- `reports/operational-build-demo-scan.json` — full machine-readable inventory.
- `reports/operational-build-demo-scan.md` — human-readable summary table (source hits + bundle hits when scanned).

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | All source hits are allowlisted within their `maxHits` ceilings, no dead allowlist entries. |
| `1` | One or more source files exceed their ceiling, are unallowlisted, or the allowlist has dead entries. |
| `2` | Fatal internal error (allowlist parse failure, missing ripgrep for `--build-dir`, etc.). |

---

## Current baseline

Recorded at Wave 0 §8 commit:

- **Source**: 29 files with hits / 104 total hits / 0 errors.
- **Bundle** (`.next/` informational): ~72 files / ~73 hits — non-blocking until Wave 5/6.

See `reports/operational-build-demo-scan.md` for the latest numbers.

---

## Governance rules

1. **Never edit the allowlist to hide new demo content.** Every new entry must correspond to a real gated-render or runtime-detector code path with a truthful `reason`.
2. **`maxHits` is a ceiling, not a floor.** When a legitimate refactor removes references, lower `maxHits` accordingly. Dead entries fail the scan.
3. **Every entry has a `targetWave`.** Wave 5/6 must either remove the reference or promote it to a dynamically-imported demo module.
4. **Do not use `report-artifact` or `test-fixture` classifications for operational source.** They exist only to document the categories the test-path filter excludes.

---

## Escalation to bundle isolation (Wave 5/6)

When Wave 5/6 introduces dynamic imports:

1. Convert static `import { CupeXxx } from './cupe4373-...'` to `const { CupeXxx } = await import('./cupe4373-...')` inside the `isCupe4373DemoRuntime()` gate.
2. Move demo-only navigation constants (`CUPE4373_DEMO_NAVIGATION`, etc.) into a demo-only module.
3. Verify `pnpm reality:build-scan:with-bundle` shows the bundle hit count drop to zero.
4. Promote `UE-BUILD-OPERATIONAL-ISOLATION` from `LIMITED` to `REAL` in `apps/union-eyes/lib/reality/capability-registry.ts`.
5. Remove the corresponding allowlist entries.

---

## Related artifacts

- Scanner: [tooling/reality/operational-build-scan.ts](../../../tooling/reality/operational-build-scan.ts)
- Allowlist: [tooling/reality/operational-build-demo-allowlist.json](../../../tooling/reality/operational-build-demo-allowlist.json)
- Runtime gate: [apps/union-eyes/lib/dashboard/role-experience.ts](../../../apps/union-eyes/lib/dashboard/role-experience.ts)
- Capability entry: `UE-BUILD-OPERATIONAL-ISOLATION` in [apps/union-eyes/lib/reality/capability-registry.ts](../../../apps/union-eyes/lib/reality/capability-registry.ts)
- Baseline report: [reports/operational-build-demo-scan.md](../../../reports/operational-build-demo-scan.md)
- Peer scanner (anti-theatre): [tooling/reality/anti-theatre-scan.ts](../../../tooling/reality/anti-theatre-scan.ts)
