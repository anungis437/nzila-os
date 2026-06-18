# Knowledge Architecture - Evidence Index

Backfill scope:
- Advancement A5 only (Institutional Knowledge Architecture)
- Governed by 00-claim-constitution.md and 14-evidence-priority-matrix.md

## Backfilled Evidence Register (A5)

| File Path | Commit Hash | Date | Evidence Tier | What It Proves | Supports | PR Reference | Provenance Quality | Evidence Confidence |
|---|---|---|---|---|---|---|---|---|
| apps/union-eyes/config/continuity-ontology-matrix.json | dc36ef6d7 | 2026-05-27 | Tier 1 | Machine-readable continuity ontology matrix exists as architecture core artifact. | A5, Failure #005 | not found in local metadata | checkpoint provenance (no narrower origin found via log/blame/follow) | Medium |
| apps/union-eyes/reports/ontology-antipattern-inventory.json | dc36ef6d7 | 2026-05-27 | Tier 1 | Anti-pattern inventory provides concrete drift/quality-control output for ontology structure. | A5, Failure #005 | not found in local metadata | checkpoint provenance (no narrower origin found via log/blame/follow) | Medium |
| apps/union-eyes/lib/oci/__tests__/crosswalkCoverageIntegrity.test.ts | 3fae15023 | 2026-05-23 | Tier 1 | Crosswalk integrity has explicit automated test coverage. | A5, Failure #005 | not found in local metadata | narrow commit provenance | High |
| docs/sred/2026/07-supporting-evidence/knowledge-architecture/test-runs/2026-06-17-a5-crosswalk-coverage-integrity-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated execution record shows crosswalk coverage integrity pass (15/15). | A5, Failure #005 | not found in local metadata | execution provenance | High |
| docs/oci/methodology/standards-crosswalk.yaml | 402551bca | 2026-05-23 | Tier 2 | Standards crosswalk provides governed mapping scaffold for architecture consistency. | A5, Failure #005 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/methodology/coefficient-registry.yaml | 402551bca | 2026-05-23 | Tier 2 | Coefficient registry formalizes machine-readable parameter governance. | A5, Failure #005 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md | e9e47caca | 2026-05-23 | Tier 2 | Question architecture inventory captures category/structure reasoning metadata. | A5 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/compliance/OCI_COVERAGE_MATRIX.md | 3fae15023 | 2026-05-23 | Tier 2 | Coverage matrix links architecture structures to governance/compliance surfaces. | A5 | not found in local metadata | narrow commit provenance | Medium |

Checkpoint provenance note (A5):
- For apps/union-eyes/config/continuity-ontology-matrix.json and apps/union-eyes/reports/ontology-antipattern-inventory.json, no narrower non-checkpoint origin commit was found locally.
- Verification method: git log --follow, git log --all --diff-filter=A, and git blame on 2026-06-17.
- These are tracked in 15-evidence-gap-register.md for mitigation.

Readiness gate snapshot (A5):
- Tier 1 items: 4
- Tier 2 items: 4
- Failure linkage: Failure #005
- A5 evidence threshold: met

## Ontology and Relationship Artifacts
- apps/union-eyes/config/continuity-ontology-matrix.json
- apps/union-eyes/reports/ontology-antipattern-inventory.md
- apps/union-eyes/reports/ontology-antipattern-inventory.json

## Doctrine and Methodology Structures
- docs/oci/methodology/README.md
- docs/oci/methodology/standards-crosswalk.yaml
- docs/oci/methodology/coefficient-registry.yaml
- docs/oci/compliance/OCI_COVERAGE_MATRIX.md

## Reasoning and Category Formation Signals
- docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md
- docs/oci/audit/QUESTION_ARCHITECTURE_GOVERNANCE.md
- docs/oci/audit/QUESTION_ARCHITECTURE_PROCUREMENT_REVIEW.md

## Knowledge-Evolution Chain
Advancement: A5 - Institutional Knowledge Architecture

1. Research Question
- Can institutional doctrine/ontology/relationship models be machine-readable while remaining interpretable and governable across sectors?

2. Technological Uncertainty
- Whether informal institutional knowledge could become machine-operable without semantic drift or governance loss.

3. Experiment Sequence
- Experiment 1: initial approach
  - Informal ontology/doctrine growth and knowledge-registry seeding.
  - Commit cluster: d4dcbe00a (2026-05-22), 402551bca (2026-05-23).
  - Result: drift and ambiguous categories.
  - Failure/rejected approach: informal growth without anti-pattern controls (Failure #005).
  - Learning: require versioned crosswalks, registries, anti-pattern controls, coverage tests.
  - Revised experiment: governed ontology matrix + anti-pattern inventory + crosswalk integrity testing.
  - Commit cluster: 3fae15023 (2026-05-23), dc36ef6d7 (2026-05-27, checkpoint provenance).
  - Test evidence: 2026-06-17 crosswalkCoverageIntegrity (15/15) under test-runs/.

4. Advancement Delta
- Prior state: drifting informal architecture.
- New knowledge: governed, test-validated, machine-readable architecture for continuity/governance reasoning.
- Why this is not routine engineering: resolved a machine-operability vs interpretability uncertainty.

5. Reviewer Proof Path
- Where to start: this evidence index (A5 register above).
- Uncertainty: apps/union-eyes/reports/ontology-antipattern-inventory.json.
- Experimentation: commits 402551bca, 3fae15023, dc36ef6d7.
- Failure/learning: Failure #005 in 12-failure-ledger.md.
- Advancement: test-runs/2026-06-17 A5 record.
- Provenance note: dc36ef6d7 is checkpoint provenance; disclosed in 15-evidence-gap-register.md.
