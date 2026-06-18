# 2026 Advancement Registry

Purpose: define SR&ED claim units as technological advancements arising from explicit uncertainties.

Use rule:
- The claim unit is advancement, not project.
- Projects organize execution and evidence, but each claim statement should map to one or more advancements below.

## Advancement A1
Title:
Confidence-Aware Institutional Measurement

Prior State:
Institutional maturity and continuity were typically treated as static checklist or questionnaire outcomes, with weak uncertainty handling.

Uncertainty:
Whether institutional continuity, governance capacity, organizational memory, trust, and resilience can be measured in a repeatable, defensible method with explicit confidence controls.

Experiments:
- confidence weighting strategy iterations
- evidence-strength gating and branching
- contradiction sensitivity and signal conflict handling
- static vs adaptive assessment pathway comparisons

Outcome:
Confidence-aware measurement framing emerged with stronger interpretability boundaries and uncertainty disclosure controls.

Evidence Confidence:
High

Backfilled Trace Chain:
- Uncertainty: confidence-aware institutional measurement validity and defensibility under mixed-quality signals.
- Experiment: adaptive scoring model revisions, contradiction-confidence bridging, and signal-integrity test coverage.
- Failure or Result: naive additive confidence treatment was unstable; bounded confidence interpretation and routing constraints performed better.
- Learning: confidence must be governed by evidence strength and interpretability constraints, not treated as linear score inflation.
- Evidence: listed in table below.

Backfilled Evidence (A1 only):

| File Path | Commit Hash | Date | Evidence Tier | What It Proves | Supports | PR Reference | Provenance Quality | Evidence Confidence |
|---|---|---|---|---|---|---|---|---|
| apps/union-eyes/lib/icra/adaptation/adaptiveScoringModel.ts | d5a129802 | 2026-05-22 | Tier 1 | Core adaptive scoring logic was implemented and iterated in code. | A1 | not found in local metadata | narrow commit provenance | High |
| apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/confidenceSignalDensity.test.ts | fe0dad804 | 2026-05-23 | Tier 1 | Confidence signal behavior was validated with dedicated signal-integrity tests. | A1 | not found in local metadata | narrow commit provenance | High |
| apps/union-eyes/lib/icra/adaptation/__tests__/adaptiveScoringModel.test.ts | 7eb73db25 | 2026-05-22 | Tier 1 | Adaptive scoring model behavior was tested as part of live assessment flow work. | A1 | #540 (from commit subject) | narrow commit provenance | High |
| docs/sred/2026/07-supporting-evidence/institutional-intelligence/test-runs/2026-06-17-a1-adaptive-scoring-model-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated test execution confirms adaptive scoring test pass (11/11). | A1, Failure #001 | not found in local metadata | execution provenance | High |
| docs/sred/2026/07-supporting-evidence/institutional-intelligence/test-runs/2026-06-17-a1-confidence-signal-density-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated test execution confirms confidence signal density test pass (5/5). | A1, Failure #001 | not found in local metadata | execution provenance | High |
| docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md | 3fae15023 | 2026-05-23 | Tier 2 | Confidence interpretation constraints were explicitly documented for defensibility. | A1, Failure #001 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md | e9e47caca | 2026-05-23 | Tier 2 | Audit record ties confidence generation behavior to architecture and quality controls. | A1, Failure #001 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md | e9e47caca | 2026-05-23 | Tier 2 | Adaptive routing constraints and evidence depth controls were formally reviewed. | A1 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/methodology/METHODOLOGY_CHANGELOG.md | 2db6cbacb | 2026-05-23 | Tier 2 | Changelog records contradiction-to-confidence/routing integration decisions in dated form. | A1 | not found in local metadata | narrow commit provenance | Medium |

Claim-Readiness Gate (A1):
- Tier 1 evidence count: 5 (minimum 2 required)
- Tier 2 evidence count: 4 (minimum 2 required)
- Documented failure linked: Failure #001 (required)
- Status: claim-ready threshold met for A1

Evidence:
- docs/sred/2026/07-supporting-evidence/institutional-intelligence/chronology.md
- docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md
- docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md

## Knowledge-Evolution Chain
Advancement: A1 - Confidence-Aware Institutional Measurement

1. Research Question
- Can institutional maturity and continuity be measured reliably and defensibly when underlying signals vary in quality and can contradict each other?

2. Technological Uncertainty
- It was unknown whether static maturity scoring could be made stable and interpretable, or whether confidence handling would distort rather than improve measurement.

3. Experiment Sequence
- Experiment 1: initial approach
  - Direct/likert-style maturity scoring with early confidence-as-uplift treatment.
  - Commit cluster: e44325ca1 (2026-05-21 modality/sensing expansion, confidenceEvolutionModel), d5a129802 (2026-05-22 adaptive scoring model implementation).
  - Result: confidence applied as a direct score factor produced instability under mixed-quality evidence.
  - Failure/rejected approach: naive additive confidence treatment (see Failure #001).
  - Learning: confidence had to be bounded, evidence-aware, and interpretation-governed rather than linearly added.
  - Revised experiment: contradiction-aware confidence with routing-v2 predicates and evidence-ladder gating.
  - Commit cluster: fe0dad804 (2026-05-23 v1.2.0 contradiction engine + evidence ladder + routing-v2), 2db6cbacb (2026-05-23 v1.2.1 wire contradiction engine into confidence + routing-v2), e9e47caca (2026-05-23 question architecture audit + signal-integrity tests).
  - Test evidence: 2026-06-17 dated runs — adaptiveScoringModel (11/11) and confidenceSignalDensity (5/5), recorded under 07-supporting-evidence/institutional-intelligence/test-runs/.

4. Advancement Delta
- Prior state: no validated, repeatable confidence-aware institutional measurement; confidence handling was unstable.
- New knowledge: a bounded, contradiction-sensitive, evidence-weighted confidence methodology that improves measurement consistency and interpretability.
- Why this is not routine engineering: the work resolved a genuine measurement-science uncertainty (stability/interpretability of confidence under conflicting institutional signals), not a known implementation task.

5. Reviewer Proof Path
- Where to start: docs/sred/2026/07-supporting-evidence/institutional-intelligence/evidence-index.md (A1 register).
- What evidence confirms uncertainty: docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md, docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md.
- What evidence confirms experimentation: commits d5a129802, fe0dad804, 2db6cbacb and adaptive scoring + signal-integrity test sources.
- What evidence confirms failure/learning: Failure #001 in 12-failure-ledger.md.
- What evidence confirms advancement: 2026-06-17 dated test-run records plus contradiction-confidence integration in METHODOLOGY_CHANGELOG.md.

## Advancement A2
Title:
Adaptive Institutional Assessment

Prior State:
Assessment approaches were largely fixed-flow and insufficiently responsive to signal quality and context.

Uncertainty:
Whether adaptive assessment can improve signal depth without reducing interpretability and auditability.

Experiments:
- dynamic questionnaire model revisions
- routing policy redesign and audit checks
- branch behavior validation under heterogeneous signal profiles

Outcome:
Adaptive pathway doctrine and constraints were established with explicit interpretability and audit expectations.

Evidence:
- docs/sred/2026/07-supporting-evidence/institutional-intelligence/chronology.md
- docs/oci/assessment/OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md
- docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md

## Advancement A3
Title:
Governance Entropy Modeling

Prior State:
No operationally interpretable governance entropy framework was available in this context.

Uncertainty:
Whether entropy-like governance signals can be made measurable and decision-useful without overclaiming precision.

Experiments:
- entropy signal construction and scenario analysis
- interpretability and reviewer-guide development
- gap analysis and evidence-threshold refinement

Outcome:
An experimental governance entropy framework with explicit interpretation and review constraints was developed.

Evidence:
- docs/sred/2026/07-supporting-evidence/institutional-intelligence/evidence-index.md
- docs/oci/procurement/OCI_GOVERNANCE_ENTROPY_REVIEW_GUIDE.md
- docs/oci/audit/ENTROPY_SIGNAL_GAP_REPORT.md

## Advancement A4
Title:
Continuity Breakpoint Detection

Prior State:
Continuity disruptions were typically managed reactively, without a formalized signal-based detection methodology.

Uncertainty:
Whether continuity breakpoints can be inferred from governance, stewardship, document, and operational signals in a defensible way.

Experiments:
- lineage and inheritance model trials
- transition-risk scoring experiments
- survivability and continuity mapping audits

Outcome:
A methodological basis for continuity breakpoint reasoning was established with evidence-linked governance and survivability constructs.

Evidence:
- docs/sred/2026/07-supporting-evidence/union-eyes/chronology.md
- docs/oci/audit/HUMAN_CONTINUITY_THEORY_ALIGNMENT.md
- docs/oci/audit/LONGITUDINAL_SURVIVABILITY_AUDIT.md

## Advancement A5
Title:
Institutional Knowledge Architecture

Prior State:
Institutional reasoning artifacts existed but lacked a governed machine-readable architecture for continuity/governance reasoning.

Uncertainty:
Whether institutional doctrine, ontology, and relationship models can be encoded into a machine-readable architecture that preserves interpretability.

Experiments:
- ontology matrix and relationship-graph structuring
- anti-pattern detection and remediation
- standards and coefficient registry alignment work

Outcome:
A governed institutional knowledge architecture baseline emerged with explicit anti-pattern controls and versioned structure assets.

Evidence Confidence:
High

Backfilled Trace Chain:
- Uncertainty: whether institutional doctrine, ontology, and relationship models can be machine-readable while remaining interpretable.
- Experiment: ontology matrix formalization, anti-pattern inventory generation, and crosswalk coverage integrity testing.
- Failure or Result: informal ontology growth produced drift; governed registries and validation assets improved structural integrity.
- Learning: ontology architecture needs versioned crosswalks, coefficient registries, anti-pattern controls, and test-backed coverage checks.
- Evidence: listed in table below.

Backfilled Evidence (A5 only):

| File Path | Commit Hash | Date | Evidence Tier | What It Proves | Supports | PR Reference | Provenance Quality | Evidence Confidence |
|---|---|---|---|---|---|---|---|---|
| apps/union-eyes/config/continuity-ontology-matrix.json | dc36ef6d7 | 2026-05-27 | Tier 1 | Machine-readable continuity ontology matrix exists as a concrete structural artifact. | A5 | not found in local metadata | checkpoint provenance (no narrower origin found via log/blame/follow) | Medium |
| apps/union-eyes/reports/ontology-antipattern-inventory.json | dc36ef6d7 | 2026-05-27 | Tier 1 | Anti-pattern detection output exists as generated/maintained architecture evidence. | A5, Failure #005 | not found in local metadata | checkpoint provenance (no narrower origin found via log/blame/follow) | Medium |
| apps/union-eyes/lib/oci/__tests__/crosswalkCoverageIntegrity.test.ts | 3fae15023 | 2026-05-23 | Tier 1 | Crosswalk coverage integrity is validated via dedicated automated tests. | A5 | not found in local metadata | narrow commit provenance | High |
| docs/sred/2026/07-supporting-evidence/knowledge-architecture/test-runs/2026-06-17-a5-crosswalk-coverage-integrity-test-run.md | n/a (execution record) | 2026-06-17 | Tier 1 | Dated test execution confirms crosswalk coverage integrity pass (15/15). | A5, Failure #005 | not found in local metadata | execution provenance | High |
| docs/oci/methodology/standards-crosswalk.yaml | 402551bca | 2026-05-23 | Tier 2 | Standards crosswalk provides governed mapping structure for machine-readable architecture. | A5, Failure #005 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/methodology/coefficient-registry.yaml | 402551bca | 2026-05-23 | Tier 2 | Coefficient registry documents controlled model coefficients and architecture governance. | A5, Failure #005 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md | e9e47caca | 2026-05-23 | Tier 2 | Question architecture inventory supplies auditable structure and category reasoning metadata. | A5 | not found in local metadata | narrow commit provenance | Medium |
| docs/oci/compliance/OCI_COVERAGE_MATRIX.md | 3fae15023 | 2026-05-23 | Tier 2 | Coverage matrix links architecture constructs to governance/compliance reasoning surfaces. | A5 | not found in local metadata | narrow commit provenance | Medium |

Checkpoint provenance note (A5):
- apps/union-eyes/config/continuity-ontology-matrix.json and apps/union-eyes/reports/ontology-antipattern-inventory.json currently trace to checkpoint commit dc36ef6d7 as introduction commit (validated via git log --follow, git log --diff-filter=A, and git blame on 2026-06-17).
- These are retained with explicit checkpoint provenance and tracked in 15-evidence-gap-register.md for mitigation.

Claim-Readiness Gate (A5):
- Tier 1 evidence count: 4 (minimum 2 required)
- Tier 2 evidence count: 4 (minimum 2 required)
- Documented failure linked: Failure #005 (required)
- Status: claim-ready threshold met for A5

Evidence:
- docs/sred/2026/07-supporting-evidence/knowledge-architecture/chronology.md
- apps/union-eyes/config/continuity-ontology-matrix.json
- apps/union-eyes/reports/ontology-antipattern-inventory.md

## Knowledge-Evolution Chain
Advancement: A5 - Institutional Knowledge Architecture

1. Research Question
- Can institutional doctrine, ontology, and relationship models be encoded into a machine-readable architecture that remains interpretable and governable across sectors?

2. Technological Uncertainty
- It was unknown whether organically grown institutional concepts could be made machine-operable without semantic drift, ambiguous categories, or loss of governance integrity.

3. Experiment Sequence
- Experiment 1: initial approach
  - Informal doctrine/ontology growth and canonical knowledge seeding.
  - Commit cluster: d4dcbe00a (2026-05-22 ingest Continuity Gap Master Whitepaper v3 + knowledge-registry seed), 402551bca (2026-05-23 methodology whitepaper v1.0.0 with standards-crosswalk and coefficient-registry).
  - Result: structure existed but drifted; categories and relationships were not consistently machine-operable.
  - Failure/rejected approach: informal ontology evolution without anti-pattern governance (see Failure #005).
  - Learning: the architecture required versioned crosswalks, coefficient registries, anti-pattern controls, and automated coverage validation.
  - Revised experiment: governed ontology matrix + anti-pattern inventory + crosswalk coverage integrity testing.
  - Commit cluster: 3fae15023 (2026-05-23 crosswalk coverage integrity test + governance sprint), dc36ef6d7 (2026-05-27 checkpoint introducing continuity-ontology-matrix.json and ontology-antipattern-inventory.json — checkpoint provenance, see 15-evidence-gap-register.md).
  - Test evidence: 2026-06-17 dated run — crosswalkCoverageIntegrity (15/15), recorded under 07-supporting-evidence/knowledge-architecture/test-runs/.

4. Advancement Delta
- Prior state: no governed machine-readable institutional knowledge architecture; informal structures drifted.
- New knowledge: a versioned, anti-pattern-controlled, test-validated ontology/crosswalk architecture supporting continuity and governance reasoning.
- Why this is not routine engineering: the work resolved an architecture-science uncertainty (machine-operability vs interpretability of institutional knowledge), not a standard schema build.

5. Reviewer Proof Path
- Where to start: docs/sred/2026/07-supporting-evidence/knowledge-architecture/evidence-index.md (A5 register).
- What evidence confirms uncertainty: apps/union-eyes/reports/ontology-antipattern-inventory.json, docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md.
- What evidence confirms experimentation: commits 402551bca, 3fae15023, dc36ef6d7 and crosswalkCoverageIntegrity test source.
- What evidence confirms failure/learning: Failure #005 in 12-failure-ledger.md.
- What evidence confirms advancement: 2026-06-17 dated test-run record plus standards-crosswalk.yaml and coefficient-registry.yaml governance artifacts.
- Provenance note: two A5 Tier 1 artifacts trace to checkpoint commit dc36ef6d7 and are disclosed honestly in 15-evidence-gap-register.md.

## Advancement A6
Title:
Cross-Sector Ontology Formation

Prior State:
Cross-sector continuity and governance reasoning lacked a unified conceptual and structural model.

Uncertainty:
Whether a shared ontology can support meaningful continuity/governance reasoning across union, healthcare, and adjacent sectors.

Experiments:
- category formation revisions across contexts
- crosswalk and mapping consistency checks
- question architecture inventory and governance review

Outcome:
Cross-sector ontology formation advanced through governed mappings, architecture inventories, and structural consistency controls.

Evidence:
- docs/sred/2026/07-supporting-evidence/knowledge-architecture/evidence-index.md
- docs/oci/methodology/standards-crosswalk.yaml
- docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md

## Maintenance Protocol
- This registry is governed by 00-claim-constitution.md.
- Update this registry before modifying T661 narrative text.
- Every advancement entry must link to chronology entries and failed-attempt records.
- Apply evidence weighting rules from 14-evidence-priority-matrix.md when linking artifacts.
- If an advancement cannot show uncertainty, experiment, and evidence linkage, do not claim it.
