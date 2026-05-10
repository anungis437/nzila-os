# Explainability Standards

Every cognition output is wrapped in an `InstitutionalExplainabilityEnvelope`.
The envelope is the **single contract** between cognition engines and any
human (or automated) consumer.

## Required Fields

| Field                     | Why it exists                                             |
|---------------------------|-----------------------------------------------------------|
| `organizationId`          | Scope guarantee — never a personal scope.                 |
| `domain`                  | Cognition domain that produced the result.                |
| `payload`                 | Domain-specific cognition output.                         |
| `confidence`              | Canonical confidence band.                                |
| `evidence`                | Concrete evidence items backing the conclusion.           |
| `reasoning`               | Step-by-step chain explaining HOW the result was reached. |
| `assumptions`             | Continuity assumptions the result depends on.             |
| `governanceImplications`  | What humans must review, with severity.                   |
| `provenance`              | Engine id, version, contract version, timestamp.          |
| `interpretationGuidance`  | Plain-language guidance for reviewers.                    |

## Confidence Bands

`very_high | high | moderate | low | insufficient_data`

Use `confidenceBandFromScore(0..100)` from the kernel — never define your own.

## Evidence Discipline

- Evidence items must be **organizational** records (decisions, plans,
  governance actions, continuity events) — never personal records.
- Each item carries a stable `id` for cross-reference in audit chains.
- Reasoning steps reference evidence by `evidenceIds`, ensuring chain integrity.

## Reviewer Workflow

Every envelope answers four questions for a human reviewer:

1. **What** is the conclusion? (`payload`, `interpretationGuidance`)
2. **Why** is it the conclusion? (`reasoning`, `evidence`)
3. **How** sure are we? (`confidence`, `assumptions`)
4. **What** must we do? (`governanceImplications`)

If any of those questions cannot be answered from the envelope, the engine
is non-conformant and must not register with the kernel.
