# Institutional Intelligence Observatory Schema

<!--
  ARTIFACT TYPE: Canonical Data Architecture
  DOCTRINE_VERSION: 1.1.0-draft
  CHANGE CLASS: Constitutional GTM/data control - founder sign-off required.
  CANONICAL REFERENCE: docs/doctrine/INSTITUTIONAL_INTELLIGENCE_CANONICAL_PACKAGE.md
  ARCHITECTURE REFERENCE: docs/doctrine/programs/INSTITUTIONAL_INTELLIGENCE_PRODUCT_ARCHITECTURE.md
-->

> Purpose: define the canonical data model for the Institutional Intelligence Observatory.
> All benchmark, cohort, and maturity reporting must be generated from this schema.

---

## 1. Design Principles

1. Institutional, not individual: no individual performance or behavioral profiling.
2. Evidence-traceable: every score links to engagement evidence and confidence.
3. Consent-governed: publication and attribution depend on explicit consent flags.
4. De-identification by default: identifiers are removed before benchmark publication.
5. Longitudinal continuity: schema supports baseline and reassessment history.

Governing standards:
- `docs/doctrine/programs/OBSERVATORY_DATA_COLLECTION_STANDARD.md`
- `docs/doctrine/programs/OBSERVATORY_OPERATING_MODEL.md`

---

## 2. Core Entities

1. OrganizationProfile
2. Engagement
3. IIAAssessment
4. DimensionScore
5. FragilityEconomics
6. RouteDecision
7. ReassessmentEvent
8. ConsentProfile
9. PublicationEligibility

---

## 3. Entity Definitions

## 3.1 OrganizationProfile

| Field | Type | Required | Description |
|---|---|---|---|
| organization_id | string (UUID) | Yes | Internal stable ID |
| org_alias | string | Yes | De-identified label used in analysis |
| sector | enum | Yes | labour, healthcare, municipal, association, smb, other |
| sub_sector | string | No | Optional finer segmentation |
| size_band | enum | Yes | micro, small, medium, large, enterprise |
| federation_status | enum | No | federated, centralized, hybrid, unknown |
| geography_region | string | Yes | Generalized region (not street-level) |
| country_code | string (ISO-2) | Yes | Country reference |
| first_engagement_date | date | Yes | First observed engagement date |

---

## 3.2 Engagement

| Field | Type | Required | Description |
|---|---|---|---|
| engagement_id | string (UUID) | Yes | Unique engagement reference |
| organization_id | string (UUID) | Yes | Foreign key to OrganizationProfile |
| route_entry_type | enum | Yes | iia_first, ue_first, trustcore_route, hybrid_iia_ue, defer |
| delivery_mode | enum | Yes | discovery, workshop, annual_review |
| engagement_start_date | date | Yes | Start date |
| engagement_end_date | date | No | End date |
| executive_sponsor_present | boolean | Yes | Sponsor participation control |
| participant_count | integer | Yes | Number of participants |
| evidence_confidence_overall | enum | Yes | low, medium, high |
| case_study_opt_in | boolean | Yes | Consent signal for case-study usage |

---

## 3.3 IIAAssessment

| Field | Type | Required | Description |
|---|---|---|---|
| assessment_id | string (UUID) | Yes | Unique assessment record |
| engagement_id | string (UUID) | Yes | Foreign key to Engagement |
| assessment_date | date | Yes | Date scored |
| iia_composite_score | integer | Yes | 0-24 |
| maturity_level | enum | Yes | level1, level2, level3, level4, level5 |
| primary_risk_dimensions | string[] | Yes | Ordered top risk dimensions |
| top_priority_count | integer | Yes | Count of top priorities |
| reassessment_due_date | date | No | Planned reassessment date |

Maturity mapping:
- 0-6: level1
- 7-12: level2
- 13-17: level3
- 18-21: level4
- 22-24: level5

---

## 3.4 DimensionScore

| Field | Type | Required | Description |
|---|---|---|---|
| dimension_score_id | string (UUID) | Yes | Unique row ID |
| assessment_id | string (UUID) | Yes | Foreign key to IIAAssessment |
| dimension_name | enum | Yes | memory_integrity, continuity_capacity, governance_maturity, trust_operations, accountability_architecture, institutional_resilience |
| score | integer | Yes | 0-4 |
| consequence_level | enum | Yes | low, medium, high |
| urgency_level | enum | Yes | low, medium, high |
| evidence_confidence | enum | Yes | low, medium, high |
| evidence_note | string | No | De-identified evidence summary |

---

## 3.5 FragilityEconomics

| Field | Type | Required | Description |
|---|---|---|---|
| economics_id | string (UUID) | Yes | Unique economics row |
| assessment_id | string (UUID) | Yes | Foreign key to IIAAssessment |
| leadership_transition_cost | number | No | Estimated annualized exposure |
| knowledge_loss_cost | number | No | Estimated annualized exposure |
| governance_inconsistency_cost | number | No | Estimated annualized exposure |
| audit_preparation_cost | number | No | Estimated annualized exposure |
| regulatory_response_cost | number | No | Estimated annualized exposure |
| trust_erosion_cost | number | No | Estimated annualized exposure |
| vendor_dependency_cost | number | No | Estimated annualized exposure |
| total_fragility_exposure | number | No | Sum of available fields |
| economics_confidence | enum | Yes | low, medium, high |

---

## 3.6 RouteDecision

| Field | Type | Required | Description |
|---|---|---|---|
| route_decision_id | string (UUID) | Yes | Unique route decision ID |
| engagement_id | string (UUID) | Yes | Foreign key to Engagement |
| iia_route_score | integer | Yes | Matrix score |
| ue_route_score | integer | Yes | Matrix score |
| trustcore_route_score | integer | Yes | Matrix score |
| selected_route | enum | Yes | iia_first, ue_first, hybrid_iia_ue, trustcore_route, defer |
| route_rationale | string | Yes | Why this route was selected |
| override_used | boolean | Yes | Whether deterministic rule was overridden |
| override_approval | string | No | Approver for override |
| decision_date | date | Yes | Date of route decision |

---

## 3.7 ReassessmentEvent

| Field | Type | Required | Description |
|---|---|---|---|
| reassessment_id | string (UUID) | Yes | Unique reassessment event ID |
| organization_id | string (UUID) | Yes | Foreign key to OrganizationProfile |
| prior_assessment_id | string (UUID) | Yes | Previous baseline or reassessment |
| current_assessment_id | string (UUID) | Yes | Current assessment |
| delta_composite | integer | Yes | Current minus prior composite |
| delta_level | integer | Yes | Maturity level change |
| improved_dimensions | string[] | No | Dimensions with positive score delta |
| regressed_dimensions | string[] | No | Dimensions with negative score delta |
| reassessment_interval_days | integer | Yes | Days between assessments |

---

## 3.8 ConsentProfile

| Field | Type | Required | Description |
|---|---|---|---|
| consent_id | string (UUID) | Yes | Unique consent record |
| organization_id | string (UUID) | Yes | Foreign key to OrganizationProfile |
| benchmark_use_consent | boolean | Yes | Consent for anonymized benchmark use |
| quote_use_consent | boolean | Yes | Consent for quotes |
| attributed_quote_consent | boolean | Yes | Consent for attribution |
| case_study_publication_consent | boolean | Yes | Consent for case-study publishing |
| consent_effective_date | date | Yes | Effective date |
| consent_version | string | Yes | Consent terms version |

---

## 3.9 PublicationEligibility

| Field | Type | Required | Description |
|---|---|---|---|
| publication_id | string (UUID) | Yes | Unique publication record |
| cohort_key | string | Yes | Sector/size/region cohort identifier |
| cohort_count | integer | Yes | Number of organizations in cohort |
| k_anonymity_threshold | integer | Yes | Required cohort minimum |
| eligible_for_public_reporting | boolean | Yes | True when cohort_count >= threshold |
| exclusion_reason | string | No | Why cohort was withheld |
| publication_window | string | Yes | quarter/year window |

Default threshold:
- Public cohort reporting requires k >= 25.

---

## 4. Controlled Vocabularies

## 4.1 Sector Enum
- labour
- healthcare
- municipal
- association
- smb
- other

## 4.2 Route Enum
- iia_first
- ue_first
- hybrid_iia_ue
- trustcore_route
- defer

## 4.3 Dimension Enum
- memory_integrity
- continuity_capacity
- governance_maturity
- trust_operations
- accountability_architecture
- institutional_resilience

---

## 5. Minimum Data Package Per Assessment

An assessment is benchmark-eligible only when all are present:
1. OrganizationProfile sector, size_band, geography_region, country_code.
2. Engagement route_entry_type, delivery_mode, participant_count.
3. IIAAssessment composite, maturity_level.
4. Six DimensionScore rows with score, consequence, urgency, confidence.
5. ConsentProfile benchmark_use_consent.

---

## 6. Data Quality Rules

1. iia_composite_score must equal sum of six dimension scores.
2. Dimension score values must be integers in [0,4].
3. Maturity level must match composite band.
4. selected_route must match qualification matrix result unless override_used=true.
5. Any override requires override_approval and rationale.
6. No publication without benchmark_use_consent=true.

---

## 7. Privacy and De-Identification Requirements

1. No personal identifiers stored for observatory analytics.
2. Organization names are replaced by org_alias in analysis datasets.
3. Regional values must be generalized to prevent re-identification.
4. Public reporting must satisfy k-anonymity thresholds.
5. Attributed quotes require explicit attributed_quote_consent=true.

---

## 8. Benchmark Output Views (Derived)

1. CohortMaturityDistribution
- Inputs: sector, size_band, maturity_level counts
- Output: maturity distribution by cohort

2. DimensionHeatmapBySector
- Inputs: average dimension score by sector
- Output: comparative fragility profile

3. ReassessmentDeltaView
- Inputs: reassessment events
- Output: median score improvements and regressions

4. RouteConversionView
- Inputs: route decisions + downstream engagement outcomes
- Output: route-to-product conversion trends

---

## 9. Versioning and Change Control

1. Schema version format: major.minor.patch
2. Major: breaking field or enum changes
3. Minor: additive fields and derived views
4. Patch: clarification and non-breaking constraints

Current schema version:
- 1.0.0-draft
