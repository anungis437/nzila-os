# Institutional Validation Engine

<!--
  ARTIFACT TYPE: Operational Program — Validation, Evidence, and Index Architecture
  DOCTRINE_VERSION: 1.0.0
  CHANGE CLASS: Operational — pilot framework, evidence capture, index methodology.
                Doctrine anchors are constitutional and require founder sign-off to amend.
  CANONICAL DOCTRINE SOURCE: docs/doctrine/DOCTRINE.md
  RELATED ARTIFACTS:
    - docs/doctrine/SCORING_MODELS.md (ICI / GFS / OMS / TDS methodology)
    - docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md (diagnostic instrument)
    - docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md (evidence boundaries)
-->

> Architecture earns intellectual respect. It does not, by itself, earn institutional adoption.
>
> Institutional adoption requires evidence: operational legitimacy from working pilots,
> benchmark authority from published longitudinal data, and category credibility from
> documented outcomes in real institutions.
>
> This document defines how Nzila generates that evidence — structurally, repeatably,
> and under the same doctrinal constraints that govern the platform itself.

---

# Table of Contents

1. [Validation Engine Overview](#1-validation-engine-overview)
2. [Pilot Validation Framework](#2-pilot-validation-framework)
3. [Evidence Capture Architecture](#3-evidence-capture-architecture)
4. [The Institutional Continuity Index (ICI)](#4-the-institutional-continuity-index-ici)
5. [Case Study Architecture](#5-case-study-architecture)
6. [Annual Report Structure](#6-annual-report-structure)
7. [Governance Constraints on the Validation Engine](#7-governance-constraints-on-the-validation-engine)

---

# 1. Validation Engine Overview

## 1.1 — Purpose

The Institutional Validation Engine is the system through which Nzila generates four categories of evidence:

1. **Operational legitimacy.** Documented evidence that the platform works in real institutional environments, producing measurable continuity, governance, and operational outcomes.
2. **Benchmark authority.** Cross-institutional, longitudinal data establishing the empirical baseline for institutional continuity posture across sectors.
3. **Category credibility.** Published findings that establish "institutional continuity infrastructure" as a recognized category with documented practitioners and measurable maturity.
4. **Institutional proof.** Standardized case study material that buyers, regulators, members, and analysts can reference as evidence of institutional performance.

## 1.2 — Architectural Position

The validation engine sits between the operational platform and the doctrine layer.

- It draws **inputs** from operational deployments (with explicit consent and anonymization).
- It produces **outputs** to the doctrine layer (refined frameworks, validated scoring models, evidence-backed positioning).
- It produces **outputs** to the public layer (Institutional Continuity Index, case studies, annual reports).
- It enforces **constraints** from the Anti-Surveillance Doctrine on all data collection, anonymization, and publication.

```
+----------------------+
|   Operational        |  pilot deployments, OCRA results
|   Platform           |  (consent-bound, sovereignty-preserved)
+----------+-----------+
           |
           v (anonymized, aggregated)
+----------------------+
|   Validation         |  cohort analytics, benchmark engine,
|   Engine             |  longitudinal trends, case extraction
+----------+-----------+
           |
           +--> Doctrine refinement (private)
           +--> ICI publication (public, annual)
           +--> Case studies (institutional, with consent)
           +--> Sector reports (public, cohort-based)
```

## 1.3 — Validation Engine Principles

Six principles govern every operation of the validation engine:

1. **Consent-first.** No institution's data enters the validation engine without explicit, scoped consent. Default participation is opt-in, not opt-out.
2. **Anonymization by architecture.** Anonymization is structural, not procedural. Identifying data is stripped at ingestion; re-identification is not a recoverable operation.
3. **Sovereignty preservation.** Participation in the validation engine does not change the institution's ownership of its own data. Withdrawal is unconditional and triggers cohort recalculation.
4. **Methodological transparency.** Scoring methodologies, sampling decisions, and analytical choices are publicly documented. The validation engine is itself reviewable.
5. **Institutional integrity.** No institution may be identified in published materials without explicit case-study consent. Cohort sizes are governed by k-anonymity floors.
6. **Doctrinal alignment.** Every output of the validation engine must withstand review against the canonical doctrine. Findings that contradict doctrine trigger doctrine review — not data suppression.

---

# 2. Pilot Validation Framework

## 2.1 — Pilot Lifecycle

The pilot lifecycle has six structured phases. Each phase has explicit entry criteria, governance review, and exit conditions.

### Phase 1 — Pre-Pilot Diagnostic
**Purpose:** Establish institutional baseline before any platform deployment.
**Activities:** OCI Continuity Risk Assessment (OCRA); steward and coordinator interviews; documentation review.
**Outputs:** Baseline continuity score; governance fragility findings; identified risk concentrations; pilot scope recommendation.
**Exit criteria:** Documented baseline, scoped pilot agreement, governance review completed.

### Phase 2 — Pilot Scoping & Governance Approval
**Purpose:** Define pilot scope, governance structure, success criteria, and consent architecture.
**Activities:** Scope definition (function, department, committee, federation working group); governance review by institutional leadership; consent framework; success criteria formalization.
**Outputs:** Pilot charter; documented success criteria; consent agreements; governance sign-off.
**Exit criteria:** Signed pilot charter; member or stakeholder notification (where applicable); consent agreements in place.

### Phase 3 — Deployment & Calibration
**Purpose:** Deploy platform within pilot scope and calibrate against institutional reality.
**Activities:** Technical deployment; role-scoped access configuration; governance instrument visibility setup; initial training for stewards and coordinators.
**Outputs:** Functioning deployment; configured governance; trained operators; calibration report.
**Exit criteria:** Functional deployment; visible governance instruments; operators trained; consent confirmations complete.

### Phase 4 — Active Pilot Operation
**Purpose:** Operate the platform within pilot scope under measurement.
**Duration:** Typically 90–180 days, depending on institutional cadence (e.g., a governance committee that meets monthly requires more elapsed time than a daily operational function).
**Activities:** Operational use; continuous evidence capture; governance event documentation; periodic check-in reviews.
**Outputs:** Operational record; governance evidence; continuity event documentation; ongoing metric capture.
**Exit criteria:** Defined operational duration completed; baseline-to-current measurement available.

### Phase 5 — Mid-Pilot Review
**Purpose:** Assess pilot trajectory against success criteria; adjust if necessary.
**Activities:** Re-measurement against baseline; stakeholder interviews; governance review; identification of adjustments needed.
**Outputs:** Mid-pilot findings; trajectory assessment; adjustment recommendations (if any).
**Exit criteria:** Documented review; decision to continue, adjust, or restructure.

### Phase 6 — Pilot Closure & Validation
**Purpose:** Formally close the pilot, generate validation findings, and decide on full deployment.
**Activities:** Final re-measurement; OCRA re-administration; institutional outcomes assessment; case study extraction (with consent); decision review.
**Outputs:** Pilot closure report; validated outcome data; case study material (if consented); deployment recommendation.
**Exit criteria:** Closure report delivered to institution; institution makes documented decision on full deployment; validation engine receives anonymized cohort data (if consented).

## 2.2 — Pilot Success Criteria

Success criteria are agreed in Phase 2 and measured in Phase 6. They are organized across five categories.

### A. Governance Metrics
Measurement of governance posture improvement.

| Metric | Definition | Measurement Method |
|--------|-----------|-------------------|
| Decision rationale preservation rate | % of governance decisions captured with documented rationale | Review of decision records |
| Decision lineage traceability | % of decisions whose lineage can be reconstructed end-to-end | Sample audit of decision records |
| Governance instrument visibility | % of governance instruments visible to governed parties | Configuration audit |
| Approval lineage completeness | % of approvals with complete chain documentation | Sample audit |
| Governance event response time | Median time from event to documented response | Operational log analysis |

### B. Continuity Metrics
Measurement of continuity exposure reduction.

| Metric | Definition | Measurement Method |
|--------|-----------|-------------------|
| Operational dependency concentration | % of operational functions dependent on a single individual | Functional mapping |
| Transition readiness score | Composite measure of how prepared the institution is for senior transition | Re-administration of OCRA Transition Readiness section |
| Onboarding time to operational independence | Median days from new operator start to functional independence | Operational log analysis |
| Continuity exposure index | Composite continuity risk score | OCRA re-administration |
| Knowledge transfer completeness | % of role-critical knowledge documented as institutional asset | Sample audit |

### C. Operational Improvement Metrics
Measurement of operational outcome quality.

| Metric | Definition | Measurement Method |
|--------|-----------|-------------------|
| Operational record completeness | % of operationally material activity captured in institutional records | Sample audit |
| Audit-readiness posture | Time required to produce audit response from request | Stakeholder interviews; sample exercise |
| Repeated-mistake rate | Frequency of decisions reversed due to lost rationale | Operational record review |
| Coordination efficiency (federation contexts) | Time to coordinate across constituent entities | Operational log analysis |

### D. Adoption Indicators
Measurement of operator uptake and platform integration.

| Indicator | Definition | Measurement Method |
|-----------|-----------|-------------------|
| Active operator percentage | % of in-scope operators actively using the platform | Operational log analysis |
| Operator-reported usability | Qualitative assessment from operator interviews | Structured interviews |
| Workflow integration depth | Extent to which platform is integrated into routine operations | Operational observation |
| Voluntary expansion requests | Number of institutional requests to expand pilot scope | Documented requests |

### E. Institutional Trust Indicators
Measurement of trust posture within and around the institution.

| Indicator | Definition | Measurement Method |
|-----------|-----------|-------------------|
| Member confidence (where applicable) | Member perception of governance quality | Structured surveys (consented) |
| Steward confidence | Operator confidence in institutional continuity posture | Structured interviews |
| External stakeholder confidence | Regulator, board, or partner confidence in audit posture | Stakeholder interviews |
| Visible governance acknowledgment | Evidence that governed parties acknowledge governance visibility | Structured assessment |
| Anti-surveillance compliance | Confirmation that no doctrinal red lines have been crossed | Configuration and operational review |

## 2.3 — Pilot Charter Template

Every pilot is anchored by a written charter signed by institutional leadership and Nzila. The charter contains:

1. Institutional context and scope.
2. Pilot scope (function, department, committee, or federation working group).
3. Governance structure and decision authority during pilot.
4. Baseline measurements (from Phase 1 OCRA).
5. Success criteria across the five categories above, with specific thresholds.
6. Consent architecture and notification scope.
7. Duration and milestone schedule.
8. Sovereignty and data ownership terms (institution retains full ownership).
9. Anti-Surveillance Doctrine reference (binding).
10. Closure conditions and case study consent.

---

# 3. Evidence Capture Architecture

## 3.1 — What Gets Captured

Evidence capture is scoped to institutional posture, never individual behavior. The following data categories are captured (subject to consent):

### Institutional Posture Data
- Governance instrument configurations (anonymized at institutional level).
- Decision capture patterns (aggregate, no decision content).
- Operational record completeness rates.
- Governance event documentation rates.
- Federation coordination patterns (where applicable).

### Continuity Indicators
- Continuity exposure scores (from OCRA administrations).
- Transition readiness scores.
- Onboarding time medians.
- Operational dependency concentrations (aggregate).
- Knowledge transfer completeness rates.

### Operational Outcome Data
- Audit-readiness posture changes.
- Coordination efficiency changes.
- Repeated-mistake rate changes.
- Governance event response time changes.

### Adoption Metadata
- Active operator percentages (aggregate, never individual).
- Operator role distributions.
- Workflow integration depth.

### Trust Indicators
- Survey results (where consented, fully anonymized).
- Stakeholder confidence indicators.
- Anti-surveillance compliance confirmations.

## 3.2 — What Is NOT Captured

The Anti-Surveillance Doctrine governs this list. The validation engine does not capture:

- Individual operator behavior, productivity, or activity patterns.
- Decision content (rationale text, deliberation content).
- Personal identifiers of any operator, member, steward, or coordinator.
- Communication content of any kind.
- Time-on-task, location, or attention data of any individual.
- Member personal data of any kind.
- Patient data, in healthcare deployments.
- Any data that could enable re-identification of individuals.

These exclusions are architectural. The data is not collected, not stored, not transmitted to the validation engine. There is no configuration option that enables capture of these categories.

## 3.3 — Anonymization Architecture

Anonymization operates at three layers:

### Layer 1 — Ingestion Filtering
At the boundary between operational platform and validation engine, an ingestion filter removes identifying data structurally. The filter is deny-by-default: only explicitly permitted categories pass. Permitted categories are versioned and audited.

### Layer 2 — Institutional De-identification
Institutional identifiers (organization name, identifiable structural details, distinctive operational characteristics) are removed or generalized. Sector, size band, and federation status are preserved as cohort characteristics; specific identity is not.

### Layer 3 — k-Anonymity Enforcement
Cohort-level reporting is governed by minimum cohort size requirements:

- **Public benchmark reporting:** k ≥ 25 institutions per reported cohort.
- **Sector cohort findings:** k ≥ 15 institutions per sector cohort.
- **Cross-sector comparisons:** k ≥ 10 institutions per cohort cell.

Cohorts below the k threshold are either aggregated upward or suppressed from publication. Suppression is preferred over false aggregation.

## 3.4 — Benchmark Structure

The validation engine maintains the following benchmark structures:

### Sector Cohorts
- Labor organizations.
- Healthcare institutions.
- Public-sector bodies.
- Federated associations and multi-entity nonprofits.
- Governance-heavy enterprises in regulated environments.

### Size Bands
- Small (under 250 operationally relevant persons).
- Mid (250–2,500).
- Large (2,500–25,000).
- Enterprise (25,000+).

### Maturity Bands
(From OCRA framework — `programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md`)
- Band 1: Personality Dependent (0–20).
- Band 2: Operationally Aware (21–40).
- Band 3: Structurally Documented (41–60).
- Band 4: Institutionally Resilient (61–80).
- Band 5: Continuity Intelligence (81–100).

### Composite Benchmarks
Cross-tabulations of sector × size × maturity produce the cohort cells used for ICI publication. Each cell must meet k-anonymity floors before publication.

## 3.5 — Longitudinal Tracking

The validation engine maintains longitudinal series across:

- ICI scores by sector cohort over time.
- Governance Fragility Score (GFS) distributions over time.
- Operational Memory Score (OMS) distributions over time.
- Trust Debt Score (TDS) distributions over time.
- Maturity band migration rates (institutions moving from one band to another).
- Sector cohort baseline drift over time.

Longitudinal findings are published annually in the Institutional Continuity Report (Section 6).

---

# 4. The Institutional Continuity Index (ICI)

## 4.1 — Index Purpose

The Institutional Continuity Index is the canonical public benchmark for institutional continuity posture across sectors and institutional sizes. It establishes:

- **Empirical baseline.** What the actual continuity posture of institutions looks like in real operating environments.
- **Maturity distribution.** How institutions are distributed across the maturity bands.
- **Cross-sector comparisons.** How continuity posture varies across sectors and contexts.
- **Longitudinal trend.** How institutional continuity posture changes over time at the sector and category level.
- **Category authority.** The ICI is the published authority for "institutional continuity infrastructure" as a recognized category.

## 4.2 — Scoring Methodology

ICI scoring is derived from the OCRA scoring model (`programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md`) with one adaptation: ICI scores are always cohort-level, never individual institution-level in public reporting.

### Component Scores
The ICI integrates four component scores:

1. **Governance Fragility Score (GFS)** — 0–100; higher is more fragile.
2. **Operational Memory Score (OMS)** — 0–100; higher is more institutional memory preserved.
3. **Trust Debt Score (TDS)** — 0–100; higher is more trust debt.
4. **Continuity Exposure Score (CES)** — 0–100; higher is more exposure.

### Composite Calculation
The ICI composite score is calculated as:

```
ICI = 0.30 × (100 - GFS)
    + 0.30 × OMS
    + 0.20 × (100 - TDS)
    + 0.20 × (100 - CES)
```

Higher ICI = stronger institutional continuity posture.

### Cohort Reporting
ICI is reported at the cohort level only:

- Cohort median.
- Cohort interquartile range.
- Cohort distribution across maturity bands.
- Cohort movement vs. prior period.

## 4.3 — Benchmark Categories

The ICI publishes benchmarks across the following cohort dimensions:

### Primary Cohorts
- Sector (labor / healthcare / public sector / federated associations / governance-heavy enterprises).
- Size band (small / mid / large / enterprise).
- Sector × Size composite cells (where k ≥ 10).

### Secondary Cohorts
- By federation status (federated / single-entity).
- By regulatory intensity (high / mid / low).
- By prior continuity event experience (yes / no).

### Longitudinal Cohorts
- Year-over-year movement at cohort level.
- Maturity band migration rates.
- Sector cohort baseline drift.

## 4.4 — Maturity Bands (ICI-Aligned)

ICI scores map to the canonical Operational Memory Ladder:

| ICI Range | Band | Description |
|-----------|------|-------------|
| 0–20 | Band 1 — Personality Dependent | Operational memory lives in individuals. Transitions expose the institution. |
| 21–40 | Band 2 — Operationally Aware | Continuity risk is recognized; structural response is partial. |
| 41–60 | Band 3 — Structurally Documented | Continuity infrastructure exists for material functions. Documentation is reliable but not universal. |
| 61–80 | Band 4 — Institutionally Resilient | Continuity infrastructure spans the institution. Transitions are absorbed without operational loss. |
| 81–100 | Band 5 — Continuity Intelligence | Continuity infrastructure is structural. Operational memory is an institutional asset. Governance is continuously audit-ready. |

## 4.5 — Annual Index Publication

The Institutional Continuity Index is published annually as the **Institutional Continuity Report** (Section 6 below). Mid-year updates may be published for material methodological changes or significant cohort threshold events.

## 4.6 — ICI Governance

The ICI methodology is governed under Constitutional change class. Methodology changes require:

1. Founder sign-off.
2. Documented review of methodology against the canonical doctrine.
3. Public methodology change notation.
4. Notification to participating institutions.
5. Recalculation of prior periods under the new methodology where comparability is affected (with both old and new methodology results published for the transition period).

---

# 5. Case Study Architecture

## 5.1 — Case Study Purpose

Case studies are the institutional proof layer. They translate cohort-level findings into specific institutional narratives that buyers, regulators, members, and analysts can recognize and reference.

Case studies are produced under explicit institutional consent. No case study is published without:

1. Signed case study consent from institutional leadership.
2. Member or stakeholder notification (where applicable).
3. Institutional review of draft case study material.
4. Documented approval of final case study text.
5. Adherence to anonymization where requested by the institution.

## 5.2 — Standardized Case Study Framework

Every Nzila case study follows the same eight-section structure:

### Section 1 — Institutional Context
- Sector and institutional type.
- Size and structural characteristics.
- Operational environment and constraints.
- Continuity-critical functions.

### Section 2 — Pre-Pilot State
- Continuity posture (ICI baseline).
- Governance fragility findings (GFS baseline).
- Operational memory state (OMS baseline).
- Trust debt indicators (TDS baseline).
- Specific institutional risks identified.

### Section 3 — Pilot Scope and Charter
- Pilot scope (function, department, committee, federation working group).
- Governance structure during pilot.
- Success criteria as agreed in pilot charter.
- Duration and milestones.
- Consent architecture summary.

### Section 4 — Deployment and Calibration
- Technical deployment approach.
- Governance instrument configuration.
- Operator training and onboarding.
- Calibration findings.

### Section 5 — Pilot Operation
- Operational use patterns.
- Governance events captured.
- Continuity events handled (e.g., a transition that occurred during pilot).
- Adoption trajectory.

### Section 6 — Outcomes (Before / After)

#### Governance Maturity Evolution
- Decision rationale preservation rate: baseline → final.
- Decision lineage traceability: baseline → final.
- Governance instrument visibility: baseline → final.
- Approval lineage completeness: baseline → final.

#### Continuity Improvements
- Operational dependency concentration: baseline → final.
- Transition readiness score: baseline → final.
- Onboarding time to operational independence: baseline → final.
- Continuity exposure index: baseline → final.

#### Operational Stabilization Indicators
- Operational record completeness: baseline → final.
- Audit-readiness posture: baseline → final.
- Repeated-mistake rate: baseline → final.
- Coordination efficiency (where applicable): baseline → final.

#### Trust Improvement Metrics
- Member confidence (where measured).
- Steward and coordinator confidence.
- External stakeholder confidence.
- Visible governance acknowledgment.

### Section 7 — Institutional Reflection
- Institutional leadership reflection on the pilot (in their voice, with permission).
- Lessons learned, as named by the institution.
- Decisions taken on full deployment.
- Conditions under which the institution would recommend the approach to peers.

### Section 8 — Doctrinal Notes
- Specific doctrinal commitments tested during the pilot.
- Anti-Surveillance Doctrine compliance review.
- Sovereignty preservation confirmation.
- Any doctrinal questions raised during the pilot, and how they were addressed.

## 5.3 — Case Study Consent Architecture

Case study consent operates at three levels:

### Level 1 — Anonymous Cohort Reference
Aggregate cohort data with no institutional identification.
- Default consent included in pilot charter.
- Used in ICI, sector reports, and methodological publications.

### Level 2 — Anonymized Case Study
Detailed case study with institutional context (sector, size band, structural characteristics) but no identifying information.
- Requires explicit consent at pilot closure.
- Reviewed and approved by institutional leadership.
- Published with sector and structural detail only.

### Level 3 — Named Case Study
Full case study with institutional identification.
- Requires explicit consent at pilot closure.
- Requires member or stakeholder notification (where applicable).
- Reviewed and approved by institutional leadership, including direct quotes.
- Institution may revoke consent at any time, triggering removal.

## 5.4 — Case Study Editorial Standards

- **No marketing voice.** Case studies are written in operational, institutional voice. They are not testimonials.
- **Verifiable claims only.** Every outcome figure is anchored to measured baseline-to-final data. Aspirational language is excluded.
- **Institutional reflection in institutional voice.** Where leadership reflection is included, it is reproduced as the leadership expressed it, not as marketing rewrote it.
- **Doctrinal anchors visible.** Every case study explicitly references the doctrinal commitments that governed the pilot.
- **Anti-surveillance review.** Every case study is reviewed for compliance with the Anti-Surveillance Doctrine before publication.

---

# 6. Annual Report Structure

The annual **Institutional Continuity Report** is the canonical public publication of the validation engine.

## 6.1 — Report Sections

### Section 1 — Doctrinal Position and Methodological Statement
- Restatement of category position.
- Methodology summary.
- Methodology changes from prior year (if any).
- Anti-Surveillance Doctrine confirmation.
- Cohort size disclosure and k-anonymity compliance.

### Section 2 — Cohort Composition
- Participating institutions by sector.
- Participating institutions by size band.
- Participating institutions by maturity band (at start of reporting period).
- Aggregate cohort characteristics.
- Cohort growth from prior year.

### Section 3 — Institutional Continuity Index (Sector View)
- ICI distribution by sector cohort.
- Sector medians and interquartile ranges.
- Sector maturity band distributions.
- Sector year-over-year movement.

### Section 4 — Institutional Continuity Index (Size View)
- ICI distribution by size band.
- Size band medians and interquartile ranges.
- Size band maturity distributions.
- Size band year-over-year movement.

### Section 5 — Component Score Analysis
- Governance Fragility Score distribution and trend.
- Operational Memory Score distribution and trend.
- Trust Debt Score distribution and trend.
- Continuity Exposure Score distribution and trend.

### Section 6 — Cross-Sector Comparisons
- Sector-by-sector ICI comparison.
- Sector-by-sector component score comparisons.
- Identified patterns across sectors.

### Section 7 — Longitudinal Findings
- Multi-year ICI trend at cohort level.
- Maturity band migration rates over time.
- Sector cohort baseline drift.
- Notable institutional movement patterns.

### Section 8 — Case Study Compendium
- Selected case studies (Level 2 and Level 3, as consented).
- Distribution across sectors and maturity bands.

### Section 9 — Doctrinal Reflection
- Doctrinal questions raised during the reporting period.
- Doctrinal refinements made (if any).
- Anti-Surveillance Doctrine enforcement summary.
- Open questions for the next reporting period.

### Section 10 — Methodological Appendix
- Full OCRA methodology.
- ICI calculation methodology.
- Anonymization methodology.
- k-anonymity floors and enforcement.
- Cohort definition and management.
- Limitations and caveats.

## 6.2 — Report Editorial Standards

- **Procurement-grade.** The report is referenceable in procurement, governance review, and regulatory contexts.
- **Methodologically transparent.** Every published number is traceable to documented methodology.
- **Anti-hype.** No marketing rhetoric. No predictive overreach. No category puffery.
- **Institutional voice.** The report is written as institutional infrastructure documentation, not as content marketing.

---

# 7. Governance Constraints on the Validation Engine

## 7.1 — Sovereignty

Institutional sovereignty is not compromised by participation in the validation engine.

- Institutions retain full ownership of all operational data.
- Participation is opt-in at all levels.
- Withdrawal is unconditional and triggers cohort recalculation.
- No data shared with the validation engine is used for any purpose other than documented validation, benchmarking, and anonymized publication.

## 7.2 — Anti-Surveillance

The Anti-Surveillance Doctrine governs all validation engine operations.

- The validation engine does not capture individual behavioral data.
- The validation engine does not enable institutional surveillance of members or staff.
- Case studies do not identify individuals.
- All consent is informed and revocable.

## 7.3 — Methodological Transparency

The validation engine is itself subject to scrutiny.

- Methodologies are publicly documented.
- Cohort definitions and k-anonymity floors are published.
- Changes to methodology are publicly noted.
- Limitations and caveats are disclosed in every publication.

## 7.4 — Doctrinal Integrity

Validation findings that contradict the doctrine trigger doctrine review — not data suppression.

If empirical findings from the validation engine suggest that a doctrinal commitment is operationally incorrect, the response is:

1. Document the finding and the apparent contradiction.
2. Initiate doctrine review under the change protocol.
3. Either refine the doctrine with founder sign-off, or document why the empirical finding does not require doctrinal change.
4. Publish the resolution.

This is the operational expression of the Humility Doctrine (Part III of `constitution.md`): the doctrine is binding, but it is not infallible.

## 7.5 — Anti-Capture

The validation engine resists capture by any single institution, sector, or commercial interest.

- No single institution may dominate cohort composition.
- Cohort balance is maintained as a structural priority.
- Validation engine outputs are not adjusted to favor any institution's commercial preferences.
- Methodology is not relaxed under commercial pressure.

---

## Doctrine Anchors

- **Master Doctrine** — `docs/doctrine/DOCTRINE.md`
- **Constitution** — `docs/doctrine/constitution.md` (Part III — Humility Doctrine, esp. anti-capture and methodological discipline)
- **Scoring Models** — `docs/doctrine/SCORING_MODELS.md` (ICI, GFS, OMS, TDS canonical methodology)
- **Risk Assessment** — `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md` (the diagnostic instrument feeding the validation engine)
- **Anti-Surveillance Doctrine** — `docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md` (constraints on all evidence capture)
- **Frameworks** — `docs/doctrine/frameworks.md` (Continuity Stack, Fragility Curve, Memory Ladder, Trust Debt Model)
- **Governance** — `docs/doctrine/DOCTRINE_GOVERNANCE.md` (change protocol for ICI methodology)
- **Stress Test** — `docs/doctrine/DOCTRINE_STRESS_TEST.md` (anticipated critiques of benchmark authority)
