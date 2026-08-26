# Institutional Engineering Corpus Qualification Program

| Field | Value |
| --- | --- |
| Program phase | Wave 2 — Corpus Qualification |
| Status | Proposed; pending authorized steward confirmation |
| Scope | Qualification of ingested corpus artifacts; no Nzila adoption or implementation |
| Decision authority | Unassigned |
| Prerequisite | Wave 1 recovery and constitutional ingestion |

## Purpose

Wave 2 qualifies recovered corpus material before further corpus expansion. Ingestion establishes that a source has been recovered with recorded provenance. Qualification determines whether a recovered working draft is sufficiently coherent, evidenced, attributable, and governed to become an approved canonical corpus artifact.

An approved canon remains distinct from a candidate standard, Nzila adoption, implementation, and validation.

## Qualification Pipeline

Each artifact follows these ordered review gates. A gate may record a pass, conditional pass, or return for revision; no gate is implied by passage through a later state.

1. Recovered source
2. Editorial review
3. Technical review
4. Architectural review
5. Evidence review
6. Cross-reference review
7. Terminology review
8. Originality review
9. Nzila alignment review
10. Approved canon
11. Candidate standard
12. Adopted by Nzila
13. Implemented
14. Validated

Only the first state is presently evidenced for IEBOK-0 and IEBOK-I.1 through IEBOK-I.3. The source-declared `working_draft` lifecycle remains controlling until an authorized decision records a different corpus state.

## Evidence Expectations

Qualification records must identify the reviewed artifact and edition, reviewer role, review date, findings, disposition, and evidence references. The program may not treat self-description, source availability, or an existing Nzila feature as evidence of technical validity, external originality, or implementation conformance.

The following assertions require independent evidence before an approved-canon decision:

- terminology is defined consistently and has no unresolved collision;
- technical and architectural claims are internally coherent;
- claims have a traceable evidence basis or are explicitly identified as hypotheses;
- citations and dependencies resolve to a recorded edition;
- claimed originality, prior art, and attribution have been reviewed;
- the relationship to Nzila methods is recorded without reclassifying those methods.

## Knowledge-System Direction

The future Institutional Engineering Knowledge System is concept-centric: documents discuss first-class governed entities rather than owning their meaning. This program does not construct a graph or assert relationships not supported by reviewed evidence.

When introduced in Wave 3, the graph will use separate entity classes for concepts, principles, patterns, anti-patterns, variables, theories, equations, evidence, observations, documents, standards, Nzila implementations, and reference cases. Relationships must distinguish at least `defines`, `uses`, `appears_in`, `references`, `supported_by`, `implemented_by`, `observed_in`, and `validated_by`.

## Boundary Model

Three evidence domains remain separate in every qualification record:

| Domain | Meaning | Prohibited inference |
| --- | --- | --- |
| Engineering truth | A corpus claim, definition, principle, hypothesis, or relationship | A Nzila feature proves the claim without evidence review |
| Nzila implementation | Nzila's independently governed method, platform behavior, or adoption decision | It becomes corpus canon by being an existing Nzila artifact |
| Reference-case evidence | Observation or measured evidence from a specific institution | One case establishes universal engineering truth |

## Revised Program Sequence

1. Wave 1 — Corpus recovery and constitutional ingestion: complete for the initial Charter and Foundations.
2. Wave 2 — Corpus Qualification.
3. Wave 3 — Knowledge graph construction.
4. Wave 4 — Nzila method reconciliation.
5. Wave 5 — Institutional Mechanics research program and validation framework.
6. Wave 6 — Reference implementation qualification.
7. Wave 7 — Candidate standards maturation.
8. Wave 8 — External publication readiness.

No Wave in this sequence authorizes a later Wave by implication. Each requires its own steward, decision record, evidence, and applicable governance review.
