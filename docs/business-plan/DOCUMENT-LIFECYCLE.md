# Document Lifecycle

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** AUTHORITATIVE — governs all future document management

---

## Part 1 — Lifecycle Stages

Every major document in the Nzila commercialization corpus passes through the following stages. A document may not be used for an audience beyond its current stage without satisfying the requirements for the next stage.

| Stage | Symbol | Meaning |
|---|---|---|
| **Draft** | `[DRAFT]` | Initial content created; not reviewed; not validated |
| **Internal Review** | `[INTERNAL REVIEW]` | Reviewed by at least one internal stakeholder; inconsistencies identified |
| **Leadership Review** | `[LEADERSHIP REVIEW]` | Reviewed and approved by Aubert Nungisa (and Michel Nungisa where applicable) |
| **Evidence Complete** | `[EVIDENCE COMPLETE]` | All claims backed by cited evidence; no unresolved evidence gaps |
| **Commercial Ready** | `[COMMERCIAL READY]` | Approved for use in buyer, partner, or investor conversations |
| **Lender Ready** | `[LENDER READY]` | Approved for submission to BDC or other lenders; all Critical and High findings resolved |
| **Archived** | `[ARCHIVED]` | Superseded by a newer version; retained for institutional memory; not for active use |
| **Superseded** | `[SUPERSEDED]` | Explicitly replaced by a named successor document; must not be used |

---

## Part 2 — Document Catalogue with Current Stage

### Evidence Book Section Files

| Document | Current Stage | Notes |
|---|---|---|
| `00-Executive-Summary.md` | `[EVIDENCE COMPLETE]` | Lender-ready after all 6 Critical findings closed |
| `01-Company.md` | `[EVIDENCE COMPLETE]` | Lender-ready after REM-006 (Michel) and REM-012 (entity naming) closed |
| `02-Institutional-Intelligence.md` | `[EVIDENCE COMPLETE]` | Lender-ready after consistency review against remediated package |
| `03-Products.md` | `[EVIDENCE COMPLETE]` | FairCase boundary clean; lender-ready after remediation |
| `04-Technology.md` | `[EVIDENCE COMPLETE]` | Lender-ready after remediation |
| `05-Commercialization.md` | `[EVIDENCE COMPLETE]` | Lender-ready after seeded pipeline removed (REM-004) |
| `06-Security.md` | `[EVIDENCE COMPLETE]` | Lender-ready after pentest disclosure updated (REM-011) |
| `07-Operations.md` | `[EVIDENCE COMPLETE]` | Lender-ready after remediation |
| `08-Validation.md` | `[EVIDENCE COMPLETE]` | Lender-ready after internal-certification labeling updated (REM-014) |
| `09-IP.md` | `[EVIDENCE COMPLETE]` | Lender-ready after patent status confirmed (REM-016) and IP assignments confirmed (REM-015) |
| `10-Evidence-Register.md` | `[EVIDENCE COMPLETE]` | Lender-ready after remediation |
| `11-Gap-Register.md` | `[EVIDENCE COMPLETE]` | Lender-ready after updated to reflect remediated state |
| `12-Commercial-Readiness.md` | `[EVIDENCE COMPLETE]` | Lender-ready after scores updated to reflect remediated state |
| `13-Timeline.md` | `[EVIDENCE COMPLETE]` | Lender-ready after confirmed use-of-funds timeline incorporated (REM-002) |
| `14-Founder-Investment.md` | `[INTERNAL REVIEW]` | Not lender-ready in current form — estimated figures not verified (REM-008) |
| `15-Commercial-Traction-Pipeline.md` | `[INTERNAL REVIEW]` | Not lender-ready — seeded pipeline data not yet removed (REM-004, REM-007) |
| `APPENDICES.md` | `[EVIDENCE COMPLETE]` | Lender-ready after consistency review |
| `Nzila-Evidence-and-Commercial-Readiness-Dossier.md` | `[INTERNAL REVIEW]` | Lender-ready only after all 6 Critical findings closed |

### BDC Workstream Documents

| Document | Current Stage | Notes |
|---|---|---|
| `BDC-U1-Underwriter-Attack-Review.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen; not for distribution |
| `BDC-U2-Repayment-Story-Audit.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen |
| `BDC-U3-Financial-Consistency-Audit.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen |
| `BDC-U4-Commercial-Evidence-Audit.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen |
| `BDC-U5-Founder-Investment-Ledger.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen |
| `BDC-U6-Management-Credibility-Review.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen |
| `BDC-U7-Executive-Summary-Compressed.md` | `[INTERNAL REVIEW]` | Not valid until financial reconciliation complete |
| `BDC-U8-Decline-Memo-and-Rebuttal.md` | `[EVIDENCE COMPLETE]` | Internal stress-test — lifecycle frozen |
| `BDC-U9-Remediation-Register.md` | `[EVIDENCE COMPLETE]` | Internal working document — lifecycle frozen |
| `BDC-U10-Credit-Package-Readiness.md` | `[EVIDENCE COMPLETE]` | Internal working document — lifecycle frozen |

### Closure and Control Documents

| Document | Current Stage | Notes |
|---|---|---|
| `BDC-WORKSTREAM-HANDOFF.md` | `[EVIDENCE COMPLETE]` | Internal — lifecycle frozen |
| `BDC-FREEZE-RECORD.md` | `[EVIDENCE COMPLETE]` | Internal — lifecycle frozen |
| `BDC-FOUNDER-INPUT-CHECKLIST.md` | `[EVIDENCE COMPLETE]` | Internal — active pending founder inputs |
| `BDC-DOCUMENT-CONTROL-INDEX.md` | `[EVIDENCE COMPLETE]` | Internal — lifecycle frozen |
| `CLOSURE-RECORD.md` | `[EVIDENCE COMPLETE]` | Internal — lifecycle frozen |
| `REPOSITORY-GOVERNANCE-AUDIT.md` | `[EVIDENCE COMPLETE]` | Internal governance — current |
| `CORPORATE-KNOWLEDGE-MAP.md` | `[EVIDENCE COMPLETE]` | Institutional reference — current |
| `CONTROLLED-VOCABULARY.md` | `[EVIDENCE COMPLETE]` | Canonical vocabulary — current |
| `DOCUMENT-LIFECYCLE.md` | `[EVIDENCE COMPLETE]` | This document — current |
| `SINGLE-SOURCE-OF-TRUTH.md` | `[EVIDENCE COMPLETE]` | Precedence framework — current |
| `AI-AUTHORING-POLICY.md` | `[EVIDENCE COMPLETE]` | AI governance — current |
| `EVIDENCE-MAINTENANCE-GUIDE.md` | `[EVIDENCE COMPLETE]` | Evidence management — current |
| `PRODUCT-GOVERNANCE.md` | `[EVIDENCE COMPLETE]` | Product governance — current |
| `INSTITUTIONAL-CLOSURE.md` | `[EVIDENCE COMPLETE]` | Institutional closure — current |

### Commercial Assets

| Document | Current Stage | Notes |
|---|---|---|
| `pricing-framework.md` | `[COMMERCIAL READY]` | SOC 2 language correction required for lender use (REM-010) |
| `FOUNDER_REVENUE_COCKPIT.md` | `[INTERNAL REVIEW]` | Not commercial-ready — seeded data present (REM-004) |
| Sales kit (01–08) | `[COMMERCIAL READY]` | Ready for use in sales conversations |
| Close package | `[COMMERCIAL READY]` | Ready for enterprise use |
| Pilot offer (CUPE) | `[COMMERCIAL READY]` | Ready for use |
| Trust center (commercial) | `[COMMERCIAL READY]` | Ready for buyer use |
| `revenue-scenarios.md` | `[DRAFT]` | Numbers absent — not ready for any external use (REM-003) |

---

## Part 3 — Stage Gate Requirements

### Draft → Internal Review

- Document has been created with initial content
- At least one pass to identify obvious gaps, inconsistencies, or prohibited language

### Internal Review → Leadership Review

- Internal inconsistencies resolved or documented
- No prohibited language (see `CONTROLLED-VOCABULARY.md` Part 2)
- Evidence citations present for all major claims

### Leadership Review → Evidence Complete

- Aubert Nungisa (and Michel Nungisa where applicable) has reviewed and approved
- All evidence citations verified as pointing to existing repository artifacts
- All confidence labels (Verified / Demonstrated / Documented / Planned) confirmed as accurate
- Gap register updated with any remaining gaps

### Evidence Complete → Commercial Ready

- No claims that cannot be substantiated by cited evidence
- No deprecated language
- Legal entity name normalized to "Nzila Ventures Inc." in all corporate contexts
- Product maturity boundaries accurate and current
- Confidentiality level confirmed (buyer-facing materials must contain no internal financial estimates)

### Commercial Ready → Lender Ready

- All 6 Critical findings from REM-001 through REM-006 closed with documentary evidence
- All 7 High findings (REM-007 through REM-014) addressed
- No seeded pipeline data in any lender-facing document
- Founder investment figures replaced with verified declarations from accounting records
- SOC 2 language corrected (REM-010)
- Internal-certification labeling accurate (REM-014)
- Michel's complete, verified management profile consistent across all documents (REM-006)
- Board resolution authorizing the loan application executed (REM-018)

### Lender Ready → Archived

- Document has been superseded by a newer, better-evidenced version
- Original retained in the `historical-archive/` directory
- Successor document identified by name in the archived version's header

### Any Stage → Superseded

- A named successor document has been approved and is in use
- The superseded document's header must state: "SUPERSEDED BY: [filename] — [date]"

---

## Part 4 — Ownership and Approval Authority

| Role | Approval authority |
|---|---|
| Aubert Nungisa | All evidence-book documents; all BDC-prefixed documents; all lender-facing materials; commercial strategy |
| Michel Nungisa | Commercial materials (sales kit, outreach, close package, pricing); management profile |
| Accountant | Founder investment verification; financial statements; shareholder advance ledger |
| Legal counsel | IP assignment confirmation; board resolution; succession plan; corporate structure |
| SR&ED advisor | SR&ED claim documentation; advisor letter |
| Future agents | May not advance any document beyond its current stage without verified inputs from the above |

---

## Part 5 — Revision Policy

1. **All revisions to evidence-book documents must be traceable to a git commit with a descriptive commit message.**
2. **No revision may remove or replace a gap, finding, or evidence citation without replacing it with a verifiably better source.**
3. **Readiness verdicts may only be advanced when all requirements for the target stage have been met and documented.**
4. **Closures of open findings (REM-001 through REM-025) must be accompanied by a reference to the specific documentary evidence that closes them, committed in the same changeset.**
5. **No revision to the master dossier may be made without a corresponding revision to the affected section file.**
6. **Documents classified as "Internal stress-test — lifecycle frozen" must not be revised. If new findings emerge, they must be added to the remediation register as new items, not edits to existing stress-test documents.**
7. **Deprecated language (see `CONTROLLED-VOCABULARY.md` Part 2) may not be introduced in any revision.**

---

*This document governs the lifecycle of all documents in the BDC commercialization corpus. It does not govern engineering or operations documentation outside the `docs/business-plan/` scope.*
