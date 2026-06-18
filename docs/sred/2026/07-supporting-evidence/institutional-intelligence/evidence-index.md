# Institutional Intelligence - Evidence Index

Purpose: map claim statements to concrete artifacts.

Backfill scope:
- Advancement A1 only (Confidence-Aware Institutional Measurement)
- Governed by 00-claim-constitution.md and 14-evidence-priority-matrix.md

## Backfilled Evidence Register (A1)

| File Path | Commit Hash | Date | Evidence Tier | What It Proves | Supports | PR Reference | Provenance Quality | Evidence Confidence |
|---|---|---|---|---|---|---|---|---|
| apps/union-eyes/lib/icra/adaptation/adaptiveScoringModel.ts | d5a129802 | 2026-05-22 | Tier 1 | Adaptive scoring logic exists in implementation code and was iterated. | A1 | not found in local metadata | narrow commit provenance | High |
| apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/confidenceSignalDensity.test.ts | fe0dad804 | 2026-05-23 | Tier 1 | Confidence signal behavior is validated through dedicated signal-integrity tests. | A1, Failure #001 | not found in local metadata | narrow commit provenance | High |
| apps/union-eyes/lib/icra/adaptation/__tests__/adaptiveScoringModel.test.ts | 7eb73db25 | 2026-05-22 | Tier 1 | Adaptive scoring model has automated test coverage in assessment-flow development. | A1 | #540 (from commit subject) | narrow commit provenance | High |
| docs/sred/2026/07-supporting-evidence/institutional-intelligence/test-runs/2026-06-17-a1-adaptive-scoring-model-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated execution record shows adaptive scoring test pass (11/11). | A1, Failure #001 | not found in local metadata | execution provenance | High |
| docs/sred/2026/07-supporting-evidence/institutional-intelligence/test-runs/2026-06-17-a1-confidence-signal-density-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated execution record shows confidence signal density test pass (5/5). | A1, Failure #001 | not found in local metadata | execution provenance | High |
| docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md | 3fae15023 | 2026-05-23 | Tier 2 | Confidence interpretation rules and governance boundaries are explicitly documented. | A1, Failure #001 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md | e9e47caca | 2026-05-23 | Tier 2 | Confidence generation behavior and control points are audited in a dated artifact. | A1, Failure #001 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md | e9e47caca | 2026-05-23 | Tier 2 | Adaptive routing constraints are documented to preserve interpretability and evidence depth. | A1 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/methodology/METHODOLOGY_CHANGELOG.md | 2db6cbacb | 2026-05-23 | Tier 2 | Dated methodology record captures contradiction-confidence-routing integration changes. | A1 | not found in local metadata | narrow commit provenance | Medium |

Readiness gate snapshot (A1):
- Tier 1 items: 5
- Tier 2 items: 4
- Failure linkage: Failure #001
- A1 evidence threshold: met

## Core Methodology Artifacts
- docs/oci/OCI_METHOD.md
- docs/oci/oci-method.md
- docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md
- docs/oci/methodology/METHODOLOGY_CHANGELOG.md
- docs/oci/assessment/OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md
- docs/oci/assessment/OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md

## Confidence and Entropy-Related Artifacts
- docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md
- docs/oci/procurement/OCI_GOVERNANCE_ENTROPY_REVIEW_GUIDE.md
- docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md
- docs/oci/audit/ENTROPY_SIGNAL_GAP_REPORT.md

## Adaptive and Signal Architecture
- docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md
- docs/oci/audit/QUESTION_REDESIGN_ROADMAP.md
- docs/oci/audit/QUESTION_POOL_v2_0_ROADMAP.md
- docs/oci/audit/STATISTICAL_INTERPRETABILITY_AUDIT.md

## Candidate Code/Runtime Artifacts
- apps/union-eyes/config/continuity-ontology-matrix.json
- apps/union-eyes/reports/governance-simulation-summary.json
- apps/union-eyes/reports/semantic-observability-baseline.md

## Knowledge-Evolution Chain
Advancement: A1 - Confidence-Aware Institutional Measurement

1. Research Question
- Can institutional maturity/continuity be measured reliably when signals vary in quality and contradict each other?

2. Technological Uncertainty
- Whether confidence handling would stabilize or distort measurement; static scoring appeared unstable.

3. Experiment Sequence
- Experiment 1: initial approach
  - Direct/likert-style scoring with additive confidence.
  - Commit cluster: e44325ca1 (2026-05-21), d5a129802 (2026-05-22).
  - Result: instability under mixed-quality evidence.
  - Failure/rejected approach: naive additive confidence (Failure #001).
  - Learning: confidence must be bounded and evidence-aware.
  - Revised experiment: contradiction-aware confidence + routing-v2 + evidence ladder.
  - Commit cluster: fe0dad804 (2026-05-23), 2db6cbacb (2026-05-23), e9e47caca (2026-05-23).
  - Test evidence: 2026-06-17 adaptiveScoringModel (11/11), confidenceSignalDensity (5/5) under test-runs/.

4. Advancement Delta
- Prior state: unstable confidence handling, no validated measurement.
- New knowledge: bounded, contradiction-sensitive, evidence-weighted measurement methodology.
- Why this is not routine engineering: resolved a genuine measurement-stability/interpretability uncertainty.

5. Reviewer Proof Path
- Where to start: this evidence index (A1 register above).
- Uncertainty: docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md.
- Experimentation: commits d5a129802, fe0dad804, 2db6cbacb.
- Failure/learning: Failure #001 in 12-failure-ledger.md.
- Advancement: test-runs/2026-06-17 A1 records.
