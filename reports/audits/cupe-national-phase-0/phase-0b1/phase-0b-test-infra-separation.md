# Phase 0B.1 — Test Infrastructure Separation

**Status:** ✅ **DOCUMENTED** — the 255-file repo-wide test-infra sweep
in commit `1e5a6bd94` is classified as *Unrelated* to Phase 0B on the
clean branch (see [phase-0b-commit-disposition.md](phase-0b-commit-disposition.md)).

## What the sweep did

`1e5a6bd94` — "Phase 0B: repo-wide test infrastructure recovery"
touched 255 files:

- 248 × `packages/**/vitest.config.ts` files — added / normalised
  `test.include`, `test.exclude`, `passWithNoTests: true`, per-package
  timeouts, and hoisted mocks.
- 1 × `scripts/audit/*.ps1` — the audit harness that produced the
  Phase 0B conflict log.
- 6 × individual test files — regressions the sweep uncovered.

## Why it was conflated with Phase 0B originally

The sweep was required to make **any** package's test suite runnable on
the developer machine at the moment Phase 0B evidence collection began
(vitest's `projects: [...]` inheritance from the root config was
producing spurious `packages/<pkg>/apps/...` include errors — see the
user-memory note on Vitest Execution). Because Phase 0B's audit scripts
depend on those test suites executing without erroring, the sweep was
committed under the Phase 0B banner.

## Why it does not belong on the Phase 0B clean branch

- It changes 248 files that have no code relationship to the organization
  contract, the platform tenant resolver, migration 0038, or the KPI
  schema change. Reviewer cannot bound the change to Phase 0B intent.
- It is not required to make the *Phase 0B code* under review compile or
  test. Only 6 of those 248 vitest configs (at most) belong to packages
  actually touched by Phase 0B. The other ~242 would be re-litigated on
  every future PR that touches an unrelated package.
- It masks a governance signal: a Phase 0B commit that touches ~250
  package configs is indistinguishable from a repo-wide sweep with a
  misleading commit message.

## Separation policy for the clean branch

The clean branch `fix/union-eyes-phase0b-clean` accepts a vitest config
change **only** when:

1. The package under change is directly touched by another Phase 0B
   commit on the same branch (the package's `src/**` files appear in the
   Direct/Supporting inventory in the disposition doc), AND
2. The vitest config change is the narrowest possible correction to make
   that package's Phase 0B tests execute correctly, AND
3. The commit that carries the vitest change also carries the Phase 0B
   test/source it exists to support.

## Successor branch

The remaining 242 vitest configs from `1e5a6bd94` (plus the 1 audit script
and 6 individual test files) are documented as belonging on a separate
future branch, tentatively `chore/test-infrastructure-stabilization`.
That branch is **out of scope for Phase 0B.1** and requires its own
governance review — it is not authorised as a side-effect of Phase 0B.1.

## Historical branch preservation

`1e5a6bd94` remains as-is on `fix/union-eyes-reality-remediation`. It is
not rewritten, split, or reverted. The commit's existence is preserved as
a record of what was actually pushed; only its future re-application is
constrained to the successor branch.
