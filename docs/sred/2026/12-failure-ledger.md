# 2026 Failure Ledger

Purpose: maintain a consolidated record of failed technical attempts and resulting learning.

Use rule:
- Every major failed approach should be logged here with linked evidence.
- Failure entries must show learning and corrective direction.
- This ledger is a primary credibility artifact for systematic investigation.

## Failure #001
Question:
Can confidence be directly added to maturity scores as a simple additive factor?

Attempt:
Early confidence treatment as a direct score uplift/downshift.

Result:
Produced instability and interpretability problems under mixed-quality evidence conditions.

Resolution:
Moved to confidence-aware interpretation and bounded confidence governance rather than naive direct additive scoring.

Evidence Confidence:
High

Backfilled Evidence (A1):

| File Path | Commit Hash | Date | Evidence Tier | What It Proves | Supports | PR Reference | Provenance Quality | Evidence Confidence |
|---|---|---|---|---|---|---|---|---|
| docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md | e9e47caca | 2026-05-23 | Tier 2 | Audit artifact documents confidence generation review and instability concerns. | Failure #001, A1 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md | 3fae15023 | 2026-05-23 | Tier 2 | Confidence governance and bounded interpretation were formalized as remediation constraints. | Failure #001, A1 | not found in local metadata | narrow commit provenance | Medium |
| apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/confidenceSignalDensity.test.ts | fe0dad804 | 2026-05-23 | Tier 1 | Signal-integrity test coverage demonstrates post-failure validation of confidence behavior. | Failure #001, A1 | not found in local metadata | narrow commit provenance | High |
| docs/sred/2026/07-supporting-evidence/institutional-intelligence/test-runs/2026-06-17-a1-confidence-signal-density-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated execution output confirms confidence signal density test pass (5/5). | Failure #001, A1 | not found in local metadata | execution provenance | High |
| docs/oci/methodology/METHODOLOGY_CHANGELOG.md | 2db6cbacb | 2026-05-23 | Tier 2 | Changelog provides dated trace of contradiction-confidence and routing integration updates. | Failure #001, A1 | not found in local metadata | narrow commit provenance | Medium |

Evidence:
- docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md
- docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md
- docs/sred/2026/07-supporting-evidence/institutional-intelligence/failed-approaches.md

## Knowledge-Evolution Chain
Linked Advancement: A1 - Confidence-Aware Institutional Measurement

1. Research Question
- Can confidence be incorporated into maturity scoring without destabilizing measurement?

2. Technological Uncertainty
- Whether confidence could improve rather than distort institutional measurement under contradictory signals.

3. Experiment Sequence
- Experiment 1: initial approach
  - Direct additive confidence on maturity scores.
  - Commit cluster: e44325ca1 (2026-05-21), d5a129802 (2026-05-22).
  - Result: instability and interpretability problems under mixed-quality evidence.
  - Failure/rejected approach: naive additive confidence (this failure).
  - Learning: confidence required bounded, evidence-aware governance.
  - Revised experiment: contradiction-aware confidence + routing-v2 + evidence ladder.
  - Commit cluster: fe0dad804 (2026-05-23), 2db6cbacb (2026-05-23).
  - Test evidence: 2026-06-17 confidenceSignalDensity run (5/5).

4. Advancement Delta
- Prior state: confidence handling unstable.
- New knowledge: bounded confidence interpretation improves consistency.
- Why this is not routine engineering: resolved a measurement-stability uncertainty, not a known fix.

5. Reviewer Proof Path
- Where to start: 12-failure-ledger.md Failure #001 table.
- Uncertainty: CONFIDENCE_GENERATION_AUDIT.md.
- Experimentation: commits d5a129802, fe0dad804, 2db6cbacb.
- Failure/learning: this entry plus institutional-intelligence/failed-approaches.md.
- Advancement: 2026-06-17 confidence signal density test-run record.

## Failure #002
Question:
Can static questionnaire flow adequately capture institutional continuity complexity?

Attempt:
Fixed-flow assessment pathways and static sequencing assumptions.

Result:
Insufficient signal depth in heterogeneous contexts and poor adaptation to uncertainty profiles.

Resolution:
Transitioned to adaptive assessment and routing doctrine with audit constraints.

Evidence:
- docs/oci/assessment/OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md
- docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md
- docs/oci/audit/QUESTION_REDESIGN_ROADMAP.md

## Failure #003
Question:
Can governance entropy signals be used without explicit interpretation controls?

Attempt:
Early entropy framing without sufficiently explicit reviewer protocol.

Result:
Interpretability gaps and reviewer inconsistency risk.

Resolution:
Introduced governance entropy review guidance and gap-report-driven refinements.

Evidence:
- docs/oci/audit/ENTROPY_SIGNAL_GAP_REPORT.md
- docs/oci/procurement/OCI_GOVERNANCE_ENTROPY_REVIEW_GUIDE.md

## Failure #004
Question:
Can continuity risk be inferred from simple governance proxies alone?

Attempt:
Continuity inference from narrow governance indicators without deeper lineage/survivability constructs.

Result:
Low explanatory power and weak transition-risk coverage.

Resolution:
Expanded methodology to include lineage, inheritance, survivability, and stewardship transition analysis.

Evidence:
- docs/oci/audit/HUMAN_CONTINUITY_THEORY_ALIGNMENT.md
- docs/oci/audit/LONGITUDINAL_SURVIVABILITY_AUDIT.md
- docs/sred/2026/07-supporting-evidence/union-eyes/failed-approaches.md

## Failure #005
Question:
Can ontology structure evolve informally without anti-pattern controls?

Attempt:
Organic category and relationship growth without explicit anti-pattern governance.

Result:
Semantic drift, ambiguous categories, and machine-operability inconsistencies.

Resolution:
Implemented anti-pattern inventory and governed structure controls with registry and crosswalk artifacts.

Evidence Confidence:
High

Backfilled Evidence (A5):

| File Path | Commit Hash | Date | Evidence Tier | What It Proves | Supports | PR Reference | Provenance Quality | Evidence Confidence |
|---|---|---|---|---|---|---|---|---|
| apps/union-eyes/reports/ontology-antipattern-inventory.json | dc36ef6d7 | 2026-05-27 | Tier 1 | Anti-pattern inventory output captures architecture drift detection in concrete artifact form. | Failure #005, A5 | not found in local metadata | checkpoint provenance (no narrower origin found via log/blame/follow) | Medium |
| apps/union-eyes/config/continuity-ontology-matrix.json | dc36ef6d7 | 2026-05-27 | Tier 1 | Machine-readable ontology matrix shows governed structure replacing informal growth. | Failure #005, A5 | not found in local metadata | checkpoint provenance (no narrower origin found via log/blame/follow) | Medium |
| apps/union-eyes/lib/oci/__tests__/crosswalkCoverageIntegrity.test.ts | 3fae15023 | 2026-05-23 | Tier 1 | Automated integrity test demonstrates crosswalk coverage is explicitly validated. | Failure #005, A5 | not found in local metadata | narrow commit provenance | High |
| docs/sred/2026/07-supporting-evidence/knowledge-architecture/test-runs/2026-06-17-a5-crosswalk-coverage-integrity-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated execution output confirms crosswalk coverage integrity pass (15/15). | Failure #005, A5 | not found in local metadata | execution provenance | High |
| docs/oci/methodology/standards-crosswalk.yaml | 402551bca | 2026-05-23 | Tier 2 | Crosswalk provides formal mapping controls for architecture consistency. | Failure #005, A5 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/methodology/coefficient-registry.yaml | 402551bca | 2026-05-23 | Tier 2 | Coefficient registry provides controlled model parameter governance. | Failure #005, A5 | not found in local metadata | narrow commit provenance | Medium |

Evidence:
- apps/union-eyes/reports/ontology-antipattern-inventory.md
- docs/oci/methodology/standards-crosswalk.yaml
- docs/oci/methodology/coefficient-registry.yaml
- docs/sred/2026/07-supporting-evidence/knowledge-architecture/failed-approaches.md

## Knowledge-Evolution Chain
Linked Advancement: A5 - Institutional Knowledge Architecture

1. Research Question
- Can institutional ontology structure remain machine-operable as it grows without explicit anti-pattern controls?

2. Technological Uncertainty
- Whether informal ontology evolution could preserve interpretability and governance integrity.

3. Experiment Sequence
- Experiment 1: initial approach
  - Organic category/relationship growth and knowledge-registry seeding.
  - Commit cluster: d4dcbe00a (2026-05-22), 402551bca (2026-05-23).
  - Result: semantic drift and ambiguous categories.
  - Failure/rejected approach: informal growth without anti-pattern governance (this failure).
  - Learning: required versioned crosswalks, registries, anti-pattern controls, and coverage tests.
  - Revised experiment: governed ontology matrix + anti-pattern inventory + crosswalk integrity testing.
  - Commit cluster: 3fae15023 (2026-05-23), dc36ef6d7 (2026-05-27, checkpoint provenance).
  - Test evidence: 2026-06-17 crosswalkCoverageIntegrity run (15/15).

4. Advancement Delta
- Prior state: drifting informal architecture.
- New knowledge: governed, test-validated machine-readable architecture.
- Why this is not routine engineering: resolved a machine-operability vs interpretability uncertainty, not a standard schema task.

5. Reviewer Proof Path
- Where to start: 12-failure-ledger.md Failure #005 table.
- Uncertainty: ontology-antipattern-inventory.json.
- Experimentation: commits 402551bca, 3fae15023, dc36ef6d7.
- Failure/learning: this entry plus knowledge-architecture/failed-approaches.md.
- Advancement: 2026-06-17 crosswalk coverage integrity test-run record.
- Provenance note: dc36ef6d7 is checkpoint provenance (see 15-evidence-gap-register.md).

## Ledger Hygiene
- Add date, owner, and linked corrective iteration when updating entries.
- Never delete failures; close them with superseding evidence.
- Ensure each failure is traceable to at least one advancement in 11-advancement-registry.md.
