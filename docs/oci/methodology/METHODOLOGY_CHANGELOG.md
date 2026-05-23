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
