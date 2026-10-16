# Cora Human Validation Analysis Specification

**Version:** `cora-round1-analysis-1.0`
**Design only:** no dashboard, telemetry, human results or runtime code.

## Inputs and partitioning

Approved local research exports: 1.0 human captures validated by the
[capture schema](CORA_HUMAN_VALIDATION_CAPTURE.schema.json), external study
index/QA logs, independent review records and pinned
[manifest](CORA_HUMAN_VALIDATION_ROUND_1_MANIFEST.json).

Exclude metadata-only blanks and analyst fixtures from human denominators.
Partition by study round/version, reference SHA/version, protocol/rubric and
capture-schema versions, persona and first-exposure/retest cohort.
Two sittings combine as one participant only when pins match and baseline
answers are not repeated/overwritten. No pre/post pooling after revision.
Maintain valid, limited, invalid, incomplete and withdrawn counts visibly.

## Required analysis output

Machine-ingestible tables/JSON in authorized research storage, not source
control. Each output has data kind `HUMAN_FORMATIVE_RESULTS`, cohort pins,
generation time, source capture IDs and metric validity/missing reasons.
No report is generated now; absent results are unknown, not zero success.

| Output                   | Calculation / fields                                                                                                                                                       | Guardrail                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Overall comprehension    | For complete valid captures: earned first-answer points / (122 \* number of independent participants); show numerator/denominator.                                         | Never use answered-only denominator for incomplete captures. Report each participant too.                       |
| Persona comprehension    | Equal-participant mean of participant rates within each role; include n, points and missing slots.                                                                         | Each participant and persona >=85%; no pooled pass hiding a role.                                               |
| Guardrail accuracy       | Count responses scoring exactly 2 / planned guardrail responses per participant/persona/scenario.                                                                          | Every required guardrail response must be 2, without rounding. Missing/partial is not full credit.              |
| Critical misconceptions  | Per-flag distinct-person count; also raw occurrences, confidence, QA context and resolution status.                                                                        | Repeated occurrences != independent participants; historical failures never deleted.                            |
| Confidence x correctness | LOW/MEDIUM/HIGH/UNKNOWN crossed with 0/1/2/null; separate high-confidence material wrong rows.                                                                             | Confidence cannot change correctness weight or erase an error.                                                  |
| Scenario failure         | Per-scenario participant counts for incomplete, any score<2, any critical/high and any guardrail failure; state definition for each rate.                                  | Raw wrong rows are not independent participant n.                                                               |
| Language friction        | Per-term distinct participants, observed task count, own-word paraphrases, severity and optional reviewed/redacted quote.                                                  | No paraphrase invented; distinguish prompted from spontaneous confusion.                                        |
| Find times               | Q02 source, Q03 issuer, Q06 requirement owner, Q09 decision owner, Q10 freshness, Q13 reuse: valid completed correct finds; mean/median/n by task/scenario/cohort/persona. | Use active seconds = elapsed-paused; show incorrect finds, censored lower bounds and missing counts separately. |
| Disclosures/backtracking | Per-task total and unique openings, return events/route traces; summary with valid counts.                                                                                 | Openings/speed not proof of comprehension; missed counts are null, not zero.                                    |
| Retest                   | Original finding/reference, changed cohort/version, failed+unaffected scenario outcomes, different-persona coverage and independent closure status.                        | Targeted retest not interchangeable with full study slot.                                                       |

Timing for repeated-exposure tasks is reported separately from first exposure.
Censored tasks do not enter completed-find mean/median as 120-second successes.
Small role groups yield descriptive statistics only; no population prevalence,
significance, institutional acceptance, market demand or productivity claims.

## Approved local advancement rule

Apply in order, retaining all failure reasons:

1. Missing authorization/consent, instrument defect, invalid reference or
   unresolved protocol/capture defect -> **BLOCK**.
2. Any unresolved critical/high finding or disputed scoring -> **BLOCK**.
   Any critical flag or less-than-2 guardrail in a would-be qualifying cohort
   also blocks that cohort; later teaching cannot erase it.
3. Fewer than **12 complete independently valid sessions, three per persona**
   -> **INCONCLUSIVE_COVERAGE**, with observed failures still blocking.
4. Each complete participant and persona must achieve >=0.85, i.e.
   at least **104/122 points** per participant. Do not round a failing rate up.
5. Every allocated guardrail response equals 2; zero critical misconceptions
   in the qualifying cohort and zero unresolved critical/high findings.
6. Maximum persona mean minus minimum <=**0.10** (ten percentage points).
7. No unresolved QA/protocol defect; all required independent reviews
   adjudicated and version/retest evidence preserved.

Only all conditions satisfied -> `LOCAL_FORMATIVE_GATE_MET`.
That result requests an explicit next-work decision; it is not autonomous
permission to advance, ship or use live data. Original protocol's conservative
critical-error veto remains: finding closure after revision is demonstrated
in a separately identified clean qualifying cohort, not by reclassifying
the original misconception as never occurring.

`VALID_WITH_LIMITATIONS` can fill a comprehension slot only when all 61
independent baseline answers remain valid; disclose which metrics were
excluded. Invalid/incomplete/withdrawn data remain in participant-flow counts
and historical findings but do not fill quota or appear as perfect scores.

## Review and recommendations output

Each finding records:

```text
findingId, cohortPins, affectedObservationIds, persona/scenario/question,
participantStatement, observedUIState, analystInterpretation,
firstAnswerScore, confidence, misconceptionFlags, severity,
qaLimitations, independentReviewStatus, recommendedAdjustment,
decisionOwner, authorizationNeeded, retestCoverage, resolutionStatus
```

No quote without approved scope and redaction/re-identification review.
No desired-outcome briefing for reviewers; record `AGREED`, `DISAGREED`,
`REQUIRES_ADJUDICATION` externally and compatible accepted capture statuses.
Proposals inform product work only after explicit authorization.

## Acceptance/control cases for future analysis

- Twelve blank files -> zero human sessions, no computed comprehension.
- Eleven valid sessions -> coverage inconclusive, even if all score 100%.
- Twelve valid sessions but one 120/122 with a critical flag -> block.
- One guardrail 1 and otherwise 2 -> block at 121/122.
- Persona means 100%,100%,100%,86% -> 14-point gap blocks pooled success.
- Correct answers with missing stopwatch -> descriptive comprehension valid,
  timing unknown; do not impute fast times.
- Two occurrences from one person -> one independent flag count.
- Two distinct people with same critical flag -> pause Round 1 under QA.
- Revised reference mid-round -> separate cohorts, retain original failures;
  no blended denominator or claim that revision solved itself.

These are specifications and constructed controls, not actual study outcomes.
