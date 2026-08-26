# §20 — Semantic Demo Isolation

**Programme:** Union Eyes Reality & World-Class Remediation Programme, Wave 0.
**Branch:** `fix/union-eyes-reality-remediation`.
**Status:** `STAGE_1_COMPLETE` — physical artifact separation and
operational-app cleanup are complete and enforced by the anti-theatre
scanner. Independent build/typecheck of the demo artifact is not yet
wired (Stage 2, see below).

## Why this document exists

Prior sessions closed the Wave 0 §3 driver (anti-theatre R-3 =
"production code imports demo/fixtures") by reaching a scanner-clean
state through regex exemptions and route-group placement. As §16 now
records, that was scanner cleanliness, not semantic isolation. Two
loopholes remained:

1. Next.js route groups `(name)/` do not change URLs. Placing files
   under `app/[locale]/dashboard/(demo)/` and `app/api/cases/[caseId]/(demo)/`
   was a source-organisation convention, not an enforcement boundary.
   Whether those routes rendered was decided at request time by
   `isCupe4373DemoRuntime()`, not by build-time exclusion.
2. The prior R-3 rule only detected `import ... from '...'` and CJS
   `require('...')`. Dynamic `await import('...')` was invisible to
   it, and two operational pages (`dashboard/page.tsx` and
   `dashboard/communications/page.tsx`) used exactly that form to load
   demo modules behind the runtime gate.

The corrective mandate for this session required replacing scanner
compliance with real artifact-level separation. This document records
the change that was actually shipped.

## What changed in this commit

### Scanner (enforcement)

`tooling/reality/anti-theatre-scan.ts`, R-3 rule rewritten:

- New constant `DEMO_ARTIFACT_ROOTS = ['apps/union-eyes-demo/']` — the
  exhaustive list of prefixes that may import demo/fixture modules.
- New helper `isDemoSpecifier(spec)` centralises the pattern list
  (`/demo/`, `/fixtures/`, `/cupe4373-`, `@nzila/*-fixtures`, …).
- Four import-form regexes now run over every scanned file:
  static `from '…'`, bare static `import '…'`, dynamic
  `import('…')` including the `await import(…)` form, and CJS
  `require('…')`.
- Prior `(demo)` route-group and `/demo/` path exemptions removed.
  Only files whose repository path starts with a
  `DEMO_ARTIFACT_ROOTS` entry (plus `__hashfixture__/` and
  `__fixtures__/`) may import demo specifiers.
- R-3 message updated: *"Production code {formName} from a
  demo/fixtures path: `{spec}`. Move the calling file under an
  enumerated demo-artifact root (currently `apps/union-eyes-demo/`)
  or remove the import."*

### Physical relocation (separation)

New workspace member `apps/union-eyes-demo/` created with:

- `package.json` — `@nzila/union-eyes-demo`, private, no runtime
  dependencies wired yet (Stage 2).
- `tsconfig.json` — mirrors the operational app tsconfig with
  `@/*` → `./*` scoped to the demo app root.
- `README.md` — declares this the sole R-3-exempt artifact and
  enumerates outstanding work.

The following files moved from `apps/union-eyes/` into
`apps/union-eyes-demo/`, tracked by git as renames:

| From (under `apps/union-eyes/`) | To (under `apps/union-eyes-demo/`) |
|---|---|
| `app/[locale]/dashboard/(demo)/**` (14 files) | `app/[locale]/dashboard/(demo)/**` |
| `app/api/cases/[caseId]/(demo)/**` (2 files) | `app/api/cases/[caseId]/(demo)/**` |
| `lib/demo/**` (10 files incl. `server/__tests__/`) | `lib/demo/**` |
| `components/demo/**` (17 files) | `components/demo/**` |
| `app/api/__tests__/cases-decision.route.test.ts` | `app/api/__tests__/cases-decision.route.test.ts` |
| `app/api/__tests__/cases-proof-pack.route.test.ts` | `app/api/__tests__/cases-proof-pack.route.test.ts` |
| `scripts/seed-cupe4373-demo.ts` | `scripts/seed-cupe4373-demo.ts` |
| `scripts/seed-cupe4373-members.ts` | `scripts/seed-cupe4373-members.ts` |
| `scripts/smoke-cupe4373-demo-walkthrough.mjs` | `scripts/smoke-cupe4373-demo-walkthrough.mjs` |
| `scripts/smoke-cupe4373-personas.mjs` | `scripts/smoke-cupe4373-personas.mjs` |

### Operational code stripped of demo branches

Four operational files had `isCupe4373DemoRuntime()` branches that
dynamically imported demo modules. Those branches have been removed:

- `apps/union-eyes/app/[locale]/dashboard/page.tsx` — removed the
  demo branch entirely; the page now unconditionally resolves the
  role landing path and redirects.
- `apps/union-eyes/app/[locale]/dashboard/communications/page.tsx` —
  removed the demo branch; the page now always renders the operational
  hub.
- `apps/union-eyes/app/[locale]/dashboard/reports/page.tsx` — the
  page previously rendered *only* demo components. It now returns
  `notFound()` because there is no non-demo reports surface yet. This
  is deliberately honest: the operational app should not pretend to
  have a reports surface when none exists.
- `apps/union-eyes/components/work/work-surface.tsx` — removed the
  demo short-circuit; the operational work surface now always
  renders its tabbed operational content.

Each file carries a `NOTE (Wave 0 §3 — semantic demo isolation)`
block explaining what was removed and why. The
`isCupe4373DemoRuntime` helper itself remains in
`apps/union-eyes/lib/dashboard/role-experience.ts` for the boot-time
guard, but nothing in the operational request path calls it now.

### Verification

- `pnpm reality:anti-theatre` — `0 errors, 1249 warning(s)`. R-3
  count is `0` and is now enforced against the artifact boundary,
  not a regex exemption list.
- `pnpm exec tsc --noEmit` from `apps/union-eyes/` — exit 0. No
  operational typecheck regressions.
- `pnpm install` — completes cleanly with the new demo workspace
  member; no dependency drift.

## What Stage 1 does NOT prove

- **Operational Next.js build has not been re-run** in this commit.
  The Next.js production build (Turbopack) is the authoritative
  test of tree-shaking and code-splitting. Stage 2 must run
  `pnpm build --filter @nzila/union-eyes` and grep the `.next/`
  output for demo strings (`cupe4373`, `/lib/demo/`, `UE_FEATURE_PROFILE`,
  known synthetic case identifiers) expecting zero hits.
- **Demo artifact is not independently built or type-checked.** Its
  `package.json` does not declare `next`, `react`, `@nzila/*` runtime
  dependencies yet. It exists to be the enforcement boundary; making
  it independently buildable is Stage 2.
- **Runtime tests were not executed** for the operational app in
  this session (`pnpm test:fast`, integration, contract). Stage 2
  §5 covers these.
- **Environment identity contract (§4) is unchanged.** Removing the
  `isCupe4373DemoRuntime()` branches from operational request paths
  reduces the surface but does not close §4.

## Stage 2 work (not in this commit)

Tracked in `docs/union-eyes/reality-remediation/` as the
next-session queue:

1. Add `apps/union-eyes-demo/package.json` runtime dependencies
   (`next`, `react`, `react-dom`, `@nzila/platform-auth`, `@nzila/ui`,
   etc.) so `pnpm --filter @nzila/union-eyes-demo typecheck` becomes
   real.
2. Wire `apps/union-eyes-demo/next.config.mjs` and a minimal
   `app/layout.tsx` so the demo app can boot in isolation.
3. Run `pnpm build --filter @nzila/union-eyes` and produce
   `reports/wave0/build-graph-demo-scan.{json,md}` proving the
   operational build output contains no demo strings.
4. Move `apps/union-eyes-demo/scripts/*` behind a proper package
   command; drop them from the operational scripts search path.
5. Add scanner unit tests for R-3 (static / dynamic / CJS /
   artifact-root exemption).
6. Close §4 environment identity contract by consolidating the two
   demo-deployment-guard implementations
   (`tooling/reality/demo-deployment-guard.ts` and
   `apps/union-eyes/lib/reality/demo-deployment-guard.ts`).
7. Execute §5 validation runs (full test suites, dependency scans,
   Trivy container scan, SBOM).

## References

- §16 `16_ANTI_THEATRE_BASELINE.md` — updated with the honest R-3
  post-relocation number.
- §17 `17_VALIDATION_MATRIX.md` — updated with the artifact-level
  R-3 verdict.
- §19 `19_AUTHORIZATION_VIOLATION.md` — the record that motivated
  the correction to scanner-only cleanliness.
