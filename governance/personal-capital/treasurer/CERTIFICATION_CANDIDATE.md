# TREASURER certification candidate

This file is the freeze marker. Further implementation is not part of this candidate.

`TREASURER_CERTIFICATION_CANDIDATE_SHA` is the commit that updates this file on `feat/treasurer-fleet-agent`:

```
git log -1 --format=%H -- governance/personal-capital/treasurer/CERTIFICATION_CANDIDATE.md
```

That SHA is also recorded in the pull request body after the commit is pushed. Do not treat a later SHA as this candidate.

## Invalidated candidate

Independent Fleet REDTEAM returned `RED_TEAM_PASS: NO` on `eef575eec5600a28c041126785490e0f79d42b19`. That SHA is INVALID for certification. It is not this candidate.

| Field | Value |
| --- | --- |
| OLD_CANDIDATE_SHA | `eef575eec5600a28c041126785490e0f79d42b19` |
| OLD_CANDIDATE_STATUS | INVALID |
| FLEET_REDTEAM_ON_OLD | NO |
| RECORD_KIND | IMPLEMENTER_ASSESSMENT |
| TREASURER_CERTIFIED | NO |
| FLEET_CERTIFIED | NO |

## Lineage

| Field | Value |
| --- | --- |
| OLD_BRANCH | `cursor/treasurer-fleet-agent-2c38` |
| OLD_PR | https://github.com/anungis437/nzila-os/pull/859 (closed) |
| NEW_BRANCH | `feat/treasurer-fleet-agent` |
| NEW_PR | https://github.com/anungis437/nzila-os/pull/860 |
| VERIFIER_NO_SHA | `5f25a566f8a66e61eb468abcf72346cff952c21f` |
| PARENT_BEFORE_THIS_FREEZE | `eef575eec5600a28c041126785490e0f79d42b19` |
| BASE | `e85bc288703e0e48369704f7d45494a6efb8d69e` |

## Remediations in this candidate

1. `reportToNorthstar` requires `validateSnapshot`. `availableDeployableClass` is FACT only when validation succeeds and cash is FACT. The caller flag `snapshotIsFreshFact` is gone. A forged snapshot cannot yield FACT deployable capacity.
2. `recordExternalConfirmation` requires stage `AUTHORIZED` and `investmentAuthorized`. Confirmation does not set `humanAuthorized`, `investmentAuthorized`, or `transactionExecuted`. Fail-closed was chosen, so there is no independence limitation.
3. Related series that share an instrument stem are clustered across caller `exposureGroupId` values. Known corporate product tokens and compact forms are refused on PERSONAL snapshots, including ids that lack `corp:`, `product:`, `nzila-product:`, or `org:` prefixes.
4. Accepted limitations add `NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING` and `NO_ISSUER_REGISTRY_RELATED_ASSETS`. The prior five limitations remain.
5. The local catalog may record disposition `OPEN`. Honesty does not fail the package gate. Material OPEN findings still block fleet certification claims. Local `RED_TEAM_PASS` is NO while `unrelated-id-concentration-split` is OPEN.

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
| INDEPENDENT_FLEET_REDTEAM | NO on the invalidated SHA. Not claimed YES on this candidate. Not re-commissioned by the implementer. |
| LOCAL_RED_TEAM | RED_TEAM_PASS NO. RESOLVED attacks blocked. OPEN residual remains. |

Canonical artifacts: `governance/personal-capital/treasurer/certification-record.json` and `TREASURER_CERTIFICATION_RECORD.md`. Neither assigns `TREASURER_CERTIFIED: YES` or `FLEET_CERTIFIED: YES`.

## Accepted limitations

| Id | Status |
| --- | --- |
| NO_LIVE_CUSTODIAN_OR_MARKET_DATA | accepted |
| NO_TAX_COMPUTATION | accepted |
| PEER_AGENTS_ARE_BOUNDARIES_NOT_RUNTIMES | accepted |
| NO_PRODUCTION_DEPLOYMENT | accepted |
| NO_CORPORATE_ACTION_ADJUSTMENT | accepted |
| NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING | accepted |
| NO_ISSUER_REGISTRY_RELATED_ASSETS | accepted residual. BLOCKS fleet certification claims. Distinct instrument strings for one economic issuer are not clustered. A well-formed external fact can still be analyzed. |

## Local commands on this freeze tree

| Command | Exit | Scope |
| --- | --- | --- |
| `pnpm --filter @nzila/treasurer typecheck` | 0 | this freeze tree, before commit |
| `pnpm --filter @nzila/treasurer exec vitest run` | 0 | 11 files, 50 tests |
| `pnpm --filter @nzila/treasurer materialize` | 0 | certification record and local red-team report |
| `pnpm lint` | NOT_RUN on this SHA | last run was parent `61f519cec`, exit 0, 171/171 |
| `pnpm typecheck` | NOT_RUN on this SHA | last run was parent `61f519cec`, exit 0, 237/237 |
| `pnpm test:fast` | NOT_RUN on this SHA | parent `61f519cec` exit 1: 2 Union Eyes docker postgres tests, docker absent; 2162 files passed; 29587 tests passed |
| `pnpm governance:audit` | NOT_RUN on this SHA | parent `61f519cec` exit 0 |
| `pnpm secret-scan` | NOT_RUN | `gitleaks` is not installed in this session |
| Trivy | NOT_RUN locally | no trivy binary invoked here |

Do not read parent monorepo exits as results for this candidate SHA.

## CI

CI for this freeze commit is NOT_RUN until GitHub finishes the push. Trivy SARIF upload remains a Principal/infrastructure blocker on the prior SHA: `Code scanning is not enabled for this repository.` Blocking vulnerability scan steps on that SHA succeeded. SCAN_FINDINGS: none observed on the prior SHA. SCAN_EXECUTION_FAILURE: SARIF publication.

## What this candidate does not claim

- Independent Fleet REDTEAM has not returned YES.
- Independent VERIFIER has not returned YES.
- MERGE_AUTHORIZED is NO. Do not merge.
- Package-local IMPLEMENTER_PASS is not FLEET_CERTIFIED.
- LOCAL_RED_TEAM is not Fleet REDTEAM and is not FLEET_CERTIFIED.
- PACKAGE_TESTS pass is not FLEET_CERTIFIED.
- VERIFIER NO implies TREASURER_CERTIFIED NO.
- The OPEN residual is not marked resolved.
