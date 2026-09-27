# TREASURER certification candidate

This file is the freeze marker. Further implementation is not part of this candidate.

`TREASURER_CERTIFICATION_CANDIDATE_SHA` is the commit that adds this file on `feat/treasurer-fleet-agent`:

```
git log -1 --format=%H -- governance/personal-capital/treasurer/CERTIFICATION_CANDIDATE.md
```

That SHA is also recorded in the pull request body after the commit is pushed. Do not treat a later SHA as this candidate.

## Lineage

| Field | Value |
| --- | --- |
| OLD_BRANCH | `cursor/treasurer-fleet-agent-2c38` |
| OLD_PR | https://github.com/anungis437/nzila-os/pull/859 (closed) |
| NEW_BRANCH | `feat/treasurer-fleet-agent` |
| NEW_PR | https://github.com/anungis437/nzila-os/pull/860 |
| VERIFIER_NO_SHA | `5f25a566f8a66e61eb468abcf72346cff952c21f` |
| PARENT_BEFORE_FREEZE | `61f519cec6fdc347bb38a2212ca0b0a9c5076b24` |
| BASE | `e85bc288703e0e48369704f7d45494a6efb8d69e` |

## Authority

| Field | Value |
| --- | --- |
| RECORD_KIND | IMPLEMENTER_ASSESSMENT |
| IMPLEMENTER_ASSESSMENT | IMPLEMENTER_PASS under package-local gates |
| FLEET_CERTIFIED | NO |
| TREASURER_CERTIFIED | NO |
| PRODUCTION_AUTHORITY | NO |
| FINANCIAL_TRANSACTION_AUTHORITY | NEVER |
| MERGE_AUTHORIZED | NO |
| INDEPENDENT_VERIFIER | NO on PR #859. Not re-commissioned by the implementer. |

Canonical artifacts: `governance/personal-capital/treasurer/certification-record.json` and `TREASURER_CERTIFICATION_RECORD.md`. Neither assigns `TREASURER_CERTIFIED: YES` or `FLEET_CERTIFIED: YES`.

## Local commands

Authoritative monorepo commands were run on parent `61f519cec` after `pnpm install --frozen-lockfile --ignore-scripts`. An earlier lint and typecheck exited 2 on a pruned install and were re-run.

| Command | Exit | Scope |
| --- | --- | --- |
| `pnpm --filter @nzila/treasurer typecheck` | 0 | re-run on the freeze tree before commit |
| `pnpm --filter @nzila/treasurer exec vitest run` | 0 | 11 files, 49 tests, including fleet contracts and cert-authority tests |
| `pnpm --filter @nzila/executive-os exec vitest run src/agents/treasury.test.ts` | 0 | parent SHA |
| `pnpm --filter @nzila/doctrine-enforcement test` | 0 | 12 tests, parent SHA |
| capital-allocation + capital-engine-v2 contract tests | 0 | 10 tests, parent SHA |
| `pnpm lint` | 0 | 171/171, parent SHA |
| `pnpm typecheck` | 0 | 237/237, parent SHA |
| `pnpm test:fast` | 1 | parent SHA. 2 failed, 2162 passed, 8 skipped. 29587 tests passed |
| `pnpm governance:audit` | 0 | parent SHA. Generated report churn was not committed |
| `pnpm inventory:generate` | 0 | freeze tree. `tsTestFileCount` 2699 after the fleet contract test is tracked |
| `pnpm secret-scan` | NOT_RUN | `gitleaks` is not installed in this session |
| Trivy | NOT_RUN locally | no trivy binary invoked here |

`pnpm test:fast` failures: `apps/union-eyes/scripts/__tests__/apply-rls-foundation-migration.postgres.test.ts` and `p4-authority-state.postgres.test.ts`. Docker start status was null. `docker` is not installed here. Those paths are unchanged versus `e85bc2887`. This is not a TREASURER assertion failure. CI Unit Tests on `61f519cec` passed.

## CI classification at parent `61f519cec` (PR #860)

Point-in-time snapshot while Lint & Typecheck was still pending. Classifications use the required labels.

| Check | Result | Class | Evidence |
| --- | --- | --- | --- |
| branch-policy | PASS | remediated TREASURER_CAUSED | `cursor/*` failed `validate-branch-tag-policy` on #859. `feat/treasurer-fleet-agent` passes. |
| Repository Inventory | PASS | remediated TREASURER_CAUSED | Counts now include `packages/treasurer`. No inventory exception was added. |
| Secret Scan (both jobs) | PASS | remediated CI_INFRASTRUCTURE | #859 failed with HTTP 403 on `GET pulls/859/commits` (`x-accepted-github-permissions: pull_requests=read`). Standalone Gitleaks and TruffleHog OSS passed. No secret material in the TREASURER diff. Same 403 class failed on PR #858 before this package existed. Governance job now requests `pull-requests: read`. SCAN_FINDINGS: none. SCAN_EXECUTION_FAILURE: cleared on #860. |
| Governance Gate (both) | PASS | cascade of the secret-scan execution failure, now clear | Gate log on #859 exited because secret scan was `failure`. |
| Trivy filesystem, monorepo, orchestrator, Governance Baseline Trivy | FAIL | CI_INFRASTRUCTURE, not TREASURER_CAUSED | Blocking vulnerability scan steps succeeded. Failing step is SARIF upload: `Code scanning is not enabled for this repository.` PR #858 failed the same four jobs before TREASURER. Main push workflow `Container Security Scan (Trivy)` run `36044332853` succeeded; push upload does not take the pull-request code-scanning path. SCAN_FINDINGS: none observed. SCAN_EXECUTION_FAILURE: SARIF publication. |
| Unit Tests | PASS | n/a | Completed on #860. |
| Lint & Typecheck | pending at snapshot | NOT_RUN in CI | Local `pnpm lint` and `pnpm typecheck` exited 0 on the parent. |
| E2E · union-eyes | no longer pending or failing at the later snapshot | n/a | Not a TREASURER suite. |

CI for the freeze commit itself is NOT_RUN until GitHub finishes the push. Do not read parent CI as a result for the candidate SHA.

## What this candidate does not claim

- Independent VERIFIER has not returned YES.
- MERGE_AUTHORIZED is NO. Do not merge.
- Package-local IMPLEMENTER_PASS is not FLEET_CERTIFIED.
- LOCAL_RED_TEAM pass is not FLEET_CERTIFIED.
- PACKAGE_TESTS pass is not FLEET_CERTIFIED.
- VERIFIER NO implies TREASURER_CERTIFIED NO.
