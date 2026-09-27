# CI authority surface

Architecture B stays. Existing jobs implement validation. Canonical `Merge Authority / ...` checks publish the merge contract. This remediation adds the merge-critical contexts Command found missing. It does not require the whole CI workflow or the mixed Governance Gates job.

## Canonical contexts

| Context | Source job |
| --- | --- |
| `Merge Authority / Lint & Typecheck` | `lint-and-typecheck` |
| `Merge Authority / Unit Tests` | `test` (`pnpm test:coverage`) |
| `Merge Authority / Schema Integrity` | `schema-drift` |
| `Merge Authority / PostgreSQL RLS` | `sage-postgres-concurrency` |
| `Merge Authority / Migration Chain` | `sage-live-postgres` |
| `Merge Authority / Affected Build` | `build` (`turbo run build --affected`, or `pnpm build` when the diff is not package-scoped) |
| `Merge Authority / Architectural Contracts` | `contract-tests` |
| `Merge Authority / Repository Inventory` | `repository-inventory` |
| `Merge Authority / Governance Integrity` | `governance-integrity` |
| `Merge Authority / Hash Chain Integrity` | `hash-chain-drift` |
| `Merge Authority / Operating Layer` | `operating-layer-gate` |
| `Merge Authority / IaC Security` | `iac-scan` (`CHANGE_CONDITIONAL_MERGE_CRITICAL`) |
| `Merge Authority / Ops Documentation` | `ops-pack-validation` (`CHANGE_CONDITIONAL_MERGE_CRITICAL`) |

Direct secret contexts, unchanged: `Gitleaks`, `TruffleHog OSS`, `Docker Secret Policy`.

`Merge Authority / Affected Build` runs `turbo run build --affected` when every relevant path sits inside a pnpm workspace package. Lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `bun.lock`, `bun.lockb`), `turbo.json` / `turbo.jsonc`, `pnpm-workspace.yaml`, root `package.json`, root `.npmrc`, and any other path that is not inside a workspace package and is not proven documentation force `pnpm build` (`turbo build`, the same portfolio command Reliability Guard already runs). Proven documentation stays not applicable. Unknown paths are not not-applicable. An empty diff or an unreadable SCM base also runs `pnpm build`.

On turbo 2.9.14, a diff that only touches `pnpm-lock.yaml`, root `package.json`, `pnpm-workspace.yaml`, `.npmrc`, or another non-package path makes `--affected` select `//` and schedule 0 build tasks. `turbo.json` currently schedules the full build task graph; Build All still runs `pnpm build` for it so the result does not depend on that global-trigger behavior. Package-scoped affected closure still does not build the whole portfolio, so `PORTFOLIO_BUILD_AUTHORITY` stays unresolved. Unit tests do not retire `pnpm test:fast`. `TEST_FAST_SUBSET` stays unresolved. `E2` stays blocked. Reliability Guard is unchanged, including its `pnpm build`.

## Auth boundary

PostgreSQL RLS is database row-access enforcement. Auth authority is the application and platform authorization-truth check inside Governance Integrity (`scripts/validate-auth-authority.ts`). A passing RLS context does not prove auth authority, and a passing Governance Integrity context does not prove row-level security.

## Governance Integrity steps

Included:

- Script alias regression guard
- Governance fail-closed gate
- Evidence lifecycle policy gate
- Truth authority validation
- Auth authority validation
- GA state machine validation
- Workspace dependency integrity
- Control manifest validation

Left in Governance Gates and outside this authority context: tier focus labels, maturity summary, GA gate check, DORA, cost attribution, onboarding KPIs, strategic resilience, runtime data residency, release strict validation, platform proof generation, proof artifact verification, runtime budget, and the report upload. The embedded contract-test step and the inventory lock also remain in Governance Gates. Authority uses the standalone contract-test job and the dedicated inventory job. Removing the embedded copies is a later deduplication, not this change.

## Classifier

Applicability is per invariant.

- Engineering (lint, unit tests, schema, RLS, migration chain, affected build) is `NOT_APPLICABLE` only for a proven documentation path.
- Governance Integrity stays applicable for `docs/categories/platform-and-operations/`, `governance/`, `tooling/governance/`, and the validator scripts themselves. Other proven documentation can be irrelevant to it.
- Repository Inventory stays applicable for `apps/`, `packages/`, `services/`, `tooling/`, and `.github/workflows/`, because those inputs change the committed inventory.
- Architectural contracts stay applicable for anything that is not proven documentation, and for `tooling/contract-tests/`.
- Hash chain stays applicable for `packages/db/`, `migrations/`, and hash-chain paths.
- Operating layer stays applicable for console, control-plane, orchestrator-api, and other application or package code.
- IaC Security and Ops Documentation are change-conditional. A documentation-only classification does not decide them.

An empty change set or any path that is not proven irrelevant is `REQUIRES_EXECUTION`. Secret safety stays applicable for every pull request. Unknown does not become `NOT_APPLICABLE`.

When CI will run, the reporter waits for the source jobs, including `iac-scan` and `ops-pack-validation`. It does not wait on the CI workflow as a whole, and it does not re-run those validators. When CI `paths-ignore` skips the workflow, proven-irrelevant contexts publish `NOT_APPLICABLE`. Applicable governance integrity, inventory, IaC Security, and Ops Documentation execute in the Merge Authority workflow, using the same validation commands as CI. Any other applicable invariant that CI will not run publishes `UNRESOLVED` failure. A skipped job is not `NOT_APPLICABLE` unless the classifier already proved that invariant irrelevant.

## IaC applicability

Source job: `IaC Security Validation` (`iac-scan`). Command: `checkov --directory infrastructure/bicep --framework bicep`, with the existing `CKV_AZURE_99`, `CKV_AZURE_139`, `CKV_AZURE_163`, `CKV_AZURE_166`, and `CKV_AZURE_189` skips. The Checkov bicep runner collects files with `rglob("*.bicep")` only.

The merge-critical result is that Checkov process. `IaC SARIF Reporting` is evidence-only. It does not feed `Merge Authority / IaC Security`. When GitHub code scanning is not enabled, that job records `SARIF_REPORTING = NOT_CONFIGURED` and does not call `upload-sarif`. A reporting failure stays visible on `IaC SARIF Reporting` and cannot change the Checkov result. The CI-skip fast path runs the same Checkov command and does not upload SARIF.

Applicable:

- `infrastructure/bicep/**/*.bicep`
- Checkov configs the invocation loads if present: `infrastructure/bicep/.checkov.yaml`, `infrastructure/bicep/.checkov.yml`, `.checkov.yaml`, `.checkov.yml`
- Files that change the scan or the authority execution: `.github/workflows/ci.yml`, `.github/workflows/merge-authority.yml`, `tooling/ci/merge-authority/surface.mjs`, `tooling/ci/merge-authority/publish.mjs`

Proven not consumed, so `NOT_APPLICABLE` on the fast path:

- `.bicepparam` (the runner does not parse it)
- `*.bicep` outside `infrastructure/bicep/`, including `apps/union-eyes/infra/`, `apps/abr/infra/`, and `tech-repo-scaffold/`
- Markdown, because the runner does not read it
- Other files under known non-input trees (`apps/`, `packages/`, `services/`, `tooling/` except the authority files above, `ops/`, `infrastructure/` except scanned bicep and the Checkov configs)

`docs/**` files that are not markdown stay `REQUIRES_EXECUTION`. CI `paths-ignore` skips those paths, and the fast path runs the same Checkov command. It does not publish `NOT_APPLICABLE` because CI skipped.

When the scan runs: success is `PASS`, failure is `FAILURE`, and cancelled, missing, or an unexpected skip is non-success.

## Ops pack applicability

Source job: `Ops Documentation Pack`. Command: `pnpm tsx tooling/ops/validate-ops-pack.ts`. The validator reads only:

- `ops/runbooks/README.md`
- `ops/oncall/README.md`
- `ops/incident-response/README.md`
- `ops/disaster-recovery/README.md`
- `ops/business-continuity/README.md`
- `ops/compliance/README.md`
- `ops/change-management/README.md`
- `ops/security-operations/README.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `reports/ops/snapshot.json`

Tooling that can change that check is also applicable: `tooling/ops/validate-ops-pack.ts`, `.github/workflows/ci.yml`, `.github/workflows/ops-pack.yml`, `.github/workflows/merge-authority.yml`, and the merge-authority classifier and publisher.

Other operational notes, including `ops/runbooks/security/keyvault-rotation.md`, are not inputs. A generic documentation-only label does not decide this invariant.

`ARCHITECTURE.md`, `SECURITY.md`, and the required ops indexes are markdown, so CI `paths-ignore` skips the CI workflow. The Merge Authority fast path runs the same validator. A code pull request that already runs `ops-pack-validation` does not run it again.

When validation runs: success is `PASS`, failure is `FAILURE`, and cancelled, missing, or an unexpected skip is non-success.

## Accepted residuals

`ML_TOOLING_AUTHORITY = ACCEPTABLE_RESIDUAL`

`AI_EVAL_AUTHORITY = ACCEPTABLE_RESIDUAL`

`ML Tooling Gates` and `AI Eval Gate` stay outside the canonical surface. This change does not promote them.

Still unresolved, and not silently closed:

`PORTFOLIO_BUILD_AUTHORITY = UNRESOLVED`

`TEST_FAST_SUBSET = UNRESOLVED`

`E2 = BLOCKED`

## Ruleset

This change does not activate a ruleset, does not enable required status checks, does not add a bypass actor, and does not modify branch protection or Reliability Guard. `default` stays disabled.

`RULESET_SURFACE_READY = YES`

That is a structural assessment for Command. It is not ruleset activation. The 13 canonical contexts fail closed, the 3 secret contexts stay authoritative, IaC and Ops applicability are per invariant, a CI skip cannot waive either, and unknown classifications do not pass. `ML_TOOLING_AUTHORITY` and `AI_EVAL_AUTHORITY` remain accepted non-blocking residuals.
