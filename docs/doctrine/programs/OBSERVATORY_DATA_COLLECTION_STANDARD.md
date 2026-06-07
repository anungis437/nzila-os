# Observatory Data Collection Standard

<!--
  ARTIFACT TYPE: Observatory Governance Standard
  DOCTRINE_VERSION: 1.1.0-draft
  CHANGE CLASS: Constitutional data governance - founder sign-off required.
  CANONICAL REFERENCE: docs/doctrine/INSTITUTIONAL_INTELLIGENCE_CANONICAL_PACKAGE.md
  SCHEMA REFERENCE: docs/doctrine/programs/INSTITUTIONAL_INTELLIGENCE_OBSERVATORY_SCHEMA.md
-->

> This document governs what Observatory data may be collected, how it is de-identified, what may be published, and how withdrawal is handled.

---

## 1. Scope

Applies to all Institutional Intelligence Observatory collection pathways, including:
1. IIA workshops
2. Reassessments
3. Case-study extraction
4. Benchmark and cohort reporting

This standard governs institutional analytics only. Individual behavior analytics are prohibited.

---

## 2. Consent Classes

| Class | Name | What it permits | Default |
|---|---|---|---|
| C0 | Operational delivery only | Use data only for client delivery artifacts; no observatory ingestion | Allowed |
| C1 | Anonymous benchmark contribution | De-identified ingestion for cohort benchmarking | Opt-in |
| C2 | Anonymized case-study contribution | Use in anonymized case narratives and benchmark commentary | Opt-in |
| C3 | Attributed publication | Named institution quotes or case references | Opt-in, explicit approval |

Rules:
1. Consent is informed, scoped, and versioned.
2. Consent can be reduced at any time by the institution.
3. C3 is never implied from C1 or C2.

---

## 3. Publication Classes

| Class | Name | Allowed content | Prerequisites |
|---|---|---|---|
| P0 | No publication | No external publication | Any consent state |
| P1 | Private client reporting | Client-specific readouts and internal memos | Service contract |
| P2 | Public anonymized benchmark | Cohort-level statistics and sector trends | C1 + k-anonymity pass |
| P3 | Public anonymized case study | Narrative case without identifying markers | C2 + review approval |
| P4 | Public attributed case study | Named institution and attributed quotes | C3 + explicit publication approval |

---

## 4. Allowed Data and Prohibited Data

### Allowed (institutional posture)
1. IIA dimension scores and composite scores
2. Maturity levels and reassessment deltas
3. Sector, size band, generalized geography
4. Route decision scores and selected route
5. De-identified economics estimates and confidence levels

### Prohibited (never collected for observatory analytics)
1. Individual productivity or behavior profiles
2. Time-on-task monitoring for individuals
3. Personal member, worker, or patient identifiers
4. Any raw data that creates re-identification risk

---

## 5. De-Identification Rules

1. Organization names are replaced with alias IDs before analytics.
2. Geography is generalized to region-level reporting categories.
3. Structural identifiers that can reveal institution identity are removed.
4. Free-text notes must be redacted for identifying content before ingestion.
5. Public outputs must satisfy published k-anonymity thresholds.

Default public thresholds:
1. Sector benchmark cohort: k >= 15
2. Public flagship cross-sector report: k >= 25
3. Cross-tab cells below threshold must be suppressed or aggregated upward.

---

## 6. Benchmark Eligibility Rules

A record is benchmark-eligible only when all conditions are true:
1. Consent class includes C1 or above.
2. Minimum data package is complete per Observatory Schema.
3. Data quality checks pass.
4. Cohort cell meets k-anonymity threshold.

If any condition fails, record remains private operational data.

---

## 7. Retention and Deletion

1. Raw collection artifacts: retain only as required for contracted delivery and audit trace.
2. De-identified observatory records: retained for longitudinal trend analysis unless withdrawn.
3. Consent records: retained for legal and governance traceability.
4. Published benchmark aggregates: retained as historical publication record.

Retention schedule must be declared in engagement terms and consent forms.

---

## 8. Withdrawal Procedure

Institutional withdrawal rights are unconditional.

Withdrawal workflow:
1. Institution submits written withdrawal request.
2. ConsentProfile is updated immediately.
3. Future collection ceases under withdrawn consent classes.
4. Unpublished de-identified records are removed from active benchmark datasets.
5. Published aggregate reports are not retroactively rewritten, but future editions exclude withdrawn records.
6. If attributable material exists under C3, remove from web/public distribution unless legal retention obligations apply.

Target SLA:
- Acknowledge within 2 business days.
- Complete operational withdrawal actions within 15 business days.

---

## 9. Approval and Review Controls

1. Any publication class above P2 requires observatory governance review.
2. Any exception to de-identification or threshold policy requires founder-level approval.
3. Standard reviewed at least annually or upon material legal/regulatory change.

---

## 10. Compliance Anchors

This standard is aligned with:
1. Institutional Intelligence Observatory Schema
2. Anti-Surveillance Doctrine
3. Product Qualification Matrix and route governance
4. Institutional Validation Engine consent and anonymization principles
