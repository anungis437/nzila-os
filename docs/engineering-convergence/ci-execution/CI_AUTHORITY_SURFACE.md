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
| `Merge Authority / Affected Build` | `build` (`turbo run build --affected`) |
| `Merge Authority / Architectural Contracts` | `contract-tests` |
| `Merge Authority / Repository Inventory` | `repository-inventory` |
| `Merge Authority / Governance Integrity` | `governance-integrity` |
| `Merge Authority / Hash Chain Integrity` | `hash-chain-drift` |
| `Merge Authority / Operating Layer` | `operating-layer-gate` |

Direct secret contexts, unchanged: `Gitleaks`, `TruffleHog OSS`, `Docker Secret Policy`.

`Merge Authority / Affected Build` is affected closure only. `PORTFOLIO_BUILD_AUTHORITY` stays unresolved. Unit tests do not retire `pnpm test:fast`. `TEST_FAST_SUBSET` stays unresolved. `E2` stays blocked.

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

An empty change set or any path that is not proven irrelevant is `REQUIRES_EXECUTION`. Secret safety stays applicable for every pull request.

When CI will run, the reporter waits for the source jobs. When CI `paths-ignore` skips the workflow, proven-irrelevant contexts publish `NOT_APPLICABLE`. Applicable governance integrity and inventory locks execute in the Merge Authority workflow. Any other applicable invariant that CI will not run publishes `UNRESOLVED` failure. A skipped job is not `NOT_APPLICABLE` unless the classifier already proved that invariant irrelevant.

## Conditional residual

`CONDITIONAL_AUTHORITY_RESIDUAL`

These jobs are not canonical contexts in this change: `IaC Security Scan`, `ML Tooling Gates`, `Ops Documentation Pack`, `AI Eval Gate`. They stay path- or workflow-scoped inside CI. Ruleset activation is not authorized while they remain outside the authority surface.

## Ruleset

This change does not activate `main-merge-authority` and does not modify Reliability Guard.
