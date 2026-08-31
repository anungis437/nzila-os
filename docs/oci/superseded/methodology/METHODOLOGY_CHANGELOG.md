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

  - version: '1.2.0-foundation'
    date: '2026-05-23'
    change_class: 'standard'
    category: 'doctrine'
    summary: >
      Signal Sophistication Recovery Sprint — foundation. Introduces an
      isolated v2 modality registry (eight modalities: contradiction_pair,
      evidence_strength, continuity_distribution, dependency_mapping,
      confidence_marker, topology_mapping, stability_marker,
      transition_exposure), a contradiction-detection engine with severity
      and per-dimension confidence-penalty composition, a six-level
      evidence-strength taxonomy with monotonic branching engine and
      declared-vs-evidenced gap function, a GES Level 5 probe registry
      addressing all eight L5 signals, and seven routing-v2 path types
      that deepen extraction where fragility is detected. Adds six
      signal-integrity test suites (31 passing assertions, 8 todos
      tracking v1.3.0/v1.4.0 deliverables) and three doctrine documents
      (GES_LEVEL_5_SIGNAL_MODEL, MODERNIZATION_INSTABILITY_SIGNAL_MODEL,
      QUESTION_POOL_v2_0_ROADMAP).
    rationale: >
      Closes audit findings M-1, R-1, E-1, C-3 at the foundation layer.
      Modalities are isolated in `modalities-v2/` to avoid breaking the
      runtime scoring engine, narrative engine, and UI layer; integration
      into the active OCRA flow proceeds through migration waves 1.3.0 →
      1.6.0 per QUESTION_POOL_v2_0_ROADMAP.md. Doctrine guarantee:
      contradictions REDUCE confidence; they are never silently averaged.
      Anti-claims preserved: no individual mapping, no surveillance drift,
      no behavioural inference.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'apps/union-eyes/lib/icra/modalities-v2/types.ts'
      - 'apps/union-eyes/lib/icra/modalities-v2/registry.ts'
      - 'apps/union-eyes/lib/icra/contradictions/contradictionSignalPairs.ts'
      - 'apps/union-eyes/lib/icra/contradictions/contradictionSeverityModel.ts'
      - 'apps/union-eyes/lib/icra/contradictions/contradictionConfidence.ts'
      - 'apps/union-eyes/lib/icra/contradictions/contradictionDetectionEngine.ts'
      - 'apps/union-eyes/lib/icra/evidence-strength/evidenceTaxonomy.ts'
      - 'apps/union-eyes/lib/icra/evidence-strength/evidenceBranchingEngine.ts'
      - 'apps/union-eyes/lib/icra/ges-level5/probes.ts'
      - 'apps/union-eyes/lib/icra/routing-v2/pathTypes.ts'
      - 'docs/oci/audit/GES_LEVEL_5_SIGNAL_MODEL.md'
      - 'docs/oci/audit/MODERNIZATION_INSTABILITY_SIGNAL_MODEL.md'
      - 'docs/oci/audit/QUESTION_POOL_v2_0_ROADMAP.md'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/contradictionCoverage.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/evidenceStrengthCoverage.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/confidenceSignalDensity.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/topologyExtractionIntegrity.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/modernizationFragilityCoverage.test.ts'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/adaptiveTopologyDepth.test.ts'

  - version: '1.2.1-integration'
    date: '2026-05-23'
    change_class: 'standard'
    category: 'doctrine'
    summary: >
      Signal Sophistication Recovery Sprint — controlled live-flow
      migration of the v1.2.0 foundation (P1 priorities). (1) Wires the
      contradiction-detection engine into the v1 continuity confidence
      surface via an additive, non-mutating bridge
      (`contradictions/confidencePenaltyBridge.ts`) that re-projects v2
      dimension penalties onto v1 confidence domains, preserves nulls
      (refusal-respecting), and clamps cumulative per-domain drag at 0.7.
      (2) Introduces a pure evidence-multiplier helper
      (`evidence-strength/evidenceScoringBridge.ts`) ready for v1.3.0
      Answer-type extension; undefined-passthrough makes the future
      wiring backward-compatible by construction. (3) Makes routing-v2
      paths executable via deterministic predicates
      (`routing-v2/pathActivation.ts`) and adds an additive
      `pathDeepens?` hint to `AdaptiveRules` that may only escalate
      inclusion / raise confidence floors, never suppress. (4) Extends
      the narrative engine with a contradiction-aware insight slot
      (`contradictions/contradictionInsightAdapter.ts`) surfaced via a
      new `contradiction_detected` insight category and an optional
      `contradictionReport?` parameter on `generateInsights()`. Adds 29
      new passing integration assertions across all four deliverables
      (`__tests__/signal-integrity/v2/foundationIntegration.test.ts`).
    rationale: >
      v1.2.0 foundation was isolated by design to avoid breaking the
      runtime scoring, narrative, and UI surfaces. v1.2.1 begins the
      controlled migration into the live flow per
      QUESTION_POOL_v2_0_ROADMAP.md while preserving every doctrinal
      guarantee: contradictions REDUCE confidence (never average);
      routing additions DEEPEN extraction (never suppress); evidence
      grading reflects honesty over inflation (multipliers in
      [0.5, 1.0]); no individual mapping, no behavioural inference, no
      surveillance drift. Answer-type extension (which would unlock
      live evidence-multiplier wiring) is intentionally DEFERRED to
      v1.3.0 because it touches the question-pool runtime, fixtures,
      persistence, and the scoring trace fingerprint — three orders of
      magnitude more risk than a pure helper landing now.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'apps/union-eyes/lib/icra/contradictions/confidencePenaltyBridge.ts'
      - 'apps/union-eyes/lib/icra/contradictions/contradictionInsightAdapter.ts'
      - 'apps/union-eyes/lib/icra/evidence-strength/evidenceScoringBridge.ts'
      - 'apps/union-eyes/lib/icra/routing-v2/pathActivation.ts'
      - 'apps/union-eyes/lib/icra/adaptation/types.ts'
      - 'apps/union-eyes/lib/icra/insight-engine.ts'
      - 'apps/union-eyes/lib/icra/types.ts'
      - 'apps/union-eyes/components/icra/ICRAProfile.tsx'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/v2/foundationIntegration.test.ts'

  - version: '1.2.2'
    date: '2026-06-15'
    change_class: 'clarification'
    category: 'confidence-model'
    summary: >
      Adds whitepaper §7.6 "Confidence signals vs. maturity evidence
      (scoring role)" documenting — without changing any coefficient or
      scoring rule — how perception-based `likert_5` Continuity Confidence
      Signals affect scoring. Records the measured minority weight share
      carried by confidence signals in each dimension (9.4 % of the
      institutional_continuity composite; 7.6–11.4 % across the five
      dimensions), the resulting bound that confidence cannot move a
      maturity band on its own (≈ 4.7-point maximum composite swing), the
      monotonic-downward contradiction channel (contradictions reduce
      confidence, never inflate score), the per-dimension ≥ 1 likert floor,
      and the governed (non-silent) option to fully decouple confidence
      from the composite in a future scoring-version migration.
    rationale: >
      Closes the first concern raised in the v4 question-bank hostile-review
      pass ("how do confidence signals affect scoring?" — the lead question a
      public-sector / auditor-general reviewer asks). The protection already
      existed in the math (confidence is a minority corroboration input and
      the contradiction engine only reduces confidence) but was undocumented;
      this entry makes the existing behaviour explicit and reproducible.
      No coefficient, threshold, weight, band, scale, or comparability
      change — documentation of existing behaviour only.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'

  - version: '1.2.3'
    date: '2026-06-15'
    change_class: 'clarification'
    category: 'doctrine'
    summary: >
      Adds a "Government-readiness & validation layer" companion block to the
      whitepaper front matter, cross-referencing the existing additive,
      read-only government-readiness artifacts from the methodology authority
      document: the evidence validation binder, the obligation taxonomy and
      source-instrument catalogue governance, the assessor certification and
      inter-rater reliability standard, and the senior-validator protocol and
      verdicts. No prose in the scoring sections changes.
    rationale: >
      Closes the routing gap behind the v4 hostile-review concerns Q2
      (evidence validation), Q3 (obligation-mapping governance), and Q4
      (assessor governance). The capabilities already exist as
      constitutionally-isolated, tested modules (assessor-governance and
      obligation-mapping-isolation suites green; never import the scoring
      engine) and as doctrine under docs/oci/government-readiness/, but the
      methodology packet an auditor reads first did not reference them — so an
      auditor could not reconstruct the procurement claims by following the
      methodology document. This entry makes the additive layer discoverable
      from the methodology authority surface. No coefficient, threshold,
      weight, band, scale, or comparability change — cross-reference only.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'

  - version: '1.2.4'
    date: '2026-06-15'
    change_class: 'clarification'
    category: 'confidence-model'
    summary: >
      Adds a "Construct basis — why perception is admitted to the score at
      all" paragraph to whitepaper §7.6, stating the measurement-theory
      rationale for confidence signals' presence in the composite (not only
      the operational magnitude bound recorded in 1.2.2). Records the settled
      construct position: OCI measures one construct — institutional
      continuity capability — across an evidence gradient (behavioral >
      structural > self-assessed), where likert_5 is the weakest evidence
      tier of the same construct, constrained by OCI_MODALITY_DOCTRINE §4 to
      measure "perceived continuity reality, not satisfaction" (affective
      forms forbidden) and grounded in the declared-vs-evidenced distinction
      of the evidence-strength taxonomy. States explicitly that this is
      Option A (perception is a legitimate, bounded, evidence-graded
      component) and not Option B (perception excluded from the composite),
      and that Option B remains a governed future migration, not the current
      methodology.
    rationale: >
      Hardens the answer to the deepest hostile-review question ("why should
      perception contribute to a maturity score at all?") from an operational
      argument ("it contributes only a little") to a methodological one ("it
      contributes because self-assessed capability is the weakest evidence
      tier of the same continuity construct, admitted as bounded minority
      corroboration and subordinated to behavior"). Resolves the A/B construct
      ambiguity flagged in pre-validation review by stating the position
      explicitly rather than leaving it implicit. No coefficient, threshold,
      weight, band, scale, or comparability change — documentation of the
      existing construct decision only.
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'

  - version: '1.2.5'
    date: '2026-06-15'
    change_class: 'constitutional'
    category: 'doctrine'
    summary: >
      Adds whitepaper §4.6 "The Construct Invariant™ (single construct,
      evidence gradient)" as a frozen constitutional rule on the same footing
      as the comparability invariant (§6) and the fairness rule: OCI/OCRA
      measures a single construct — institutional continuity capability — and
      the question modalities are different evidence strengths of that one
      construct (maturity_select = behavioral, multiple_choice = structural,
      likert_5 = self-assessed), differing in evidentiary strength, not in
      construct identity. Updates §7.6 to disclose BOTH the realistic gaming
      swing (≈4.7 points, honest-neutral → inflated) and the absolute
      full-range swing (≈9.4 points, floor → ceiling) of the confidence
      channel, replacing the single ≈4.7 figure. Adds an executable guard,
      apps/union-eyes/lib/icra/__tests__/signal-integrity/constructInvariant.test.ts,
      proving floor behavioral evidence + maximally inflated confidence
      remains in the lowest maturity band (composite < 30) and bounding the
      confidence swing in CI.
    rationale: >
      Elevates the measurement-theory position from an explanatory paragraph
      to a constitutional rule (pre-validation reviewer guidance: a named
      invariant is stronger than prose because it becomes enforceable
      doctrine). The executable guard answers the sharpest hostile-review
      question — "can an institution achieve a high score through optimism
      alone?" — with reproducible evidence (no), and converts the documented
      bound into a CI tripwire so a future weight edit that let perception
      dominate would fail rather than ship silently. The full-range ≈9.4
      figure is disclosed alongside the ≈4.7 gaming figure for honesty: a
      reviewer running the full-range scenario will find ≈9.4, and the
      methodology states it rather than being caught by it. The classification
      is 'constitutional' because §4.6 freezes a new invariant; however it is
      a documentation+validation addition only — NO coefficient, threshold,
      weight, band, scale, or comparability value changes, and the scoring
      core is untouched (breaking_change_yn: false).
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'
      - 'apps/union-eyes/lib/icra/__tests__/signal-integrity/constructInvariant.test.ts'

  - version: '1.2.6'
    date: '2026-06-15'
    change_class: 'clarification'
    category: 'crosswalk'
    summary: >
      Adds whitepaper §12.12 "Measurement-tradition positioning — self-assessed
      capability as evidence" (renumbering the former §12.12 Summary positioning
      to §12.13), and a companion `measurement_traditions` block in
      standards-crosswalk.yaml. Positions OCI's admission of self-assessment (the
      weakest evidence tier under the §4.6 Construct Invariant) against five
      established measurement traditions in which self-assessed capability is
      already treated as a bounded evidence form: self-efficacy (Bandura),
      organizational readiness for change (Weiner), safety climate/culture
      (Zohar), control self-assessment (IIA internal-audit practice), and
      organizational-resilience self-assessment (ISO 22316 tradition). Introduces
      a distinct fifth relationship class, `structurally-consistent`, used ONLY
      for measurement-tradition lineage and explicitly separated from the four
      standards-substitutability classes (complements/extends/gap-coverage/
      not-equivalent). Updates the §12 intro and methodology README to note the
      separate class.
    rationale: >
      Closes the final hostile-review question on the self-assessment premise:
      "is it even legitimate to count self-assessed capability as evidence?"
      The section demonstrates the pattern is established assessment practice —
      OCI did not invent it — while making three honesty boundaries explicit:
      OCI claims STRUCTURAL CONSISTENCY only, never derivation, instrument
      adoption, or inheritance of any tradition's empirical validation (the
      v1.0.0 maturity disclosure still governs). It also turns the positioning
      into a strength by showing OCI is MORE conservative than pure self-report
      instruments — self-assessment is capped to a minority weight, subordinated
      to behavioral evidence, and cross-checked by downward-only contradiction
      detection. Control self-assessment is highlighted as closest in spirit
      because public-sector auditors themselves treat self-assessment as evidence
      that must be corroborated. Classified 'clarification': positioning prose
      plus a companion-artifact block only — NO coefficient, threshold, weight,
      band, scale, comparability value, or scoring-core change
      (breaking_change_yn: false).
    authority: 'OCI doctrine maintainers'
    breaking_change_yn: false
    affected_artifacts:
      - 'docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md'
      - 'docs/oci/methodology/standards-crosswalk.yaml'
      - 'docs/oci/methodology/README.md'

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
