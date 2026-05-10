# Shared Operational Language System

> **Status:** Canonical convergence · **Layer:** Language · **Inherits:** [README.md](README.md)

## 1. Objective

Standardize the operational vocabulary so every term means the same thing in every Nzila product.

## 2. Canonical glossary

| Term | Canonical meaning |
|---|---|
| Governance | The cited authority under doctrine to make institutional decisions. |
| Review | An append-only, doctrine-cited recording of an institutional decision. |
| Stabilization | A slowing or pausing of change to preserve continuity. |
| Continuity | System-scoped operational integrity over time. |
| Rollout | A pacing-bounded change to a deployed environment. |
| Intelligence | Read-only interpretive material; never operational instruction. |
| Legitimacy | A release × environment × verdict statement bound to cited evidence. |
| Evidence | Content-hash-anchored material cited by a decision or attestation. |
| Posture | A banded reading of operational state at a moment in time. |
| Attestation | A signed envelope binding a class, verdict, and cited evidence. |
| Modernization | Change executed under continuity discipline. |
| Operational readiness | The banded readiness of a system to absorb a planned change. |

## 3. Required rule

A term MUST NOT change meaning between apps. A product that needs a divergent meaning either:

1. Promotes a new canonical term into this glossary by cited change, or
2. Refuses the meaning at the product boundary.

## 4. Refused vocabulary

Words explicitly refused as primary operational vocabulary:

- "Score", "rating", "ranking" — composite scoring is refused.
- "Real-time", "live alert" — refresh is cadence-bound.
- "Critical", "urgent", "emergency" — reserved for verified blocking events.
- "Productivity", "performance" applied to people — refused at every boundary.

## 5. Required outputs

The glossary ships in [`@nzila/operational-convergence`](../../packages/operational-convergence) as `CANONICAL_GLOSSARY` and `defineTerm(term)`.

## 6. Discipline

Language drift is a doctrine-bearing regression. Drift is reverted or promoted; never absorbed silently.
