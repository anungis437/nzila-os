# Corporate Knowledge Map

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** AUTHORITATIVE INSTITUTIONAL REFERENCE

This map describes the entire Nzila Ventures Inc. commercialization corpus. Every section identifies purpose, primary audience, owner, current maturity, dependencies, and related documents. It is designed so that any new employee, investor, auditor, lender, advisor, lawyer, accountant, or future AI agent can orient to the repository without relying on founder memory.

---

## 1. Business Plan and Evidence Book

### 1.1 Nzila Evidence and Commercial Readiness Dossier

**Purpose:** Master assembled lender, government-program, and investor diligence document. Converts business assertions into repository-traceable evidence across 16 sections.  
**Location:** `docs/business-plan/evidence-book/Nzila-Evidence-and-Commercial-Readiness-Dossier.md`  
**Primary audience:** BDC loan committee; government program reviewers; strategic partners; institutional diligence contacts.  
**Owner:** Aubert Nungisa  
**Current maturity:** Draft — lender-facing after remediation of all six Critical findings (REM-001 through REM-006)  
**Dependencies:** All 16 individual section files (00–15); verified founder inputs from `BDC-FOUNDER-INPUT-CHECKLIST.md`  
**Related documents:** All `docs/business-plan/evidence-book/NN-*.md` files; `BDC-U9-Remediation-Register.md`; `BDC-U10-Credit-Package-Readiness.md`

### 1.2 Evidence Book Section Files (00–15)

| File | Title | Notes |
|---|---|---|
| `00-Executive-Summary.md` | Executive Summary | Product scorecard; TRL matrix |
| `01-Company.md` | Company | Corporate identity; principals; governance posture |
| `02-Institutional-Intelligence.md` | Institutional Intelligence | OCI doctrine; methodology evidence |
| `03-Products.md` | Products | Union Eyes, CIVIC, CourtLens; FairCase historical lineage |
| `04-Technology.md` | Technology | Shared platform; architecture; CI/CD |
| `05-Commercialization.md` | Commercialization | Pricing; GTM; pilots; maturity boundaries |
| `06-Security.md` | Security | Posture; privacy; AI governance; compliance |
| `07-Operations.md` | Operations | Delivery; release; SRE; DR; FinOps |
| `08-Validation.md` | Validation | Production certification; pilots; external-review readiness |
| `09-IP.md` | Intellectual Property | Software; methodology; documentation; brand |
| `10-Evidence-Register.md` | Evidence Register | Claim-by-claim traceability matrix |
| `11-Gap-Register.md` | Gap Register | Honest gap log and remediation priorities |
| `12-Commercial-Readiness.md` | Commercial Readiness | Scored readiness view |
| `13-Timeline.md` | Timeline | Chronological repository-derived milestone view |
| `14-Founder-Investment.md` | Founder Investment | Founder-funded R&D (estimated — not verified) |
| `15-Commercial-Traction-Pipeline.md` | Commercial Traction Pipeline | Pipeline evidence without overstating traction |

**Primary audience:** All; scope depends on section  
**Owner:** Aubert Nungisa  
**Current maturity:** Lender-facing after remediation  
**Dependencies:** Source evidence paths cited in each section; corporate records

---

## 2. BDC Stress-Test Series

### 2.1 BDC-U1 through BDC-U8 (Internal Stress Tests)

**Purpose:** Adversarial underwriting simulation designed to surface every question a BDC credit committee would raise before the meeting. Eight documents covering repayment, collateral, management, commercial evidence, legal, governance, and evidence.  
**Location:** `docs/business-plan/evidence-book/BDC-U1-*.md` through `BDC-U8-*.md`  
**Primary audience:** Founders; legal counsel; accountants; future agents resuming this workstream  
**Owner:** Aubert Nungisa  
**Current maturity:** Complete and frozen — internal documents only  
**Dependencies:** Evidence-book section files; `BDC-U9-Remediation-Register.md`  
**Distribution restriction:** Must not be sent to BDC under any circumstances  
**Related documents:** `BDC-U9-Remediation-Register.md`; `BDC-U10-Credit-Package-Readiness.md`

### 2.2 BDC-U9 Remediation Register

**Purpose:** Consolidated register of all 25 findings from BDC-U1 through BDC-U8. Each finding includes severity, source stress-test reference, affected lender-facing document, required source evidence, responsible owner, and closure evidence requirements.  
**Location:** `docs/business-plan/evidence-book/BDC-U9-Remediation-Register.md`  
**Primary audience:** Founders; accountant; legal counsel; future agents  
**Owner:** Aubert Nungisa  
**Current maturity:** Complete and frozen — 25 findings, 0 closed  
**Distribution restriction:** Must not be sent to BDC  
**Related documents:** `BDC-U10-Credit-Package-Readiness.md`; `BDC-FOUNDER-INPUT-CHECKLIST.md`

### 2.3 BDC-U10 Credit Package Readiness Assessment

**Purpose:** Current readiness verdict (NOT READY); quantified path to CONDITIONALLY READY and READY FOR BDC REVIEW; information required from founders; accounting and legal documents required.  
**Location:** `docs/business-plan/evidence-book/BDC-U10-Credit-Package-Readiness.md`  
**Primary audience:** Founders; legal counsel; accountants; future agents  
**Owner:** Aubert Nungisa  
**Current maturity:** Complete and frozen — verdict: NOT READY  
**Distribution restriction:** Must not be sent to BDC  
**Related documents:** `BDC-U9-Remediation-Register.md`; `BDC-WORKSTREAM-HANDOFF.md`

---

## 3. Founder and Financing Documents

### 3.1 BDC Workstream Handoff

**Purpose:** Session-level orientation document. Records branch, commit SHA, documents produced, reading order, per-founder input lists, and next-session restart instructions.  
**Location:** `docs/business-plan/BDC-WORKSTREAM-HANDOFF.md`  
**Primary audience:** Future agents; internal team  
**Owner:** Aubert Nungisa  
**Current maturity:** Final — frozen  
**Dependencies:** All `docs/business-plan/` documents  
**Distribution restriction:** Internal only — must not be sent to BDC

### 3.2 BDC Founder Input Checklist

**Purpose:** 15-section intake checklist for every input that must be obtained from founders, accountant, and legal counsel before remediation can proceed. No values are prefilled.  
**Location:** `docs/business-plan/BDC-FOUNDER-INPUT-CHECKLIST.md`  
**Primary audience:** Aubert Nungisa; Michel Nungisa; accountant; legal counsel  
**Owner:** Aubert Nungisa  
**Current maturity:** Final — active pending founder inputs  
**Dependencies:** `BDC-U9-Remediation-Register.md` (all cross-referenced remediation IDs)  
**Distribution restriction:** Internal only — must not be sent to BDC

### 3.3 Founder Succession Plan

**Purpose:** Documents corporate continuity in the event of Aubert's incapacitation.  
**Location:** `governance/corporate/governance/policy-founder-succession-continuity-plan.md`  
**Primary audience:** BDC (required for submission); legal counsel  
**Owner:** Aubert Nungisa  
**Current maturity:** Draft — incomplete per REM-005. Must be completed, signed, and effective before BDC submission.  
**Related documents:** REM-005; `BDC-FOUNDER-INPUT-CHECKLIST.md` Section 15

### 3.4 Shareholder and Corporate Structure Summary

**Purpose:** Documents Nzila Ventures Inc.'s legal entity, corporate structure, shareholders, and IP assignment framework.  
**Location:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`  
**Primary audience:** BDC; legal counsel; accountants  
**Owner:** Aubert Nungisa; legal counsel  
**Current maturity:** Documented — requires reconciliation to confirm Michel's complete profile (REM-006) and OptivaCare scope (REM-019)  
**Related documents:** REM-006; REM-015; REM-019

---

## 4. Financial Documents

### 4.1 Government Funding Strategy

**Purpose:** Documents SR&ED claims, IRAP positioning, and government-program strategy.  
**Location:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`  
**Primary audience:** Internal; SR&ED advisors  
**Owner:** Aubert Nungisa  
**Current maturity:** Internal working document — contains SR&ED portfolio inconsistencies documented in REM-020 and REM-021. Must be reconciled before any lender-facing use.  
**Distribution restriction:** Not for BDC distribution in current form  
**Related documents:** REM-020; REM-021

### 4.2 Revenue Scenarios

**Purpose:** Conservative, Base, and Upside scenario framework for investor and lender use.  
**Location:** `docs/categories/stakeholders/investor/revenue-scenarios.md`  
**Primary audience:** Investors; BDC (after population)  
**Owner:** Aubert Nungisa  
**Current maturity:** Framework exists — numerical projections absent (REM-003, Critical — open). Must be populated with actual projections before any lender-facing use.  
**Related documents:** REM-001; REM-003

### 4.3 Detailed Financial Strategy

**Purpose:** Internal financial planning framework.  
**Location:** `governance/corporate/finance/detailed-financial-strategy.md`  
**Primary audience:** Internal; investors  
**Owner:** Aubert Nungisa  
**Current maturity:** Internal — not validated against accounting records

### 4.4 SR&ED Documentation (2026)

**Purpose:** SR&ED claim support package for 2026 filing.  
**Location:** `docs/sred/2026/`  
**Primary audience:** SR&ED advisors; CRA  
**Owner:** Aubert Nungisa; SR&ED advisor  
**Current maturity:** Internal working documents — claim amounts and advisor confirmation required (REM-021)  
**Related documents:** `BDC-FOUNDER-INPUT-CHECKLIST.md` Section 13.2

---

## 5. Commercial Assets

### 5.1 Pricing Framework

**Purpose:** Official pricing tiers and structure for Union Eyes (and CIVIC/CourtLens when applicable).  
**Location:** `docs/categories/stakeholders/commercial/pricing-framework.md`  
**Primary audience:** Sales; commercial partners; buyers  
**Owner:** Aubert Nungisa; Michel Nungisa  
**Current maturity:** Published draft — SOC 2 language requires correction (REM-010) before any lender-facing or customer-facing use  
**Related documents:** REM-010; `BDC-U4-Commercial-Evidence-Audit.md`

### 5.2 Founder Revenue Cockpit

**Purpose:** Deal tracking and commercial activity management system.  
**Location:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`  
**Primary audience:** Founders; commercial execution team  
**Owner:** Aubert Nungisa; Michel Nungisa  
**Current maturity:** System architecture complete — deal table contains seeded (developer-inserted illustrative) data only (REM-004). Must not be used for lender-facing claims in its current form.  
**Distribution restriction:** Must not be shared with BDC in current form  
**Related documents:** REM-004; REM-009

### 5.3 Sales Kit (01–08)

**Purpose:** Complete sales enablement package: one-pager, demo script, discovery checklist, objection handling, ROI calculator, pilot proposal template, follow-up emails, and procurement response pack.  
**Location:** `docs/categories/stakeholders/commercial/sales-kit/`  
**Primary audience:** Sales team (Aubert; Michel)  
**Owner:** Michel Nungisa (commercial execution); Aubert Nungisa  
**Current maturity:** Complete — ready for use in sales conversations  
**Related documents:** `docs/categories/stakeholders/commercial/pricing-framework.md`

### 5.4 Top 15 Pursuit List

**Purpose:** Identifies the 15 highest-priority prospect organizations for Union Eyes.  
**Location:** `docs/categories/stakeholders/commercial/TOP_15_PURSUIT_LIST.md`  
**Primary audience:** Founders; commercial team  
**Owner:** Michel Nungisa; Aubert Nungisa  
**Current maturity:** Documented — no logged outreach activity as of the last verified scan  
**Related documents:** REM-007; `BDC-FOUNDER-INPUT-CHECKLIST.md` Section 10

### 5.5 CUPE Pilot Offer

**Purpose:** Specific pilot offer document for CUPE and similar local union organizations.  
**Location:** `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`  
**Primary audience:** CUPE local representatives; commercial team  
**Owner:** Aubert Nungisa; Michel Nungisa  
**Current maturity:** Ready for use — no confirmed acceptance on record  
**Related documents:** REM-007

### 5.6 First 50 Targets (Canada)

**Purpose:** Expanded prospect list for Union Eyes commercial outreach in Canada.  
**Location:** `docs/categories/stakeholders/commercial/FIRST_50_TARGETS_CANADA.md`  
**Primary audience:** Commercial team  
**Owner:** Michel Nungisa  
**Current maturity:** Documented — no logged outreach activity

### 5.7 Close Package

**Purpose:** Complete enterprise close sequence including buyer deck, ROI calculator, procurement checklist, case study template, and trust visual pack.  
**Location:** `docs/categories/stakeholders/commercial/close-package/`  
**Primary audience:** Enterprise buyers; procurement contacts  
**Owner:** Michel Nungisa; Aubert Nungisa  
**Current maturity:** Ready for use — deployed in commercial engagements  
**Related documents:** `docs/categories/stakeholders/commercial/pricing-framework.md`

---

## 6. Sales Assets

### 6.1 Union Eyes Buyer Pack

**Purpose:** Complete buyer-facing commercial package for Union Eyes.  
**Location:** `docs/categories/stakeholders/buyers/union-eyes-buyer-pack.md`  
**Primary audience:** Union buyers; procurement contacts  
**Owner:** Michel Nungisa; Aubert Nungisa  
**Current maturity:** Complete  
**Dependencies:** Pricing framework; trust center

### 6.2 45-Minute Demo Script

**Purpose:** Structured script for a 45-minute live Union Eyes demonstration.  
**Location:** `docs/categories/stakeholders/commercial/sales-kit/02-45-minute-demo-script.md`  
**Primary audience:** Sales team  
**Owner:** Aubert Nungisa  
**Current maturity:** Complete  

### 6.3 Objection Handling Sheet

**Purpose:** Pre-prepared responses to common buyer objections.  
**Location:** `docs/categories/stakeholders/commercial/sales-kit/04-objection-handling-sheet.md`  
**Primary audience:** Sales team  
**Owner:** Michel Nungisa; Aubert Nungisa  
**Current maturity:** Complete

### 6.4 Outreach Templates

**Purpose:** Outbound first-touch email templates and meeting-booking scripts.  
**Location:** `docs/categories/stakeholders/commercial/outreach/`  
**Primary audience:** Sales team  
**Owner:** Michel Nungisa  
**Current maturity:** Complete — awaiting deployment

---

## 7. Pricing

### 7.1 Union Eyes Pricing Framework (Canonical)

**Purpose:** Defines Local, Regional, and National pricing tiers with feature inclusions.  
**Location:** `docs/categories/stakeholders/commercial/pricing-framework.md`  
**Primary audience:** Buyers; sales team; BDC (after SOC 2 language correction)  
**Owner:** Aubert Nungisa  
**Current maturity:** Published draft — one known correction required (REM-010: SOC 2 language)  
**Notes:** CIVIC and CourtLens have no published pricing tiers (CIVIC: market-development stage; CourtLens: planned)

---

## 8. Governance

### 8.1 Mission, Vision, Values

**Location:** `governance/corporate/governance/nzila-mission-vision-values.md`  
**Primary audience:** All stakeholders  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented

### 8.2 Operating Principles

**Location:** `governance/corporate/governance/nzila-ventures-operating-principles.md`  
**Primary audience:** Internal team; investors  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented

### 8.3 Portfolio Truth System and Claims Discipline

**Purpose:** Prevents estimated revenue or speculative claims from appearing in commercial output.  
**Location:** Referenced in evidence-book and closure documents; implemented in `docs/categories/stakeholders/commercial/claims-ledger.md`  
**Primary audience:** Internal team; future agents  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented — actively governing commercial content

### 8.4 Privacy and AI Governance

**Location:** `governance/privacy/`; `governance/corporate/compliance/ethical-ai-charter.md`; `apps/union-eyes/docs/trust-center/AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md`  
**Primary audience:** Buyers; regulators; BDC (due diligence)  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented — privacy policies, AI governance framework, and DPIA templates in place

### 8.5 IP Portfolio Protection

**Location:** `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md`  
**Primary audience:** Legal counsel; investors; BDC  
**Owner:** Aubert Nungisa; legal counsel  
**Current maturity:** Policy documented — IP assignment execution status unconfirmed (REM-015)

---

## 9. Methodologies

### 9.1 Institutional Intelligence Methodology

**Purpose:** Core analytical and engineering methodology underlying all three products. Derived from OCI (Operational Continuity Intelligence) doctrine.  
**Location:** `docs/business-plan/evidence-book/02-Institutional-Intelligence.md`; `docs/CIVIC_OCI_ALIGNMENT.md`  
**Primary audience:** Institutional buyers; government partners; BDC  
**Owner:** Aubert Nungisa  
**Current maturity:** Verified — methodology is documented and implemented across the platform  
**Related documents:** `docs/public-service/civic-thesis.md`; `docs/public-service/civic-one-page-brief.md`

### 9.2 Portfolio Truth System

**Purpose:** Governance methodology preventing promotion of unverified claims to official status.  
**Location:** Referenced in `15-Commercial-Traction-Pipeline.md` and evidence-book  
**Primary audience:** Internal team; future agents  
**Owner:** Aubert Nungisa  
**Current maturity:** Operational

---

## 10. Institutional Intelligence

**Purpose:** The foundational concept and methodology of Nzila's platform — transforming how institutions manage knowledge, continuity, governance, and operational memory.  
**Documents:**
- `docs/business-plan/evidence-book/02-Institutional-Intelligence.md` — full evidence section
- `docs/CIVIC_OCI_ALIGNMENT.md` — CIVIC-specific OCI alignment
- `docs/public-service/civic-thesis.md` — civic sector application
- `docs/sred/2026/01-project-charters/institutional-intelligence-measurement-engine/` — SR&ED charter

**Primary audience:** Institutional buyers; government partners; investors; BDC  
**Owner:** Aubert Nungisa  
**Current maturity:** Verified — methodology is the organizing principle of the entire platform

---

## 11. OCI (Operational Continuity Intelligence)

**Purpose:** The specific doctrine and framework governing how Nzila platforms preserve, transfer, and govern institutional knowledge and operational continuity.  
**Documents:**
- `docs/CIVIC_OCI_ALIGNMENT.md` — formal OCI-CIVIC alignment
- `docs/business-plan/evidence-book/02-Institutional-Intelligence.md` — OCI doctrine evidence  

**Primary audience:** Government and public-sector buyers; institutional partners  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented — methodology formalized, aligned to public-sector procurement frameworks

---

## 12. OCRA

**Purpose:** OCRA (Operational Continuity and Resilience Assessment) is the assessment methodology used by the platform to evaluate an institution's continuity posture.  
**Documents:** Referenced in Union Eyes architecture and procurement documents  
**Primary audience:** Union and institutional buyers  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented — integrated into Union Eyes governance runtime  
**Related documents:** `apps/union-eyes/docs/architecture/GOVERNANCE_RUNTIME_MODEL.md`

---

## 13. CIVIC

**Purpose:** CIVIC is the public-sector implementation of the Institutional Intelligence platform. It targets municipal, provincial, and federal government institutions.  
**Maturity:** Market-development stage — no published pricing, no active paid pipeline  
**Key documents:**
- `docs/public-service/civic-thesis.md` — sector thesis
- `docs/public-service/civic-one-page-brief.md` — executive brief
- `docs/CIVIC_OCI_ALIGNMENT.md` — OCI methodology alignment
- `docs/business-plan/evidence-book/05-Commercialization.md` — CIVIC commercialization section

**Primary audience:** Government procurement officers; public-sector institutional buyers  
**Owner:** Aubert Nungisa  
**Current maturity:** Documented — discovery and pilot-definition phase  
**Boundary:** Must not be described as deployed, procured, or generating validated recurring revenue

---

## 14. CLEAR

**Purpose:** CLEAR is the compliance and labour-equity assurance module within the Union Eyes platform. It focuses on labour standards, reporting obligations, and equity compliance governance.  
**Documents:** Referenced in Union Eyes architecture and workspace documentation  
**Primary audience:** Union labour representatives; compliance officers  
**Owner:** Aubert Nungisa  
**Current maturity:** Integrated into Union Eyes production runtime  
**Related documents:** `apps/union-eyes/docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md`

---

## 15. Union Eyes

**Purpose:** The primary commercial product. A labour-sector implementation of the Institutional Intelligence platform that enables unions to manage governance, case intelligence, member continuity, and institutional knowledge.  
**Maturity:** Production-certified; controlled-pilot GO clearance  
**Key documents:**
- `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md` — production certification
- `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` — pilot scope definition
- `apps/union-eyes/docs/procurement/PILOT_VALIDATION.md` — pilot validation record
- `apps/union-eyes/docs/trust-center/` — buyer trust center
- `docs/categories/stakeholders/buyers/union-eyes-buyer-pack.md` — commercial buyer pack
- `docs/categories/stakeholders/commercial/sales-kit/` — full sales kit

**Primary audience:** Union leadership; procurement officers; BDC (as primary product evidence)  
**Owner:** Aubert Nungisa  
**Current maturity:** Production-certified; commercially ready pending pentest (REM-011) and SOC 2 timeline correction (REM-010)  
**Boundary:** No deployed paying customers on record as of the last verified repository scan

---

## 16. CourtLens

**Purpose:** The legal and access-to-justice sector implementation of the Institutional Intelligence platform. Targets law societies, legal aid clinics, courts, and access-to-justice organizations.  
**Maturity:** Planned — TRL 3. ABR codebase (`apps/abr/`) provides the technical reuse foundation.  
**Key documents:**
- `docs/courtlens/README.md` — product overview
- `docs/courtlens/target-architecture.md` — architecture plan
- `docs/courtlens/pilot-readiness-plan.md` — future pilot plan

**Primary audience:** Legal sector buyers; future investors  
**Owner:** Aubert Nungisa  
**Current maturity:** Planned — not commercially deployed, not production-certified  
**Boundary:** Must not be described as commercially available, deployed, or customer-validated

---

## 17. Whitepapers

**Purpose:** Published long-form thought leadership on Institutional Intelligence, governance, and labour-sector technology.  
**Location:** `apps/union-eyes/app/(marketing)/whitepapers/`; `apps/union-eyes/public/whitepapers/`; `apps/union-eyes/lib/whitepaper/`  
**Primary audience:** Institutional buyers; strategic partners; government contacts  
**Owner:** Aubert Nungisa  
**Current maturity:** In repository — not classified for external release status in current workstream

---

## 18. Playbooks

**Purpose:** Operational and commercial playbooks guiding pilot execution, revenue generation, and enterprise close sequences.  
**Key documents:**
- `docs/categories/stakeholders/commercial/sales-kit/06-pilot-proposal-template.md`
- `docs/categories/stakeholders/buyers/union-eyes-revenue-playbook.md`
- `docs/categories/stakeholders/commercial/close-package/ENTERPRISE_CLOSE_SEQUENCE.md`
- `apps/union-eyes/docs/procurement/CAPE-PILOT-PLAYBOOK.md`

**Primary audience:** Sales team; commercial team  
**Owner:** Michel Nungisa; Aubert Nungisa  
**Current maturity:** Complete

---

## 19. Assessments

**Purpose:** Internal and external readiness assessments used to validate platform and commercial readiness.  
**Key documents:**
- `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md` — Union Eyes production readiness
- `docs/business-plan/evidence-book/12-Commercial-Readiness.md` — scored commercial readiness
- `governance/privacy/readiness-assessment.md` — privacy readiness
- `governance/security/AUDIT_READINESS.md` — security audit readiness
- `apps/console/docs/fortune500-readiness-assessment.md` — enterprise readiness

**Primary audience:** Internal; BDC; enterprise buyers  
**Owner:** Aubert Nungisa  
**Current maturity:** Varies by document — see individual files

---

## 20. Pilot Material

**Purpose:** All materials supporting the controlled pilot program for Union Eyes.  
**Key documents:**
- `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` — pilot scope
- `apps/union-eyes/docs/procurement/PILOT_VALIDATION.md` — validation record
- `apps/union-eyes/docs/procurement/CAPE-PILOT-PLAYBOOK.md` — CAPE pilot playbook
- `apps/union-eyes/docs/procurement/CAPE-DEMO-FLOW.md` — CAPE demo flow
- `docs/categories/stakeholders/buyers/pilot-readiness-checklist.md` — buyer-facing checklist

**Primary audience:** Pilot clients; commercial team  
**Owner:** Aubert Nungisa  
**Current maturity:** Complete — GO clearance for controlled pilot deployment

---

## 21. Evidence Packs

**Purpose:** Structured evidence packages supporting enterprise procurement, security review, and commercial due diligence.  
**Key documents:**
- `docs/categories/stakeholders/commercial/trust-center/` — commercial trust center (10 topics)
- `docs/categories/stakeholders/commercial/vendor-risk-pack/` — vendor risk pack
- `apps/union-eyes/docs/trust-center/` — Union Eyes-specific trust center
- `apps/union-eyes/docs/procurement/GOVERNANCE_SIMULATION_OVERVIEW.md`
- `apps/union-eyes/docs/procurement/FEDERATION_SOVEREIGNTY_OVERVIEW.md`

**Primary audience:** Enterprise procurement; security teams; BDC (due diligence)  
**Owner:** Aubert Nungisa  
**Current maturity:** Complete

---

## 22. Commercial Readiness

**Purpose:** Scored and documented assessment of Nzila's readiness for commercial deployment at each stage.  
**Key documents:**
- `docs/business-plan/evidence-book/12-Commercial-Readiness.md` — authoritative scored readiness
- `docs/business-plan/evidence-book/BDC-U10-Credit-Package-Readiness.md` — BDC credit package readiness verdict

**Primary audience:** Internal; BDC; investors  
**Owner:** Aubert Nungisa  
**Current maturity:** Commercial readiness document: complete. BDC credit readiness: NOT READY (6 Critical findings open).

---

## 23. Roadmaps

**Purpose:** Product and commercialization roadmaps.  
**Key documents:**
- `apps/union-eyes/docs/roadmap/` — Union Eyes roadmap
- `governance/docs/PORTFOLIO_DEEP_DIVE.md` — portfolio deep dive

**Primary audience:** Internal; investors  
**Owner:** Aubert Nungisa  
**Current maturity:** Internal — not for BDC distribution

---

## 24. Validation

**Purpose:** Technical and operational validation records.  
**Key documents:**
- `docs/business-plan/evidence-book/08-Validation.md` — validation evidence section
- `apps/union-eyes/docs/procurement/PILOT_VALIDATION.md` — pilot validation
- `apps/union-eyes/docs/procurement/CAPE-PILOT-AUDIT-REPORT.md` — CAPE pilot audit

**Primary audience:** BDC; institutional buyers; enterprise procurement  
**Owner:** Aubert Nungisa  
**Current maturity:** Internal certifications complete. External validation (pentest, SOC 2) in progress — see REM-011, REM-010.

---

## 25. Intellectual Property

**Purpose:** Documents Nzila's IP portfolio, protection strategy, and assignment framework.  
**Key documents:**
- `docs/business-plan/evidence-book/09-IP.md` — IP evidence section
- `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md` — protection strategy
- `governance/corporate/intellectual-property/document-royalty-licensing-flow-model.md` — licensing model
- `governance/corporate/legal/guide-ip-commercialization-tracker.md` — commercialization tracker

**Primary audience:** BDC (collateral); investors; legal counsel  
**Owner:** Aubert Nungisa; legal counsel  
**Current maturity:** Policy documented. IP assignment execution status unconfirmed (REM-015). Patent filing status unconfirmed (REM-016).

---

## 26. Corporate Governance

**Purpose:** Legal entity structure, shareholder agreements, board governance, and corporate operations.  
**Key documents:**
- `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`
- `governance/corporate/governance/nzila-mission-vision-values.md`
- `governance/corporate/governance/policy-founder-succession-continuity-plan.md`
- `governance/corporate/board/README.md`
- `governance/corporate/governance/document-founder-executive-roles-equity-memo.md`

**Primary audience:** BDC; investors; legal counsel  
**Owner:** Aubert Nungisa; legal counsel  
**Current maturity:** Documented — Michel's corporate profile and succession plan require completion (REM-005, REM-006)

---

## 27. Legal

**Purpose:** Legal compliance, SDK/API licensing, IP commercialization, and risk management frameworks.  
**Key documents:**
- `governance/corporate/legal/legal-compliance-framework.md`
- `governance/corporate/legal/document-sdk-api-licensing-terms-draft.md`
- `governance/corporate/legal/guide-ip-commercialization-tracker.md`
- `governance/corporate/compliance/legal-enterprise-risk-management-erm-framework.md`

**Primary audience:** Legal counsel; investors  
**Owner:** Aubert Nungisa; legal counsel  
**Current maturity:** Framework documented — execution of key agreements pending

---

## 28. Finance

**Purpose:** Financial strategy, capital deployment, SR&ED, government funding, and financial reporting frameworks.  
**Key documents:**
- `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`
- `governance/corporate/finance/detailed-financial-strategy.md`
- `governance/corporate/finance/finance-capital-strategy-resource-allocation.md`
- `docs/sred/2026/` — SR&ED documentation

**Primary audience:** Accountants; investors; BDC; SR&ED advisors  
**Owner:** Aubert Nungisa; accountant  
**Current maturity:** Strategic frameworks documented. Financial statements and accounting records required (see `BDC-FOUNDER-INPUT-CHECKLIST.md` Section 7).

---

*This document is an authoritative institutional reference. It should be updated whenever a new major document is added to the corpus.*
