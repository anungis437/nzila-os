# OCRA AI Boundary Model

**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**PARENT:** [OCI_AI_AUGMENTATION_DOCTRINE.md](./OCI_AI_AUGMENTATION_DOCTRINE.md)

> **Canonical statement.** AI assists continuity interpretation and synthesis. Institutional findings remain grounded in structured continuity signals, deterministic assessment logic, and reviewer-led interpretation.

---

## The OCRA boundary, restated for the assessment surface

OCRA (Organizational Continuity Risk Assessment) produces deterministic continuity findings. AI assists the narrative articulation of those findings; AI does not produce, alter, or rank the findings themselves.

### What AI receives

The synthesis layer receives a **`NarrativeContext`** object that contains only:

- maturity bands (e.g. `pillar.maturity = 'developing'`)
- continuity confidence signals (band labels only)
- structural continuity signals (band labels only)
- adaptive context bands (`institutionalScale`, `continuityComplexity`, `governanceComplexity`, `continuityExposure`, `respondentLens`)
- archetype identifiers + canonical summaries
- continuity breakpoint identifiers
- onboarding survivability findings (deterministic findings only)
- governance continuity observations (deterministic findings only)
- locale (`en-CA` or `fr-CA`)
- prompt version + synthesis version

### What AI never receives

- raw answers
- raw free text from respondents
- raw workshop transcripts (unless explicitly consented and gated by a separate workflow)
- telemetry events
- typing cadence
- session timing
- behavioural metadata
- emotional inference signals
- hidden profile identifiers
- organization names (unless explicitly required for a board brief AND consented; never inferred)

This boundary is enforced by [`buildNarrativeContext.ts`](../../../apps/union-eyes/lib/icra-ai/buildNarrativeContext.ts), which builds the context from typed structured signals only and is unit-tested for absence of forbidden fields.

---

## Behaviour the AI must exhibit

The AI must behave like:

> a governance-aware continuity analyst.

The AI must not behave like:

- a therapist
- a consultant persona
- a motivational coach
- a compliance bot
- a management guru
- a risk classifier
- a behavioural profiler

Tone must remain calm, operational, institutional, precise, and emotionally mature.

---

## Forbidden output patterns

Any AI output containing the following patterns is rejected by [`narrativeOutputValidator.ts`](../../../apps/union-eyes/lib/icra-ai/narrativeOutputValidator.ts):

- "high-risk organization"
- "poor leadership"
- "failing governance"
- "unsafe organization"
- "weak institution"
- "toxic culture"
- "AI determined"
- "AI predicts"
- "AI detected emotional"
- legal conclusions ("violates", "breach", "non-compliant with [statute]")
- psychological assumptions ("the leadership feels", "members are anxious")

See [`prohibitedAiPatterns.ts`](../../../apps/union-eyes/lib/icra-ai/prohibitedAiPatterns.ts) for the full machine-readable list.

---

## Validation gates

Every AI output passes through the following gates before reaching reviewers:

1. **Tone validation** — calm, operational, non-punitive.
2. **Governance-safe language validation** — no legal/HR/psychological diagnostics.
3. **Explainability validation** — references at least one deterministic signal by identifier.
4. **Certainty moderation** — no absolute predictive claims.
5. **Reviewer-presence validation** — output is marked `draft` until a reviewer transitions it.
6. **Anti-surveillance validation** — no references to behavioural or telemetry signals.
7. **Institutional dignity validation** — preserves the institution's voice and authority.

If any gate fails, the output is rejected and not surfaced to reviewers.

---

## Procurement-grade summary

> OCRA uses AI to draft narrative paragraphs that articulate deterministic continuity findings. AI never scores, ranks, classifies, or profiles. Every AI-assisted paragraph is reviewer-edited before delivery. The boundary is enforced in code, tested in CI, and documented for procurement review.
