# TREASURER certification candidate

This file is the freeze marker. Further implementation is not part of this candidate.

`TREASURER_CERTIFICATION_CANDIDATE_SHA` is the commit that updates this file on `feat/treasurer-fleet-agent`:

```
git log -1 --format=%H -- governance/personal-capital/treasurer/CERTIFICATION_CANDIDATE.md
```

That SHA is also recorded in the pull request body after the commit is pushed. Do not treat a later SHA as this candidate.

## Invalidated candidates

| SHA | Status |
| --- | --- |
| `eef575eec5600a28c041126785490e0f79d42b19` | INVALID. Fleet REDTEAM `RED_TEAM_PASS: NO`. |
| `28ac10067df4fd571a87d0119b0f86e88b2f4175` | INVALID. Fleet REDTEAM verified the prior remediations CLOSED and returned `RED_TEAM_PASS: NO` because `unrelated-id-concentration-split` was OPEN. |

## Lineage

| Field | Value |
| --- | --- |
| BRANCH | `feat/treasurer-fleet-agent` |
| PR | https://github.com/anungis437/nzila-os/pull/860 |
| CLOSED_PREDECESSOR | https://github.com/anungis437/nzila-os/pull/859 |
| VERIFIER_NO_SHA | `5f25a566f8a66e61eb468abcf72346cff952c21f` |
| PARENT_BEFORE_THIS_FREEZE | `28ac10067df4fd571a87d0119b0f86e88b2f4175` |
| BASE | `e85bc288703e0e48369704f7d45494a6efb8d69e` |

## Remediation in this candidate

Distinct instrument ids are not treated as independent for concentration unless each holding carries hashed external issuer evidence (`kind: ISSUER`, instrument id, issuer id, content hash). Absence fails closed with `CONCENTRATION_UNPROVEN`. The same evidenced issuer id is clustered across caller `exposureGroupId` values and checked against the group ceiling. Caller grouping alone cannot assert that AAA and BBB are within ceilings.

Prior remediations stay in force: NORTHSTAR `validateSnapshot`, fail-closed external confirmation, stem clustering, ambiguous corporate ids, `NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING`, and local OPEN honesty.

The certification field `TREASURER_RED_TEAM` is renamed to `RESOLVED_ATTACKS_BLOCKED`. That field is not `RED_TEAM_PASS` and it is not Fleet REDTEAM.

## Authority

| Field | Value |
| --- | --- |
| RECORD_KIND | IMPLEMENTER_ASSESSMENT |
| IMPLEMENTER_ASSESSMENT | IMPLEMENTER_PASS under package-local gates |
| RESOLVED_ATTACKS_BLOCKED | PASS (resolved local attacks blocked; not Fleet REDTEAM) |
| LOCAL_RED_TEAM | catalog `RED_TEAM_PASS: YES` because no attack disposition is OPEN. This is not Fleet REDTEAM. |
| FLEET_CERTIFIED | NO |
| TREASURER_CERTIFIED | NO |
| PRODUCTION_AUTHORITY | NO |
| FINANCIAL_TRANSACTION_AUTHORITY | NEVER |
| MERGE_AUTHORIZED | NO |
| INDEPENDENT_VERIFIER | NO on PR #859. Not re-commissioned by the implementer. |
| INDEPENDENT_FLEET_REDTEAM | NO on `28ac10067`. Not claimed YES on this candidate. Not re-commissioned by the implementer. |

Canonical artifacts: `governance/personal-capital/treasurer/certification-record.json` and `TREASURER_CERTIFICATION_RECORD.md`. Both keep TREASURER_CERTIFIED at NO and FLEET_CERTIFIED at NO.

## Accepted limitations

| Id | Status |
| --- | --- |
| NO_LIVE_CUSTODIAN_OR_MARKET_DATA | accepted |
| NO_TAX_COMPUTATION | accepted |
| PEER_AGENTS_ARE_BOUNDARIES_NOT_RUNTIMES | accepted |
| NO_PRODUCTION_DEPLOYMENT | accepted |
| NO_CORPORATE_ACTION_ADJUSTMENT | accepted |
| NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING | accepted |
| RELATEDNESS_REQUIRES_ISSUER_EVIDENCE | accepted. Absence of issuer evidence fails closed. `unrelated-id-concentration-split` is RESOLVED. There is no live issuer registry, so a forged issuer fact that declares two instruments unrelated is not rejected by a registry lookup. |

`NO_ISSUER_REGISTRY_RELATED_ASSETS` is removed. It left the split attack OPEN. It is not an accepted limitation of this candidate.

## Local commands on this freeze tree

| Command | Exit | Scope |
| --- | --- | --- |
| `pnpm --filter @nzila/treasurer typecheck` | 0 | this freeze tree, before commit |
| `pnpm --filter @nzila/treasurer exec vitest run` | 0 | 11 files, 51 tests |
| `pnpm --filter @nzila/treasurer materialize` | 0 | certification record and local red-team report |
| `pnpm lint` | NOT_RUN on this SHA | |
| `pnpm typecheck` | NOT_RUN on this SHA | |
| `pnpm test:fast` | NOT_RUN on this SHA | |
| `pnpm governance:audit` | NOT_RUN on this SHA | |
| `pnpm secret-scan` | NOT_RUN | `gitleaks` is not installed in this session |
| Trivy | NOT_RUN locally | |

Do not read earlier monorepo exits as results for this candidate SHA.

## CI

CI for this freeze commit is NOT_RUN until GitHub finishes the push. Trivy SARIF upload remains a Principal/infrastructure blocker from earlier SHAs: code scanning is not enabled for this repository.

## What this candidate does not claim

- Independent Fleet REDTEAM has not returned YES.
- Independent VERIFIER has not returned YES.
- MERGE_AUTHORIZED is NO. Do not merge.
- Package-local IMPLEMENTER_PASS is not FLEET_CERTIFIED.
- Local catalog `RED_TEAM_PASS` is not Fleet REDTEAM and is not FLEET_CERTIFIED.
- `RESOLVED_ATTACKS_BLOCKED` is not `RED_TEAM_PASS` and is not Fleet REDTEAM.
- PACKAGE_TESTS pass is not FLEET_CERTIFIED.
- VERIFIER NO implies TREASURER_CERTIFIED NO.
