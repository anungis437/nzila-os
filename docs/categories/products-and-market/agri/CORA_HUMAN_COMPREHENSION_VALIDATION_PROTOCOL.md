# Cora Human Comprehension Validation Protocol

**Status:** Design ready with limitations; no human sessions conducted.
**Version:** `cora-comprehension-1.0` | **Date:** 2026-10-10

## Decision and scope

Can people understand the governance meaning of the accepted synthetic
workflow UX without being taught its model first?

This is formative comprehension research, not aesthetics testing, an A/B
experiment, a production acceptance gate or proof of population prevalence.
The design uses observed navigation plus plain-language explanations.
Synthetic analyst dry runs are test-design checks, never human evidence.
All numeric thresholds below are proposed local safety criteria, not
universal research standards or empirically validated targets.

No product functionality or UX redesign is authorized. No live providers,
real producer data, real institutional integrations, outreach, application
grants, production persistence, connector work, commit or push.
Deere/FieldView remain frozen; Organic Alpha remains
`BLOCKED_RIGHTS_CONFIRMATION`, `PHASE_3_PERMISSION = NONE_GRANTED` and
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.

**Cora can interpret; authorized institutions determine.**

## Reading and source baseline

- Research owner: this protocol, then [the rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md).
- Moderator: [session guide](CORA_SYNTHETIC_VALIDATION_SESSION_GUIDE.md);
  keep the rubric/answer key private until all first answers are locked.
- Analyst: [capture schema](CORA_HUMAN_VALIDATION_CAPTURE_SCHEMA.md), including
  completeness, confidence and finding rules.
- Maintainer: review findings and retest evidence, not just aggregate scores.

Baseline reviewed: [Slice 8 proof](CORA_OPERATOR_WORKFLOW_UX_SLICE_8.md),
[view contract](CORA_OPERATOR_WORKFLOW_VIEW_CONTRACT.md),
[truth guide](CORA_WORKFLOW_UX_TRUTH_AND_AUTHORITY_GUIDE.md),
[Slice 7](CORA_GOVERNED_INSTITUTIONAL_WORKFLOW_SLICE_7.md) and
[Slice 6](CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md).
The existing local `slice8-reference.html` was inspected for all ten entries.
It is a synthetic static snapshot, not a server or access-control service.
Pin its SHA-256 before a session; identical run IDs across independent
journeys are not proof of one live chronology.

## Research roles, not participating institutions

| Persona code               | Research perspective                                          | Main risk to examine                                                          |
| -------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `PRODUCER_OPERATOR`        | Understand evidence and what action is lawful now.            | Reading a technical match as approval or revoked history as usable.           |
| `ADVISER_SERVICE_PROVIDER` | Explain evidence provenance and reuse to another person.      | Treating source provider as issuer or technical reuse as permission transfer. |
| `CERTIFIER_PROGRAM_ADMIN`  | Understand requirements, assertion conflicts and sufficiency. | Treating Cora as certifier or interpreting conflict as resolved.              |
| `INSTITUTIONAL_RECIPIENT`  | Understand independent institutional decision ownership.      | Treating another institution's result as its own decision.                    |

These roles do not imply that any organization agreed to participate.
Future individual participants can have relevant experience without acting
for, configuring or supplying data from a real institution.

## Frozen scenario set and coverage

Use participant labels A-I, not revealing names such as "qualified reuse"
in the moderator's task introduction. The original UI scenario names remain
visible: record this cue exposure rather than hiding or changing the UI.

| ID / label | Existing HTML entry                                          | Objective                                                                                       | Required question IDs      |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------- |
| `S1` / A   | `scenario-0`: Technical match without recipient decision     | Evidence/authority, technical match not approval, unknown currentness, bounded rights.          | Q01-Q13, Q18               |
| `S2` / B   | `scenario-1`: Additional evidence needed with governed reuse | Same evidence used; supplemental-review missing; new recipient independent.                     | Q05-Q13, Q18, Q19          |
| `S3` / C   | `scenario-2`: Revoked historical result                      | Past technical check survives; new use is prohibited.                                           | Q07-Q10, Q14, Q15, Q18     |
| `S4` / D   | `scenario-3` and authorized successor `scenario-4`           | Old workflow remains history; successor is current path, not approval/current source guarantee. | Q07-Q10, Q15, Q17          |
| `S5` / E   | `scenario-5`: Conflicting assertions                         | Both providers/issuers/claims; no winner selected.                                              | Q02-Q04, Q07-Q09, Q11, Q16 |
| `S6` / F   | `scenario-6`: Access unavailable                             | Bounded denial; do not guess withheld evidence or the exact denial cause.                       | Q01, Q05, Q08, Q11, Q18    |
| `S7` / G   | `scenario-9`: Reconstruction is not qualified reuse          | Reconstruction is not qualified reuse despite similar evidence/partial technical result.        | Q07, Q08, Q12, Q13, Q20    |
| `S8` / H   | `scenario-7`: Stale evidence                                 | Freshness guardrail: stale is not current.                                                      | Q10, Q11                   |
| `S9` / I   | `scenario-8`: Expired historical context                     | Separate current expiry from recorded historical technical match.                               | Q07, Q10, Q15              |

All four personas use all seven core scenarios plus both existing freshness
probes: **61 scored responses per completed participant, 122 possible points**.
Every one of the sixteen requested core questions appears; Q17-Q20 cover
successor, action rights, decision transfer and pseudo-reuse explicitly.
Do not drop difficult scenarios or include withheld details in the answer key
shown to participants.

## Proposed future session design

Recommend a first formative round of **12 individuals, three per persona**,
only after separate human authorization for research logistics and contact.
This is a proposed operational sample (T6: design judgment, confidence L),
not a power calculation or proof of saturation. Balance role experience,
digital familiarity and desktop/narrow-screen use where feasible; record
language, accessibility needs and previous Cora exposure without identifiers.
Exclude Cora implementers/answer-key readers from the first-exposure cohort.
Experienced retest participants are explicitly tagged, never mixed with novices.

Reserve up to **90 minutes including breaks** (T6, confidence L). Verify burden
in the first authorized session; split into two pinned sessions if needed and
retain the full denominator. Never force completion or penalize withdrawal.
No target timing is a product SLA.

Counterbalance S1-S7 with cyclic orders:
`1,2,3,4,5,6,7`; `2,3,4,5,6,7,1`; continue through seven rotations.
Assign rotations by planned session index, not observed performance.
Alternate H/I order after the core block. Record actual order, gallery-title
exposure, other scenarios visited and prior learning. Repeated questions are
not independent participants; report first-exposure answers separately.

## Observation and analysis

Follow task -> observation -> explanation -> confidence -> neutral probe.
Use only the UI, no doctrinal briefing or correct-answer coaching.
Capture first answers verbatim and lock them before probing. Revisions after
teaching are learning observations, not improved baseline scores.

| Observable                                                                    | Definition and instrument                                                                                                    | Limitation / counter-check                                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Source, issuer, requirement-owner, decision-owner, freshness, reuse find time | Manual stopwatch per task: start after neutral task finishes; stop when participant points to supporting UI and explains it. | Capture incorrect finds separately; speed without accuracy is not success.                    |
| Navigation time                                                               | Per-question elapsed seconds minus logged interruptions.                                                                     | Prior exposure changes search difficulty; tag repeat versus first exposure.                   |
| Timeout                                                                       | At 120 active seconds, offer skip neutrally; retain `TIMED_OUT` and elapsed time.                                            | Proposed burden bound (T6, L); not a failed render or 120-second performance measurement.     |
| Disclosures opened                                                            | Count each closed-to-open action during the task.                                                                            | Distinguish first unique expansion from repeated openings; opening many is not understanding. |
| Backtracking                                                                  | Return to a previously visited section/entry after leaving during that task.                                                 | Record route trace; not a UI latency measure.                                                 |
| Terminology confusion                                                         | Exact term, participant paraphrase and requested explanation.                                                                | Defer definitions until baseline complete; do not infer confusion from pause alone.           |
| Confidence                                                                    | Participant reports LOW/MEDIUM/HIGH after each answer.                                                                       | Self-confidence is not analyst certainty or proof of correctness.                             |

Use local researcher capture only, not product telemetry or new runtime
instrumentation. If a stopwatch observation was missed, use null and a reason,
not zero or invented timing. No covert recording. Default: written notes and
pseudonymous responses; recording requires separately authorized consent,
storage/access/deletion arrangements and must not enter this repository.

Score with the [rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md). A second reviewer
independently codes all critical/high findings and a preselected sample of
other rows; disagreements remain visible and block closure of affected findings.
Separate participant statement, observed route and analyst interpretation.
Report counts and denominators per persona/scenario, including incomplete,
assisted, confidently wrong and repeated-exposure responses.

## Proposed gate and failure response

Pre-register these rules before human sessions (all T6: local design judgment,
confidence L for empirical adequacy):

- Each completed participant and each persona: at least **85%** earned points.
  For 61 responses, minimum **104/122**; use unrounded comparisons.
- Every authority/decision, match-not-approval and current/history guardrail
  question in the rubric must score **2**, not just 100% as a rounded mean.
- Zero critical misconception flags. A high total never offsets one.
- Each persona must meet the same gates; a gap **greater than 10 percentage
  points** between persona means triggers investigation and blocks advancement.
- All planned roles and scenarios must be complete; missing/withdrawn sessions
  are reported as inconclusive coverage, not silently excluded from readiness.
- Any unresolved critical/high finding, disputed coding or invalid capture
  blocks advancement. A partial or uncertain guardrail answer is a failed
  comprehension gate even without an explicit critical misconception.

Passing permits only discussion of the next bounded synthetic research step.
It does not unlock providers, persistence, production rollout or real
institutional acceptance. Confidence-high wrong answers escalate review;
confidence-low right answers remain a distinct support concern.

Goodhart risk: optimizing a score can reward coaching, easy questions or
dropping low scorers. Countermeasures: locked first responses, fixed coverage,
critical veto, prompt logs, full denominators and per-persona reporting.
Fast navigation is paired with correct interpretation and uncensored timeouts.

## Retest and governance ownership

Research owner registers the plan; moderator observes; two analysts code;
maintainer decides whether a finding is closed. No person is appointed or
contacted by this document.

A critical/high finding requires a scoped change proposal, separate
implementation authorization and later retest of:

1. The original failed scenario and question.
2. One previously unaffected scenario with the same truth boundaries.
3. At least one different persona.

Use fresh participants where possible and label returning participants.
Keep original answers/findings immutable; new UI digest, protocol version,
retest IDs and adjudication link the evidence. Do not close based on a code
test, moderator teaching or a synthetic analyst answer.

## Design dry run and testability

The [synthetic analyst fixture](CORA_HUMAN_VALIDATION_DRY_RUN.json) records
four role lenses across seven core scenarios and both freshness probes.
It is one analyst exercise, not independent people or user research.

| Design issue found                                        | Correction in this protocol                                                               | Residual limitation                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Asking every identity question on denial forces guessing. | S6 accepts "not disclosed"; exact evidence/requirement identity not required.             | Cannot diagnose the underlying denial cause from UI.                    |
| Scenario titles disclose outcomes.                        | Neutral task labels; record title cue and ask for supporting explanation.                 | Test understanding of a labeled reference, not unaided state discovery. |
| Conflict appears inside a stopped/historical lifecycle.   | Score conflict claims/no-winner independently from workflow state.                        | Cannot exercise interactive issuer correction.                          |
| Supersession could be read as source refresh.             | Q17 requires successor path without approval/currentness inference.                       | No live transition or refresh is tested.                                |
| "Was reused" can mean similar bytes or reconstruction.    | Q13/Q20 distinguish governed use from reconstruction.                                     | Raw rejection code language remains a research target.                  |
| Whole-session stopwatch cannot attribute find times.      | Task-level timers, repeat-exposure tags and null/missing reasons.                         | No actual human timing is available.                                    |
| Prompted correctness can inflate scores.                  | First answer immutable; neutral assisted correction capped at 1; taught answers excluded. | Moderator consistency must be tested in authorized sessions.            |
| Good overall score can hide a severe error.               | Guardrail veto plus adverse scoring examples in rubric.                                   | Proposed thresholds lack human calibration.                             |

**Existing UX is testable without redesign; no `UX_VALIDATION_BLOCKER`
identified in the bounded design inspection.** Long IDs, raw lifecycle/rejection
terms in details, cueing, repeated prompts and static history are limitations
to measure, not established human failures.

### Assumptions and adversarial check

- Labels and explanations can be tested in a static snapshot (confidence M,
  direct artifact inspection). Invalidate if participants cannot locate a
  consistent state or the pinned snapshot contradicts its answer key.
- Manual timing can distinguish find tasks (confidence L, T6). Invalidate on
  missing timers, pauses or moderator intervention; retain unknown metrics.
- Persona coverage is directionally useful (confidence L, T6). Experts can
  explain the doctrine yet novices cannot; never infer novice comprehension
  from analyst dry runs or pooled expert means.
- Repetition can teach answers. Track order/exposure and flag first-versus-later
  divergences; a polished high score after repetition is not first-use proof.
- A participant can read a warning aloud without understanding it. Require
  application to the scenario and a neutral counterfactual after the locked
  answer; do not substitute recognition for an explanation.

Revisit the design on any UX/reference change, impossible observation,
disputed answer key, missing coverage or participant burden. Threshold
changes require a new pre-registered version, never retroactive pass-making.

## Exact next step

Maintainer reviews the four-document pack and approves thresholds, proposed
sample, consent/capture handling and moderator rehearsal. Then obtain separate
explicit authorization to arrange individual sessions; no contact now.
The first authorized participant uses the pinned local synthetic reference
and the guide, with one moderator and one observer. Lock/capture all first
answers and confidence before debrief; independently review safety errors
before proceeding to the remaining planned sessions.
