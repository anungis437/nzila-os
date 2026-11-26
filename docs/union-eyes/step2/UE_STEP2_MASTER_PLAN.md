# Union Eyes V2 Step 2 master plan

S2.00 freezes the programme. It does not merge, deploy, or change a gate.

`STEP_2_PLANNING_COMPLETE = YES`

`STEP_2_ENGINEERING_COMPLETE = NO`

`STEP_2_ACCEPTED = NO`

`STAGING_GO = HELD`

`PRODUCTION_GO = HELD`

`UE_SAAS_OPERATIONAL_READINESS = NO_GO`

`fullReadiness = NOT_YET_PROVEN`

Phase 3B is not started. Financial Officer 2.1 stays out of scope. The machine-readable contracts are the acceptance register, the action-authority matrix and the work breakdown in this directory. This page is the programme narrative. It does not replace those files.

## Baseline

Accepted Step 1 source: `b00a3624619be09aa77cd201fa7fe8a8c16b21f3` on draft PR #1309. During S2.00 that commit was `HEAD` of `fix/ue-private-document-delivery`, the pull request was open and draft, and `git merge-base --is-ancestor` showed it is not on `origin/main`. `origin/main` was `97cd90fb029af07dbfcbf4455c1068acfd6e1cb8` (`Merge pull request #1307`). Step 1 acceptance lives in the PR #1309 description for that exact SHA. The committed convergence record still says the checks were unread because a file on the branch cannot name a later commit.

The deployment pin in `tooling/scripts/lib/ue-v2-staging-candidate.json` still names `6a60c95c9de17e9343e0414bb51766afbc190054`. That is an incompatibility, not a serving observation. S2.01 rebinds the pin only after a normal merge creates a new SHA. Check runs on `b00a362` do not qualify that merge commit.

## Scope ceiling

The ceiling is the existing base-release scope. S2.00 recomputed it from `docs/union-eyes/staging/UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json` and `docs/union-eyes/staging/UE_STAGING_GO_CONTRACT.json`.

| Denominator | Required | Source count |
| --- | ---: | --- |
| Functional families C01–C22 | 22 | 22 |
| Operational families | 13 required, O09 and O10 deferred | 15 stored |
| Stakeholder families | 26 required | 35 stored, 9 deferred |
| Role boundaries | 34 required | 39 stored, 5 excluded aliases |
| Lifecycle stages | 16 | 16 |
| Operating-model presets | 4 | 4 |
| Cross-cutting variants | 6 | 7 stored, PM05 deferred |
| Required scope nodes | 654 | sum of the 16 required inventories |
| Staging criteria | 20 required | 21 stored, `LOCAL_HOLISTIC_REGRESSION` advisory |

The 654 nodes are the required rows of those 16 inventories. Every one joins to at least one C or O family. The join was recomputed in S2.00. There were no required orphans. 288 non-required rows also name an action. They stay outside the 654 and are not passes.

Seven navigation profiles (`member`, `steward`, `chief_steward`, `officer`, `secretary_treasurer`, `admin`, `app_owner`) are a subset. The historical pilot list called the full admin console excluded, and the current reconciliation marks that one excluded-list row required. C19 stays in Step 2 because of that reclassification.

O09 full-traffic failover and O10 physical-device expansion stay deferred. PM05 multi-affiliate executive reporting stays deferred. Deferred rows are not passes.

## What is already true, and what is not

Classifications cite the Step 1 convergence record and the action contract entry points. A route that exists is `SOURCE_PRESENT_RUNTIME_UNPROVEN` until a journey persists a result. Nothing below is `STAGING_PROVEN`.

Disposable or CI evidence, still short of the family and short of staging: C01, C03, C04, C05, C06, C08, C09, C12, C13, C16, C17, C18, C19, C22.

Source is present and runtime proof on this head is absent: C02, C07, C10, C11, C14, C15, C20, C21. C09's disposable proof is a manual assign after a case was scoped. The staging criterion for automatic workload matching stays open. C14's older export receipts belong to other SHAs.

Blocked until an institution adopts an instrument: case-scope backfill for UE-CAP-B-002. The authority store and physical guards are infrastructure. They are not a user-facing pass. File 26's RLS failure is a September 2026 observation of a different application revision (`nzila-os-union-eyes-staging--0000142`, source `0a2c9fa0b`). It is not a current V2 catalog reading, and it is not evidence that the later V2 database repaired it.

The action ledger still says `CURRENT_STEP_1_CANDIDATE_UNQUALIFIED`. That sentence is older than the Step 1 acceptance of `b00a362`. S2.00 does not rewrite the ledger. Staging qualification of C01–C22 and the 13 required operational families remains unexecuted.

## Programme

S2.00 is this freeze. S2.01 integrates PR #1309, requalifies the merge commit, builds immutable images and rebinds the candidate. S2.02 takes a fresh staging preimage, applies the legacy-topology gate, rehearses the preserving upgrade and proves rollback and forward recovery. S2.03 is the no-delete what-if, zero-traffic revision, health-gated cutover and readback. S2.04 qualifies identity, membership, mandates and external denials. S2.05 qualifies C01–C22 on that revision, including a finance denial for every required role. S2.06 qualifies the controlled inbox and the workers. S2.07 qualifies performance, backup and restore, accessibility, bilingual states, registry truth and telemetry. S2.08 is the adversarial pass and the 20 criteria. Only S2.08 can support a later staging decision, and this plan does not make that decision.

Lane A owns S2.01–S2.03. Lane B owns S2.04–S2.06. Lane C owns S2.07. One integration branch owns the acceptance register, the authority kernel, the migration sequence and the release manifest. Lanes do not edit those four surfaces in parallel.

## Risks that stop the programme

The serving revision is `CONFLICTED_HISTORICAL`. The 23 November operator binding and the remaining-work note say `cccfc8c311a1017f80241bf089c00ef0c6828751` is serving and that apply was not launched. The 24 November document-family file names `6a60c95c9de17e9343e0414bb51766afbc190054` without a revision, a traffic weight or a command transcript. S2.00 did not inspect Azure. S2.02-PREIMAGE is the stop condition.

The four legacy installer cases are `APPLICABLE_UNTIL_DISPROVEN`. They are not passes. A current bootstrap does not stand in for an older database. The owner remains `team-union-eyes-engineering@nzila.ai`.

CHG-2026-0114 authorizes founder-operated staging work for the candidates it names. It does not authorize this Step 1 head, a production change, a financial transaction, or an institutional mandate.

## Definition of done for Step 2

Step 2 engineering is complete only when every planned package has executed evidence on one serving SHA. Step 2 is accepted only when all 20 required staging criteria pass on that SHA and the adversarial record is closed. This document does not set either of those flags.

## Outside this authorization

Merging PR #1309, deploying, changing customer data, issuing mandates, enabling union finance, starting Financial Officer 2.1, certifying an election or ratification, activating WorkAid, starting Phase 3B, and changing production release controls are outside S2.00.
