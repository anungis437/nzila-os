# Union Eyes — Family 1 nine-finding source-engineering acceptance

- **Scope:** the nine canonical Family 1 findings named by the programme on 2026-11-09.
- **Baseline:** B167 at `9915fa4031cfbdb1f6d1b11c1385858e0083e784`.
- **This record:** B168 adds three bounded corrections where a finding still failed a concrete acceptance criterion.
- **Exact SHA:** the commit that adds this file. The SHA and its remote CI results are recorded on PR #1137.

## What this record is and is not

This records **source engineering** only. For each finding it asks: has the original defect been eliminated in source, including affected consumers, persistence, authorization and adverse behaviour?

It is **not** independent qualification. It is **not** institutional acceptance. It is **not** security-design approval: the `security-design-reviewed` gate stays with the authorized reviewer. Every finding stays `IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION`, and none is closed.

Evidence was reused wherever it was sufficient. Engineering was reopened only on a concrete failing criterion. That happened for three findings, each marked **B168** below.

## Verdicts

| # | Finding | Verdict | Basis |
|---|---|---|---|
| 1 | `DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW` | PASS | See 1 |
| 2 | `DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR` | PASS after B168 | See 2 |
| 3 | `DEF-0B7-COGA-PROFILES-MEASURE-ENTERED-MEMORY-ROWS-NOT-GOVERNANCE` | PASS | See 3 |
| 4 | `DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE` | PASS (B167) | See 4 |
| 5 | `DEF-0B7-EXC-COPILOT-EXPLAINABILITY-IS-FIXED-TEXT-AND-NOT-STORED` | PASS | See 5 |
| 6 | `DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS` | PASS after B168 | See 6 |
| 7 | `DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS` | PASS after B168 | See 7 |
| 8 | `DEF-0B7-COGB-RESILIENCE-INDEX-TREND-AND-DOCUMENTATION-QUALITY-ARE-HEURISTIC-LABELS` | PASS | See 8 |
| 9 | `DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST-EXTRAPOLATES-TWO-TYPED-SCORES` | PASS | See 9 |

### 1. Consent and reclassification

**Consent.**
- `app/api/exit-interviews/[id]/governance/route.ts` refuses an administrator's `consentGranted: true` with 409, and writes and audits nothing.
- The body schema is strict.
- Withdrawal deactivates the knowledge-base copy and erases its embedding in the same transaction.
- No other write path sets consent.

**Reclassification.**
- Lowering an interview out of `legal_sensitive` or `executive_confidential` creates a pending request.
- A distinct `national_officer+` reviewer must approve the request. Self-approval and stale requests are refused.
- Approval is exactly-once under a conditional update.

**Stale reads.** Every write is conditioned on the row version that was read, and a concurrent change returns 409.

**Adverse tests.** `exit-interviews-governance.route.test.ts`: 21 cases.

**Limit.** No retiree-authored consent capture exists, so an interview can't be made indexable by consent today. That is a missing capability, not this defect.

### 2. Cognition memory (B168)

**Already in place.**
- Authorship is stamped server-side under a reserved payload key the caller can't set (`recordedBy`, plus the audit record).
- The payload is bounded to 16 KB.
- A simulation snapshot given a scenario is computed by the server (`system_generated`, with workflow, model version, scenario and input evidence ids).

**Failing criterion found.**
- A system simulation's `immediateImpactScore` was stored as `resilienceScoreAtCapture`. That figure is disruption severity, where higher is worse; resilience runs the other way.
- The timeline then plotted it as resilience, labelled it `officer_asserted`, and differenced it against typed resilience scores.

**Correction.**
- The impact score stays in the stored result only.
- `resilienceScoreAtCapture` is null for such entries.
- The timeline therefore holds only scores whose source it names, and so does every profile engine built on it.

**Test.** `memory-store.test.ts` asserts null.

### 3. Governance profiles

**Behaviour, culture and archetype.**
- These report insufficient history or zero evidence coverage instead of a fabricated characterization.
- The empty-history archetype narrative says it is "not a characterization", and the `methodologyNote` names officer-entered input.

**Coherence and momentum.** These refuse with `NOT_IMPLEMENTED` (501) and return no profile.

**Adaptation and adaptive resilience.** These return `insufficient_history`.

**Upstream fix.** Finding 2's correction removes non-resilience figures from the timeline these engines read.

### 4. Propagation

Accepted at B167. The evidence contract has these parts:

- Directed edges.
- Claim-level confirmation.
- Identity key version 2 with ambiguity detection.
- A single currentness evaluator.
- Document content binding and external attestation tiers (platform 0087, with database checks).
- Explicit re-verification.

Every consumer is routed through the evaluator, including the reviewer and alias interfaces. Native PG 15 and 16 passed on `9915fa403`.

### 5. Copilot explainability

**Envelope contents.**
- The envelope describes what the system computed and supplied as context. It never claims a retrieval by the model.
- Evidence coverage is derived from node counts, not a fixed "high".

**Persistence.** The envelope is persisted inline with the assistant message in the same audited transaction.

**Limit.** There is no per-claim attribution of the model's answer to the envelope. The envelope describes the inputs, not the claims.

### 6. Risk ratings (B168)

**Already in place.**
- The expertise map returns `coverageConcentrationLevel`, not a risk rating.
- It returns `hasRiskData` to distinguish "no score" from "scored zero".
- Roles are suppressed below the minimum cohort.
- Coverage gaps use the schema's role enum.
- An organization with no interviews gets `overallRiskScore` null, not 0.
- Decision-brief confidence is derived from counts.

**Failing criterion found.**
- `overallRiskScore` was still fixed capped weights over counts, with nothing saying so.
- The health panel presented it as High, Moderate or Low Risk.

**Correction.**
- The report carries `scoreBasis: fixed_rule_index_over_interview_counts` and a `methodologyNote` stating the exact rule.
- The panel labels the figure a rule-based coverage index.

**Test.** `risk-detector.test.ts`.

### 7. Succession readiness (B168)

**Failing criterion found.** The core defect remained:

- Readiness was `100 − (roles with no interview / 5) × 50 − 10 × minimal roles`.
- So more recorded departures produced higher "transition readiness".
- Per-role readiness came from interview counts.
- Roles were hand-coded.

**Correction.**
- The data model holds no successor, handover or documentation record, so readiness is not scored.
- `transitionReadinessScore` is null, with `transitionReadinessBasis: not_assessed_no_successor_records`.
- Per role, the report gives `departureDocumentation` and `departureDocumentationCoverage`.
- Roles come from `exitInterviewRoleEnum`.
- The cockpit shows readiness as not assessed.

**Adverse test.** An organization with more departures does not read as more ready.

### 8. Resilience index

**Documentation quality.** The interview-count "doc quality" figure has been removed.

**Trend and maturity.**
- `trend` and `maturityLevel` are documented in the type and in the response's `methodologyNote` as a single-snapshot concentration signal and score cut-offs. They are not a measured trend or a maturity assessment.
- No screen or consumer renders them.

### 9. Learning trajectory forecast

**Minimum points.** No forecast is produced below 5 points; it used to be produced from 2. Below the threshold the observed series is returned in full, and `estimatedMonthsToNextMilestone` is null.

**Projection band.** The former "confidence range" is a `projectionBand`. It is documented as a fixed formula, not an interval derived from the data.

**Input.** The input timeline carries only named-source scores (see finding 2).

## Verdict

**FAMILY 1 SOURCE-ENGINEERING PASS:** all nine findings, at the commit adding this record.

**Still not done:**
- Independent qualification.
- Institutional acceptance.
- Security-design approval.
