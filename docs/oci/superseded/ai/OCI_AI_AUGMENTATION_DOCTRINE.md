# OCI AI Augmentation Doctrine

**ARTIFACT TYPE:** Institutional Doctrine — Transparent AI Augmentation
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Internal/engineering — not part of the public method surface. The canonical AI
doctrine is [`docs/oci/OCI_AI_BOUNDARY.md`](../../OCI_AI_BOUNDARY.md); this document and its
children describe implementation, not doctrine. See [`SUPERSEDED.md`](../../SUPERSEDED.md).
**INTENDED READER:** engineers implementing the synthesis layer
**PARENT DOCTRINE:** [docs/oci/OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md)
**RELATED:** [OCRA_AI_BOUNDARY_MODEL.md](OCRA_AI_BOUNDARY_MODEL.md) · [OCRA_AI_SYSTEM_ARCHITECTURE.md](OCRA_AI_SYSTEM_ARCHITECTURE.md) · [AI_DATA_BOUNDARY_MODEL.md](AI_DATA_BOUNDARY_MODEL.md) · [AI_DISCLOSURE_NOTICE.md](AI_DISCLOSURE_NOTICE.md)

> **Canonical statement.** AI assists continuity interpretation and synthesis. Institutional findings remain grounded in structured continuity signals, deterministic assessment logic, and reviewer-led interpretation.

---

## Purpose

This doctrine names — explicitly, and at the level of code, copy, and contract — where AI is allowed to assist OCI/OCRA work, and where it is forbidden. It exists so that institutions, procurement reviewers, and member representatives can verify the boundary in writing before they verify it in software.

The boundary is not a marketing posture. It is a load-bearing architectural rule enforced by:

- the synthesis engine's input contract ([`apps/union-eyes/lib/icra-ai/buildNarrativeContext.ts`](../../../../apps/union-eyes/lib/icra-ai/buildNarrativeContext.ts))
- the prompt registry ([`apps/union-eyes/lib/icra-ai/systemPromptRegistry.ts`](../../../../apps/union-eyes/lib/icra-ai/systemPromptRegistry.ts))
- the output validator ([`apps/union-eyes/lib/icra-ai/narrativeOutputValidator.ts`](../../../../apps/union-eyes/lib/icra-ai/narrativeOutputValidator.ts))
- the prohibited-patterns list ([`apps/union-eyes/lib/icra-ai/prohibitedAiPatterns.ts`](../../../../apps/union-eyes/lib/icra-ai/prohibitedAiPatterns.ts))
- the review workflow ([`apps/union-eyes/lib/icra-ai/reviewWorkflow.ts`](../../../../apps/union-eyes/lib/icra-ai/reviewWorkflow.ts))
- the governance tests under [`apps/union-eyes/lib/icra-ai/__tests__/`](../../../../apps/union-eyes/lib/icra-ai/__tests__)

If any of those modules drift from the rules below, the corresponding test fails. The boundary is part of the build.

---

## What AI assists with

| AI Layer               | Allowed | Forbidden |
|------------------------|---------|-----------|
| Narrative synthesis    | ✅ Yes  | AI scoring |
| Executive drafting     | ✅ Yes  | Autonomous judgment |
| Workshop summarization | ✅ Yes  | Behavioural profiling |
| Translation refinement | ✅ Yes  | Psychological inference |
| Pattern summarization  | ✅ Yes  | Hidden ranking |
| Tone refinement        | ✅ Yes  | Institutional grading |

## What AI never does

AI in OCI/OCRA never:

- calculates scores
- determines maturity bands
- determines continuity risk
- changes adaptive routing
- alters telemetry
- profiles users
- infers emotions
- ranks institutions
- produces legal conclusions
- produces HR-style diagnostics
- replaces facilitator interpretation
- replaces reviewer endorsement

These are the standing rules. Any feature that proposes to relax any of them is rejected at design review and blocked by the governance tests.

---

## Output types

AI may generate the following draft narrative artefacts (always reviewer-edited before delivery):

```
ExecutiveSummary
ContinuityNarrative
OperationalObservation
GovernanceReflection
StewardshipObservation
ContinuityTransitionNarrative
ModernizationAlignmentNarrative
BoardBriefNarrative
FacilitatorSummary
```

AI must never generate:

```
RiskScore
InstitutionRank
GovernanceGrade
InstitutionalTrustScore
PsychologicalProfile
LeadershipRating
```

---

## Required UX language

The user interface must never say:

- "AI evaluated your organization"
- "AI identified risk"
- "AI predicted"
- "AI classified your governance"

The user interface should instead say:

- "Narrative synthesis"
- "AI-assisted continuity summary"
- "Reviewer-assisted interpretation"
- "Structured continuity interpretation"

This distinction is enforced in [`aiDisclosureCopy.ts`](../../../../apps/union-eyes/lib/icra-ai/aiDisclosureCopy.ts) and verified by `aiDisclosureIntegrity.test.ts`.

---

## Human review enforcement

No AI-generated executive narrative becomes final without an explicit human review state transition. The supported states are:

```
draft → reviewed → approved
                 ↘ rejected
```

The transitions are enforced in [`reviewWorkflow.ts`](../../../../apps/union-eyes/lib/icra-ai/reviewWorkflow.ts) and tested by `reviewWorkflowIntegrity.test.ts`.

---

## Auditability

For every AI-assisted narrative artefact, OCI persists only:

- prompt version
- synthesis version
- reviewer status
- narrative generation timestamp
- deterministic signal references (band identifiers, archetype identifiers — never raw inputs)

OCI does not persist:

- raw prompts containing sensitive organization context (unless explicitly required and consented)
- telemetry
- hidden embeddings
- behavioural inference
- vectorized personality models

See [`aiNarrativeAuditRecord.ts`](../../../../apps/union-eyes/lib/icra-ai/aiNarrativeAuditRecord.ts).

---

## Procurement statement

OCI's procurement materials (trust center, security overview, AI boundary) carry the canonical statement at the top of this doctrine verbatim. Procurement reviewers can verify the statement against the code modules listed in [Purpose](#purpose).

---

## Sign-off

- **Author:** OCI Doctrine Working Group
- **Engineering owner:** Continuity Intelligence Squad
- **Governance owner:** OCI Doctrine Council
- **Status:** Canonical — changes require Doctrine Council review.
