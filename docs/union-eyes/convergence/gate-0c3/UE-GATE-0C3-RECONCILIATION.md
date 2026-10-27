# Union Eyes Gate 0C.3 - institutional scope exceptions and release-debt reconciliation

Gate: GATE-0C.3. Anchor commit: `f90f74d135c209812b4728585c076ea410704719`. Gate 0 verdict: IN_PROGRESS.

This gate reconciles obligations. It repairs nothing, adopts no decision, selects no carbon option, ratifies no persona baseline, issues no release approval and changes no application source, schema, migration or allowlist.

## Registers

| Register | File | sha256 |
| --- | --- | --- |
| assessment | `docs/union-eyes/convergence/register/ue-release-high-defect-assessment-0c3.json` | `4e5fd0b979c7bc1f7e9cd3f905b8710b88dacd7a9a0948682e6ed21ad45eb8d8` |
| debt | `docs/union-eyes/convergence/register/ue-release-debt-index-0c3.json` | `457ecd54a080199bd1ebfa276c0eaa170a9a0fe1021b2e49c682e70fe7f5d4d8` |
| challenges | `docs/union-eyes/convergence/register/ue-opl-challenge-treatment-0c3.json` | `46871016035772ae87b29b8ef4607b2c65db3ffc400d0aea7b2f1761c5654bf5` |
| carbon | `docs/union-eyes/convergence/register/ue-carbon-scope-decision-0c3.json` | `65a78d5766d9f25cfd775bfc2f5e8439acfaa0b7d823517659cc65f72b130106` |
| decisions | `docs/union-eyes/convergence/register/ue-decision-index-0c3.json` | `b94d5433e7151b097b25d0ba62855b1f3716fd63c2384bc4a20547bc21678db0` |
| relationships | `docs/union-eyes/convergence/register/ue-defect-relationship-map-0c3.json` | `3c166aa58e8606217fd6ff9f828af19da9b03af47f13c7065fe30bad69b10dbf` |
| closure | `docs/union-eyes/convergence/register/ue-closure-model-0c3.json` | `36b6423a34fe97e30ad09bdc7c98664875e79f74ca1e81d4bf105d984d47a635` |

## Frozen evidence

The totals the Gate 0C.2 commit accepted are compared with what the registers hold. They are not forced onto them.

| Total | Accepted | Observed | Match |
| --- | --- | --- | --- |
| operations | 1646 | 1646 | yes |
| capabilities | 111 | 111 | yes |
| defects | 777 | 777 | yes |
| institutionalDecisions | 79 | 79 | yes |
| releaseBlockingDispositions | 32 | 32 | yes |
| conditionallyBlockingDispositions | 41 | 41 | yes |
| earlierHighAwaitingQualification | 71 | 71 | yes |
| challenges | 2 | 2 | yes |
| publicExposures | 3 | 3 | yes |
| carbonExceptions | 4 | 4 | yes |
| proposedPersonaBaselines | 3 | 3 | yes |

## Release-debt index

| Measure | Value |
| --- | --- |
| Unique release-debt items | 150 |
| Unique register defects among them | 146 |
| Tracked ratchet, test or source items | 4 |
| Repair obligations (one per item) | 150 |
| Release-blocking register defects | 34 |
| RELEASE_BLOCKING dispositions | 32 |
| CONDITIONALLY_BLOCKING dispositions | 41 |
| Conditional dispositions under challenge | 2 |
| Earlier HIGH defects awaiting an accepted disposition | 71 |
| Public exposure operations / their release-blocking defects | 3 / 2 |
| Listings before de-duplication | 153 |
| Duplicate inflation avoided | 3 |
| Accepted release decisions | 0 |
| Closed obligations | 0 |

Reporting classes: AWAITING_ACCEPTED_DISPOSITION 71, CONDITIONALLY_BLOCKING 39, CONDITIONALLY_BLOCKING_CHALLENGED 2, RELEASE_BLOCKING 34, TRACKED_ENGINEERING_DEBT 4.

Six record types stay distinct: defect, releaseDispositionAssessment, challenge, exposureContract, engineeringRepairObligation, acceptedReleaseDecision. Every item carries an engineering owner (accountability, not authorization), a target gate, a source reference and an acceptance condition. The release effect of an unaccepted item is never recorded as accepted.

## Earlier HIGH defects

71 defects assessed: CONDITIONALLY_BLOCKING 25, RELEASE_BLOCKING 43, REVIEW_REQUIRED 3. See `docs/union-eyes/convergence/gate-0c3/UE-HIGH-DEFECT-RELEASE-ASSESSMENT-0C3.md`. All proposals are PROPOSED_NOT_ACCEPTED.

## OPL-01 and OPL-07 challenges

Status: CHALLENGES_PRESERVED_UNRESOLVED. Original dispositions stay CONDITIONALLY_BLOCKING and frozen. The challenge position stays `RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF`. New source evidence: NO_NEW_SOURCE_EVIDENCE_THE_CHALLENGES_ARE_UNCHANGED (9 cited files compared with the challenge commit, 0 flag files added, 0 removed).

This record does not assume the flag is enforced in every release path. 8 dispositions depend on the flag.

## Carbon scope

Three options, one recommendation, none selected. See `docs/union-eyes/convergence/gate-0c3/UE-CARBON-SCOPE-DECISION-RECORD-0C3.md`.

## Decision index

138 distinct decision records across five families, 0 exact duplicate identifiers, 19 reviewed overlaps (merged: none), 0 adopted.

| Family | Count | Owner role | Blocks scope lock | Blocks implementation |
| --- | --- | --- | --- | --- |
| INVENTORY_INSTITUTIONAL | 79 | INSTITUTION_TO_BE_NAMED | NO | CONDITIONAL |
| BASELINE_INSTITUTIONAL_AUTHORITY | 32 | INSTITUTION_TO_BE_NAMED | NO | CONDITIONAL |
| BASELINE_PRODUCT | 14 | AUTHORIZED_PRODUCT_OWNER | YES | CONDITIONAL |
| GATE_0C2_PRODUCT | 10 | AUTHORIZED_PRODUCT_OWNER | YES | CONDITIONAL |
| PERSONA_RATIFICATION | 3 | AUTHORIZED_PRODUCT_OWNER | YES | CONDITIONAL |

Overlap relations: ADJACENT_DISTINCT 5, OVERLAPPING_SCOPE 7, PRODUCT_SPECIFIES_INSTITUTION_DECIDES 7. The cluster count collapses only the reviewed OVERLAPPING_SCOPE pairs. It is an upper bound on independent institutional authorities, not a claim that the overlap list is exhaustive.

A product approval is a product-specification baseline. It never carries an institutional grant.

## Defect relationships

14 clusters over 49 defects. Defects merged: 0. Severities changed: 0.

The Gate 0B.8 record rates the health-and-welfare path MEDIUM with no release disposition and the Gate 0B.12 record rates four tax paths over the same table and floor HIGH with a RELEASE_BLOCKING disposition. Both stay as recorded. The difference is flagged for an independent severity review and is not resolved here.

## Two-level closure model

Level 1, GATE_0_SCOPE_LOCK_COMPLETION: 7 of 7 record criteria satisfied. Certifiable: false. Certification blockers:
- PERSONA-STEWARD (PRODUCT_OWNER_DECISION): steward has no ratified canonical. The product owner decides the proposed package; this gate does not.
- PERSONA-REPRESENTATIVE (PRODUCT_OWNER_DECISION): representative has no ratified canonical. The product owner decides the proposed package; this gate does not.
- PERSONA-FINANCIAL-OFFICER (PRODUCT_OWNER_DECISION): financial-officer has no ratified canonical. The product owner decides the proposed package; this gate does not.
- CARBON-DECISION-BOUND-EXCEPTIONS (INSTITUTIONAL_DECISION): 4 carbon operations stay decision-bound exceptions until UE-INST-CARBON-ACCOUNTING-SCOPE is decided by the deciding authority.
- GATE-0C3-INDEPENDENT-REVIEW (INDEPENDENT_REVIEW): The Gate 0C.3 registers are not accepted until an independent adversarial review accepts them.

Level 2, RELEASE_ACCEPTANCE, additional to level 1:
| Criterion | State |
| --- | --- |
| Authorized security and business decisions. | OPEN |
| Corrective implementation. | NOT_STARTED |
| Runtime tenant-isolation proof. | NOT_STARTED |
| Native database and migration qualification. | NOT_STARTED |
| Credentialed browser acceptance. | NOT_STARTED |
| Relevant regression and governance controls. | OPEN |
| Closure or authorized disposition of release-blocking debt. | OPEN |

Release authorization: NOT_GRANTED. Production GO: false. UE_SAAS_OPERATIONAL_READINESS: NO_GO. A Gate 0 verdict is never a release authorization.

## Handoff obligations

| Obligation | Before | After Gate 0C.3 | Closed |
| --- | --- | --- | --- |
| OBL-0C-PERSONA-BASELINES | PENDING | PENDING | no |
| OBL-0C-INSTITUTIONAL-DECISIONS | OUTSTANDING | OUTSTANDING | no |
| OBL-0C-CARBON-SCOPE-EXCEPTIONS | OUTSTANDING | OUTSTANDING | no |
| OBL-0C-HIGH-DEFECTS-AWAITING-REVIEW | AWAITING | AWAITING | no |
| OBL-0C-RELEASE-DISPOSITIONS | OPEN | OPEN | no |
| OBL-0C-OPL-CHALLENGES | OPEN | OPEN | no |
| OBL-0C-UNJUSTIFIED-PUBLIC-EXPOSURES | OPEN | OPEN | no |
| OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS | OPEN | OPEN | no |
| OBL-0C-RUNTIME-QUALIFICATION | PENDING | PENDING | no |
