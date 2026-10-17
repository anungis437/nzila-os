# Cora Human Validation Session QA Contract

**Version:** `cora-round1-qa-1.0`
**Scope:** Research handling only; no runtime authorization or production gate.

Implements the accepted [protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md)
and [rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md).

## Session classification

| Classification            | Condition                                                                                                                                                                                                         | Treatment                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `VALID`                   | Authorized/consented, correct reference, independent uncoached interaction, all 61 baseline tasks captured, no material defect.                                                                                   | Eligible for cohort comprehension analysis; score gates still apply.                                                               |
| `VALID_WITH_LIMITATIONS`  | Same comprehension validity/completeness, but bounded nonmaterial limitation such as missed timing, documented access mechanics or outcome-title exposure.                                                        | Include valid comprehension with limitation label; omit invalid timing/behavior metrics. Cannot waive a guardrail or high finding. |
| `INVALID_RETEST_REQUIRED` | Coaching, wrong version, omitted required scenario, material capture loss, post-debrief score rewrite, lack of independent meaning explanation, major technical failure or materially misunderstood instructions. | No gate-qualifying session; preserve original evidence and require retest/replacement authorization.                               |

Incomplete/withdrawn sessions are retained with completion status separately,
not given false validity or a denominator of 61. They do not fill a valid
slot. Disability/accommodations alone never constitute invalidity; inability
to observe independently without coaching is an instrument/accessibility issue.
Valid does not mean comprehended correctly; a valid session can fail all gates.

## QA signals and log shape

Use an approved external study index and append-only sidecar log, not new
runtime fields or a dashboard. Required record shape:

```text
studyRoundId, studyVersion, referenceVersion, referenceSha256, slotId,
captureId, blockId, actualScenarioOrder, sessionCompletion,
qaClassification, qaFlags[], invalidMetricQuestionIds[],
baselineLocks[{observationId, lockedAt, answerConfidenceSha256}],
events[{eventId, at, type, observationId?, reason}],
qaReviewerRef, secondReviewerRef?, disposition, retestOf[]
```

No fabricated dates/QA status in blank fixtures. A first-answer hash binds
answer and confidence as captured; later numeric coding/adjudication events
are separate, with prior/proposed score/reason and reviewer references.
No attempt to make a later correction the participant's first answer.

Flags: `COACHING_BEFORE_LOCK`, `SCENARIO_NOT_SHOWN`,
`SCORE_REWRITTEN_AFTER_DEBRIEF`, `NON_INDEPENDENT_INTERACTION`,
`MAJOR_TECHNICAL_FAILURE`, `INVALID_TIMING`,
`REFERENCE_VERSION_MISMATCH`, `STUDY_INSTRUCTIONS_MISUNDERSTOOD`,
`MATERIAL_CAPTURE_LOSS`, `MISLEADING_SYNTHETIC_SCENARIO`,
`ACCESSIBILITY_INSTRUMENT_BARRIER`.

Record exact scope: wrong reference/material defect invalidates session;
missed stopwatch alone may invalidate only timings. Do not silently null a
score to discard a severe error. Supported misconceptions remain reviewable
even in invalid/incomplete sessions, with contamination context.

## Independent review and adjudication

Every critical misconception, high comprehension failure and disputed score
requires independent second review by a different person.

Provide: pseudonymous first answer/confidence, locked UI state/reference
digest and scenario, question/rubric, observed mechanics and neutral prompt
log. Hide proposed score, moderator preference and desired outcome until
second reviewer records independent code/rationale. Reviewer must not be
moderator for that observation or be pressured to reach a pass.

Review log:

```text
reviewId, captureId, observationId, referenceSha256, rubricVersion,
initialReviewerRef, initialScore, initialFlags, initialRationale,
secondReviewerRef, independentScore, independentFlags, independentRationale,
comparisonStatus, adjudicatorRef?, adjudicationReason?, resolutionStatus
```

Comparison status:

- `AGREED`: independently same material coding; retain both records.
- `DISAGREED`: material difference found; unresolved, no closure.
- `REQUIRES_ADJUDICATION`: escalated to a third independent reviewer/maintainer;
  preserve disagreement and rationale. Never average opposing scores.

The accepted capture's `review.status` remains `NOT_REVIEWED`, `AGREED` or
`DISPUTED`. Map external `AGREED` to `AGREED`; both `DISAGREED` and
`REQUIRES_ADJUDICATION` to `DISPUTED` until a documented adjudication resolves
it. External outcome details are preserved; no schema enum silently replaced.
An unchecked/disputed critical/high finding always blocks advancement.
Reviewer-role placeholders R1/R2/R3 are not actual assignments.

## Round stop rules

Pause remaining recruitment/sessions and notify Aubert/research owner when:

1. The **same critical flag** is supported in **two distinct independent
   participants**. Repeated answers from one person, staged blocks and retests
   are not two participants. Pause pending review even if coding is provisional;
   log uncertainty, do not wait for a quota.
2. UX/reference defect invalidates interpretation, including wrong version,
   contradictory answer-bearing state or unusable successor.
3. Moderator protocol is found leading or teaching before first answers.
4. Capture/schema loses material observations or cannot represent the truth.
5. Synthetic scenario itself is misleading, not just misunderstood.

One critical misconception already blocks advancement and needs immediate
review; the two-person rule is a round collection pause, not permission to
ignore the first. Sensitive-data exposure, missing consent or unauthorized
recording also pauses collection for privacy handling.

Do not continue to reach twelve while the instrument is defective.
Keep all records, pause reasons, affected tasks and dispositions. Resumption
requires explicit Aubert authorization after defect review, not an automatic
counter reset or analyst-only dry-run success.

## Revision and retest

Any necessary UX change is reported as `UX_VALIDATION_BLOCKER` for this
mission; no silent redesign. Later authorized revision:

- Freeze old cohort/captures/reference; retain failures as historical evidence.
- Create new UX/reference digest/version and study manifest/cohort amendment.
  If protocol/rubric changes, version those too; no backdated amendments.
- Never pool pre/post results blindly or overwrite old scores.
- Retest original failed scenario/question, one unaffected scenario and
  at least one different persona, with fresh participants where possible.
  Returning participants are separately marked.
- Resolve critical/high findings through actual human retest and independent
  review; passing code/analyst checks is not closure.
- A shortened targeted retest cannot fill a full 61-response valid slot.
  A qualifying new cohort needs twelve valid complete independent participants,
  three per role, unless Aubert explicitly approves a changed study design.

## QA examples (constructed controls, not observations)

| Constructed event                                         | Decision                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| One participant repeats same critical flag on three tasks | One person; immediate finding review/block, not two-person pause count. |
| Two different participants share one critical flag        | Pause round; independently review and obtain authorization to resume.   |
| Same participant returns for second sitting               | One participant/session, same version and full denominator.             |
| Missing stopwatch, intact independent answers             | VALID_WITH_LIMITATIONS; omit timing, retain comprehension.              |
| Wrong reference or coaching before lock                   | INVALID_RETEST_REQUIRED; do not rescue scores after debrief.            |
| Independent reviewers disagree                            | DISPUTED/REQUIRES_ADJUDICATION; advancement blocked.                    |
| UX change after participant five                          | Freeze cohort; new version; separate analysis and required retest.      |
| 98% score with one critical misconception                 | Gate blocked regardless of aggregate.                                   |

See [analysis specification](CORA_HUMAN_VALIDATION_ANALYSIS_SPEC.md) for gate
ordering and denominators. No valid human session exists at preparation time.
