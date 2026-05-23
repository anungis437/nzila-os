# OCI Method™ — Methodology Governance Changelog
# ARTIFACT TYPE: Methodology Companion Artifact
# DOCTRINE_VERSION: 1.0.0
#
# Authoritative changelog for the OCI Method™ methodology surface. Tracks
# every change to:
#   - Coefficients (values in coefficient-registry.yaml).
#   - Confidence model (sample-size-policy.yaml).
#   - Observable criteria (observable-criteria/entropy-{1..5}.yaml).
#   - Standards crosswalk (standards-crosswalk.yaml).
#   - Doctrine interpretation (whitepaper sections).
#   - Maturity-classification advancements (per coefficient).
#
# Change classes:
#   constitutional — alters the doctrine surface itself. Requires
#                    coordinated amendment per OCI_METHOD.md §13.
#   standard       — alters a coefficient, threshold, observable, or
#                    crosswalk cell. Requires reviewer endorsement.
#   clarification  — non-substantive prose or formatting change. Logged
#                    for traceability but does not require endorsement.
#
# Schema (per entry):
#   version | date | change_class | category | summary | rationale |
#   authority | breaking_change_yn | affected_artifacts[]

entries:

  - version: '1.0.0'
    date: '2026-05-23'
    change_class: 'constitutional'
    category: 'methodology-publication'
    summary: >
      Founding entry. First publication of the OCI Method™ methodology
      whitepaper (v1.0.0) and companion machine-readable artifacts.
    rationale: >
      Establish an audit-defensible methodology surface so OCI can survive
      ISO/COBIT-trained procurement review, academic critique, and
      union/healthcare/public-sector audit review. Closes the
      methodology-legitimacy gap surfaced by the global benchmark
      assessment (May 2026).
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'
      - 'docs/oci/methodology/README.md'
      - 'docs/oci/methodology/coefficient-registry.yaml'
      - 'docs/oci/methodology/sample-size-policy.yaml'
      - 'docs/oci/methodology/standards-crosswalk.yaml'
      - 'docs/oci/methodology/sensitivity/scenarios.yaml'
      - 'docs/oci/methodology/observable-criteria/entropy-1.yaml'
      - 'docs/oci/methodology/observable-criteria/entropy-2.yaml'
      - 'docs/oci/methodology/observable-criteria/entropy-3.yaml'
      - 'docs/oci/methodology/observable-criteria/entropy-4.yaml'
      - 'docs/oci/methodology/observable-criteria/entropy-5.yaml'

  - version: '1.0.0'
    date: '2026-05-23'
    change_class: 'standard'
    category: 'maturity-classification'
    summary: >
      All v1.0.0 coefficients classified as Theoretical or Practitioner-Informed.
      Zero coefficients claim Sector-Anchored, Empirically-Calibrated, or
      Externally-Validated maturity.
    rationale: >
      Honesty baseline. v1 coefficients are reviewer-derived and lack a
      calibration dataset. The maturity taxonomy (whitepaper §4.5) makes
      this explicit rather than implied.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/coefficient-registry.yaml'
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'

  - version: '1.1.0'
    date: '2026-05-23'
    change_class: 'standard'
    category: 'doctrine'
    summary: >
      Enterprise Defensibility & Statistical Governance Sprint. Adds runtime
      confidence infrastructure (@nzila/oci-confidence), Governance Entropy
      audit reproducibility (Entropy Audit Packet™ with SHA-256
      reproducibility hash), HHI/Gini statistical anchoring, ISO/COBIT
      clause-level crosswalks, auditor & procurement positioning docs, and
      whitepaper Appendices K–T operationalising the doctrine.
    rationale: >
      OCI v1.0.0 published the doctrine; v1.1.0 makes it standards-traceable,
      confidence-aware, statistically contextualised, auditably reproducible,
      and operationally defensible. Additive only — no v1 coefficient or
      threshold changes, no maturity-classification advancements. Three-way
      agreement preserved (no ranking, no AI inference, no individual
      attribution). Crosswalks use only {FULL | PARTIAL | ADJACENT |
      OUT_OF_SCOPE}; no row asserts equivalence with any cited standard
      (enforced by crosswalkCoverageIntegrity.test.ts).
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'packages/oci-confidence/package.json'
      - 'packages/oci-confidence/src/confidenceContracts.ts'
      - 'packages/oci-confidence/src/confidence-model.ts'
      - 'packages/oci-confidence/src/confidence-decay.ts'
      - 'packages/oci-confidence/src/stability-engine.ts'
      - 'packages/oci-confidence/src/data-completeness.ts'
      - 'packages/oci-confidence/src/interpretive-cautions.ts'
      - 'packages/oci-confidence/src/confidenceVisualModel.ts'
      - 'packages/oci-confidence/src/index.ts'
      - 'packages/oci-confidence/src/confidence-model.test.ts'
      - 'packages/oci-confidence/src/confidence-decay.test.ts'
      - 'packages/oci-confidence/src/stability-engine.test.ts'
      - 'apps/union-eyes/lib/oci/statistics/statisticalAnchorContracts.ts'
      - 'apps/union-eyes/lib/oci/statistics/calculateHHI.ts'
      - 'apps/union-eyes/lib/oci/statistics/calculateGini.ts'
      - 'apps/union-eyes/lib/oci/statistics/stewardshipConcentrationModel.ts'
      - 'apps/union-eyes/lib/oci/statistics/statisticalConfidenceModel.ts'
      - 'apps/union-eyes/lib/oci/statistics/index.ts'
      - 'apps/union-eyes/lib/oci/statistics/__tests__/calculateHHI.test.ts'
      - 'apps/union-eyes/lib/oci/statistics/__tests__/calculateGini.test.ts'
      - 'apps/union-eyes/lib/oci/audit/entropyAuditContracts.ts'
      - 'apps/union-eyes/lib/oci/audit/observableEvidenceTaxonomy.ts'
      - 'apps/union-eyes/lib/oci/audit/evidenceSufficiencyEngine.ts'
      - 'apps/union-eyes/lib/oci/audit/confidenceEscalationRules.ts'
      - 'apps/union-eyes/lib/oci/audit/entropyAuditPacketBuilder.ts'
      - 'apps/union-eyes/lib/oci/audit/reviewerVarianceModel.ts'
      - 'apps/union-eyes/lib/oci/audit/auditObservability.ts'
      - 'apps/union-eyes/lib/oci/audit/index.ts'
      - 'apps/union-eyes/lib/oci/audit/__tests__/evidenceSufficiencyEngine.test.ts'
      - 'apps/union-eyes/lib/oci/audit/__tests__/entropyAuditPacketBuilder.test.ts'
      - 'apps/union-eyes/lib/oci/audit/__tests__/reviewerVarianceModel.test.ts'
      - 'apps/union-eyes/lib/oci/__tests__/crosswalkCoverageIntegrity.test.ts'
      - 'docs/oci/compliance/OCI_ISO22301_CROSSWALK.md'
      - 'docs/oci/compliance/OCI_ISO22317_CROSSWALK.md'
      - 'docs/oci/compliance/OCI_ISO37000_CROSSWALK.md'
      - 'docs/oci/compliance/OCI_ISO31000_CROSSWALK.md'
      - 'docs/oci/compliance/OCI_COBIT2019_CROSSWALK.md'
      - 'docs/oci/compliance/OCI_COVERAGE_MATRIX.md'
      - 'docs/oci/compliance/OCI_AUDITOR_GUIDE.md'
      - 'docs/oci/compliance/OCI_PROCUREMENT_POSITIONING.md'
      - 'docs/oci/procurement/OCI_AUDITOR_QUICK_REFERENCE.md'
      - 'docs/oci/procurement/OCI_CONFIDENCE_INTERPRETATION_GUIDE.md'
      - 'docs/oci/procurement/OCI_GOVERNANCE_ENTROPY_REVIEW_GUIDE.md'
      - 'docs/oci/procurement/OCI_PROCUREMENT_FAQ.md'
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'

  - version: '1.1.1'
    date: '2026-05-24'
    change_class: 'standard'
    category: 'doctrine'
    summary: >
      Question Architecture Audit™. Adds a methodology-grade signal-extraction
      validation of the OCRA/OCI question pool covering inventory, signal
      depth, signal diversity, entropy coverage, confidence generation,
      longitudinal survivability, statistical interpretability, adaptive
      routing sophistication, evidence extraction discipline, procurement
      defensibility, Human Continuity Theory operationalisation, redesign
      roadmap (v1.2.0 / v1.3.0), and a seven-stage question-change
      governance process. Adds seven Vitest signal-integrity suites that
      enforce the audit findings against the real question bank.
    rationale: >
      OCI v1.1.0 established the runtime-confidence and standards-traceability
      surface. v1.1.1 audits the question pool itself — the signal-extraction
      substrate that feeds every downstream envelope — to ensure continuity
      intelligence is derived from a rigorously audited institutional signal
      extraction architecture aligned with doctrine, confidence model,
      statistical framework, and human continuity methodology. Surfaces
      Finding M-1 (maturity_select share 77.8 % breaches doctrine 65–75 %
      band; tracked by Roadmap R-H1), Finding R-1 (adaptive routing engine
      functionally inert; tracked by R-C2), Finding E-1 (GES level 5 lacks
      direct probe; tracked by R-C1), Finding C-3 (trust_debt lacks likert
      input; tracked by R-C3). No coefficient changes; no maturity-
      classification advancement; question bank itself unchanged in this
      entry — the audit deliverables and enforcement tests are the change.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md'
      - 'docs/oci/audit/SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md'
      - 'docs/oci/audit/ENTROPY_SIGNAL_GAP_REPORT.md'
      - 'docs/oci/audit/CONFIDENCE_GENERATION_AUDIT.md'
      - 'docs/oci/audit/LONGITUDINAL_SURVIVABILITY_AUDIT.md'
      - 'docs/oci/audit/STATISTICAL_INTERPRETABILITY_AUDIT.md'
      - 'docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md'
      - 'docs/oci/audit/EVIDENCE_EXTRACTION_AUDIT.md'
      - 'docs/oci/audit/QUESTION_ARCHITECTURE_PROCUREMENT_REVIEW.md'
      - 'docs/oci/audit/HUMAN_CONTINUITY_THEORY_ALIGNMENT.md'
      - 'docs/oci/audit/QUESTION_REDESIGN_ROADMAP.md'
      - 'docs/oci/audit/QUESTION_ARCHITECTURE_GOVERNANCE.md'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/questionSignalIntegrity.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/adaptiveRouteDepth.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/entropyCoverage.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/confidenceGenerationCoverage.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/longitudinalSignalStability.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/statisticalInterpretability.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/maturitySelectCeiling.test.ts'

# Future-entry template (delete this comment block when adding entries):
#
#  - version: 'X.Y.Z'
#    date: 'YYYY-MM-DD'
#    change_class: 'constitutional | standard | clarification'
#    category: 'coefficient | confidence-model | observable-criteria | crosswalk | doctrine | maturity-classification'
#    summary: '...'
#    rationale: '...'
#    authority: '...'
#    breaking_change_yn: true | false
#    affected_artifacts:
#      - '...'
