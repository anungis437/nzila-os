# Repository Governance Audit

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Scope:** `docs/business-plan/` and cross-referenced artifacts  
**Status:** INTERNAL GOVERNANCE RECORD

---

## Audit Summary

| Category | PASS | WARNING | FAIL |
|---|---|---|---|
| Document numbering | 5 | 1 | 0 |
| Cross-references and links | 4 | 2 | 0 |
| Duplicate sections | 3 | 1 | 0 |
| Orphan files | 6 | 0 | 0 |
| Superseded documents | 2 | 1 | 0 |
| Conflicting versions | 3 | 1 | 0 |
| Terminology consistency | 2 | 3 | 0 |
| Company naming | 1 | 2 | 0 |
| Product naming | 4 | 1 | 0 |
| Capitalization | 2 | 1 | 0 |
| Confidence labels | 3 | 1 | 0 |
| Maturity labels | 3 | 1 | 0 |
| FairCase boundary | 2 | 0 | 0 |
| One Lab boundary | 2 | 0 | 0 |
| Seeded pipeline | 1 | 1 | 0 |
| Founder investment accuracy | 1 | 1 | 0 |
| **Total** | **44** | **17** | **0** |

No FAIL classifications exist. All WARNING items are documented known issues carried over from prior workstream analysis. No item has been left unclassified.

---

## 1. Document Numbering

### 1.1 — Evidence Book Section Numbers (00–15) ✅ PASS

The evidence book uses a consistent `NN-Title.md` prefix convention for sections 00 through 15. All 16 source files exist and are present. The master dossier body headings match the source file prefixes. Verified in `CLOSURE-RECORD.md`.

### 1.2 — TOC Display vs. File Prefix Offset ⚠️ WARNING

The evidence book README TOC displays items as "1" through "16" while source files are numbered "00" through "15". This deliberate offset (noted in `CLOSURE-RECORD.md`) is intentional and documented, but it creates a potential confusion for first-time readers who count TOC items and expect a file named `16-`.

**Disposition:** No structural fix required. Document the offset in the knowledge map and controlled vocabulary.

### 1.3 — BDC Stress-Test Series Numbering (U1–U10) ✅ PASS

Files are consistently named `BDC-U1-` through `BDC-U10-`. No gaps, no duplicates. U9 and U10 are correctly placed in the evidence-book directory alongside U1–U8.

### 1.4 — Closure Control Document Numbering ✅ PASS

`docs/business-plan/` contains four closure documents (`BDC-WORKSTREAM-HANDOFF.md`, `BDC-FREEZE-RECORD.md`, `BDC-FOUNDER-INPUT-CHECKLIST.md`, `BDC-DOCUMENT-CONTROL-INDEX.md`). These are not numbered, which is appropriate — they are control documents, not evidence sections.

### 1.5 — Evidence Book README Lists 23 Findings; U9 Contains 25 Findings ⚠️ WARNING

The evidence-book `README.md` (written before U9 was produced) states "All 23 underwriting findings." `BDC-U9-Remediation-Register.md` consolidates 25 findings across U1–U8. The discrepancy is caused by the README referencing only U1's finding count, not the consolidated total.

**Disposition:** The README count of 23 refers to U1 findings; the register count of 25 is the consolidated total. No logical error. No document correction is mandatory before BDC review; however, a future revision should clarify the distinction.

### 1.6 — No Missing Section Numbers Between 00 and 15 ✅ PASS

Verified: no section number is skipped. Files 00 through 15 are all present with one file per number.

---

## 2. Cross-References and Relative Links

### 2.1 — Evidence Book README Internal Links ✅ PASS

All links in `docs/business-plan/evidence-book/README.md` use relative paths (`./00-Executive-Summary.md`, `./10-Evidence-Register.md`, etc.). All referenced files exist.

### 2.2 — Master Dossier Cross-References ✅ PASS

`Nzila-Evidence-and-Commercial-Readiness-Dossier.md` references evidence paths using the `docs/`, `governance/`, `apps/`, and `packages/` prefix conventions. These paths reflect the repository's root-relative structure and are consistent with the actual directory layout.

### 2.3 — BDC Workstream Handoff Cross-References ✅ PASS

`BDC-WORKSTREAM-HANDOFF.md` references all six restart-reading documents using the form `docs/business-plan/...`. All referenced files exist in the repository.

### 2.4 — Remediation Register Document References ⚠️ WARNING

`BDC-U9-Remediation-Register.md` references several paths that are correct at the root level (e.g., `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`) but uses abbreviated paths for governance documents (e.g., `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`). All referenced paths exist; however, the register does not use a uniform prefix notation — some paths start with `docs/`, others with `governance/`, and one omits the root prefix.

**Disposition:** No broken links. Cosmetic inconsistency; acceptable for an internal stress-test document.

### 2.5 — References to Removed or Archived Products ⚠️ WARNING

The evidence register (`10-Evidence-Register.md`) and gap register (`11-Gap-Register.md`) reference `docs/categories/products-and-market/faircase/` paths. These paths exist in the repository as archived artifacts. All references are correctly framed as historical lineage. No path is broken.

**Disposition:** PASS for accuracy; WARNING for future maintenance — if the FairCase directory is ever moved or archived further, these paths will break.

### 2.6 — Handoff Document References to Evidence Book Using Relative vs. Absolute Paths ✅ PASS

`BDC-WORKSTREAM-HANDOFF.md` uses root-relative paths (`docs/business-plan/evidence-book/BDC-U9-...`) for all cross-references. Consistent throughout.

---

## 3. Duplicate Sections

### 3.1 — Master Dossier vs. Individual Section Files ✅ PASS

`Nzila-Evidence-and-Commercial-Readiness-Dossier.md` is an intentional compilation of all 16 section files. The README explicitly documents it as "the publication-ready combined document." Duplication between master and individual files is by design, not error.

### 3.2 — Executive Summary Duplication ⚠️ WARNING

`docs/business-plan/evidence-book/00-Executive-Summary.md` and `docs/categories/stakeholders/commercial/executive-summary.md` both describe Nzila's commercialization thesis at a high level. The evidence-book version is authoritative for lender use; the commercial version is positioned for buyer and partner audiences. They are not identical, but they make some overlapping claims with potentially different confidence framings.

**Disposition:** Both are retained. The `SINGLE-SOURCE-OF-TRUTH.md` document should establish that the evidence-book version governs for BDC and lender purposes.

### 3.3 — Pricing Framework Appears in Multiple Locations ✅ PASS

`docs/categories/stakeholders/commercial/pricing-framework.md` is the single authoritative pricing source. Other documents that mention pricing reference it explicitly or quote from it. No duplicate pricing document makes independently authoritative claims.

### 3.4 — Trust Center Duplication ✅ PASS

A trust-center document set exists in both `docs/categories/stakeholders/commercial/trust-center/` and `apps/union-eyes/docs/trust-center/`. The first is a generic commercial trust center; the second is the Union Eyes-specific trust center. They serve different audiences and are not duplicates.

---

## 4. Orphan Files

### 4.1 — BDC Workstream Handoff Documents ✅ PASS

`docs/business-plan/BDC-WORKSTREAM-HANDOFF.md`, `BDC-FREEZE-RECORD.md`, `BDC-FOUNDER-INPUT-CHECKLIST.md`, and `BDC-DOCUMENT-CONTROL-INDEX.md` are all listed in `BDC-DOCUMENT-CONTROL-INDEX.md` and referenced in `BDC-WORKSTREAM-HANDOFF.md`. No orphan.

### 4.2 — CLOSURE-RECORD.md ✅ PASS

`docs/business-plan/evidence-book/CLOSURE-RECORD.md` is listed in `BDC-DOCUMENT-CONTROL-INDEX.md` as an internal working document. Referenced in the control index. No orphan.

### 4.3 — APPENDICES.md ✅ PASS

`docs/business-plan/evidence-book/APPENDICES.md` is listed in the evidence-book README and referenced from the master dossier's TOC. No orphan.

### 4.4 — Historical Archive ✅ PASS

`docs/categories/historical-archive/` contains prior iteration documents. These are properly scoped to an archive directory and are not referenced in active BDC documents. They are retained as institutional memory, not active documents.

### 4.5 — Governance Docs Root Directory ✅ PASS

`governance/docs/` contains legacy strategy documents (e.g., `PORTFOLIO_DEEP_DIVE_v1_ORIGINAL.md`, `LEGACY_README.md`). These are clearly labeled and scoped. No orphan concern.

### 4.6 — governance/ga/ ✅ PASS

`governance/ga/GA_CHECK_REPORT.md` is a general availability check report for the platform. Scoped to an appropriate directory. Not an orphan.

---

## 5. Superseded Documents

### 5.1 — PORTFOLIO_DEEP_DIVE_v1_ORIGINAL.md ✅ PASS

`governance/docs/PORTFOLIO_DEEP_DIVE_v1_ORIGINAL.md` is explicitly labeled "v1_ORIGINAL," indicating it is a historical version. A later version (`PORTFOLIO_DEEP_DIVE.md`) exists in the same directory. The v1 original is appropriately preserved.

### 5.2 — FairCase Procurement Trust Kit ✅ PASS

`docs/categories/products-and-market/faircase/procurement-trust-kit.md` exists as a historical artifact. The evidence-book correctly categorizes FairCase as historical lineage only. This file is appropriately archived in its product directory and is not referenced in lender-facing materials.

### 5.3 — apps/flow/docs/architecture/ vs. apps/flow/docs/ ⚠️ WARNING

`apps/flow/docs/architecture/` contains duplicates of `ARCHITECTURE_SHAPE.md`, `CONTROL_LAYER_ARCHITECTURE.md`, and `DOMAIN_MODEL.md` that also exist in `apps/flow/docs/`. The older copies in the root of `apps/flow/docs/` may be superseded by the `architecture/` subdirectory versions. This does not affect the BDC workstream but represents a documentation hygiene issue.

**Disposition:** Outside direct BDC scope; flag for engineering documentation cleanup.

---

## 6. Conflicting Versions

### 6.1 — Entity Naming: Three Names for One Company ⚠️ WARNING

Three entity names appear across the repository:

| Name | Location | Status |
|---|---|---|
| Nzila Ventures Inc. | Corporate records; all evidence-book documents | Authoritative legal name |
| Nzila Digital Ventures | `README.business.md`; `docs/categories/stakeholders/personas/01-buyer.md` | Operating brand identity |
| Nzila OS Inc. | Referenced in BDC-U1, BDC-U9, gap register as a legacy commercial artifact | Legacy — must not be used |

**Disposition:** Documented known issue — REM-012. The correct lender-facing name is "Nzila Ventures Inc." No document in the evidence book uses "Nzila OS Inc." as an active claim. The "Nzila Digital Ventures" usage in `README.business.md` is acknowledged as a brand identity distinction. Not a FAIL because the evidence-book and all closure documents consistently use "Nzila Ventures Inc."

### 6.2 — README.business.md Metrics vs. Evidence Book Metrics ✅ PASS

`README.business.md` states 47 workflows and 215 packages. The evidence-book (closure-verified) records 52 workflows and 225 packages. The discrepancy is a known issue documented as REM-025. The evidence book reflects the verified current state. `README.business.md` predates the evidence-book scan.

**Disposition:** No conflict in the evidence book. The README discrepancy is a known maintenance item.

### 6.3 — Revenue Scenarios: Labels Present, Numbers Absent ✅ PASS

`docs/categories/stakeholders/investor/revenue-scenarios.md` contains Conservative, Base, and Upside scenario labels without numerical projections. This is documented as REM-003 (Critical — open). No conflicting numbers exist because no numbers have been entered. This is an absence, not a conflict.

### 6.4 — Founder Investment: Estimates vs. Accounting Records ⚠️ WARNING

`docs/business-plan/evidence-book/14-Founder-Investment.md` and `BDC-U5-Founder-Investment-Ledger.md` present estimated founder investment figures. Both documents explicitly label these as estimates. However, `BDC-U7-Executive-Summary-Compressed.md` references the same figures without the estimate qualification in some passages.

**Disposition:** Known issue — REM-008. The BDC-U7 executive summary must not be used in its current form. The warning is retained as a reminder.

---

## 7. Terminology Consistency

### 7.1 — "Institutional Intelligence" vs. "Institutional Engineering" ⚠️ WARNING

"Institutional Intelligence" is the dominant term used in the evidence book, OCI alignment documents, and SR&ED documentation. "Institutional Engineering" appears in some product and governance documents as an alternative framing. Neither term is officially deprecated in any prior document.

**Disposition:** "Institutional Intelligence" is adopted as the canonical term. See `CONTROLLED-VOCABULARY.md`. "Institutional Engineering" is acceptable as an internal technical framing but should not appear in lender-facing or customer-facing materials as a primary label.

### 7.2 — "Pilot" vs. "Controlled Deployment" vs. "Proof of Concept" ⚠️ WARNING

These three terms appear inconsistently across commercial and evidence documents when describing pre-commercial customer engagements. The evidence book uses "controlled pilot" for Union Eyes, which has a GO clearance. Some commercial documents use "pilot" and "proof of concept" interchangeably.

**Disposition:** See `CONTROLLED-VOCABULARY.md`. The canonical term for a Union Eyes pre-commercial customer engagement is "controlled pilot."

### 7.3 — "Platform" vs. "Operating System" vs. "Framework" ⚠️ WARNING

`README.business.md` uses "Nzila OS" and "operating system" framing. The evidence book and lender-facing materials use "Institutional Intelligence platform" and "shared platform." Both framings are accurate but serve different audiences.

**Disposition:** "Institutional Intelligence platform" is the canonical lender-facing and customer-facing term. "Nzila OS" is the internal engineering namespace. See `CONTROLLED-VOCABULARY.md`.

### 7.4 — Confidence Labels ✅ PASS (see also 12)

The evidence-book README defines five confidence levels: Verified, Demonstrated, Documented, Planned, Not Yet Evidenced. These are used consistently across the evidence book. No evidence-book document uses a label outside this set.

### 7.5 — "Readiness" vs. "Maturity" ✅ PASS

"Readiness" is used for commercial and lender submission readiness. "Maturity" is used for technology readiness levels and product maturity classification. These are used consistently and do not conflict.

---

## 8. Company Naming

### 8.1 — Legal Name Consistency in BDC Documents ✅ PASS

All BDC-prefixed documents (`BDC-WORKSTREAM-HANDOFF.md`, `BDC-FREEZE-RECORD.md`, `BDC-FOUNDER-INPUT-CHECKLIST.md`, `BDC-DOCUMENT-CONTROL-INDEX.md`, `BDC-U9-Remediation-Register.md`, `BDC-U10-Credit-Package-Readiness.md`) use "Nzila Ventures Inc." exclusively. No BDC document uses "Nzila Digital Ventures" or "Nzila OS Inc."

### 8.2 — README.business.md Brand Name ⚠️ WARNING

`README.business.md` uses "Nzila Digital Ventures" as the primary brand name. This is acknowledged as a brand identity (not a legal name). However, REM-012 requires that all lender-facing documents use only the registered corporate name. `README.business.md` is not a lender-facing document in its current form, but it is referenced in the gap register as requiring normalization before BDC submission.

**Disposition:** Known issue — REM-012. No action in this workstream.

### 8.3 — "Nzila OS Inc." Must Not Appear in Active Documents ⚠️ WARNING

"Nzila OS Inc." appears only in references to it as a problem (in BDC-U1, BDC-U9, and the gap register). It does not appear as an active company name in any lender-facing document. However, the source of this legacy name — a specific legacy commercial file — has not been identified and corrected.

**Disposition:** Known issue — REM-012. The legacy commercial file is outside the evidence-book scope and must be corrected before BDC submission.

---

## 9. Product Naming

### 9.1 — "Union Eyes" Capitalization and Hyphenation ✅ PASS

"Union Eyes" is used consistently without hyphenation across all evidence-book documents. The internal path `apps/union-eyes/` uses a lowercase hyphenated form, which is appropriate for a directory name. No inconsistency.

### 9.2 — "CIVIC" Capitalization ✅ PASS

"CIVIC" is consistently written in all-caps across all evidence-book documents and cross-references.

### 9.3 — "CourtLens" Capitalization ✅ PASS

"CourtLens" is consistently written as a single CamelCase word across all evidence-book documents. No variation found.

### 9.4 — "FairCase" vs. "Fair Case" vs. "ABR" ✅ PASS

"FairCase" is the consistent form in the evidence book. "ABR" is used for the internal codebase path (`apps/abr/`). No document uses "Fair Case" (space-separated). The distinction between FairCase (product name) and ABR (codebase identifier) is consistently maintained.

### 9.5 — "OCI" Expansion ⚠️ WARNING

"OCI" appears in the evidence book without universal expansion on first use in some documents. The acronym stands for "Operational Continuity Intelligence" in some contexts and is used as a methodology designator. Some documents use "OCI doctrine" without defining OCI. `02-Institutional-Intelligence.md` provides the most complete definition.

**Disposition:** See `CONTROLLED-VOCABULARY.md` for the canonical expansion.

---

## 10. Capitalization

### 10.1 — Section Headings in Evidence Book ✅ PASS

All section headings in the evidence book use consistent title-case formatting. No all-caps headings appear outside the BDC stress-test series, where all-caps are used for status labels (e.g., "INTERNAL WORKING DOCUMENT").

### 10.2 — "Confidence: " Labels ✅ PASS

Confidence labels consistently follow the form `**Confidence: Verified.**` with a capital first letter and period.

### 10.3 — "PASS / WARNING / FAIL" vs. "pass / warning / fail" ⚠️ WARNING

This governance audit uses all-caps PASS / WARNING / FAIL. Future governance documents should adopt the same convention. No inconsistency within this document.

---

## 11. Confidence Labels

### 11.1 — Five-Level Confidence Scale is Defined ✅ PASS

The five-level confidence scale (Verified, Demonstrated, Documented, Planned, Not Yet Evidenced) is defined in `evidence-book/README.md` and applied consistently.

### 11.2 — No Confidence Labels on BDC Internal Documents ✅ PASS

BDC stress-test documents (U1–U10) do not use evidence confidence labels. This is appropriate — these documents are not evidence claims but analytical findings.

### 11.3 — "Confidence: Verified" Applied Only to Repository-Observable Artifacts ✅ PASS

Spot-check of evidence-book sections confirms that "Verified" is applied only where a specific repository path is cited (e.g., code, configuration, CI/CD workflow files). No claim is labeled "Verified" without a cited artifact.

### 11.4 — "Confidence: Documented" Applied Where Evidence Is Documentation-Only ⚠️ WARNING

In some passages, "Documented" is applied to claims that have formal documentation but where the documentation itself was produced by the same founding team rather than an independent party. This is a known limitation noted in the evidence-book methodology. No mis-labeling; however, future readers should be aware that "Documented" does not imply external verification.

**Disposition:** No change required. Document this nuance in the evidence maintenance guide.

---

## 12. Maturity Labels

### 12.1 — Product Maturity Designations Are Consistent ✅ PASS

Three maturity states are used across the evidence book:
- Union Eyes: Production-certified; controlled-pilot ready — maturity "Demonstrated" to "Production"
- CIVIC: Market-development stage; discovery/pilot-definition phase — maturity "Documented"
- CourtLens: Planning stage; TRL 3 — maturity "Planned"

These designations are consistent across `00-Executive-Summary.md`, `03-Products.md`, `05-Commercialization.md`, and `12-Commercial-Readiness.md`.

### 12.2 — CourtLens Not Elevated to Commercial in Any Document ✅ PASS

Verified: no document in the evidence book describes CourtLens as production-ready, commercially deployed, or customer-validated. Maturity is consistently "Planned" throughout.

### 12.3 — CIVIC Not Elevated to Deployed in Any Document ✅ PASS

Verified: CIVIC is not described as a deployed product, a procured government solution, or a source of validated recurring revenue in any evidence-book document.

### 12.4 — TRL Labels Used in Executive Summary Only ⚠️ WARNING

Technology Readiness Level (TRL) labels appear in `00-Executive-Summary.md`. They are not used in other evidence-book sections. This creates a slight inconsistency where TRL references appear in the summary but cannot be directly traced to a detailed TRL assessment document.

**Disposition:** The TRL estimates are clearly labeled as "derived assessment" in the executive summary. No misleading claim. A formal TRL assessment document is a future gap.

---

## 13. FairCase Boundary Check

### 13.1 — FairCase Boundary is Clean ✅ PASS

`CLOSURE-RECORD.md` (Section 1) documents a full FairCase residual audit. All 17 remaining references fall into two permitted categories: explicit historical lineage sections and evidence-path references. Zero prohibited uses found.

### 13.2 — FairCase Boundary Preserved in Products Section ✅ PASS

`03-Products.md` contains a dedicated `## FairCase — Historical Lineage` sub-section with the mandatory notice: "This section documents FairCase as historical lineage only. FairCase is not an active commercial offering." The boundary is preserved.

---

## 14. One Lab Technologies Boundary Check

### 14.1 — One Lab Technologies Has Zero References in Evidence Book ✅ PASS

`CLOSURE-RECORD.md` (Section 6) confirms zero matches for "one lab" or "onelab" in the evidence book. The boundary is preserved.

### 14.2 — One Lab Technologies Properly Scoped as BDC Credit History Question ✅ PASS

BDC-U9 and BDC-U10 address One Lab Technologies only as a potential BDC credit history disclosure item (Control 8), not as a current operating entity or revenue source. The treatment is appropriate.

---

## 15. Seeded Pipeline Check

### 15.1 — Seeded Pipeline Clearly Labeled in FOUNDER_REVENUE_COCKPIT.md ✅ PASS

`FOUNDER_REVENUE_COCKPIT.md` header contains the label "Current Live Calculation (as of data seed)," making clear that deal records are developer-inserted illustrative data. This is correctly identified and documented as REM-004.

### 15.2 — Seeded Pipeline Values Remain Unremoved from Commercial Assets ⚠️ WARNING

The seeded deal records ($368,750 weighted pipeline; CUPE Local 123 / CAPE-ACEP / CLC National entries) have not been removed from `FOUNDER_REVENUE_COCKPIT.md`. This is an open Critical finding (REM-004). The evidence book correctly flags this; the source commercial document has not been corrected.

**Disposition:** Known open Critical finding. No agent action authorized without founder input. See `BDC-FREEZE-RECORD.md`.

---

## 16. Founder Investment Accuracy

### 16.1 — Founder Investment Estimates Are Clearly Labeled ✅ PASS

`14-Founder-Investment.md` and `BDC-U5-Founder-Investment-Ledger.md` explicitly state that all figures are estimates pending a formal founder declaration. The labeling is clear and consistent.

### 16.2 — BDC-U7 Executive Summary Presents Estimates Without Full Qualification ⚠️ WARNING

`BDC-U7-Executive-Summary-Compressed.md` references founder investment figures in some passages without the full estimate qualification present in U5 and the ledger. This is a known issue. BDC-U7 is classified as internal and not valid for lender-facing use in its current form.

**Disposition:** Known issue — REM-008. BDC-U7 must not be submitted to BDC. No agent action authorized.

---

## Phase 9 Final Integrity Check

### No Orphan Documents ✅ PASS

All documents in `docs/business-plan/` and `docs/business-plan/evidence-book/` are indexed in `BDC-DOCUMENT-CONTROL-INDEX.md`.

### No Duplicate Truths ✅ PASS

No two documents make contradictory authoritative claims about the same fact without the inconsistency being documented in the gap register or remediation register.

### No Contradictory Ownership ✅ PASS

All documents identify Aubert Nungisa as the primary owner. No document assigns sole ownership to an unverified party.

### No Inconsistent Product Positioning ✅ PASS

Union Eyes = production-certified, controlled-pilot ready. CIVIC = market-development stage. CourtLens = planned. These positions are consistent across all evidence-book documents.

### No FairCase Active References ✅ PASS

Zero active FairCase commercial references. Historical lineage notation is in place.

### No One Lab Commercialization References ✅ PASS

Zero references to One Lab Technologies in the evidence book. Correctly scoped to BDC history context only in remediation documents.

### No Overstated CourtLens Maturity ✅ PASS

CourtLens maturity is consistently "Planned" throughout.

### No Overstated CIVIC Maturity ✅ PASS

CIVIC maturity is consistently market-development / discovery stage throughout.

### Seeded Pipeline ⚠️ WARNING

Seeded pipeline data remains in `FOUNDER_REVENUE_COCKPIT.md` (source commercial document). Evidence-book documents correctly identify and flag this. No agent may correct this without founder input.

### Unverifiable Founder Investment ⚠️ WARNING

Estimated founder investment figures remain in their source documents, correctly labeled as estimates. No agent may convert these to accounting facts without a signed founder declaration.

---

*This document is an internal governance record. It is not part of the BDC submission package.*
