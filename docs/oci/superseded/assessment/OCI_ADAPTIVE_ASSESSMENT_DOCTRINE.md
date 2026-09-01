# OCI Adaptive Assessment Doctrine

**Doctrine version:** 1.0.0
**Status:** Active
**Scope:** OCRA (Organizational Continuity Risk Assessment) and every downstream
OCI engine that consumes its output.

---

## 1. Premise

OCRA is **not a quiz**. It is an *institutional sensing instrument*. Until now
it has applied a single, fixed lens to every organization that completes it —
a small union, a national federation, a hospital, and a crown corporation
have received the same questions, weighted the same way, narrated in the same
voice.

That uniformity is *legible* but it is not *true*. The continuity risks of a
five-person union local and a 4 000-person health authority are not the same
phenomenon, even when their composite scores coincide. Treating them as the
same risks two failures:

1. **Survey insult.** A small organization is asked enterprise-scoped questions
   that do not describe its reality.
2. **Interpretive thinness.** A large or federated organization receives a
   reading that misses the layered, jurisdictional, federation-coordination
   risks that actually concern it.

This doctrine introduces **deterministic institutional adaptation** to close
both gaps without sacrificing comparability, explainability, or dignity.

---

## 2. What adaptation is — and what it is not

| Term                          | What it means here                                            |
| ----------------------------- | ------------------------------------------------------------- |
| **Static question bank**      | The full inventory of OCRA questions. Never changes per org.  |
| **Adaptive question routing** | A deterministic subset of the bank is *selected and ordered* per institutional profile, with rationale. |
| **Adaptive scoring**          | Interpretation of the same raw score adapts to context (e.g. small-org concentration is read differently from enterprise concentration). The **raw** score remains comparable. |
| **Adaptive reporting**        | Narrative phrasing and emphasis adapt to institutional reality. Findings do not. |
| **Adaptive intelligence**     | Downstream OCI products (workbook, stabilization, runtime, intelligence network) receive richer institutional context alongside the scored profile. |

Adaptation is **never**:

- random,
- inferred from behavioural signals,
- inferred from anything the respondent did not explicitly declare,
- a psychometric or personality test,
- a personalization gimmick,
- a black box.

Every adaptive decision OCRA makes must be expressible in one sentence,
attributable to one or more form-declared inputs, and reproducible from the
same inputs forever.

---

## 3. Inputs to adaptation

Adaptation reads **only** the following respondent-declared values, captured
at the org-context step:

- `ctx_org_type` — organization type (selected from a fixed list).
- `ctx_sector` — primary sector (selected from a fixed list).
- `ctx_membership_size` → canonical `workforceBand`.
- `ctx_years_operating` → canonical `organizationAge`.
- `ctx_respondent_role` — respondent capacity (self-leader, board member,
  consultant, counsel, etc.).
- Derived `governanceModel` (already produced by `org-context-mapper.ts`).
- Derived `federationAffiliation` (already produced by the same mapper).

It does **not** read:

- IP address, geolocation, or device.
- Any free-text field.
- Any answer to a scored question.
- Any prior assessment by the same respondent.
- Any external dataset.

If any required input is absent, adaptation falls back to the **conservative
default**: the full question bank, no narrative adaptation, no facilitator
caveat, no downstream context enrichment beyond what raw scoring already
provides.

---

## 4. Adaptation must remain visible

The respondent must be able to know, in plain language:

1. That the assessment was tailored.
2. Why (which institutional dimensions drove the tailoring).
3. That **core continuity questions remain included** so the result remains
   comparable to assessments completed by other institutions.
4. That nothing about them as an individual was used.

The facilitator (and any reviewer) must additionally be able to see:

- Which question clusters were emphasized.
- Which were deferred (and the rule that deferred them).
- Which lens the system applied.
- Which interpretation caveats apply (e.g. external-advisor respondent).

This is recorded as a **`RoutingRationale[]`** alongside every assessment.

---

## 5. Comparability invariant

A small union and a national federation may receive **different question
sets**, but their composite scores remain on the **same 0–100 scale** with
the same maturity-band thresholds. Scale-adjusted *warnings* and
*interpretation* differ; the underlying number does not.

This is enforced by three rules:

1. The **core** continuity questions (those marked `adaptiveWeight: 'core'`)
   are always included for every assessment, regardless of profile.
2. Scoring normalization may re-weight *interpretation emphasis* across
   dimensions; it never re-weights individual answers.
3. The minimum routed question count is bounded below so the assessment
   cannot become so short that its composite ceases to be meaningful.

If any rule is violated, the routing engine refuses the route and returns the
full bank with a `routing_failure_safe_default` rationale.

---

## 6. Dignity rules

Adaptive narrative must never:

- **shame** a small organization for lacking enterprise infrastructure;
- **flatter** a large organization by assuming maturity it has not demonstrated;
- **patronize** a federated organization by oversimplifying its governance;
- **profile** a respondent based on their selected role.

The doctrinal phrasing the report uses for small organizations is:

> "In smaller institutions, continuity risk often concentrates in trusted
> individuals rather than formal systems. The concern is not lack of care; it
> is the absence of structural relief for the people carrying continuity."

For federated organizations:

> "In federated environments, continuity risk often appears as uneven
> interpretation across units, regions, committees, or affiliated bodies. The
> central question is whether institutional memory survives across the
> federation, not only within one office."

For external-advisor respondents:

> "Because this assessment was completed from an advisory perspective,
> findings should be treated as an external continuity reading and validated
> with internal stewards before operational decisions are made."

These passages and their French equivalents are version-locked to this
doctrine. They may evolve only through an explicit doctrine revision.

---

## 7. What this doctrine forbids

- No covert A/B testing of adaptive variants.
- No machine-learned routing model.
- No telemetry that records *which questions* a specific respondent was
  routed to (only aggregate counts by profile band).
- No comparative ranking of institutions.
- No reputational scoring of any kind.
- No org-name surfacing in routing telemetry.
- No use of `ctx_primary_challenge` (free text) in routing or scoring.

---

## 8. Implementation surfaces

| Surface                             | Module                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Institutional classification        | `lib/icra/adaptation/orgContextClassifier.ts`           |
| Complexity & exposure model         | `lib/icra/adaptation/orgComplexityModel.ts`             |
| Institutional profile shape         | `lib/icra/adaptation/institutionalProfileLens.ts`       |
| Question routing                    | `lib/icra/adaptation/questionRoutingEngine.ts`          |
| Eligibility rules                   | `lib/icra/adaptation/questionEligibilityRules.ts`       |
| Priority model                      | `lib/icra/adaptation/questionPriorityModel.ts`          |
| Scoring normalization               | `lib/icra/adaptation/adaptiveScoringModel.ts`           |
| Contextual interpretation           | `lib/icra/adaptation/contextualScoreNormalizer.ts`      |
| Domain emphasis                     | `lib/icra/adaptation/domainWeightingModel.ts`           |
| Facilitator guide                   | `lib/icra/adaptation/facilitatorAdaptationGuide.ts`     |
| Product 2 handoff                   | `lib/workbook/adapters/ocraAdaptiveHandoff.ts`          |
| Product 3 handoff                   | `lib/workbook/adapters/ocraToStabilizationAdapter.ts`   |
| Product 4 signal handoff            | `lib/runtime/adapters/ocraRuntimeSignalAdapter.ts`      |
| Product 5 signal handoff            | `lib/intelligence/adapters/ocraIntelligenceSignalAdapter.ts` |

Each surface is independently testable and independently auditable.

---

## 9. Versioning

This doctrine is versioned at the top of this file. The classifier and
routing engine expose a `IDENTITY_ADAPTATION_VERSION` constant that must
match. A doctrine revision requires:

1. Updated doctrine version.
2. Updated test snapshots for routing fixtures.
3. A new entry in the facilitator guide.
4. A bilingual passage refresh if dignity language changes.

The default posture is **conservative**: never adapt unless an explicit input
warrants it, and never widen a deferral rule without doctrine review.

---

*OCRA adapts. It does not personalize. It does not profile. It does not
guess. Every adaptation is an act of institutional respect.*
