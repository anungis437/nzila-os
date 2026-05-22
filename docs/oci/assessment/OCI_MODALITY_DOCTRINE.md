# OCI Assessment Modality Doctrine

**Status:** Canonical · OCRA v3 · Bank version 3
**Scope:** Governs which question modalities OCRA uses, when each is appropriate, and what each must never become.

---

## 1. First Principle

Question modalities are **institutional sensing infrastructure**.
They are not engagement mechanics, not psychometric instruments, not survey gimmicks.

OCRA exists to sense institutional continuity with operational realism.
Modality choice is therefore a methodological decision, not a UX decision.

---

## 2. Recognized Modalities

OCRA recognizes exactly three modalities. New modalities are not permitted without a written doctrine amendment.

| Modality          | Sensing role                              | Intelligence captured                                                         |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `maturity_select` | Continuity maturity ladder                | Where the institution sits on the continuity maturity progression             |
| `likert_5`        | Institutional confidence sensing          | Confidence, clarity, ambiguity, alignment, operational trust, survivability   |
| `multiple_choice` | Structural continuity pattern detection   | Governance topology, transfer patterns, inheritance, stewardship distribution |

---

## 3. `maturity_select` — The Backbone

`maturity_select` remains the dominant modality. It represents the backbone of OCRA and must continue to do so.

**Target share:** approximately 65–75% of the scored assessment surface.

**Appropriate for:**

- Continuity maturity
- Governance sophistication
- Survivability readiness
- Onboarding resilience
- Stewardship sustainability
- Operational continuity evolution

**Must never become:**

- A productivity ladder
- An HR maturity rubric
- A surveillance index of named individuals or named teams

The five-point maturity ladder (`Absent → Informal → Partial → Structured → Institutional`) is canonical.
Maturity ladder seriousness is not weakened, softened, or gamified.

---

## 4. `likert_5` — Institutional Confidence Sensing

`likert_5` is reserved for **continuity confidence sensing** — what the institution *perceives* about its own continuity posture.

**Target share:** 6–8 questions.

**Appropriate domains:**

- Operational clarity
- Governance confidence
- Reconstruction confidence
- Onboarding confidence
- Modernization continuity confidence
- Continuity recoverability confidence

**Question form:**

Statements about institutional reality. Respondent reports the degree to which the statement is true.

> "Operational knowledge is consistently recoverable when key individuals are unavailable."

**Forbidden form:**

- "Do you agree?"
- "How satisfied are you?"
- Opinion questions about individuals
- Affective or attitudinal probes

`likert_5` measures perceived continuity reality, not satisfaction.

---

## 5. `multiple_choice` — Structural Pattern Detection

`multiple_choice` is reserved for **structural continuity pattern detection** — surfacing which continuity topology an institution operates under.

**Target share:** 4–6 questions.

**Appropriate domains:**

- Operational knowledge transfer patterns
- Governance escalation structures
- Continuity ownership patterns
- Modernization operational pathways
- Onboarding inheritance structures

**Question form:**

A question with mutually exclusive structural answers, each representing a recognizable continuity pattern.

> "How does operational continuity most commonly transfer today?"
>
> - Documented procedures
> - Structured shadowing and apprenticeship
> - Committee-based inheritance
> - Informal mentorship
> - Escalation dependency on a few individuals
> - Undocumented continuity held by long-tenured staff
> - Reconstructed from scratch at each transition

**Forbidden form:**

- Branching quizzes
- Personality classifiers
- Best/worst comparisons
- "Pick the right answer" framings
- Demographic targeting

Each option is a structural archetype, not a correct answer. Selection contributes to archetype detection, not scoring rank.

---

## 6. Scoring and Modality

- `maturity_select` contributes to dimension scoring via its option score (0.00–1.00).
- `likert_5` contributes to dimension scoring via its normalized 1–5 scale (linear map to 0.00–1.00).
- `multiple_choice` may contribute to scoring through option `score` values, but its primary contribution is **archetype signal generation**, not composite score movement.

No modality alters the composite formula. All three are weighted through the same dimension-contribution model already documented in `OCI_METHOD.md`.

---

## 7. Anti-Gimmick Invariants

Across all modalities, the following are forbidden:

1. Quiz tone or quiz pacing
2. Game-style feedback
3. Engagement-maximizing copy
4. Branching for narrative effect
5. Adaptive scoring that hides logic
6. Personality typing
7. Leaderboards or comparative ranking
8. Affective copy that pressures respondents

Failure of any invariant blocks the bank from release.

---

## 8. Modality Distribution Discipline

The released bank distribution is verified by `assessmentModalityInvariant.test.ts`.

Distribution drift outside the published bounds is treated as a doctrine deviation and must be either corrected or explicitly accepted by a doctrine amendment with rationale.

---

## 9. Evolution Discipline

- New modalities require a doctrine amendment.
- Modality role changes require a doctrine amendment.
- Distribution changes outside ±2 questions require a doctrine amendment.
- Bank version increment is required whenever modality composition changes.

This document is the source of truth. Code, copy, and tests align to it — not the reverse.
