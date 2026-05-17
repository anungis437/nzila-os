# Workstream H — Source Adapter Completion Audit

## Scope

App/package focus:
- packages/institutional-governance-graph
- union-eyes runtime surfaces that consume continuity, chronology, topology, and narrative governance posture

This audit is strictly substrate maturation:
- additive
- read-only
- chronology-aware
- provenance-linked
- governance-safe

Out of scope:
- automation
- scoring/ranking
- graph persistence migration
- orchestration engines
- governance optimization

## Current substrate posture

The IGG package already contains:
- projection-capable substrate over organizations, affiliations, voting eligibility, delegation, representation, motions, reserved-matter votes, and negotiations
- chronology and lineage primitives
- continuity/timeline/evidence/trust read surfaces
- protected semantics redaction and assertion fences
- counts-only observability scaffold

Observed gap before Workstream H:
- adapter surface did not expose complete topology hydration inputs for committee structure, delegation-chain records beyond voting rows, procedural escalation records, continuity records, governance-center links, and institutional-memory references
- relationship normalization existed only implicitly via projection metadata, not as one coherent normalization layer for topology hydration

## Topology source inventory

Production-safe primary sources (already read-safe and projection-aligned):
- organizations
- congress memberships / affiliations
- voting eligibility
- representation protocols
- motions
- negotiations
- reserved-matter votes (protected semantics must be filtered downstream)

Production-safe additive sources introduced for hydration completion:
- committee structures
- delegation chains
- representation assignments
- continuity records
- institutional memory references
- procedural escalations
- governance-center sources

## Existing implicit relationships

Already implicit in projected edges and metadata:
- REPRESENTS
- DELEGATES_TO
- AFFILIATED_WITH
- MEMBER_OF
- GOVERNED_BY
- ESCALATED_TO
- SUCCESSOR_TO (via supersedes)
- CONTINUITY_LINKED_TO (via depends_on / informed_by / triggered_by convergence)
- REPORTS_TO (derivable from parent_of hierarchy)
- PARTICIPATES_IN (committee topology participation)

## Chronology and lineage posture

Already available:
- decision chronology ordering
- entity chronology views
- lineage chain traversal via supersession
- continuity timeline and succession breakpoints

Residual enrichment need addressed in Workstream H:
- single enriched chronology stream that stitches decision chronology, normalized relationship chronology, and continuity records
- provenance-linked chronology references for every hydrated relationship

## Topology hydration assumptions and risk points

Stable assumptions:
- read-only projection composition over existing substrate
- metadata-preserving projection style
- protected-semantic filtering before read surfaces

Unstable assumptions (now explicitly handled):
- missing occurredAt timestamps on edge metadata
- mixed lifecycle/status vocabularies across source systems
- relationship duplication across multiple source adapters
- implicit hierarchy interpreted as governance reporting without explicit normalization

## Semantic drift risks

Highest drift vectors:
- over-interpreting parent/affiliation structure as optimization or influence map
- flattening ambiguous chronology into false certainty
- surfacing protected governance semantics from raw source metadata

Mitigation now applied:
- explicit uncertainty markers on normalized relationships
- protected metadata filtering in hydration layer
- explainability records with source and chronology refs
- no ranking/scoring APIs in hydration output

## Runtime org models and continuity surfaces

Runtime continuity and topology posture already present in codebase and narrative tooling:
- institutional chronology and continuity dashboards
- topology UX vocabulary guards
- observability doctrine guards

Workstream H alignment:
- hydration output designed to feed these surfaces as substrate depth, not analytics posture

## Answers to required audit questions

1. Which topology sources are production-safe?
- Organizations, affiliations, voting eligibility, representation protocols, motions, negotiations, and additive read-only committee/delegation/continuity/escalation/memory/governance-center sources.

2. Which relationships already exist implicitly?
- Represents, delegates_to, affiliated_with, member_of, governed_by, escalated_to, successor_to, continuity_linked_to, reports_to, participates_in.

3. Which lineage chains are incomplete?
- Chains that terminate with no successor/predecessor evidence or only ambiguous timestamps; currently visible as incomplete lineage chains in hydration output.

4. Which chronology sources require enrichment?
- Relationship chronology (edge/source timestamps) and continuity records needed stitching with decision chronology into one explainable chronology stream.

5. Which governance relationships require normalization?
- Parent-derived reporting links, committee participation/governance links, escalation links, continuity-linked dependency links, and successor links.

6. Which continuity projections are currently synthetic?
- Projections derived solely from sparse edge metadata without continuity-record corroboration; Workstream H now marks uncertainty and unresolved transitions.

7. Which adapters risk semantic drift?
- Any adapter that emits optimization/scoring semantics, inferred intent, or protected governance internals in metadata fields.

8. Which topology assumptions are unstable?
- Timestamp completeness, status vocabulary consistency, and one-to-one mapping from structural edges to governance meaning.

9. Which institutional relationships deserve canonical treatment?
- Represents, delegates_to, affiliated_with, governed_by, escalated_to, reports_to, participates_in, member_of, successor_to, continuity_linked_to.

10. Which protected semantics must remain filtered?
- Class-B structures, reserved-matter internals, veto pathways, founder-control semantics, and protected continuity pathways.

## Workstream H audit conclusion

IGG was already a robust read-side projection substrate. Workstream H completion is justified as additive hydration maturity: source-adapter completion, explicit relationship normalization, lineage/chronology enrichment, continuity projection hydration, protected-semantic guard hardening, and explainability metadata support.
