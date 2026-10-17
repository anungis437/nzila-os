# Cora Human Validation Capture Schema

**Version:** `cora-comprehension-1.0` | **No human data collected.**

The [JSON Schema](CORA_HUMAN_VALIDATION_CAPTURE.schema.json) uses Draft 7.
The [analyst dry-run fixture](CORA_HUMAN_VALIDATION_DRY_RUN.json) is illustrative
test-design data, not participant transcripts, observed timing or human
comprehension scores. Its deliberately wrong answers test severity and veto
rules; they are not findings about actual people.

## Separation and storage

Completed captures are `SYNTHETIC_ANALYST_DRY_RUN` or `HUMAN_SESSION`; never combine
their rows or denominators. `humanEvidence` must agree with kind. Human capture
requires a separate research authorization reference, approved capture-policy
reference and voluntary-consent confirmation before collection. These are
research handling references, not Cora application grants or source rights.
This schema does not implement consent, access control, storage or deletion.

Schema artifact **1.1** adds `PRE_RECRUITMENT_TEMPLATE` for Round 1 metadata
only. Such instances use `schemaVersion: "1.1"` and contain only planned
participant/persona and protocol/study/reference pins, plus the structural
kind and `humanEvidence: false`. They forbid observations, answers, scores,
consent, authorization, environment and exposure claims, even empty arrays.
Accepted completed/dry-run 1.0 instances retain their original validation
rules and use `schemaVersion: "1.0"`. This is preparation support, not a
change to scoring or study protocol.

Before an authorized session, preserve the blank and create a separate
1.0 `HUMAN_SESSION` capture in approved research storage. Populate actual
authorization, consent, environment and observations there; link its study
and reference versions through the Round 1 manifest/index. Do not repurpose
the blank as evidence or persist human responses in this repository.

Store future pseudonymous human captures only in the separately approved
research location. No names, contact details, employer/farm identifiers, real
evidence or recordings in this repository. Free-text must be reviewed/redacted
before sharing; schema validation cannot detect sensitive information.
Do not send research captures to external AI services. Local notes are not
product telemetry. Only synthetic fixtures are checked into this pack.

## Data dictionary

| Field                                                              | Shape / meaning                                                                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `protocolVersion`                                 | Fixed version identifiers; changes require a new version, not reinterpretation of old rows.                                              |
| `captureKind`, `humanEvidence`                                     | Explicit separation of dry run from authorized human observation.                                                                        |
| `researchAuthorizationRef`, `capturePolicyRef`, `consentConfirmed` | Null/false for dry run; required nonempty references and true for future human capture.                                                  |
| `reference`                                                        | Local HTML basename and SHA-256; no private filesystem path required.                                                                    |
| `sessionId`, `persona`                                             | Pseudonymous session identity and one of four defined research roles.                                                                    |
| `environment`                                                      | Browser, viewport, language and access needs; unknown dimensions are null, not guessed.                                                  |
| `retestOf`                                                         | Original session/observation/digest links; no rewriting of failed captures.                                                              |
| `scenarioOrder`, `priorExposure`, `cueExposure`                    | Actual scenario order, familiarity and outcome-title/other-entry cues.                                                                   |
| `observations[].observationId`                                     | Unique row ID; session/scenario/question combination is unique for baseline.                                                             |
| `scenario`, `questionId`                                           | S1-S9 and Q01-Q20; must match the frozen protocol schedule.                                                                              |
| `answer`                                                           | Verbatim first explanation, or synthetic constructed explanation in a dry run; null if not captured.                                     |
| `firstAnswerScore`                                                 | Integer 0/1/2, or null for incomplete/contaminated baseline. Never a follow-up score.                                                    |
| `baselineStatus`, `missingReason`                                  | ANSWERED, TIMED_OUT, NOT_ADMINISTERED, INTERRUPTED or TAUGHT_CONTAMINATED; null values require a reason.                                 |
| `confidence`, `confidenceMissingReason`                            | Participant LOW/MEDIUM/HIGH, or null with reason; never analyst confidence.                                                              |
| `misconceptionFlags`                                               | Supported critical flags from the rubric; all imply score 0 and critical severity.                                                       |
| `assistanceBeforeLock`, `followUp`                                 | Pre-lock help flag plus post-lock prompt/answer; follow-up never overwrites first answer.                                                |
| `navigation`                                                       | Elapsed, paused and active seconds; FOUND/CENSORED/NOT_OBSERVED; expansions, unique details, backtracks, route trace and missing reason. |
| `uiLocationsUsed`                                                  | Sections/landmarks actually used, including wrong places; not inferred from expected answer.                                             |
| `terminologyConfusion`                                             | Exact term, participant paraphrase and optional suggested phrase; empty if no confusion observed.                                        |
| `moderatorNotes`                                                   | Observations distinct from analyst reasoning; interruptions, cueing and deviation recorded.                                              |
| `recommendedAdjustment`                                            | Proposed protocol/UX adjustment, not automatically authorized implementation; null if none.                                              |
| `severity`                                                         | One of the five rubric severities; not inferred solely from navigation speed.                                                            |
| `review`                                                           | Initial reviewer, second review and agreement state; unresolved/unchecked critical/high findings cannot close.                           |
| `analystChecks`                                                    | Dry-run-only coverage checks per persona/scenario; NOT observations or scored participant responses.                                     |

## Structural and semantic validation

JSON Schema rejects extra properties, invalid IDs/enums/types, score outside
0-2, critical flags with noncritical severity, critical score above 0, scored
unadministered/contaminated rows, invented confidence for unadministered tasks,
assisted 2 and critical severity without a supported flag.

Additional deterministic checks are required; a schema cannot establish
research validity:

1. IDs are unique; row identity matches session/scenario/question schedule.
2. Complete human baseline contains exactly 61 planned responses and all
   nine scenarios, with no unregistered substitutions.
3. Active time equals elapsed minus paused time when observed; all nonnegative.
   Censored time is a lower bound, not a completed find. Missed measurement
   uses null and reason. `FOUND` means a claimed location; score establishes
   whether interpretation was correct.
4. Expansions >= unique disclosures; task time is not renderer latency.
5. Guardrail score below 2 cannot carry `NO_FINDING`; material wrong answer is
   high or critical. Correct low-confidence or language-friction rows are
   reviewed separately from numeric scoring.
6. Dry-run coverage checks cannot count toward human scores or sample size.
7. Missing rows or null score make completion inconclusive; retain critical
   veto even if the session was later interrupted.
8. Critical/high findings require second-review agreement before closure;
   no rewrite of first responses. Later revisions/retests use new captures
   and explicit links to the original finding.
   Initial and second reviewer references must identify different reviewers.

Use [the rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md) for aggregation, fixed
denominators, confidence prioritization and adjudication. A schema-valid
capture is not a passing session.

## Dry-run scope and limitations

The committed fixture contains nine constructed question rows spanning all
nine scenarios and all four analyst role lenses, plus **36 design checks**
(28 core role/scenario pairs and eight freshness probes).
It is intentionally incomplete as a human session. Complete future captures
must not copy these answers or simulated seconds.

Analyst tests exercise schema rejection, valid critical/high/uncertain
observations, full schedule arithmetic, wrong-but-confident veto, incomplete
coverage and persona disparity. No human pass rate is computed from fixture.

Executed locally using the existing Ajv dependency and Node assertions:
schema compilation/fixture validation passed, the reference digest matched,
all 36 role/scenario checks were accounted for, **20 invalid capture cases**
were rejected and **nine constructed gate/arithmetic checks** passed.
These are protocol conformance checks, not new runtime tests or human results.

See [protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md) and
[session guide](CORA_SYNTHETIC_VALIDATION_SESSION_GUIDE.md).
