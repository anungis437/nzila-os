# Cora Human Comprehension Rubric

**Version:** `cora-comprehension-1.0` | **Human evidence:** none.

Private moderator/analyst key for [the protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md).
Do not show this document before baseline answers. Plain-language paraphrases
are acceptable; exact GUIDs, code spelling and architectural terminology are
not required. Pointing to a field is not sufficient without explaining meaning.

## Question bank and scenario-sensitive key

Use the frozen question/scenario allocation in the protocol. Ask open prompts,
not the answer fragments in this table. "Unknown" can be fully correct when
the UI cannot establish a fact.

| ID  | Participant prompt                                                  | Full-credit meaning (2)                                                                                                                                                                        | Guardrail |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Q01 | What evidence is being used here?                                   | Identify displayed evidence/version or class and scope in S1. S6: details are withheld; cannot identify it.                                                                                    | No        |
| Q02 | Where did it come from?                                             | Source system/provider, distinct from issuer. S5 must identify both providers in conflict.                                                                                                     | Yes       |
| Q03 | Who issued or stands behind the assertion?                          | Displayed issuer, not Cora or provider merely because it transports data. S5 includes both issuers.                                                                                            | Yes       |
| Q04 | What did Cora do with it?                                           | Technical interpretation and governed workflow support, not certification or final decision.                                                                                                   | Yes       |
| Q05 | What requirement is being checked?                                  | Recipient-specific requirement/version or plain description. S2: organic-status plus missing supplemental-review. S6: requirement not disclosed.                                               | No        |
| Q06 | Who owns that requirement?                                          | Named synthetic institution/requirement owner, not Cora or source provider.                                                                                                                    | Yes       |
| Q07 | What did the technical check establish?                             | S1 matched; S2/S7 partial; S3 past match; S4 old match historical and successor check separate; S5 conflicting assertions, no settled sufficiency; S9 past match versus expired current check. | No        |
| Q08 | Is the operator approved here? What supports your answer?           | No approval established by this view; match/partial/history/conflict/denial is not an institutional decision. S6 does not prove rejection either.                                              | Yes       |
| Q09 | Who makes the institutional decision?                               | Displayed recipient decision authority; Cora does not make it. An external reference is not an inferred outcome.                                                                               | Yes       |
| Q10 | Is this evidence current? How do you know?                          | S1/S2 not verified; S3/S4 history not current proof; S8 stale; S9 expired context, currentness not verified. Workflow context is not source currentness.                                       | Yes       |
| Q11 | What remains unknown or unresolved here?                            | S1 currentness/decision/non-disclosure actions; S2 supplemental-review and recipient decision; S5 conflicting assertions; S6 details and exact cause; S8 current reliable state.               | No        |
| Q12 | Could this evidence be used elsewhere? What would you need to know? | Only in independently authorized context with source/recipient rights and recipient requirements; not automatic permission or acceptance. No actual new use is requested.                      | Yes       |
| Q13 | Was evidence actually reused in this workflow? Explain.             | S1 none established; S2 qualified use from earlier governed context, still partial; S7 attempt not qualified because reconstruction trace.                                                     | No        |
| Q14 | What changed when permission was revoked?                           | New use stopped; authorized historical viewing here is separate, not reuse permission.                                                                                                         | Yes       |
| Q15 | What remains historical here, and what can you do with it now?      | Past technical check/audit survives; not currently actionable. S9 expiry does not erase prior match. No universal physical-deletion or retention-right claim.                                  | Yes       |
| Q16 | What does the disagreement mean? Who would resolve it?              | Both assertions conflict; Cora selected no winner; issuers clarify/correct and authorized recipient process determines next steps.                                                             | Yes       |
| Q17 | Which workflow would you follow next, and why?                      | Authorized successor in S4, preserving old history; successor is not institutional approval or verified current source state.                                                                  | Yes       |
| Q18 | What does this view permit you to do with the evidence now?         | Named recipient/purpose only where permitted; keep/export/restore not established. S3 no new use; S6 no evidence showing/use in this context, no guessing hidden rights.                       | Yes       |
| Q19 | What would another institution still need to decide for itself?     | Own requirements, permissions and decision; another recipient's disposition does not transfer.                                                                                                 | Yes       |
| Q20 | Why did this attempt not qualify as evidence reuse?                 | Reconstruction occurred; similarity, copy or duplicate upload alone does not prove governed reuse.                                                                                             | Yes       |

Moderator landmarks: Overview for permission/currentness/result; Evidence
and authority for provider/issuer; Requirement for criteria/owner; Reuse for
origin/reconstruction; Decision for recipient ownership; Lineage for history.
The [view contract](CORA_OPERATOR_WORKFLOW_VIEW_CONTRACT.md) is authoritative
for limits, not hidden fixture data participants cannot see.

## First-answer scoring

- **2:** Correct scenario-specific meaning without assistance; no contradictory
  material statement. A spontaneous "cannot know from this view" is 2 when
  warranted. Confidence is captured separately.
- **1:** Partially correct, material omission, or correct only after neutral
  clarification. A response mixing correct and wrong governance assertions
  is not 1: score 0 and flag the misconception.
- **0:** Materially wrong or participant explicitly cannot answer a task whose
  meaning is displayed. Completed timeouts with no explanation score 0.
- **null:** Not administered, withdrawal, interruption or observation/capture
  failure. This makes the participant incomplete; not a zero and not excluded
  quietly to improve a percentage.

After the first explanation, collect confidence and lock scoreable baseline.
Record neutral clarification/probe and subsequent answer separately.
If assistance occurred before the first explanation was finalized, record it
and cap otherwise-correct credit at 1. Teaching or exposing the key contaminates
the observation: mark it incomplete, do not turn it into a 2. Answer changes
after lock never overwrite initial scoring.

## Critical misconception flags

| Flag                                    | Severe interpretation                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| `CORA_CERTIFIED_OPERATOR`               | Cora certified the operator.                               |
| `MATCHED_EQUALS_APPROVED`               | Technical match means approval.                            |
| `CORA_OWNS_FINAL_DECISION`              | Cora is final institutional decision owner.                |
| `STALE_OR_HISTORY_IS_CURRENT`           | Stale/unverified/historical state is guaranteed current.   |
| `DECISION_TRANSFERS_INSTITUTIONS`       | One institution's disposition determines another's.        |
| `REUSE_TRANSFERS_RIGHTS`                | Technical reuse automatically grants onward rights.        |
| `CONFLICT_ALREADY_RESOLVED`             | Displaying conflicting assertions selected a winner.       |
| `REVOCATION_ERASES_HISTORY`             | Revocation itself erases past facts/results.               |
| `PROVIDER_EQUALS_ISSUER`                | Provider and issuer roles are necessarily interchangeable. |
| `DISCLOSURE_GRANTS_KEEP_EXPORT_RESTORE` | Disclosure automatically grants those distinct rights.     |

A demonstrated assertion of any flag is **0** and
`CRITICAL_GOVERNANCE_MISUNDERSTANDING`, regardless of confidence or totals.
Uncertainty/omission alone is not a fabricated critical flag; a guardrail
score below 2 still blocks advancement. Explicit contradictory statements
stay visible even if the participant later corrects them.

## Finding severity and confidence

| Severity                               | Coding rule                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `CRITICAL_GOVERNANCE_MISUNDERSTANDING` | At least one supported critical flag; advancement blocked.                                                                        |
| `HIGH_COMPREHENSION_FAILURE`           | Material wrong answer without a critical flag, failed guardrail, or assistance needed to understand load-bearing meaning.         |
| `MEDIUM_LANGUAGE_FRICTION`             | Terminology ambiguity without material wrong interpretation; includes correct low-confidence explanation needing language review. |
| `LOW_PRESENTATION_FRICTION`            | Pure locating/layout friction with correct interpretation; not a downgraded governance failure.                                   |
| `NO_FINDING`                           | Correct independent explanation, no observed confusion/friction or supported misconception.                                       |

Capture evidence before adjustment recommendations. High-confidence 0 answers
are priority review items within their severity, not a new score weighting.
Confidence-low 2 remains 2; record uncertainty separately. Missing confidence
is null with reason, never inferred from tone. Critical/high findings need
second-reviewer adjudication; preserve both scores if reviewers disagree.

For a not-administered row, `NO_FINDING` means no observation was made, not
that comprehension passed. Its null score still makes coverage incomplete.

## Aggregation and veto

For complete participants:
`comprehension = sum(firstAnswerScore) / (2 * 61)`.
No rounding before threshold comparison. Participant mean by persona has
equal participant weight; no mixed denominator or repeated-question pseudo-n.
Also report each question/scenario and guardrail with counts and score totals.
Incomplete sessions have no final pass rate; report observed points and
missing responses separately.

Proposed thresholds (T6: unvalidated local design choices, confidence L):

- At least **85%** per participant and per persona: at least **104/122** points.
- Every planned guardrail response equals **2**, including authority/decision
  ownership, match-not-approved, source currentness and history.
- Zero critical flags, no unresolved high findings or coding disputes.
- Persona mean gap at most **10 percentage points**; coverage complete.

Decision order: invalid/incomplete -> inconclusive; supported critical or
failed safety guardrail -> block; unresolved high/dispute -> block; numerical
or persona gap failure -> revise/retest; all pass -> bounded research gate
only. An observed critical error still blocks even in an incomplete session.

### Analyst arithmetic checks, not participant results

| Constructed case                               | Calculation                                | Decision                                                       |
| ---------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| One critical answer, all other answers correct | 120/122 = 98.36%; critical flag present.   | Block; high total cannot hide error.                           |
| One guardrail partly understood                | 121/122 = 99.18%; one guardrail score 1.   | Block even without explicit critical flag.                     |
| Nine non-guardrail material errors             | 104/122 = 85.25%.                          | Numerical threshold met; unresolved high findings still block. |
| Ten non-guardrail material errors              | 102/122 = 83.61%.                          | Threshold fails.                                               |
| One response not administered                  | 60 observed rows; no complete denominator. | Inconclusive, not a 100% pass on remaining rows.               |
| Persona means 100%, 100%, 100%, 86%            | Each exceeds 85%; gap is 14 points.        | Block persona disparity despite pooled 96.5%.                  |

These deliberately constructed totals test rules, not expected human behavior.
Never report analyst dry-run scores as comprehension rates.

## Retest

Critical/high changes require the original failed scenario, one unaffected
scenario and at least one different persona, with a pinned revised reference,
first-answer capture and independent adjudication. Original finding cannot
be deleted or closed merely because code tests pass. See [the protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md).
