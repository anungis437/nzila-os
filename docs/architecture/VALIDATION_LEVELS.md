# Validation levels

**Status:** policy change proposed with the Tool Fabric convergence PR; reviewed by
`@nzila/eng` through that PR. Reverting this one document and the matching
[lefthook.yml](../../lefthook.yml) hunks restores the previous local behavior.

Engineering velocity and release authority are separate. Cheap checks run on every
meaningful change. Expensive repository-wide qualification runs once per final
candidate SHA on suitable infrastructure and is rerun only when its inputs change.
No rule, exception expiry, test or required CI check is weakened by this policy.

| Level | Validation | When | Where |
| --- | --- | --- | --- |
| 1. Development | Staged-file lint, typecheck of packages with staged TypeScript files, focused tests, secret scan, brand/boundary check, link check, inventory consistency, changed contract tests | Every commit/push | Local hooks ([lefthook.yml](../../lefthook.yml)) |
| 2. PR qualification | Full lint, sharded affected-or-full typecheck, unit/coverage tests, contract tests, governance gates, secret/IaC/dependency scans, build | Once per candidate SHA; rerun only when invalidated | CI ([ci.yml](../../.github/workflows/ci.yml)) |
| 3. Release | Human approval, deployment and security gates, production evidence | Before merge/deployment where required | Merge authority and release workflows |

## What changed locally

| Hook | Before | After |
| --- | --- | --- |
| `typecheck-staged` | `--filter "...[HEAD]"`: changed packages **and every dependent** (any change to a shared package such as `os-core`, or to a root-level file, selected the whole 261-package workspace) | [typecheck-changed.mjs](../../scripts/typecheck-changed.mjs): only packages containing staged TypeScript files, one task at a time, building upstream dependencies through Turbo cache so declarations exist on a fresh checkout |
| `contract-tests` (pre-push) | Entire contract suite, ~300 files, every push | Contract test files added or changed by the push |

Unchanged: `gitleaks --staged`, staged lint, brand-leakage, link-check and
inventory-sync. `--no-verify`, local skip overrides and waivers remain prohibited.

## What stays mandatory

Dependents of a changed package are still typechecked, and the complete contract
suite still runs, as required CI jobs on the pull request. CI uses
[run-affected-typecheck.sh](../../tooling/ci/run-affected-typecheck.sh), which proves
an affected closure or falls back to the full workspace, with Turbo caching. A
zero-task result is not a pass. Full gates remain required before merge wherever
repository governance mandates them.

Receipt reuse: Turbo task inputs ([turbo.json](../../turbo.json)) key cached
lint/typecheck/test results. A receipt is reusable only while its source tree,
dependency lockfile and validation command are unchanged; otherwise it is rerun.

## Baseline debt and prospect delivery

Pre-existing baseline failures (for example expired governance exceptions on `main`)
are classified separately from defects introduced by a change and are resolved
through the established exception-approval process. They do not stop unrelated
product work. Tool Fabric remains an unmerged internal platform dependency; its
closed installation/execution posture does not restrict development of CORA,
Union Eyes, CIVIC or other products within their own governance boundaries.

## Local commands

```text
node scripts/typecheck-changed.mjs    # level 1 (what the hook runs)
pnpm typecheck                        # full workspace; normally left to CI
pnpm contract-tests                   # full contract suite; normally left to CI
```
